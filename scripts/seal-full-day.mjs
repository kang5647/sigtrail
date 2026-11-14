import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { analyzeFullDayRecord } from '../src/full-day.mjs';

const cache = new URL('../.cache/full-day/', import.meta.url);
const pages = JSON.parse(await readFile(new URL('pages.json', cache), 'utf8'));
const finished = JSON.parse(await readFile(new URL('finished.json', cache), 'utf8'));
if (!pages.complete || pages.rows.length !== pages.count || finished.touchingTransactions !== pages.count) {
  throw new Error('Full-day crawl has not completed');
}
const record = {
  date: '2026-11-11', fetchedAtUtc: finished.fetchedAtUtc,
  parentBlockRange: finished.parentBlockRange,
  boundaryBlocks: {
    startBefore: { height: 223988377, hash: 'FSJAHKeqiJ2bCcCTQq8Len3Lqb8M8umzctu5HSaq43dQ', timeUtc: '2026-11-10T23:59:59.397Z' },
    startInside: { height: 223988378, hash: 'AL2hAQv6jYiiTMDLG158nPu6FhvGcB9k8J5kymvvpPCW', timeUtc: '2026-11-11T00:00:00.014Z' },
    endInside: { height: 224135609, hash: 'EacX9sDK6GTbMsqUfvhged4BvR94mVkfWexsFxWbELbU', timeUtc: '2026-11-11T23:59:59.752Z' },
    endAfter: { height: 224135610, hash: 'JD95GM2eLSyetHJRK9TRVyXVZ4iwcDtNVv5bwRgTMWfc', timeUtc: '2026-11-12T00:00:00.223Z' },
  },
  source: { index: 'https://tx.main.fastnear.com/v0/account',
    traces: 'https://tx.main.fastnear.com/v0/transactions',
    query: { account_id: 'v1.signer', from_tx_block_height: 223988378,
      to_tx_block_height: 224135609, is_function_call: true, desc: false } },
  touchingTransactions: pages.count,
  transactionHashes: pages.rows.map(row => row.transaction_hash),
  transactionHashesSha256: finished.transactionHashesSha256,
  receipts: finished.receipts,
};
const checked = analyzeFullDayRecord(record, 'pending');
if (checked.summary.categories.request !== finished.analysis.categories.request ||
    checked.summary.topThreeCount !== finished.analysis.topThreeCount) {
  throw new Error('Final census analysis differs from cached crawl result');
}
const bytes = gzipSync(Buffer.from(JSON.stringify(record) + '\n'), { level: 9 });
const sha = createHash('sha256').update(bytes).digest('hex');
const dataDir = new URL('../public/data/', import.meta.url);
await mkdir(dataDir, { recursive: true });
await writeFile(new URL('full-day-census.json.gz', dataDir), bytes);
console.log(JSON.stringify({ file: 'public/data/full-day-census.json.gz', bytes: bytes.length, sha256: sha,
  touchingTransactions: checked.summary.touchingTransactions,
  directSign: checked.summary.categories.request,
  initiatingAccounts: checked.summary.initiatingAccounts,
  topThree: checked.summary.topThreeCount, topThreeShare: checked.summary.topThreeShare }, null, 2));
