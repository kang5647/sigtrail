import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { rebuildComparison } from '../src/comparison.mjs';
import { buildInvestigation } from '../src/investigation.mjs';
import { renderMeasurementReport, measurementAuditGrid } from '../src/measurement-report.mjs';
import { rebuildArtifacts } from '../src/audit.mjs';
import { renderThesis } from '../src/thesis.mjs';
import { writeArtifacts } from '../src/write-artifacts.mjs';
import { analyzeFullDayRecord } from '../src/full-day.mjs';
import { findingEvidence, evidenceManifest, assertArchiveSha256 } from '../src/research.mjs';

const dataDir = new URL('../public/data/', import.meta.url);
const source = JSON.parse(await readFile(new URL('snapshot.json', dataDir), 'utf8'));
const archive = await readFile(new URL('full-day-census.json.gz', dataDir));
const archiveSha = assertArchiveSha256(archive, source.fullDayCensus?.archiveSha256, 'Full-day');
const comparisonArchive = await readFile(new URL('comparison-source.json.gz', dataDir));
const seals = JSON.parse(await readFile(new URL('../evidence/archive-checksums.json', import.meta.url), 'utf8'));
assertArchiveSha256(archive, seals['full-day-census.json.gz'], 'Full-day');
assertArchiveSha256(comparisonArchive, seals['comparison-source.json.gz'], 'Comparison');
const comparisonSource = JSON.parse(gunzipSync(comparisonArchive));
const compared = rebuildComparison(comparisonSource);
const investigation = buildInvestigation(comparisonSource);
investigation.sourceArchive.sha256 = seals['comparison-source.json.gz'];
const fullDayRecord = JSON.parse(gunzipSync(archive));
const fullDay = analyzeFullDayRecord(fullDayRecord, archiveSha);
source.fullDayCensus = fullDay.summary;
const { snapshot, files } = rebuildArtifacts(source);
files['full-day-receipt-audit.csv'] = fullDay.csv;
files['investigation.json'] = JSON.stringify(investigation) + '\n';
files['investigation-checks.json'] = JSON.stringify(measurementAuditGrid(investigation),null,2) + '\n';
files['comparison.json'] = JSON.stringify(compared.summary, null, 2) + '\n';
files['comparison-receipts.csv'] = compared.csv;
files['finding-evidence.json'] = JSON.stringify(findingEvidence(fullDayRecord)) + '\n';
const template = await readFile(new URL('../THESIS.template.md', import.meta.url), 'utf8');
const thesis = renderThesis(template, snapshot, files['snapshot.json']);
const publicDocs = {};
for (const name of ['METHODOLOGY.md', 'DEMO.md']) publicDocs[name] = await readFile(new URL(`../${name}`, import.meta.url));
await writeArtifacts(dataDir, files);
await writeFile(new URL('../THESIS.md', import.meta.url), thesis);
const findings = renderMeasurementReport(investigation);
await writeFile(new URL('../FINDINGS.md', import.meta.url), findings);
const messages = [
  `Offline rebuild: ${snapshot.signerWindows.length} historical windows, ${snapshot.dayWindows.length} spaced windows, ${snapshot.daySummary.categories.request} pooled direct sign requests, ${snapshot.feeFootprint.receiptCount} fee outcomes`,
  `Full UTC-day parent cohort: ${snapshot.fullDayCensus.touchingTransactions.toLocaleString('en-US')} touching transactions, ${snapshot.fullDayCensus.categories.request.toLocaleString('en-US')} direct sign receipts, ${snapshot.fullDayCensus.topThreeCount.toLocaleString('en-US')} from top three (${(snapshot.fullDayCensus.topThreeShare * 100).toFixed(1)}%)`,
  `Issuance baseline: ${snapshot.issuanceAudit.epochs.length} epoch transitions, ${snapshot.issuanceAudit.dailyMintedNear.toFixed(3)} NEAR/day gross; 1% offset at ${snapshot.issuanceAudit.model.thresholds[0].requestsPerDay.toLocaleString('en-US')} direct sign requests/day`,
  `Matched UTC hours: ${compared.summary.periods.map(p => p.directRequests).join(' → ')} direct requests; ${(compared.summary.change.directRequestsPct * 100).toFixed(2)}%; not a daily trend`,
  'Rebuilt THESIS.md from committed receipt and epoch-reward records',
];
await writeFile(new URL('rebuild-proof.txt', dataDir), `npm run rebuild\n${messages.join('\n')}\n`);
for (const message of messages) console.log(message);

const manifestFiles = { ...files, 'full-day-census.json.gz': archive, 'comparison-source.json.gz': comparisonArchive,
  'rebuild-proof.txt': await readFile(new URL('rebuild-proof.txt', dataDir)) };
for (const [name, bytes] of Object.entries({ ...publicDocs, 'THESIS.md': thesis, 'FINDINGS.md': findings })) {
  const publicText = bytes.toString().replaceAll('](public/data/', '](data/').replaceAll('](README.md)', '](DEMO.md)').replaceAll('](public/archive.html)', '](archive.html)');
  await writeFile(new URL(`../public/${name}`, import.meta.url), publicText);
  manifestFiles[`../${name}`] = publicText;
}
// The recorded walkthrough is a release artifact, not regenerated analytics.
for (const name of ['walkthrough.mp4', 'walkthrough.srt']) {
  try { manifestFiles[`../${name}`] = await readFile(new URL(`../public/${name}`, import.meta.url)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
await writeFile(new URL('evidence-manifest.json',dataDir), JSON.stringify(evidenceManifest(manifestFiles),null,2)+'\n');
