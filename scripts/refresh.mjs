import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { analyzeReceipts, extractSignerReceipts, normalizeSeries, summarizeSeries } from '../src/analysis.mjs';

const SOURCES = {
  appFees: 'https://api.llama.fi/overview/fees/near',
  appRevenue: 'https://api.llama.fi/overview/fees/near?dataType=dailyRevenue',
  holdersRevenue: 'https://api.llama.fi/overview/fees/near?dataType=dailyHoldersRevenue',
  tvl: 'https://api.llama.fi/v2/historicalChainTvl/NEAR',
  signerHistory: 'https://tx.main.fastnear.com/v0/account',
  transactionTraces: 'https://tx.main.fastnear.com/v0/transactions',
  multichainIndex: 'https://api.nearblocks.io/v3/multichain/signatures',
};

// Seven equal 1,000-block windows at fixed 4-million-block intervals.
// The four additional ranges were chosen before their method classification.
const BLOCK_WINDOWS = Array.from({ length: 7 }, (_, i) => 200_000_000 + i * 4_000_000).map(start => ({ start, end: start + 999 }));
// A second, predeclared audit samples one 1,000-block window every 12,000
// block heights across Nov 11 UTC. The first window overlaps BLOCK_WINDOWS.
const DAY_WINDOWS = Array.from({ length: 12 }, (_, i) => 224_000_000 + i * 12_000).map(start => ({ start, end: start + 999 }));
const CASE = {
  nearTransaction: 'FrBQdrUigUK1JYaXyVqA7uJH4PvLYJVCHD1iPUn1UrFG',
  nearReceipt: 'J7j3QcvKFs79Z91zLg4DZ2s4RR9M73L4DQpvRLMBVTCF',
  bitcoinTransaction: '75a2455fdab91a57c89980f39df4ae50b8d094b28d6e74a87e46468f1148edd7',
};

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { 'User-Agent': 'NEAR-Capture-Test/0.1 research' } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const payload = await response.json();
  if (payload?.message && /limit|error/i.test(payload.message)) throw new Error(`${payload.message} (${url})`);
  return payload;
}

async function postFastNear(url, body) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(25_000),
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'NEAR-Capture-Test/0.1 research' },
      body: JSON.stringify(body),
    });
    if (response.ok) return response.json();
    if (attempt === 5 || ![429, 500, 502, 503, 504].includes(response.status)) throw new Error(`${response.status} ${url}`);
    const retryAfter = Number(response.headers.get('retry-after'));
    const delay = response.status === 429 ? Math.max(Number.isFinite(retryAfter) ? retryAfter * 1000 : 0, 10_000 * (attempt + 1)) : 1_500 * (attempt + 1);
    console.warn(`FastNear ${response.status}; retrying in ${Math.round(delay / 1000)}s`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

async function getWindow({ start, end }) {
  const rows = [];
  let resume_token = null;
  let reportedCount = null;
  do {
    const body = { account_id: 'v1.signer', from_tx_block_height: start, to_tx_block_height: end, is_function_call: true, limit: 200, desc: false };
    if (resume_token) body.resume_token = resume_token;
    const page = await postFastNear(SOURCES.signerHistory, body);
    if (!Array.isArray(page.account_txs)) throw new Error(`Malformed account response for ${start}`);
    if (reportedCount === null) reportedCount = page.txs_count;
    rows.push(...page.account_txs);
    resume_token = page.resume_token || null;
    await new Promise(resolve => setTimeout(resolve, 1200));
    if (rows.length > 10_000) throw new Error(`Unexpectedly large window ${start}`);
  } while (resume_token);
  const hashes = [...new Set(rows.map(row => row.transaction_hash))];
  if (hashes.length !== reportedCount) throw new Error(`Window ${start}: ${hashes.length} hashes, index reports ${reportedCount}`);
  const raw = [];
  for (let i = 0; i < hashes.length; i += 20) {
    const batch = hashes.slice(i, i + 20);
    const result = await postFastNear(SOURCES.transactionTraces, { tx_hashes: batch });
    if (!Array.isArray(result.transactions) || result.transactions.length !== batch.length) throw new Error(`Incomplete transaction hydration at ${start}:${i}`);
    raw.push(...result.transactions);
    await new Promise(resolve => setTimeout(resolve, 1200));
  }
  const receipts = extractSignerReceipts(raw);
  const analysis = analyzeReceipts(receipts);
  const timestamps = rows.map(row => Number(row.tx_block_timestamp) / 1e9).sort((a, b) => a - b);
  return {
    blocks: [start, end],
    observedRange: [new Date(timestamps[0] * 1000).toISOString(), new Date(timestamps.at(-1) * 1000).toISOString()],
    touchingTransactions: hashes.length,
    ...analysis,
    receipts,
  };
}

async function getActivitySeries() {
  const points = [];
  for (let start = 200_000_000; start <= 224_000_000; start += 1_000_000) {
    const page = await postFastNear(SOURCES.signerHistory, {
      account_id: 'v1.signer',
      from_tx_block_height: start,
      to_tx_block_height: start + 999,
      is_function_call: true,
      limit: 1,
      desc: false,
    });
    if (!Number.isInteger(page.txs_count) || !Array.isArray(page.account_txs)) throw new Error(`Invalid activity count at block ${start}`);
    points.push({
      blockStart: start,
      touchingTransactions: page.txs_count,
      date: page.account_txs[0] ? new Date(Number(page.account_txs[0].tx_block_timestamp) / 1e6).toISOString().slice(0, 10) : null,
    });
    await new Promise(resolve => setTimeout(resolve, 1200));
  }
  return points;
}

async function getCrossChainCase() {
  const [near, indexed, mempool, blockstream] = await Promise.all([
    postFastNear(SOURCES.transactionTraces, { tx_hashes: [CASE.nearTransaction] }),
    getJson(`${SOURCES.multichainIndex}?chain=BITCOIN&txn=${CASE.bitcoinTransaction}`),
    getJson(`https://mempool.space/api/tx/${CASE.bitcoinTransaction}/status`),
    getJson(`https://blockstream.info/api/tx/${CASE.bitcoinTransaction}/status`),
  ]);
  const sourceRecord = indexed.data?.find(record =>
    record.transaction_hash === CASE.nearTransaction &&
    record.receipt_id === CASE.nearReceipt &&
    record.dest_chain === 'BITCOIN' &&
    record.dest_txn === CASE.bitcoinTransaction
  );
  if (!sourceRecord) throw new Error('NearBlocks did not return the exact cross-chain association');
  const tx = near.transactions?.[0];
  const receipt = extractSignerReceipts([tx]).find(row => row.id === CASE.nearReceipt);
  if (!receipt || receipt.actions.every(action => action.method !== 'sign')) throw new Error('Cross-chain case NEAR sign receipt was not verified');
  if (!mempool.confirmed || !blockstream.confirmed || mempool.block_height !== blockstream.block_height || mempool.block_hash !== blockstream.block_hash) {
    throw new Error('Cross-chain case Bitcoin confirmation sources disagree');
  }
  return {
    nearTransaction: CASE.nearTransaction,
    nearReceipt: CASE.nearReceipt,
    parentSigner: tx.transaction.signer_id,
    signingCaller: receipt.predecessor_account_id,
    nearTimestamp: new Date(Number(receipt.block_timestamp) / 1e6).toISOString(),
    bitcoinTransaction: CASE.bitcoinTransaction,
    bitcoinBlockHeight: mempool.block_height,
    bitcoinBlockHash: mempool.block_hash,
    bitcoinBlockTime: new Date(mempool.block_time * 1000).toISOString(),
    status: 'confirmed',
    associationSource: 'NearBlocks v3 multichain/signatures indexed record observed on 2026-11-12',
    associationRecord: {
      transactionHash: sourceRecord.transaction_hash,
      receiptId: sourceRecord.receipt_id,
      destinationChain: sourceRecord.dest_chain,
      destinationTransaction: sourceRecord.dest_txn,
      blockHeight: sourceRecord.block?.block_height,
    },
    independentChecks: ['NearBlocks exact indexed association', 'FastNear transaction trace', 'Mempool.space Bitcoin status', 'Blockstream Bitcoin status'],
  };
}

const fetchedAt = new Date().toISOString();
const fullAudit = process.argv.includes('--full-audit');
const cacheDir = new URL('../.cache/', import.meta.url);
await mkdir(cacheDir, { recursive: true });
let previousSnapshot = null;
try { previousSnapshot = JSON.parse(await readFile(new URL('../public/data/snapshot.json', import.meta.url), 'utf8')); } catch {}
const snapshotWindows = [...(previousSnapshot?.signerWindows || []), ...(previousSnapshot?.dayWindows || [])];
async function getWindowCached(window) {
  if (!fullAudit) {
    let cached = null;
    try { cached = JSON.parse(await readFile(new URL(`window-${window.start}.json`, cacheDir), 'utf8')); } catch {}
    cached ||= snapshotWindows.find(row => row.blocks?.[0] === window.start);
    if (cached?.blocks?.[1] === window.end && Array.isArray(cached.receipts)) {
      const freshAnalysis = analyzeReceipts(cached.receipts);
      if (freshAnalysis.sampleSize !== cached.sampleSize || freshAnalysis.categories.request !== cached.categories?.request) throw new Error(`Cached audit mismatch at ${window.start}`);
      console.log(`Reused audited receipts ${window.start}-${window.end}`);
      return { ...cached, ...freshAnalysis };
    }
  }
  const result = await getWindow(window);
  await writeFile(new URL(`window-${window.start}.json`, cacheDir), JSON.stringify(result));
  return result;
}
const [fees, revenue, holdersRevenue, tvl] = await Promise.all([
  getJson(SOURCES.appFees),
  getJson(SOURCES.appRevenue),
  getJson(SOURCES.holdersRevenue),
  getJson(SOURCES.tvl),
]);
const rows = normalizeSeries(fees, tvl, revenue, holdersRevenue);
const summary = summarizeSeries(rows);
const signerWindows = [];
for (const window of BLOCK_WINDOWS) {
  const result = await getWindowCached(window);
  signerWindows.push(result);
  console.log(`Indexed ${window.start}-${window.end}: ${result.touchingTransactions} touching transactions, ${result.categories.request} sign receipts`);
}
const dayWindows = [signerWindows.at(-1)];
for (const window of DAY_WINDOWS.slice(1)) {
  const result = await getWindowCached(window);
  dayWindows.push(result);
  console.log(`Day audit ${window.start}-${window.end}: ${result.touchingTransactions} touching transactions, ${result.categories.request} sign receipts`);
}
const dayAnalysis = analyzeReceipts(dayWindows.flatMap(window => window.receipts));
const daySummary = {
  windowCount: dayWindows.length,
  blocks: [dayWindows[0].blocks[0], dayWindows.at(-1).blocks[1]],
  observedRange: [dayWindows[0].observedRange[0], dayWindows.at(-1).observedRange[1]],
  ...dayAnalysis,
  lowestWindowTopThreeShare: Math.min(...dayWindows.map(window => window.topThreeShare)),
  highestWindowTopThreeShare: Math.max(...dayWindows.map(window => window.topThreeShare)),
};
const activitySeries = await getActivitySeries();
for (const window of signerWindows) {
  const matching = activitySeries.find(point => point.blockStart === window.blocks[0]);
  if (matching?.touchingTransactions !== window.touchingTransactions) throw new Error(`Raw activity series disagrees with hydrated window ${window.blocks[0]}`);
}
const crossChainCase = await getCrossChainCase();
const snapshot = {
  schemaVersion: 1,
  fetchedAt,
  dataThrough: rows.at(-1).date,
  sources: SOURCES,
  methodology: {
    series: 'Full UTC calendar days present in all four DeFiLlama feeds. Current UTC day excluded.',
    signer: 'Twenty-five fixed 1,000-parent-transaction-block windows spaced one million block heights apart; seven at fixed four-million-block intervals are fully hydrated. The four additional ranges were chosen before their method classification, but the samples are not random. Count deduplicated receipts whose receiver is v1.signer and method is sign. These receipts may execute after the parent transaction window. Excludes respond, verify, and cleanup. Windows are samples, not all-network totals or proof of outbound settlement.',
    day: 'Twelve nonoverlapping 1,000-parent-transaction-block windows starting at block 224000000 and spaced 12000 heights apart. Fixed before classifying the additional eleven windows. Approximately two-hour cadence across Nov 11 UTC; not continuous full-day coverage or a random sample. One window overlaps the historical seven-window audit.',
  },
  summary,
  series: rows.slice(-180),
  signerWindows,
  dayWindows,
  daySummary,
  activitySeries,
  crossChainCase,
};
await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
await writeFile(new URL('../public/data/snapshot.json', import.meta.url), JSON.stringify(snapshot, null, 2) + '\n');
const csv = ['window_start,window_end,receipt_id,transaction_hash,predecessor,method,receipt_timestamp_utc'];
const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
for (const window of new Map([...signerWindows, ...dayWindows].map(window => [window.blocks[0], window])).values()) {
  for (const receipt of window.receipts) {
    for (const action of receipt.actions) {
      csv.push([
        window.blocks[0], window.blocks[1], receipt.id, receipt.transaction_hash,
        receipt.predecessor_account_id, action.method,
        new Date(Number(receipt.block_timestamp) / 1e6).toISOString(),
      ].map(quote).join(','));
    }
  }
}
await writeFile(new URL('../public/data/receipt-audit.csv', import.meta.url), csv.join('\n') + '\n');
console.log(JSON.stringify({ fetchedAt, dataThrough: snapshot.dataThrough, summary, signerWindows: signerWindows.map(({blocks, touchingTransactions, categories, uniqueCallers, topCallerShare, topThreeCount, topThreeShare}) => ({blocks, touchingTransactions, categories, uniqueCallers, topCallerShare, topThreeCount, topThreeShare})), daySummary: { windowCount: daySummary.windowCount, observedRange: daySummary.observedRange, requests: daySummary.categories.request, topThreeShare: daySummary.topThreeShare, uniqueCallers: daySummary.uniqueCallers } }, null, 2));
