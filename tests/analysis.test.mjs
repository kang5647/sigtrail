import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeReceipts, classifyReceipt, extractSignerReceipts, normalizeSeries, summarizeSeries, DAY } from '../src/analysis.mjs';

test('separates direct signature requests from callbacks and internal receipts', () => {
  const make = (method, account) => ({ predecessor_account_id: account, block_timestamp: '1794441600000000000', actions: method ? [{ action: 'FUNCTION_CALL', method }] : null });
  const receipts = [make('sign', 'bridge.near'), make('sign', 'wallet.near'), make('sign', 'bridge.near'), make('respond', 'mpc.near'), make('return_signature_and_clean_state_on_success', 'v1.signer'), make(null, 'v1.signer')].map((receipt, id) => ({ ...receipt, id }));
  assert.equal(classifyReceipt(receipts[3]), 'mpc_response');
  const result = analyzeReceipts(receipts);
  assert.equal(result.categories.request, 3);
  assert.equal(result.uniqueCallers, 2);
  assert.equal(result.topCallerShare, 2 / 3);
  assert.equal(result.sampleSize, 6);
  assert.equal(analyzeReceipts([...receipts, receipts[0]]).sampleSize, 6);
});

test('drops partial current UTC day and keeps sources aligned', () => {
  const start = Date.UTC(2026, 7, 1) / 1000;
  const feeRows = Array.from({length: 62}, (_, i) => [start + DAY * i, 100 + i]);
  const fees = { totalDataChart: feeRows, totalDataChartBreakdown: feeRows.map(([ts]) => [ts, {'NEAR Intents': 50}]) };
  const revenue = { totalDataChartBreakdown: feeRows.map(([ts]) => [ts, {'NEAR Intents': 20}]) };
  const holders = { totalDataChartBreakdown: feeRows.map(([ts]) => [ts, {'NEAR Intents': 10}]) };
  const tvl = feeRows.map(([date]) => ({ date, tvl: 1000 }));
  const rows = normalizeSeries(fees, tvl, revenue, holders, new Date((start + 61 * DAY) * 1000));
  assert.equal(rows.length, 61);
  assert.equal(rows.at(-1).appFees, 160);
  const summary = summarizeSeries(rows);
  assert.equal(summary.intentsFees30d, 1500);
  assert.equal(summary.ecosystemAppFees30d, 4365);
  assert.equal(summary.intentsHoldersRevenue30d, 300);
  assert.equal(summary.holderShareOfGross, 0.2);
});

test('extracts only calls into v1.signer from full transaction traces', () => {
  const raw = [{ transaction: { hash: 'abc' }, receipts: [
    { receipt: { receipt_id: 'r1', receiver_id: 'v1.signer', predecessor_id: 'bridge.near', block_timestamp: 1794441600000000000, receipt: { Action: { actions: [{FunctionCall: {method_name: 'sign'}}] } } } },
    { receipt: { receipt_id: 'r2', receiver_id: 'bridge.near', predecessor_id: 'user.near', block_timestamp: 1794441600000000000, receipt: { Action: { actions: [{FunctionCall: {method_name: 'send'}}] } } } },
  ] }];
  const rows = extractSignerReceipts(raw);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].predecessor_account_id, 'bridge.near');
  assert.equal(classifyReceipt(rows[0]), 'request');
});

test('recent proof links are sorted by receipt time rather than indexer order', () => {
  const receipts = [
    {id:'old', transaction_hash:'oldhash', predecessor_account_id:'a.near', block_timestamp:'1000000000000000000', actions:[{action:'FUNCTION_CALL',method:'sign'}]},
    {id:'new', transaction_hash:'newhash', predecessor_account_id:'b.near', block_timestamp:'2000000000000000000', actions:[{action:'FUNCTION_CALL',method:'sign'}]},
  ];
  const result = analyzeReceipts(receipts);
  assert.equal(result.recentRequests[0].hash, 'newhash');
  assert.equal(result.sampleNewestTimestamp, 2000000000);
  assert.equal(result.sampleOldestTimestamp, 1000000000);
});
