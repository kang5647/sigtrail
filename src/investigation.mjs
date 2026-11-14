import { createHash } from 'node:crypto';
import { rebuildComparison } from './comparison.mjs';
import { canonicalJSON } from '../public/investigate.mjs';

const hash = text => createHash('sha256').update(text).digest('hex');
const identity = (value, label) => {
  if (typeof value !== 'string' || !value) throw Error(`Missing ${label}`);
  return value;
};
const timestamp = (value, label) => {
  const text = String(value);
  if (!/^\d{18,20}$/.test(text)) throw Error(`Invalid ${label}`);
  return text;
};
function parseArgs(encoded) {
  if (typeof encoded !== 'string' || !encoded || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw Error('Missing or malformed base64 sign arguments');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.toString('base64') !== encoded) throw Error('Malformed base64 sign arguments');
  let args, text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); args = JSON.parse(text); } catch { throw Error('Malformed JSON sign arguments'); }
  // JSON.parse accepts duplicate object keys by keeping the last value. Reject
  // that ambiguous representation rather than silently merging signing inputs.
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g);
  let cursor = 0;
  function checkValue() {
    const token = tokens[cursor++];
    if (token === '{') {
      const keys = new Set();
      if (tokens[cursor] === '}') { cursor++; return; }
      while (true) {
        const key = JSON.parse(tokens[cursor++]);
        if (keys.has(key)) throw Error('Duplicate JSON object key in sign arguments');
        keys.add(key); cursor++; checkValue();
        if (tokens[cursor++] === '}') break;
      }
    } else if (token === '[') {
      if (tokens[cursor] === ']') { cursor++; return; }
      while (true) { checkValue(); if (tokens[cursor++] === ']') break; }
    }
  }
  checkValue();
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw Error('Sign arguments must be a JSON object');
  return canonicalJSON(args);
}

export function buildInvestigation(source) {
  // Reuse the established parent population, UTC boundary, protocol, exact fee
  // outcome and emitted-receipt graph checks before extracting any research rows.
  rebuildComparison(source);
  const inputs = Object.create(null);
  const periods = source.periods.map((period, periodIndex) => {
    const indexed = new Map();
    for (const page of period.indexPages) for (const row of page.account_txs) {
      const earlier = indexed.get(row.transaction_hash);
      if (earlier && JSON.stringify(earlier) !== JSON.stringify(row)) throw Error('Conflicting indexed parent');
      indexed.set(row.transaction_hash, row);
    }
    const seen = new Set(), rows = [];
    for (const [traceIndex, trace] of period.traces.entries()) {
      const parentHash = identity(trace.transaction.hash, 'parent transaction hash');
      const parent = indexed.get(parentHash);
      if (!parent) throw Error('Parent missing from matching index');
      const parentTimestampNs = timestamp(parent.tx_block_timestamp, 'parent inclusion timestamp');
      const callbackFailures = trace.receipts.flatMap(entry => {
        const error = entry.execution_outcome.outcome.status?.Failure;
        if (!error) return [];
        const receipt = entry.receipt;
        const methods = receipt.receipt?.Action?.actions?.flatMap(action => action?.FunctionCall ? [action.FunctionCall.method_name] : []) || [];
        return [{ receiptId: identity(receipt.receipt_id, 'failure receipt ID'), receiverId: identity(receipt.receiver_id, 'failure receiver'), method: methods.join(', ') || null, error }];
      });
      const sourceTrace = { archive: 'comparison-source.json.gz', jsonPointer: `/periods/${periodIndex}/traces/${traceIndex}`, parentHash, sha256: hash(JSON.stringify(trace)), hashEncoding: 'UTF-8 JSON.stringify of parsed trace' };
      for (const entry of trace.receipts) {
        const receipt = entry.receipt;
        if (receipt.receiver_id !== 'v1.signer') continue;
        const calls = (receipt.receipt?.Action?.actions || []).flatMap(action => action?.FunctionCall?.method_name === 'sign' ? [action.FunctionCall] : []);
        if (!calls.length) continue;
        const receiptId = identity(receipt.receipt_id, 'request receipt ID');
        if (seen.has(receiptId)) throw Error('Duplicate direct request receipt');
        seen.add(receiptId);
        const account = identity(receipt.predecessor_id, 'initiating account');
        const inputIds = [...new Set(calls.map(call => {
          const canonicalArgs = parseArgs(call.args), id = hash(`${account}\n${canonicalArgs}`);
          if (inputs[id] && (inputs[id].account !== account || inputs[id].canonicalArgs !== canonicalArgs)) throw Error('Conflicting signing input identity');
          inputs[id] = { id, account, canonicalArgs };
          return id;
        }))];
        rows.push({ receiptId, parentHash, account, parentTimestampNs,
          createdTimestampNs: timestamp(receipt.block_timestamp, 'receipt creation timestamp'),
          executedTimestampNs: timestamp(entry.execution_outcome.block_timestamp, 'receipt execution timestamp'),
          inputId: inputIds.length === 1 ? inputIds[0] : null, inputIds, signActionCount: calls.length,
          callbackFailures, sourceTrace });
      }
    }
    return { date: period.date, startUtc: period.startUtc, endUtc: period.endUtc, fetchedAtUtc: source.fetchedAtUtc,
      indexedParents: indexed.size, parentBlockRange: period.parentBlockRange, available: true, rows };
  });
  return { schemaVersion: 1, fetchedAtUtc: source.fetchedAtUtc, sourceMode: 'saved', sources: source.sources,
    sourceArchive: { filename: 'comparison-source.json.gz', sha256: null },
    metadata: { selection: source.selection, cohortMembership: 'Parent inclusion timestamp from the matching archived index; lower inclusive and upper exclusive.',
      missingArgs: 0, duplicateJSONKeys: 'Rejected', sourceArchiveSeal: 'Set by the rebuild from the validated compressed archive bytes.' },
    canonicalization: 'SHA-256(account + newline + recursively key-sorted JSON of decoded exact sign args); array order and JSON value types preserved; no field, address, payload or method alias normalization.',
    countUnits: { receipts: 'Distinct direct sign receipt IDs', inputs: 'Distinct account plus exact canonical signing-arguments groups within each selected cohort', repeatExcess: 'Receipt-to-input assignments minus distinct inputs. Multiple distinct sign inputs in one receipt remain one request receipt.' },
    periods, inputs };
}
