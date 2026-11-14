import { createHash } from 'node:crypto';

const n = (value, digits = 0) => Number(value).toLocaleString('en-US', {
  minimumFractionDigits: digits, maximumFractionDigits: digits,
});
const pct = (value, digits = 1) => `${n(value * 100, digits)}%`;
const day = iso => new Date(iso).toLocaleDateString('en-US', {
  timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric',
});
const markdownTable = (header, rows) => [header, header.map((_, index) => index ? '---:' : '---'), ...rows]
  .map(row => `| ${row.join(' | ')} |`).join('\n');

export function renderThesis(template, snapshot, canonicalSnapshotText) {
  const latest = snapshot.signerWindows.at(-1);
  const pool = snapshot.daySummary;
  const census = snapshot.fullDayCensus;
  const fee = snapshot.feeFootprint;
  const issuance = snapshot.issuanceAudit;
  if (!issuance?.supplyCrossCheck || !census) throw new Error('Missing thesis evidence');
  const historical = markdownTable(
    ['Parent block range', 'Signer-touching tx', 'Direct `sign`', 'Initiating accounts', 'Top one', 'Top three'],
    snapshot.signerWindows.map(window => [
      `${window.blocks[0]}–${window.blocks[1]}`,
      n(window.touchingTransactions), n(window.categories.request), n(window.uniqueCallers),
      `${n(window.topCallers[0]?.count || 0)}/${n(window.categories.request)} (${pct(window.topCallerShare)})`,
      `${n(window.topThreeCount)}/${n(window.categories.request)} (${pct(window.topThreeShare)})`,
    ]),
  );
  const scenarios = markdownTable(
    ['Assumed direct requests/day', 'Sign-stage burn/day', 'Burn/year at same daily rate', 'Share of observed daily gross issuance'],
    issuance.model.scenarios.map(row => [
      `${n(row.requestsPerDay)} (${row.label})`,
      `${n(row.burnNearPerDay, 3)} NEAR`, `${n(row.burnNearPerYear, 1)} NEAR`,
      `${n(row.shareOfDailyIssuancePct, 4)}%`,
    ]),
  );
  const thresholds = markdownTable(
    ['Gross issuance offset target', 'Direct `sign` requests/day at observed mean'],
    issuance.model.thresholds.map(row => [`${row.issuanceSharePct}%`, n(row.requestsPerDay)]),
  );
  const bridgeSet = new Set(['omni.bridge.near', 'btc-connector.bridge.near', 'zcash-connector.bridge.near']);
  const bridgeCount = pool.topCallers.filter(row => bridgeSet.has(row.account)).reduce((sum, row) => sum + row.count, 0);
  const values = {
    LATEST_TOP_THREE_COUNT: n(latest.topThreeCount), LATEST_DIRECT: n(latest.categories.request),
    LATEST_TOP_THREE_PCT: pct(latest.topThreeShare), LATEST_TOUCHING: n(latest.touchingTransactions),
    LATEST_CALLERS: latest.topCallers.slice(0, 3).map(row => `\`${row.account}\` (${n(row.count)})`).join(', '),
    DAY_TOP_THREE_COUNT: n(pool.topThreeCount), DAY_DIRECT: n(pool.categories.request),
    DAY_TOP_THREE_PCT: pct(pool.topThreeShare), DAY_ACCOUNTS: n(pool.uniqueCallers),
    DAY_TOP_ONE_COUNT: n(pool.topCallers[0].count), DAY_TOP_ONE_PCT: pct(pool.topCallerShare),
    CENSUS_TOUCHING: n(census.touchingTransactions), CENSUS_DIRECT: n(census.categories.request),
    CENSUS_ACCOUNTS: n(census.initiatingAccounts),
    CENSUS_TOP_ONE_COUNT: n(census.topOneCount), CENSUS_TOP_ONE_PCT: pct(census.topOneShare),
    CENSUS_TOP_THREE_COUNT: n(census.topThreeCount), CENSUS_TOP_THREE_PCT: pct(census.topThreeShare),
    CENSUS_CALLERS: census.topCallers.slice(0, 4).map(row => `\`${row.account}\` (${n(row.count)})`).join(', '),
    CENSUS_SPILLOVER: n(census.directSignsCreatedOutsideUtcDay),
    CENSUS_SHA: census.archiveSha256,
    CENSUS_ESTIMATED_BURN: n(census.categories.request * fee.averageNear, 3),
    CENSUS_ESTIMATED_ISSUANCE_PCT: `${n(census.categories.request * fee.averageNear / issuance.dailyMintedNear * 100, 4)}%`,
    BRIDGE_COUNT: n(bridgeCount), BRIDGE_PCT: pct(bridgeCount / pool.categories.request),
    HISTORICAL_TABLE: historical,
    FEE_RECEIPTS: n(fee.receiptCount), FEE_TOTAL: n(fee.totalNear, 9), FEE_AVERAGE: n(fee.averageNear, 12),
    ISSUANCE_PERIOD: `${day(issuance.windowStartUtc)}–${day(issuance.windowEndUtc)}`,
    ISSUANCE_EPOCH_COUNT: n(issuance.epochs.length), ISSUANCE_TOTAL: n(issuance.mintedNearInWindow, 3),
    ISSUANCE_DAILY: n(issuance.dailyMintedNear, 3), ISSUANCE_YEARLY: n(issuance.annualizedMintedNear, 1),
    NET_SUPPLY_CHANGE: n(issuance.supplyCrossCheck.netSupplyChangeNear, 3),
    GROSS_NET_GAP: n(issuance.supplyCrossCheck.grossMinusNetNear, 3),
    SCENARIO_TABLE: scenarios, THRESHOLD_TABLE: thresholds,
    AGGRESSIVE_PCT: `${n(issuance.model.scenarios.at(-1).shareOfDailyIssuancePct, 4)}%`,
    FETCH_DATE: day(snapshot.fetchedAt),
    SNAPSHOT_SHA: createHash('sha256').update(canonicalSnapshotText).digest('hex'),
  };
  let result = template;
  for (const [key, value] of Object.entries(values)) result = result.replaceAll(`{{${key}}}`, value);
  const unresolved = result.match(/{{[A-Z_]+}}/g);
  if (unresolved) throw new Error(`Unresolved thesis placeholders: ${unresolved.join(', ')}`);
  return result;
}
