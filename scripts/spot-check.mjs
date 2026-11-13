import { analyzeReceipts, extractSignerReceipts } from '../src/analysis.mjs';
import { assertCompleteHistory, assertCompleteHydration } from '../src/audit.mjs';

// Independent offset-window check. The default is halfway between the first
// two 11 November spaced windows; it is not part of the twelve-window pool.
const start = Number(process.argv[2] ?? 224_006_000);
if (!Number.isSafeInteger(start) || start < 0) throw new Error('Expected a block start integer');
const end = start + 999;
const base = 'https://tx.main.fastnear.com/v0';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function post(path, body) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(`${base}/${path}`, { method: 'POST', signal: AbortSignal.timeout(25_000),
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'NEAR-Capture-Test/0.1 research' }, body: JSON.stringify(body) });
    if (response.ok) return response.json();
    if (attempt === 4 || ![429, 500, 502, 503, 504].includes(response.status)) throw new Error(`${response.status} ${path}`);
    await wait(response.status === 429 ? 10_000 * (attempt + 1) : 1500 * (attempt + 1));
  }
}

const rows = [];
const seenTokens = new Set();
let cursor = null;
let count = null;
do {
  const body = { account_id: 'v1.signer', from_tx_block_height: start, to_tx_block_height: end,
    is_function_call: true, limit: 200, desc: false };
  if (cursor) body.resume_token = cursor;
  const page = await post('account', body);
  if (!Array.isArray(page.account_txs)) throw new Error('Malformed account page');
  if (count === null) count = page.txs_count;
  else if (page.txs_count != null && page.txs_count !== count) throw new Error('Changing page count');
  rows.push(...page.account_txs);
  cursor = page.resume_token || null;
  if (cursor && (seenTokens.has(cursor) || !page.account_txs.length)) throw new Error('Stalled cursor');
  if (cursor) seenTokens.add(cursor);
  await wait(1200);
} while (cursor);
const hashes = assertCompleteHistory(rows, count, start);
const raw = [];
for (let i = 0; i < hashes.length; i += 20) {
  const batch = hashes.slice(i, i + 20);
  const result = await post('transactions', { tx_hashes: batch });
  assertCompleteHydration(batch, result.transactions, `spot-check ${i}`);
  raw.push(...result.transactions);
  await wait(1200);
}
const analysis = analyzeReceipts(extractSignerReceipts(raw));
console.log(JSON.stringify({ blocks: [start, end], touchingTransactions: hashes.length,
  directSign: analysis.categories.request, topThree: analysis.topCallers.slice(0, 3),
  topThreeCount: analysis.topThreeCount, topThreeShare: analysis.topThreeShare,
  initiatingAccounts: analysis.uniqueCallers, categoryCounts: analysis.categories }, null, 2));
