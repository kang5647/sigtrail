import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { rebuildArtifacts } from '../src/audit.mjs';
import { renderThesis } from '../src/thesis.mjs';
import { writeArtifacts } from '../src/write-artifacts.mjs';
import { analyzeFullDayRecord } from '../src/full-day.mjs';

const dataDir = new URL('../public/data/', import.meta.url);
const source = JSON.parse(await readFile(new URL('snapshot.json', dataDir), 'utf8'));
const archive = await readFile(new URL('full-day-census.json.gz', dataDir));
const archiveSha = createHash('sha256').update(archive).digest('hex');
const fullDayRecord = JSON.parse(gunzipSync(archive));
const fullDay = analyzeFullDayRecord(fullDayRecord, archiveSha);
source.fullDayCensus = fullDay.summary;
const { snapshot, files } = rebuildArtifacts(source);
files['full-day-receipt-audit.csv'] = fullDay.csv;
const template = await readFile(new URL('../THESIS.template.md', import.meta.url), 'utf8');
const thesis = renderThesis(template, snapshot, files['snapshot.json']);
await writeArtifacts(dataDir, files);
await writeFile(new URL('../THESIS.md', import.meta.url), thesis);
const messages = [
  `Offline rebuild: ${snapshot.signerWindows.length} historical windows, ${snapshot.dayWindows.length} spaced windows, ${snapshot.daySummary.categories.request} pooled direct sign requests, ${snapshot.feeFootprint.receiptCount} fee outcomes`,
  `Full UTC-day parent cohort: ${snapshot.fullDayCensus.touchingTransactions.toLocaleString('en-US')} touching transactions, ${snapshot.fullDayCensus.categories.request.toLocaleString('en-US')} direct sign receipts, ${snapshot.fullDayCensus.topThreeCount.toLocaleString('en-US')} from top three (${(snapshot.fullDayCensus.topThreeShare * 100).toFixed(1)}%)`,
  `Issuance baseline: ${snapshot.issuanceAudit.epochs.length} epoch transitions, ${snapshot.issuanceAudit.dailyMintedNear.toFixed(3)} NEAR/day gross; 1% offset at ${snapshot.issuanceAudit.model.thresholds[0].requestsPerDay.toLocaleString('en-US')} direct sign requests/day`,
  'Rebuilt THESIS.md from committed receipt and epoch-reward records',
];
await writeFile(new URL('rebuild-proof.txt', dataDir), `npm run rebuild\n${messages.join('\n')}\n`);
for (const message of messages) console.log(message);
