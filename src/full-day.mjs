import { createHash } from 'node:crypto';
import { analyzeReceipts } from './analysis.mjs';

const csvQuote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;

export function analyzeFullDayRecord(record, archiveSha256) {
  const boundaries = record.boundaryBlocks;
  if (record.date !== '2026-11-11' ||
      record.parentBlockRange?.[0] !== 223_988_378 || record.parentBlockRange?.[1] !== 224_135_609 ||
      !Array.isArray(record.transactionHashes) || !Array.isArray(record.receipts) ||
      !Number.isSafeInteger(record.touchingTransactions) ||
      record.transactionHashes.length !== record.touchingTransactions ||
      new Set(record.transactionHashes).size !== record.touchingTransactions ||
      record.transactionHashes.some(hash => typeof hash !== 'string' || !hash) ||
      record.source?.index !== 'https://tx.main.fastnear.com/v0/account' ||
      record.source?.traces !== 'https://tx.main.fastnear.com/v0/transactions' ||
      record.source?.query?.account_id !== 'v1.signer' ||
      record.source?.query?.from_tx_block_height !== record.parentBlockRange[0] ||
      record.source?.query?.to_tx_block_height !== record.parentBlockRange[1] ||
      record.source?.query?.is_function_call !== true ||
      record.source?.query?.desc !== false ||
      !Number.isFinite(Date.parse(record.fetchedAtUtc)) ||
      boundaries?.startBefore?.height + 1 !== record.parentBlockRange[0] ||
      boundaries?.startInside?.height !== record.parentBlockRange[0] ||
      boundaries?.endInside?.height !== record.parentBlockRange[1] ||
      boundaries?.endInside?.height + 1 !== boundaries?.endAfter?.height ||
      boundaries.startBefore.timeUtc >= '2026-11-11T00:00:00.000Z' ||
      boundaries.startInside.timeUtc < '2026-11-11T00:00:00.000Z' ||
      boundaries.endInside.timeUtc >= '2026-11-12T00:00:00.000Z' ||
      boundaries.endAfter.timeUtc < '2026-11-12T00:00:00.000Z') {
    throw new Error('Incomplete full-day parent transaction census');
  }
  if (Object.values(boundaries).some(block => !block.hash || !Number.isFinite(Date.parse(block.timeUtc)))) {
    throw new Error('Incomplete full-day UTC boundary proof');
  }
  const hashesSha = createHash('sha256').update(record.transactionHashes.join('\n')).digest('hex');
  if (hashesSha !== record.transactionHashesSha256) throw new Error('Full-day parent transaction hash list differs');
  const parents = new Set(record.transactionHashes);
  const seenReceipts = new Set();
  for (const receipt of record.receipts) {
    if (!receipt.id || seenReceipts.has(receipt.id) || !parents.has(receipt.transaction_hash) ||
        !receipt.predecessor_account_id ||
        !/^\d{18,20}$/.test(String(receipt.block_timestamp)) || !Array.isArray(receipt.actions) ||
        !receipt.actions.length || receipt.actions.some(action => action.action !== 'FUNCTION_CALL' || typeof action.method !== 'string')) {
      throw new Error('Incomplete full-day receipt record');
    }
    seenReceipts.add(receipt.id);
  }
  const analysis = analyzeReceipts(record.receipts);
  const dayStart = BigInt(Date.parse('2026-11-11T00:00:00.000Z')) * 1_000_000n;
  const dayEnd = BigInt(Date.parse('2026-11-12T00:00:00.000Z')) * 1_000_000n;
  const outsideUtcDay = record.receipts.filter(receipt => {
    const timestamp = BigInt(receipt.block_timestamp);
    return timestamp < dayStart || timestamp >= dayEnd;
  });
  const outsideAnalysis = analyzeReceipts(outsideUtcDay);
  const summary = { date: record.date, fetchedAtUtc: record.fetchedAtUtc,
    parentBlockRange: record.parentBlockRange, boundaryBlocks: boundaries, source: record.source,
    archiveSha256, transactionHashesSha256: hashesSha,
    touchingTransactions: record.touchingTransactions,
    categories: analysis.categories, receiptCount: analysis.sampleSize,
    receiptsExecutedOutsideUtcDay: outsideUtcDay.length,
    directSignsExecutedOutsideUtcDay: outsideAnalysis.categories.request,
    initiatingAccounts: analysis.uniqueCallers, topCallers: analysis.topCallers,
    topOneCount: analysis.topCallers[0]?.count || 0,
    topOneShare: analysis.topCallerShare,
    topThreeCount: analysis.topThreeCount,
    topThreeShare: analysis.topThreeShare };
  const csv = ['receipt_id,parent_transaction_hash,initiating_account,method,receipt_timestamp_utc'];
  const seen = new Set();
  for (const receipt of record.receipts) {
    if (seen.has(receipt.id)) continue;
    seen.add(receipt.id);
    for (const action of receipt.actions) {
      csv.push([receipt.id, receipt.transaction_hash, receipt.predecessor_account_id,
        action.method, new Date(Number(BigInt(receipt.block_timestamp) / 1_000_000n)).toISOString()]
        .map(csvQuote).join(','));
    }
  }
  return { summary, csv: csv.join('\n') + '\n' };
}
