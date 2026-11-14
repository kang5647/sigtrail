import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { buildInvestigation } from '../src/investigation.mjs';
import { analyzeCohorts, canonicalJSON } from '../public/investigate.mjs';

const source = JSON.parse(gunzipSync(await readFile(new URL('../public/data/comparison-source.json.gz', import.meta.url))));
const data = buildInvestigation(source);
const clone = () => structuredClone(source);
function directEntry(s) {
  for (const trace of s.periods[0].traces) for (const entry of trace.receipts) {
    if (entry.receipt.receiver_id === 'v1.signer' && entry.receipt.receipt?.Action?.actions.some(action => action.FunctionCall?.method_name === 'sign')) return { trace, entry };
  }
  throw Error('Fixture has no direct sign receipt');
}
const setArgs = (entry, text) => { entry.receipt.receipt.Action.actions.find(action => action.FunctionCall?.method_name === 'sign').FunctionCall.args = Buffer.from(text).toString('base64'); };

test('complete raw cohorts reproduce the receipt/input reversal and every observed argument is retained', () => {
  const receipts = analyzeCohorts(data, { lens: 'receipts' });
  assert.deepEqual(receipts.periods.map(p => p.requestCount), [615, 600]);
  assert.deepEqual(receipts.periods.map(p => p.inputCount), [567, 574]);
  assert.deepEqual(receipts.periods.map(p => p.repeatExcess), [48, 26]);
  assert.deepEqual(receipts.periods.map(p => p.accountCount), [12, 13]);
  assert.equal(receipts.change.absolute, -15);
  assert.equal(receipts.change.relative, -15 / 615);
  const inputs = analyzeCohorts(data, { lens: 'inputs' });
  assert.equal(inputs.change.absolute, 7);
  assert.equal(inputs.change.relative, 7 / 567);
  assert.equal(data.periods.flatMap(p => p.rows).length, 1215);
  assert.ok(data.periods.flatMap(p => p.rows).every(r => r.inputId && r.inputIds.length === 1 && r.signActionCount === 1));
  assert.deepEqual(data.periods.map(p => p.indexedParents), [1295, 1253]);
  for (const period of data.periods) for (const row of period.rows) {
    const input = data.inputs[row.inputId];
    assert.equal(input.id, createHash('sha256').update(`${row.account}\n${input.canonicalArgs}`).digest('hex'));
    assert.equal(row.sourceTrace.parentHash, row.parentHash);
    assert.match(row.sourceTrace.sha256, /^[0-9a-f]{64}$/);
  }
});

test('direction depends on the selected matched parent-time exposure, not a forced robust growth claim', () => {
  const expected = {
    hour: [[615, 600], [567, 574], [48, 26], [12, 13]],
    first15: [[157, 125], [139, 121], [18, 4], [11, 11]],
    first30: [[306, 242], [283, 235], [23, 7], [12, 11]],
    last30: [[309, 358], [284, 339], [25, 19], [11, 11]],
  };
  for (const [window, [requests, inputs, excess, accounts]] of Object.entries(expected)) {
    for (const lens of ['receipts', 'inputs']) {
      const result = analyzeCohorts(data, { lens, window });
      assert.deepEqual(result.periods.map(p => p.requestCount), requests);
      assert.deepEqual(result.periods.map(p => p.inputCount), inputs);
      assert.deepEqual(result.periods.map(p => p.repeatExcess), excess);
      assert.deepEqual(result.periods.map(p => p.accountCount), accounts);
      const counts = lens === 'receipts' ? requests : inputs;
      assert.deepEqual(result.periods.map(p => p.metricCount), counts);
      assert.equal(result.change.relative, (counts[1] - counts[0]) / counts[0]);
    }
  }
});

test('account filtering preserves exact receipts and input groups within each period', () => {
  for (const [account, requests, inputs] of [
    ['omni.bridge.near', [243, 301], [243, 299]],
    ['zcash-connector.bridge.near', [104, 54], [57, 30]],
    ['fast-auth.near', [92, 105], [91, 105]],
    ['tx-bench.near', [24, 24], [24, 24]],
    ...['kernel-near', 'kernel-usdc', 'kernel-usdt', 'kernel-zec'].map(name => [`${name}.meteor-vaults.near`, [5, 5], [5, 5]]),
    ['62e1e3be3df663f0563c4ef48233d42ec988e6d9.aurora', [9, 1], [9, 1]],
    ['33f976ce1e7019fc56060f9e911f9b47b9c86dcd2cff7e022523619466ccc4bb', [6, 0], [6, 0]],
    ['6s5b8.sputnik-dao.near', [2, 0], [2, 0]],
    ['gimbal_dex.near', [0, 1], [0, 1]],
    ['ca7c5c6488281e177bcd442f1f4ccd11d1195bf921c7d9e2d58f6b91710133e9', [0, 1], [0, 1]],
    ['07e5b6ed0cb5d393dce98464a6fc8992bbe65d81c31d1266be408a3f1313857f', [0, 1], [0, 1]],
  ]) {
    const result = analyzeCohorts(data, { account, lens: 'inputs' });
    assert.deepEqual(result.periods.map(p => p.requestCount), requests);
    assert.deepEqual(result.periods.map(p => p.inputCount), inputs);
    assert.ok(result.periods.every(p => p.rows.every(row => row.account === account)));
  }
});

test('same-parent Already signed failures are exact joins, while some repeat inputs have no failure', () => {
  const result = analyzeCohorts(data, {});
  for (const [i, expectedFailures] of [47, 24].entries()) {
    const groups = result.periods[i].groups;
    const repeatedZcash = groups.filter(g => g.account === 'zcash-connector.bridge.near' && g.repeatExcess);
    assert.equal(repeatedZcash.length, expectedFailures);
    assert.ok(repeatedZcash.every(g => g.requestCount === 2 && g.repeatExcess === 1 && g.callbackFailureCount === 1));
    for (const group of repeatedZcash) {
      assert.equal(group.rows[0].callbackFailures.length, 0);
      assert.equal(group.rows[1].callbackFailures.length, 1);
      assert.match(JSON.stringify(group.rows[1].callbackFailures[0].error), /Already signed/);
      assert.equal(group.rows[1].callbackFailures[0].receiverId, 'zcash-connector.bridge.near');
    }
    const neutralRepeats = groups.filter(g => g.repeatExcess && !g.callbackFailureCount);
    assert.equal(neutralRepeats.length, i === 0 ? 1 : 2);
    assert.ok(neutralRepeats.every(g => g.rows.every(row => row.callbackFailures.length === 0)));
  }
});

test('canonicalization ignores object key order, preserves array order and types, and raw grouping agrees on these archives', () => {
  assert.equal(canonicalJSON({ b: { z: 3, a: 2 }, a: [1, '2'] }), canonicalJSON({ a: [1, '2'], b: { a: 2, z: 3 } }));
  assert.notEqual(canonicalJSON({ a: [1, 2] }), canonicalJSON({ a: [2, 1] }));
  assert.notEqual(canonicalJSON({ a: 1 }), canonicalJSON({ a: '1' }));
  for (const [i, period] of source.periods.entries()) {
    const raw = new Set();
    for (const trace of period.traces) for (const entry of trace.receipts) {
      const r = entry.receipt;
      if (r.receiver_id !== 'v1.signer') continue;
      for (const action of r.receipt?.Action?.actions || []) if (action.FunctionCall?.method_name === 'sign') raw.add(`${r.predecessor_id}\n${action.FunctionCall.args}`);
    }
    assert.equal(raw.size, [567, 574][i]);
  }
});

test('grouping supports multiple sign inputs in one receipt without changing request receipt count', () => {
  const s = clone(), { entry } = directEntry(s);
  const call = structuredClone(entry.receipt.receipt.Action.actions.find(a => a.FunctionCall?.method_name === 'sign'));
  entry.receipt.receipt.Action.actions.push(call);
  const identical = analyzeCohorts(buildInvestigation(s), {});
  assert.equal(identical.periods[0].requestCount, 615);
  assert.equal(identical.periods[0].inputCount, 567);
  call.FunctionCall.args = Buffer.from(JSON.stringify({ request: { payload: [0, 1], path: 'test-distinct-input', key_version: 0 } })).toString('base64');
  const changed = analyzeCohorts(buildInvestigation(s), {});
  assert.equal(changed.periods[0].requestCount, 615);
  assert.equal(changed.periods[0].inputCount, 568);
  assert.equal(changed.periods[0].inputAssignments, 616);
  const multi = changed.periods[0].rows.find(r => r.receiptId === entry.receipt.receipt_id);
  assert.equal(multi.inputId, null);
  assert.equal(multi.inputIds.length, 2);
});

test('malformed, missing or ambiguous arguments and duplicate receipt evidence fail rather than disappearing', () => {
  for (const text of ['{"request":{"a":1,"a":2}}', '{"request":{"a":1,"\\u0061":2}}', 'null', '[1,2]', '{"request":9007199254740993}', '{bad']) {
    const s = clone(); setArgs(directEntry(s).entry, text);
    assert.throws(() => buildInvestigation(s), /JSON|arguments|number/);
  }
  const missing = clone(); delete directEntry(missing).entry.receipt.receipt.Action.actions[0].FunctionCall.args;
  assert.throws(() => buildInvestigation(missing), /arguments/);
  const duplicate = clone(), { trace, entry } = directEntry(duplicate); trace.receipts.push(structuredClone(entry));
  assert.throws(() => buildInvestigation(duplicate), /receipt graph IDs/);
  const mismatch = clone(); mismatch.periods[0].traces[0].transaction.hash = 'wrong';
  assert.throws(() => buildInvestigation(mismatch), /hydration/);
});

test('parent timestamps define half-open windows even if receipt creation is outside them', () => {
  const modified = structuredClone(data);
  for (const period of modified.periods) {
    const start = BigInt(Date.parse(period.startUtc)) * 1_000_000n, first = period.rows[0];
    period.rows = [0, 900, 1800, 3599, 3600].map((seconds, i) => ({ ...first, receiptId: `boundary-${i}`, parentTimestampNs: String(start + BigInt(seconds) * 1_000_000_000n), createdTimestampNs: String(start + 7200n * 1_000_000_000n) }));
  }
  assert.deepEqual(analyzeCohorts(modified, { window: 'hour' }).periods.map(p => p.requestCount), [4, 4]);
  assert.deepEqual(analyzeCohorts(modified, { window: 'first15' }).periods.map(p => p.requestCount), [1, 1]);
  assert.deepEqual(analyzeCohorts(modified, { window: 'first30' }).periods.map(p => p.requestCount), [2, 2]);
  assert.deepEqual(analyzeCohorts(modified, { window: 'last30' }).periods.map(p => p.requestCount), [2, 2]);
});

test('empty denominators and unavailable evidence remain explicit, and invalid controls fail', () => {
  const empty = analyzeCohorts(data, { account: 'absent.near' });
  assert.equal(empty.change.absolute, 0); assert.equal(empty.change.relative, null); assert.equal(empty.change.zeroDenominator, true);
  assert.deepEqual(empty.periods.map(p => p.rows), [[], []]);
  const unavailable = structuredClone(data); unavailable.periods[0].available = false;
  assert.equal(analyzeCohorts(unavailable, {}).available, false);
  assert.equal(analyzeCohorts(unavailable, {}).change.relative, null);
  assert.equal(analyzeCohorts(unavailable, {}).change.absolute, null);
  assert.throws(() => analyzeCohorts(data, { window: 'all' }), /Unknown/);
  assert.throws(() => analyzeCohorts(data, { lens: 'users' }), /Unknown/);
});
