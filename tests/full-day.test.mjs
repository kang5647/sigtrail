import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { assertArchiveSha256 } from '../src/research.mjs';
import { analyzeFullDayRecord } from '../src/full-day.mjs';

const root = new URL('../public/data/', import.meta.url);
const archive = await readFile(new URL('full-day-census.json.gz', root));
const record = JSON.parse(gunzipSync(archive));
const snapshot = JSON.parse(await readFile(new URL('snapshot.json', root), 'utf8'));
const archiveSha = createHash('sha256').update(archive).digest('hex');

test('full-day parent cohort independently rebuilds committed counts and CSV', async () => {
  const { summary, csv } = analyzeFullDayRecord(record, archiveSha);
  assert.deepEqual(summary, snapshot.fullDayCensus);
  assert.equal(summary.touchingTransactions, 37_775);
  assert.equal(summary.categories.request, 17_665);
  assert.equal(summary.topThreeCount, 14_234);
  assert.equal(summary.initiatingAccounts, 82);
  assert.equal(summary.directSignsCreatedOutsideUtcDay, 1);
  assert.equal(summary.receiptsCreatedOutsideUtcDay, 2);
  assert.equal(csv, await readFile(new URL('full-day-receipt-audit.csv', root), 'utf8'));
});

test('full-day audit rejects duplicate receipts and falsified parent population', () => {
  assert.throws(() => analyzeFullDayRecord({ ...record,
    receipts: [...record.receipts, record.receipts[0]] }, archiveSha), /Incomplete full-day receipt record/);
  assert.throws(() => analyzeFullDayRecord({ ...record,
    transactionHashes: [...record.transactionHashes.slice(1), record.transactionHashes[0]] }, archiveSha),
  /parent transaction hash list differs/);
});

test('sealed archives cannot be silently resealed by offline rebuild', () => {
 assert.equal(assertArchiveSha256(archive, snapshot.fullDayCensus.archiveSha256, 'Full-day'), archiveSha);
 assert.throws(() => assertArchiveSha256(Buffer.concat([archive,Buffer.from('changed')]), archiveSha, 'Full-day'), /archive SHA-256 differs/);
 assert.throws(() => assertArchiveSha256(archive, undefined, 'Full-day'), /archive SHA-256 differs/);
});
