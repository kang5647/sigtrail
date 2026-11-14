import { analyzeReceipts, summarizeSeries } from './analysis.mjs';
import { analyzeIssuanceAudit } from './issuance.mjs';

export function assertCompleteHistory(rows, expectedCount, start) {
  if (!Number.isSafeInteger(expectedCount) || expectedCount < 0) throw new Error(`Invalid reported count for ${start}`);
  const hashes = rows.map(row => row?.transaction_hash);
  if (hashes.some(hash => typeof hash !== 'string' || !hash)) throw new Error(`Missing transaction hash in ${start}`);
  const unique = new Set(hashes);
  if (unique.size !== expectedCount) throw new Error(`Window ${start}: ${unique.size} hashes, index reports ${expectedCount}`);
  return [...unique];
}

export function assertCompleteHydration(requestedHashes, transactions, label) {
  if (!Array.isArray(transactions)) throw new Error(`Malformed trace response at ${label}`);
  const requested = new Set(requestedHashes);
  const returned = transactions.map(item => item?.transaction?.hash);
  if (returned.some(hash => typeof hash !== 'string' || !requested.has(hash)) ||
      returned.length !== requested.size || new Set(returned).size !== requested.size) {
    throw new Error(`Incomplete or mismatched transaction hydration at ${label}`);
  }
}

const csvQuote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;

export function rebuildArtifacts(source) {
  const signerWindows = source.signerWindows.map(window => ({ ...window, ...analyzeReceipts(window.receipts) }));
  const dayWindows = source.dayWindows.map(window => ({ ...window, ...analyzeReceipts(window.receipts) }));
  if (signerWindows.length !== 7 || dayWindows.length !== 12 ||
      dayWindows[0].blocks[0] !== signerWindows.at(-1).blocks[0]) throw new Error('Unexpected audit window layout');
  for (const window of [...signerWindows, ...dayWindows]) {
    if (window.blocks[1] - window.blocks[0] !== 999 || !Number.isSafeInteger(window.touchingTransactions) || window.touchingTransactions < 0) {
      throw new Error(`Invalid window metadata at ${window.blocks[0]}`);
    }
    for (const receipt of window.receipts) {
      if (!receipt.id || !receipt.transaction_hash || !receipt.predecessor_account_id ||
          !/^\d{18,20}$/.test(String(receipt.block_timestamp)) ||
          !Number.isFinite(Date.parse(new Date(Number(receipt.block_timestamp) / 1e6).toISOString()))) {
        throw new Error(`Incomplete receipt in window ${window.blocks[0]}`);
      }
    }
  }
  const dayAnalysis = analyzeReceipts(dayWindows.flatMap(window => window.receipts));
  const daySummary = {
    ...source.daySummary,
    ...dayAnalysis,
    lowestWindowTopThreeShare: Math.min(...dayWindows.map(window => window.topThreeShare)),
    highestWindowTopThreeShare: Math.max(...dayWindows.map(window => window.topThreeShare)),
  };
  const feeFootprint = { ...source.feeFootprint };
  const requestIds = new Set(signerWindows.at(-1).receipts.filter(receipt =>
    receipt.actions.some(action => action.method === 'sign')).map(receipt => receipt.id));
  const feeRows = feeFootprint.receipts;
  if (new Set(feeRows.map(row => row.receiptId)).size !== requestIds.size ||
      feeRows.length !== requestIds.size || feeRows.some(row => !requestIds.has(row.receiptId) || !/^\d+$/.test(row.tokensBurntYocto))) {
    throw new Error('Fee audit does not cover each direct sign receipt exactly once');
  }
  const totalYocto = feeRows.reduce((sum, row) => sum + BigInt(row.tokensBurntYocto), 0n);
  const totalNear = Number(totalYocto) / 1e24;
  feeFootprint.receiptCount = feeRows.length;
  feeFootprint.totalTokensBurntYocto = totalYocto.toString();
  feeFootprint.totalNear = totalNear;
  feeFootprint.averageNear = totalNear / feeRows.length;
  feeFootprint.scenarios = feeFootprint.scenarios.map(({ dailyRequests }) => {
    if (!Number.isSafeInteger(dailyRequests) || dailyRequests < 0) throw new Error('Invalid sensitivity request count');
    return { dailyRequests, signReceiptNearPerDay: feeFootprint.averageNear * dailyRequests };
  });
  const snapshot = {
    ...source,
    summary: summarizeSeries(source.series),
    signerWindows,
    dayWindows,
    daySummary,
    feeFootprint,
    issuanceAudit: source.issuanceAudit ? analyzeIssuanceAudit(source.issuanceAudit, feeFootprint) : undefined,
  };
  const csv = ['window_start,window_end,receipt_id,transaction_hash,predecessor,method,receipt_timestamp_utc'];
  for (const window of new Map([...signerWindows, ...dayWindows].map(window => [window.blocks[0], window])).values()) {
    for (const receipt of window.receipts) {
      for (const action of receipt.actions) {
        csv.push([window.blocks[0], window.blocks[1], receipt.id, receipt.transaction_hash,
          receipt.predecessor_account_id, action.method,
          new Date(Number(receipt.block_timestamp) / 1e6).toISOString()].map(csvQuote).join(','));
      }
    }
  }
  const feeCsv = ['receipt_id,transaction_hash,tokens_burnt_yoctonear,gas_burnt'];
  for (const row of feeRows) feeCsv.push([row.receiptId, row.transactionHash, row.tokensBurntYocto, row.gasBurnt].map(csvQuote).join(','));
  return {
    snapshot,
    files: {
      'snapshot.json': JSON.stringify(snapshot, null, 2) + '\n',
      'receipt-audit.csv': csv.join('\n') + '\n',
      'fee-audit.csv': feeCsv.join('\n') + '\n',
    },
  };
}
