import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyzeReceipts } from '../src/analysis.mjs';

const data = JSON.parse(await readFile(new URL('../public/data/snapshot.json', import.meta.url), 'utf8'));

test('committed day audit reconciles pooled receipts and concentration', () => {
  assert.equal(data.dayWindows.length, 12);
  const starts = data.dayWindows.map(window => window.blocks[0]);
  assert.equal(new Set(starts).size, 12);
  for (let i = 1; i < starts.length; i++) assert.equal(starts[i] - starts[i - 1], 12_000);
  const summary = analyzeReceipts(data.dayWindows.flatMap(window => window.receipts));
  assert.equal(summary.categories.request, data.daySummary.categories.request);
  assert.equal(summary.topThreeCount, data.daySummary.topThreeCount);
  assert.equal(summary.topThreeShare, data.daySummary.topThreeShare);
});

test('cross-chain case records the exact indexed association', () => {
  const item = data.crossChainCase;
  assert.equal(item.associationRecord.transactionHash, item.nearTransaction);
  assert.equal(item.associationRecord.receiptId, item.nearReceipt);
  assert.equal(item.associationRecord.destinationChain, 'BITCOIN');
  assert.equal(item.associationRecord.destinationTransaction, item.bitcoinTransaction);
  assert.equal(item.status, 'confirmed');
});
