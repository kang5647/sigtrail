export const DAY = 86_400;

export function utcDay(timestamp) {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

export function classifyReceipt(receipt) {
  const methods = (receipt.actions || [])
    .filter(action => action.action === 'FUNCTION_CALL')
    .map(action => action.method);
  if (methods.includes('sign')) return 'request';
  if (methods.includes('respond')) return 'mpc_response';
  if (methods.includes('return_signature_and_clean_state_on_success')) return 'internal_completion';
  if (methods.length) return 'other_method';
  return 'other_receipt';
}

export function extractSignerReceipts(rawTransactions) {
  const rows = [];
  for (const item of rawTransactions) {
    const hash = item?.transaction?.hash;
    for (const entry of item?.receipts || []) {
      const receipt = entry.receipt;
      if (receipt?.receiver_id !== 'v1.signer') continue;
      const actions = receipt.receipt?.Action?.actions || [];
      const methods = actions.flatMap(action => action.FunctionCall ? [{ action: 'FUNCTION_CALL', method: action.FunctionCall.method_name }] : []);
      if (!methods.length) continue;
      rows.push({
        id: receipt.receipt_id,
        transaction_hash: hash,
        predecessor_account_id: receipt.predecessor_id,
        block_timestamp: String(receipt.block_timestamp),
        actions: methods,
      });
    }
  }
  return [...new Map(rows.map(row => [row.id, row])).values()];
}

export function analyzeReceipts(receipts) {
  // The live indexer can repeat the boundary receipt on adjacent cursor pages.
  receipts = [...new Map(receipts.map(receipt => [receipt.id, receipt])).values()];
  const categories = { request: 0, mpc_response: 0, internal_completion: 0, other_method: 0, other_receipt: 0 };
  const callers = new Map();
  const transactions = [];
  for (const receipt of receipts) {
    const category = classifyReceipt(receipt);
    categories[category]++;
    if (category === 'request') {
      const account = receipt.predecessor_account_id || 'unknown';
      callers.set(account, (callers.get(account) || 0) + 1);
      transactions.push({
        hash: receipt.transaction_hash,
        account,
        timestamp: Number(receipt.block_timestamp || receipt.receipt_block?.block_timestamp || 0) / 1e9,
      });
    }
  }
  const sorted = [...callers].sort((a, b) => b[1] - a[1]);
  const timestamps = receipts.map(receipt => Number(receipt.block_timestamp || 0) / 1e9).filter(Number.isFinite);
  return {
    sampleSize: receipts.length,
    categories,
    uniqueCallers: callers.size,
    topCallers: sorted.slice(0, 8).map(([account, count]) => ({ account, count })),
    topCallerShare: categories.request ? sorted[0][1] / categories.request : null,
    topThreeCount: sorted.slice(0, 3).reduce((sum, [, count]) => sum + count, 0),
    topThreeShare: categories.request ? sorted.slice(0, 3).reduce((sum, [, count]) => sum + count, 0) / categories.request : null,
    sampleNewestTimestamp: Math.max(...timestamps),
    sampleOldestTimestamp: Math.min(...timestamps),
    recentRequests: transactions.sort((a, b) => b.timestamp - a.timestamp).slice(0, 8),
  };
}

export function normalizeSeries(fees, tvl, revenue, holdersRevenue, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const totals = new Map(fees.totalDataChart.map(([timestamp, amount]) => [utcDay(timestamp), Number(amount)]));
  const breakdown = new Map(fees.totalDataChartBreakdown.map(([timestamp, protocols]) => [utcDay(timestamp), protocols]));
  const net = new Map(revenue.totalDataChartBreakdown.map(([timestamp, protocols]) => [utcDay(timestamp), protocols]));
  const holders = new Map(holdersRevenue.totalDataChartBreakdown.map(([timestamp, protocols]) => [utcDay(timestamp), protocols]));
  const tvlByDay = new Map(tvl.map(row => [utcDay(row.date), Number(row.tvl)]));
  const rows = [...totals]
    .filter(([date]) => date < today && breakdown.has(date) && net.has(date) && holders.has(date) && tvlByDay.has(date))
    .map(([date, appFees]) => ({
      date,
      appFees,
      intentsFees: Number(breakdown.get(date)['NEAR Intents'] || 0),
      intentsNetRevenue: Number(net.get(date)['NEAR Intents'] || 0),
      intentsHoldersRevenue: Number(holders.get(date)['NEAR Intents'] || 0),
      defiTvl: tvlByDay.get(date),
    }))
    .filter(row => [row.appFees, row.intentsFees, row.intentsNetRevenue, row.intentsHoldersRevenue, row.defiTvl].every(x => Number.isFinite(x) && x >= 0))
    .sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

export function summarizeSeries(rows) {
  if (rows.length < 60) throw new Error(`Need at least 60 aligned complete days, got ${rows.length}`);
  const last = rows.slice(-30);
  const prior = rows.slice(-60, -30);
  for (const window of [last, prior]) {
    if ((Date.parse(window.at(-1).date) - Date.parse(window[0].date)) / 86_400_000 !== 29) {
      throw new Error('Missing calendar dates in the 30-day comparison window');
    }
  }
  const sum = (items, key) => items.reduce((acc, row) => acc + row[key], 0);
  const currentIntents = sum(last, 'intentsFees');
  const currentApps = sum(last, 'appFees');
  const priorIntents = sum(prior, 'intentsFees');
  const currentNet = sum(last, 'intentsNetRevenue');
  const currentHolders = sum(last, 'intentsHoldersRevenue');
  const meanTvl = sum(last, 'defiTvl') / last.length;
  return {
    currentPeriod: [last[0].date, last.at(-1).date],
    priorPeriod: [prior[0].date, prior.at(-1).date],
    days: last.length,
    intentsFees30d: currentIntents,
    intentsNetRevenue30d: currentNet,
    intentsHoldersRevenue30d: currentHolders,
    holderShareOfGross: currentIntents ? currentHolders / currentIntents : null,
    ecosystemAppFees30d: currentApps,
    intentsShare: currentApps ? currentIntents / currentApps : null,
    intentsChangeVsPrior: priorIntents ? currentIntents / priorIntents - 1 : null,
    averageDefiTvl30d: meanTvl,
  };
}
