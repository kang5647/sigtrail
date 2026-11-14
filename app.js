const $ = selector => document.querySelector(selector);
const integer = value => Math.round(value).toLocaleString('en-US');
const percent = value => value == null ? '—' : `${(value * 100).toFixed(1)}%`;
const money = value => value >= 1_000_000 ? `$${(value / 1_000_000).toFixed(2)}M` : `$${integer(value)}`;
const shortDate = iso => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function appendCaller(list, caller, max) {
  const row = element('div', 'caller-row');
  const top = element('div', 'caller-top');
  top.append(element('span', '', caller.account), element('span', '', integer(caller.count)));
  const track = element('div', 'caller-track');
  const fill = element('div', 'caller-fill');
  fill.style.width = `${Math.max(2, caller.count / max * 100)}%`;
  track.append(fill);
  row.append(top, track);
  list.append(row);
}

function showReceipt(request, receipt) {
  const inspector = $('#receipt-inspector');
  inspector.replaceChildren(element('span', 'mono-label', 'VERIFIABLE SIGN RECEIPT'));
  if (!receipt) {
    inspector.append(element('p', '', 'This request has no matching receipt in the committed audit. Check the downloadable CSV.'));
    return;
  }
  const timestamp = receipt.block_timestamp
    ? new Date(Number(BigInt(receipt.block_timestamp) / 1_000_000n)).toISOString()
    : 'Unavailable';
  for (const [label, value] of [
    ['Receipt ID', receipt.id],
    ['Caller → contract', `${receipt.predecessor_account_id} → v1.signer`],
    ['Method', 'sign'],
    ['Receipt time', timestamp],
    ['Parent transaction', receipt.transaction_hash],
  ]) {
    const row = element('div', 'receipt-field');
    row.append(element('span', '', label), element('code', '', value));
    inspector.append(row);
  }
  const link = element('a', 'receipt-source', 'Open parent transaction on Pikespeak ↗');
  link.href = `https://pikespeak.ai/transaction-viewer/${encodeURIComponent(request.hash)}`;
  link.target = '_blank';
  link.rel = 'noreferrer';
  inspector.append(link);
}

function renderModel(averageNear, dailyIssuanceNear) {
  const inputs = ['#model-requests', '#model-independent', '#model-multiple'].map(selector => $(selector));
  const requests = Number($('#model-requests').value);
  const independent = Number($('#model-independent').value);
  const multiple = Number($('#model-multiple').value);
  const valid = inputs.every(input => input.value.trim() !== '')
    && [requests, independent, multiple].every(Number.isFinite)
    && requests >= 0 && requests <= 100_000_000
    && independent >= 0 && independent <= 100
    && multiple >= 0.1 && multiple <= 10;
  if (!valid) {
    $('#model-daily').textContent = 'Enter values in range';
    $('#model-yearly').textContent = '—';
    $('#model-ratio').textContent = '—';
    return;
  }
  const daily = requests * independent / 100 * averageNear * multiple;
  $('#model-daily').textContent = `${daily.toLocaleString('en-US', { maximumFractionDigits: 4 })} NEAR`;
  $('#model-yearly').textContent = `${(daily * 365).toLocaleString('en-US', { maximumFractionDigits: 2 })} NEAR`;
  $('#model-ratio').textContent = `${(daily / dailyIssuanceNear * 100).toFixed(4)}%`;
}

function renderWindow(data, index) {
  const window = data.signerWindows[index];
  const categories = window.categories;
  const total = Object.values(categories).reduce((sum, value) => sum + value, 0);
  $('#block-range').textContent = `${integer(window.blocks[0])}–${integer(window.blocks[1])}`;
  $('#raw-count').textContent = integer(window.touchingTransactions);
  $('#sign-count').textContent = integer(categories.request);
  $('#sample-note').textContent = `${shortDate(window.observedRange[0])} · ${integer(window.sampleSize)} deduplicated method receipts across ${integer(window.touchingTransactions)} transactions. Fixed 1,000-block sample, not a daily total.`;
  $('#top-share').textContent = percent(window.topCallerShare);
  $('#top-three-share').textContent = percent(window.topThreeShare);
  const pieces = [
    ['Direct sign', categories.request, 'comp-request'],
    ['MPC response', categories.mpc_response, 'comp-response'],
    ['Internal completion', categories.internal_completion, 'comp-internal'],
    ['Other calls', categories.other_method + categories.other_receipt, 'comp-other'],
  ];
  $('#composition').replaceChildren();
  $('#composition-legend').replaceChildren();
  $('#composition').setAttribute('aria-label', pieces.map(([label,count]) => `${label}: ${count}`).join(', '));
  for (const [label, count, name] of pieces) {
    const segment = element('div', `comp-segment ${name}`);
    segment.style.width = `${total ? count / total * 100 : 0}%`;
    segment.title = `${label}: ${integer(count)}`;
    $('#composition').append(segment);
    const legend = element('span', 'legend-item');
    legend.append(element('i', `legend-swatch ${name}`), element('span', '', `${label} ${integer(count)}`));
    $('#composition-legend').append(legend);
  }
  const callers = $('#caller-list');
  callers.replaceChildren();
  for (const caller of window.topCallers) appendCaller(callers, caller, window.topCallers[0]?.count || 1);
  if (window.uniqueCallers > window.topCallers.length) callers.append(element('div', 'caller-row', `+ ${window.uniqueCallers - window.topCallers.length} more initiating contracts`));
  const proofs = $('#proof-rows');
  proofs.replaceChildren();
  $('#receipt-inspector').replaceChildren(element('span', 'mono-label', 'SELECT A REQUEST ABOVE'));
  for (const request of window.recentRequests.slice(0, 5)) {
    if (!request.hash) continue;
    const receipt = window.receipts?.find(candidate => candidate.transaction_hash === request.hash
      && candidate.predecessor_account_id === request.account
      && candidate.actions?.some(action => action.method === 'sign'));
    const row = element('button', 'proof-row');
    row.type = 'button';
    row.append(element('span', '', request.account), element('span', 'hash', receipt ? `Receipt ${receipt.id.slice(0, 8)}… →` : 'Inspect →'));
    row.addEventListener('click', () => {
      [...proofs.children].forEach(item => item.setAttribute('aria-pressed', String(item === row)));
      showReceipt(request, receipt);
    });
    row.setAttribute('aria-pressed', 'false');
    proofs.append(row);
  }
  [...$('#window-tabs').children].forEach((tab, i) => { tab.setAttribute('aria-selected', i === index ? 'true' : 'false'); tab.tabIndex = i === index ? 0 : -1; });
}

function render(data) {
  const moneyGrid = document.querySelector('.money-grid');
  moneyGrid.before(document.querySelector('.fee-panel'));
  moneyGrid.before(element('h3', 'intents-heading', 'Separate context: NEAR Intents fees and buybacks'));
  const latest = data.signerWindows.at(-1);
  const census = data.fullDayCensus;
  $('#hero-share').textContent = percent(census.topThreeShare);
  $('#hero-count').textContent = `${integer(census.topThreeCount)} of ${integer(census.categories.request)}`;
  $('#hero-raw').textContent = integer(latest.touchingTransactions);
  $('#hero-sign').textContent = integer(latest.categories.request);
  $('#freshness').textContent = `REFRESHED ${shortDate(data.fetchedAt)} · FEES THROUGH ${shortDate(data.dataThrough)}`;
  $('#fees-30').textContent = money(data.summary.intentsFees30d);
  $('#holders-30').textContent = money(data.summary.intentsHoldersRevenue30d);
  $('#capture-share').textContent = percent(data.summary.holderShareOfGross);
  $('#period-label').textContent = `${shortDate(data.summary.currentPeriod[0])} – ${shortDate(data.summary.currentPeriod[1])}`;
  $('#fee-total').textContent = data.feeFootprint.totalNear.toFixed(4);
  $('#fee-average').textContent = data.feeFootprint.averageNear.toFixed(6);
  $('#fee-10k').textContent = data.feeFootprint.scenarios.find(row => row.dailyRequests === 10_000).signReceiptNearPerDay.toFixed(1);
  $('#fee-100k').textContent = integer(data.feeFootprint.scenarios.find(row => row.dailyRequests === 100_000).signReceiptNearPerDay);
  $('#fee-million').textContent = integer(data.feeFootprint.scenarios.find(row => row.dailyRequests === 1_000_000).signReceiptNearPerDay);
  const issuance = data.issuanceAudit;
  const observedEstimate = census.categories.request * data.feeFootprint.averageNear;
  const estimate = element('p', 'observed-estimate', `Scale check: applying the 80-outcome mean to the ${integer(census.categories.request)} observed full-day parent-cohort requests gives an estimated ${observedEstimate.toFixed(3)} NEAR of sign-stage burn, ${((observedEstimate / issuance.dailyMintedNear) * 100).toFixed(4)}% of the daily gross issuance baseline. Actual full-day fee outcomes were not audited.`);
  document.querySelector('.fee-scenario').append(estimate);
  $('#issuance-seven').textContent = `${integer(issuance.mintedNearInWindow)} NEAR`;
  $('#issuance-daily').textContent = `${integer(issuance.dailyMintedNear)} NEAR`;
  $('#issuance-yearly').textContent = `${integer(issuance.annualizedMintedNear)} NEAR`;
  $('#issuance-period').textContent = `${issuance.windowStartUtc.slice(0, 10)} to ${issuance.windowEndUtc.slice(0, 10)} UTC · ${issuance.epochs.length} epoch transitions · gross validator and treasury rewards. Source is archived mainnet validator RPC, not a fixed inflation-rate assumption.`;
  for (const threshold of issuance.model.thresholds) {
    const row = element('div', 'threshold-row');
    row.append(element('span', '', `${threshold.issuanceSharePct}% of observed issuance`),
      element('strong', '', integer(threshold.requestsPerDay)),
      element('small', '', 'direct sign requests / day at 1× sampled burn'));
    $('#threshold-rows').append(row);
  }
  for (const selector of ['#model-requests', '#model-independent', '#model-multiple']) {
    $(selector).addEventListener('input', () => renderModel(data.feeFootprint.averageNear, issuance.dailyMintedNear));
  }
  renderModel(data.feeFootprint.averageNear, issuance.dailyMintedNear);

  const tabs = $('#window-tabs');
  data.signerWindows.forEach((window, index) => {
    const tab = element('button', 'window-tab');
    tab.type = 'button'; tab.role = 'tab'; tab.id = `window-tab-${index}`;
    tab.setAttribute('aria-selected', 'false');
    tab.append(element('strong', '', shortDate(window.observedRange[0])), element('small', '', `Block ${integer(window.blocks[0])}`));
    tab.addEventListener('click', () => renderWindow(data, index));
    tabs.append(tab);
  });
  tabs.addEventListener('keydown', event => {
    if (!['ArrowRight','ArrowLeft'].includes(event.key)) return;
    event.preventDefault();
    const active = [...tabs.children].findIndex(tab => tab.getAttribute('aria-selected') === 'true');
    const next = (active + (event.key === 'ArrowRight' ? 1 : -1) + tabs.children.length) % tabs.children.length;
    renderWindow(data, next); tabs.children[next].focus();
  });
  const max = Math.max(...data.signerWindows.map(window => window.categories.request));
  for (const window of data.signerWindows) {
    const column = element('div', 'comparison-column');
    column.append(element('span', 'comparison-number', integer(window.categories.request)));
    const bar = element('div', 'comparison-bar');
    bar.style.height = `${Math.max(4, window.categories.request / max * 82)}px`;
    column.append(bar, element('span', 'comparison-label', shortDate(window.observedRange[0])));
    $('#comparison-bars').append(column);
  }
  for (const window of data.signerWindows) {
    const row = element('div', 'matrix-row');
    const heading = element('div', 'matrix-heading');
    heading.append(element('strong', '', shortDate(window.observedRange[0])), element('small', '', `Block ${integer(window.blocks[0])}`));
    row.append(heading);
    for (const [label, value] of [
      ['Direct requests', integer(window.categories.request)],
      ['Caller accounts', integer(window.uniqueCallers)],
      ['Top one', `${integer(window.topCallers[0]?.count || 0)} · ${percent(window.topCallerShare)}`],
      ['Top three', `${integer(window.topThreeCount)} · ${percent(window.topThreeShare)}`],
    ]) {
      const cell = element('div', 'matrix-cell');
      cell.append(element('span', '', label), element('strong', '', value));
      row.append(cell);
    }
    $('#window-matrix-rows').append(row);
  }
  const activity = data.activitySeries;
  if (Array.isArray(activity) && activity.length) {
    const maximum = Math.max(...activity.map(point => point.touchingTransactions));
    const minimum = Math.min(...activity.map(point => point.touchingTransactions));
    $('#activity-range').textContent = `${integer(minimum)}–${integer(maximum)} tx / window`;
    $('#activity-start').textContent = shortDate(activity[0].date);
    $('#activity-end').textContent = shortDate(activity.at(-1).date);
    $('#activity-chart').setAttribute('aria-label', `Raw signer activity in ${activity.length} fixed 1,000-block windows, from ${integer(minimum)} to ${integer(maximum)} matching transactions per window`);
    for (const point of activity) {
      const bar = element('div', `activity-bar ${data.signerWindows.some(window => window.blocks[0] === point.blockStart) ? 'audited' : ''}`);
      bar.style.height = `${Math.max(4, point.touchingTransactions / maximum * 100)}%`;
      bar.title = `${shortDate(point.date)} · block ${integer(point.blockStart)} · ${integer(point.touchingTransactions)} matching transactions${bar.classList.contains('audited') ? ' · method audit above' : ''}`;
      $('#activity-chart').append(bar);
    }
  }
  const day = data.daySummary;
  $('#census-touching').textContent = integer(census.touchingTransactions);
  $('#census-direct').textContent = integer(census.categories.request);
  $('#census-share').textContent = percent(census.topThreeShare);
  $('#census-fraction').textContent = `${integer(census.topThreeCount)} of ${integer(census.categories.request)} direct requests`;
  $('#census-accounts').textContent = integer(census.initiatingAccounts);
  $('#census-fetched').textContent = `FastNear index fetched ${new Date(census.fetchedAtUtc).toLocaleString('en-US', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} UTC · archive SHA-256 ${census.archiveSha256.slice(0, 12)}…`;
  for (const caller of census.topCallers.slice(0, 4)) {
    const cell = element('div');
    cell.append(element('span', '', caller.account), element('strong', '', integer(caller.count)));
    $('#census-callers').append(cell);
  }
  $('#day-share').textContent = percent(day.topThreeShare);
  $('#day-fraction').textContent = `${integer(day.topThreeCount)} of ${integer(day.categories.request)} sampled requests`;
  $('#day-request-count').textContent = integer(day.categories.request);
  $('#day-window-range').textContent = `${percent(day.lowestWindowTopThreeShare)}–${percent(day.highestWindowTopThreeShare)}`;
  $('#day-callers').textContent = `Leading accounts: ${day.topCallers.slice(0, 3).map(caller => `${caller.account} (${integer(caller.count)})`).join(' · ')}`;
  $('#day-start').textContent = new Date(day.observedRange[0]).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true, timeZone: 'UTC' }) + ' UTC';
  $('#day-end').textContent = new Date(day.observedRange[1]).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true, timeZone: 'UTC' }) + ' UTC';
  $('#day-chart').setAttribute('aria-label', `Top-three caller share in ${data.dayWindows.length} sampled windows: ${data.dayWindows.map(window => percent(window.topThreeShare)).join(', ')}`);
  for (const window of data.dayWindows) {
    const bar = element('div', 'day-bar');
    bar.style.height = `${window.topThreeShare * 100}%`;
    bar.title = `${window.observedRange[0].slice(11, 16)} UTC · ${integer(window.categories.request)} requests · top three ${percent(window.topThreeShare)}`;
    $('#day-chart').append(bar);
  }
  const chainCase = data.crossChainCase;
  if (chainCase) {
    $('#case-caller').textContent = `Initiating contract: ${chainCase.signingCaller}`;
    $('#case-block').textContent = `Block #${integer(chainCase.bitcoinBlockHeight)}`;
    $('#case-bitcoin-hash').textContent = `${chainCase.bitcoinTransaction.slice(0, 14)}…${chainCase.bitcoinTransaction.slice(-10)}`;
    $('#case-near-link').href = `https://pikespeak.ai/transaction-viewer/${encodeURIComponent(chainCase.nearTransaction)}`;
    $('#case-bitcoin-link').href = `https://mempool.space/tx/${encodeURIComponent(chainCase.bitcoinTransaction)}`;
  }
  renderWindow(data, data.signerWindows.length - 1);
}

try {
  const response = await fetch('./data/snapshot.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Data request failed (${response.status})`);
  const data = await response.json();
  if (!Array.isArray(data.signerWindows) || data.signerWindows.length !== 7 || data.signerWindows.some(window => !Number.isFinite(window.topThreeShare)) || !Array.isArray(data.dayWindows) || data.dayWindows.length !== 12 || !Number.isFinite(data.daySummary?.topThreeShare) || !Number.isFinite(data.fullDayCensus?.topThreeShare) || !Number.isFinite(data.feeFootprint?.averageNear) || !Number.isFinite(data.issuanceAudit?.dailyMintedNear)) throw new Error('Signer or issuance audit data is incomplete');
  render(data);
  const proof = await fetch('./data/rebuild-proof.txt', { cache: 'no-store' });
  if (proof.ok) $('#rebuild-output').textContent = await proof.text();
} catch (error) {
  const banner = $('#error');
  banner.textContent = `Could not load the audit: ${error.message}. Run npm run refresh, then serve this directory over HTTP.`;
  banner.hidden = false;
}
