import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { analyzeReceipts, extractSignerReceipts } from '../src/analysis.mjs';
import { assertCompleteHistory, assertCompleteHydration } from '../src/audit.mjs';

// Post hoc full UTC day census: block boundaries independently found from
// archival mainnet block timestamps. This script checkpoints public API work.
const start = 223_988_378;
const end = 224_135_609;
const date = '2026-11-11';
const base = 'https://tx.main.fastnear.com/v0';
const dir = new URL('../.cache/full-day/', import.meta.url);
await mkdir(dir, { recursive: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const retryable = new Set([429, 500, 502, 503, 504]);
async function post(path, body) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const response = await fetch(`${base}/${path}`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'NEAR-Capture-Test/0.1 research' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
    if (response.ok) return response.json();
    if (!retryable.has(response.status) || attempt === 7) throw new Error(`${path} HTTP ${response.status}`);
    const wait = response.status === 429 ? 10_000 * (attempt + 1) : 2_000 * (attempt + 1);
    console.warn(`${path} HTTP ${response.status}; retry in ${wait / 1000}s`);
    await delay(wait);
  }
}
async function readJson(url) { try { return JSON.parse(await readFile(url, 'utf8')); } catch { return null; } }
const pageFile = new URL('pages.json', dir);
let pages = await readJson(pageFile) || { rows: [], cursor: null, count: null, complete: false };
if (!pages.complete) {
  const seen = new Set();
  do {
    const body = { account_id: 'v1.signer', from_tx_block_height: start,
      to_tx_block_height: end, is_function_call: true, limit: 200, desc: false };
    if (pages.cursor) body.resume_token = pages.cursor;
    const result = await post('account', body);
    if (!Array.isArray(result.account_txs)) throw new Error('Malformed account page');
    if (pages.count === null) pages.count = result.txs_count;
    else if (result.txs_count != null && result.txs_count !== pages.count) throw new Error('Changing index count');
    pages.rows.push(...result.account_txs);
    pages.cursor = result.resume_token || null;
    if (pages.cursor && (seen.has(pages.cursor) || !result.account_txs.length)) throw new Error('Stalled page cursor');
    if (pages.cursor) seen.add(pages.cursor);
    pages.complete = !pages.cursor;
    await writeFile(pageFile, JSON.stringify(pages));
    if (pages.rows.length % 2000 < 200) console.log(`Indexed ${pages.rows.length}/${pages.count} parent transactions`);
    await delay(700);
  } while (!pages.complete);
}
const hashes = assertCompleteHistory(pages.rows, pages.count, start);
console.log(`Complete index: ${hashes.length} unique parent transactions`);
const receipts = [];
for (let i = 0; i < hashes.length; i += 20) {
  const batch = hashes.slice(i, i + 20);
  const file = new URL(`batch-${String(i / 20).padStart(5, '0')}.json`, dir);
  let saved = await readJson(file);
  if (!saved || JSON.stringify(saved.hashes) !== JSON.stringify(batch)) {
    const result = await post('transactions', { tx_hashes: batch });
    assertCompleteHydration(batch, result.transactions, `full day ${i}`);
    saved = { hashes: batch, receipts: extractSignerReceipts(result.transactions) };
    await writeFile(file, JSON.stringify(saved));
    await delay(700);
  }
  receipts.push(...saved.receipts);
  if (i % 2000 === 0) console.log(`Hydrated ${i + batch.length}/${hashes.length} transactions; ${receipts.length} signer receipts`);
}
const analysis = analyzeReceipts(receipts);
const output = { date, fetchedAtUtc: new Date().toISOString(), parentBlockRange: [start, end],
  source: { index: `${base}/account`, traces: `${base}/transactions` },
  touchingTransactions: hashes.length,
  transactionHashesSha256: createHash('sha256').update(hashes.join('\n')).digest('hex'),
  receipts, analysis };
await writeFile(new URL('finished.json', dir), JSON.stringify(output));
console.log(JSON.stringify({ date, blocks: output.parentBlockRange, touchingTransactions: hashes.length,
  directSign: analysis.categories.request, initiatingAccounts: analysis.uniqueCallers,
  topOne: analysis.topCallers[0], topThree: analysis.topCallers.slice(0, 3),
  topThreeCount: analysis.topThreeCount, topThreeShare: analysis.topThreeShare,
  receiptCount: receipts.length }, null, 2));
