// Pure browser-safe calculations. A group is an exact observed signing input,
// not a user, application, economic intent, destination transaction or retry.
export function canonicalJSON(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) throw Error('Unsafe JSON number in signing arguments');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJSON(value[key])}`).join(',')}}`;
  }
  throw Error('Signing arguments must contain only JSON values');
}

const windows = { hour: [0, 3600], first30: [0, 1800], last30: [1800, 3600], first15: [0, 900] };

export function analyzeCohorts(data, { lens = 'receipts', window = 'hour', account = '' } = {}) {
  if (!['receipts', 'inputs'].includes(lens) || !Object.hasOwn(windows, window)) throw Error('Unknown investigation lens or window');
  if (typeof account !== 'string' || data?.schemaVersion !== 1 || data.periods?.length !== 2 || !data.inputs) throw Error('Invalid investigation dataset');
  const [lower, upper] = windows[window];
  const periods = data.periods.map(period => {
    const startNs = BigInt(Date.parse(period.startUtc)) * 1_000_000n;
    const lowerNs = startNs + BigInt(lower) * 1_000_000_000n;
    const upperNs = startNs + BigInt(upper) * 1_000_000_000n;
    const rows = period.rows.filter(row => (!account || row.account === account) && BigInt(row.parentTimestampNs) >= lowerNs && BigInt(row.parentTimestampNs) < upperNs);
    const seen = new Set(), grouped = new Map();
    for (const row of rows) {
      if (seen.has(row.receiptId)) throw Error('Duplicate investigation receipt');
      seen.add(row.receiptId);
      if (!Array.isArray(row.inputIds) || !row.inputIds.length || new Set(row.inputIds).size !== row.inputIds.length) throw Error('Invalid signing input assignments');
      for (const id of row.inputIds) {
        const input = data.inputs[id];
        if (!input || input.account !== row.account) throw Error('Missing or mismatched signing input');
        if (!grouped.has(id)) grouped.set(id, { id, account: input.account, canonicalArgs: input.canonicalArgs, rows: [] });
        grouped.get(id).rows.push(row);
      }
    }
    const groups = [...grouped.values()].map(group => {
      const ordered = [...group.rows].sort((a, b) => BigInt(a.parentTimestampNs) < BigInt(b.parentTimestampNs) ? -1 : BigInt(a.parentTimestampNs) > BigInt(b.parentTimestampNs) ? 1 : a.parentHash.localeCompare(b.parentHash) || a.receiptId.localeCompare(b.receiptId));
      const failureIds = new Set(ordered.flatMap(row => row.callbackFailures.map(failure => failure.receiptId)));
      return { ...group, rows: ordered, requestCount: ordered.length, repeatExcess: ordered.length - 1, callbackFailureCount: failureIds.size };
    }).sort((a, b) => b.requestCount - a.requestCount || a.account.localeCompare(b.account) || a.id.localeCompare(b.id));
    const inputAssignments = rows.reduce((sum, row) => sum + row.inputIds.length, 0);
    return { date: period.date, startUtc: new Date(Number(lowerNs / 1_000_000n)).toISOString(), endUtc: new Date(Number(upperNs / 1_000_000n)).toISOString(),
      available: period.available !== false, requestCount: rows.length, inputCount: groups.length, inputAssignments,
      repeatExcess: inputAssignments - groups.length, metricCount: lens === 'receipts' ? rows.length : groups.length,
      accountCount: new Set(rows.map(row => row.account)).size, rows, groups };
  });
  const available = periods.every(period => period.available);
  const absolute = available ? periods[1].metricCount - periods[0].metricCount : null;
  const zeroDenominator = periods[0].metricCount === 0;
  return { lens, window, account, available, periods, change: { absolute, relative: available && !zeroDenominator ? absolute / periods[0].metricCount : null, zeroDenominator, available },
    definition: lens === 'receipts' ? 'Distinct direct sign receipt IDs' : 'Distinct exact signing inputs within each selected cohort',
    limits: ['Post hoc matched parent-transaction cohorts, not a sustained growth estimate.', 'Exact signing inputs are not users, independent applications, unique economic intents or settlements.', 'Repeated inputs are observed repetitions; their cause is not inferred.', 'Failures are joined only to receipts in the same parent trace; this is not a causal retry classification.'] };
}
