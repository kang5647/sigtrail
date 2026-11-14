// Independent, offline concentration check from the committed row-level audit.
// Usage: node scripts/concentration-report.mjs
import { readFileSync } from 'node:fs';

const snapshot = JSON.parse(readFileSync(new URL('../public/data/snapshot.json', import.meta.url)));
const lines = readFileSync(new URL('../public/data/receipt-audit.csv', import.meta.url), 'utf8').trim().split(/\r?\n/);
const header = 'window_start,window_end,receipt_id,transaction_hash,predecessor,method,receipt_timestamp_utc';
if (lines.shift() !== header) throw new Error('Unexpected receipt CSV header');
const records = new Map();
for (const line of lines) {
  const fields = [...line.matchAll(/(?:^|,)"((?:[^"]|"")*)"(?=,|$)/g)].map(match => match[1].replaceAll('""', '"'));
  if (fields.length !== 7) throw new Error(`Malformed receipt row: ${line.slice(0, 80)}`);
  const [start, end, id, transaction, caller, method, timestamp] = fields;
  if (!/^\d+$/.test(start) || !/^\d+$/.test(end) || !id || !transaction || !caller || !method || !timestamp)
    throw new Error(`Incomplete receipt row: ${line.slice(0, 80)}`);
  const record = { start: Number(start), end: Number(end), id, transaction, caller, method, timestamp };
  const previous = records.get(id);
  if (previous && JSON.stringify(previous) !== JSON.stringify(record)) throw new Error(`Conflicting receipt ${id}`);
  records.set(id, record);
}

const all = [...records.values()];
const pct = (numerator, denominator) => `${(100 * numerator / denominator).toFixed(1)}%`;
function concentration(rows) {
  const direct = rows.filter(row => row.method === 'sign');
  const counts = new Map();
  for (const row of direct) counts.set(row.caller, (counts.get(row.caller) || 0) + 1);
  const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const topOne = ranked[0]?.[1] || 0;
  const topThree = ranked.slice(0, 3).reduce((sum, [, count]) => sum + count, 0);
  return { direct: direct.length, callers: counts.size, topOne, topThree, ranked };
}
function select(window) {
  return all.filter(row => row.start === window.blocks[0] && row.end === window.blocks[1]);
}
function assertWindow(window, result) {
  if (window.categories.request !== result.direct || window.uniqueCallers !== result.callers ||
      window.topThreeCount !== result.topThree || window.topCallers[0]?.count !== result.topOne)
    throw new Error(`Snapshot disagrees with row-level receipts for ${window.blocks.join('–')}`);
}
function printWindow(window) {
  const result = concentration(select(window));
  assertWindow(window, result);
  return `| ${window.blocks[0]}–${window.blocks[1]} | ${result.direct} | ${result.callers} | ${result.topOne}/${result.direct} (${pct(result.topOne, result.direct)}) | ${result.topThree}/${result.direct} (${pct(result.topThree, result.direct)}) |`;
}

console.log('Historical windows (parent-transaction block ranges):');
console.log('| Blocks | Direct sign | Initiating accounts | Top one | Top three |');
console.log('|---|---:|---:|---:|---:|');
for (const window of snapshot.signerWindows.filter(window => window.sampleSize != null)) console.log(printWindow(window));
console.log('\nSame-day spaced windows:');
console.log('| Blocks | Direct sign | Initiating accounts | Top one | Top three |');
console.log('|---|---:|---:|---:|---:|');
for (const window of snapshot.dayWindows) console.log(printWindow(window));

const dayStarts = new Set(snapshot.dayWindows.map(window => window.blocks[0]));
const dayRows = all.filter(row => dayStarts.has(row.start));
const day = concentration(dayRows);
if (day.direct !== snapshot.daySummary.categories.request || day.callers !== snapshot.daySummary.uniqueCallers ||
    day.topThree !== snapshot.daySummary.topThreeCount) throw new Error('Pooled day summary disagrees with receipt rows');
const span = snapshot.dayWindows.reduce((sum, window) => sum +
  (Date.parse(window.observedRange[1]) - Date.parse(window.observedRange[0])) / 1000, 0);
const group = ['omni.bridge.near', 'btc-connector.bridge.near', 'zcash-connector.bridge.near'];
const groupCount = group.reduce((sum, account) => sum + (day.ranked.find(([caller]) => caller === account)?.[1] || 0), 0);
console.log(`\nPooled: ${day.direct} direct sign receipts, ${day.callers} initiating accounts; top one ${day.topOne}/${day.direct} (${pct(day.topOne, day.direct)}), top three ${day.topThree}/${day.direct} (${pct(day.topThree, day.direct)}).`);
console.log(`Bridge-named account cluster (architectural grouping, ownership unverified): ${groupCount}/${day.direct} (${pct(groupCount, day.direct)}).`);
console.log(`Selected block heights: ${snapshot.dayWindows.length * 1000}; first-start to last-end span: ${snapshot.dayWindows.at(-1).blocks[1] - snapshot.dayWindows[0].blocks[0] + 1} heights.`);
console.log(`First-to-last matching-parent-transaction time within each window: ${(span / 3600).toFixed(2)} hours (${pct(span, 86400)} of a UTC day); this is not exact block-boundary coverage.`);
console.log('Pooled caller counts:');
for (const [account, count] of day.ranked) console.log(`  ${account}: ${count}`);
