import { createHash } from 'node:crypto';

// A separate full-population ledger for the finding. No top-eight truncation.
export function findingEvidence(record) {
  const accounts = new Map(), signs = [], categories = new Map();
  const ids = new Set();
  for (const r of record.receipts) {
    if (ids.has(r.id)) throw new Error('Duplicate finding receipt');
    ids.add(r.id);
    const methods = r.actions.filter(a => a.action === 'FUNCTION_CALL').map(a => a.method);
    for (const method of methods) categories.set(method, (categories.get(method) || 0) + 1);
    if (!methods.includes('sign')) continue;
    accounts.set(r.predecessor_account_id, (accounts.get(r.predecessor_account_id) || 0) + 1);
    signs.push([r.id, r.transaction_hash, r.predecessor_account_id, r.block_timestamp]);
  }
  return { scope: '2026-11-11 UTC indexed parent-transaction cohort', timestampKind: 'receipt creation; execution times not retained',
    parentBlockRange: record.parentBlockRange, accounts: [...accounts].map(([account,count])=>({account,count})).sort((a,b)=>b.count-a.count||a.account.localeCompare(b.account)),
    methods: [...categories].map(([method,count])=>({method,count})).sort((a,b)=>b.count-a.count),
    columns: ['receipt_id','parent_transaction_hash','initiating_account','receipt_created_timestamp_ns'], signs };
}
export function evidenceManifest(files) {
  return Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: Buffer.byteLength(bytes) }]));
}

export function assertArchiveSha256(bytes, expected, label) {
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (!/^[a-f0-9]{64}$/.test(expected || '') || actual !== expected) {
    throw new Error(`${label} archive SHA-256 differs from sealed evidence; review and explicitly reseal separately`);
  }
  return actual;
}
