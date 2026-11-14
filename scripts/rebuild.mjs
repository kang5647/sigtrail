import { readFile, writeFile } from 'node:fs/promises';
import { rebuildArtifacts } from '../src/audit.mjs';
import { renderThesis } from '../src/thesis.mjs';
import { writeArtifacts } from '../src/write-artifacts.mjs';

const dataDir = new URL('../public/data/', import.meta.url);
const source = JSON.parse(await readFile(new URL('snapshot.json', dataDir), 'utf8'));
const { snapshot, files } = rebuildArtifacts(source);
const template = await readFile(new URL('../THESIS.template.md', import.meta.url), 'utf8');
const thesis = renderThesis(template, snapshot, files['snapshot.json']);
await writeArtifacts(dataDir, files);
await writeFile(new URL('../THESIS.md', import.meta.url), thesis);
const messages = [
  `Offline rebuild: ${snapshot.signerWindows.length} historical windows, ${snapshot.dayWindows.length} spaced windows, ${snapshot.daySummary.categories.request} pooled direct sign requests, ${snapshot.feeFootprint.receiptCount} fee outcomes`,
  `Issuance baseline: ${snapshot.issuanceAudit.epochs.length} epoch transitions, ${snapshot.issuanceAudit.dailyMintedNear.toFixed(3)} NEAR/day gross; 1% offset at ${snapshot.issuanceAudit.model.thresholds[0].requestsPerDay.toLocaleString('en-US')} direct sign requests/day`,
  'Rebuilt THESIS.md from committed receipt and epoch-reward records',
];
await writeFile(new URL('rebuild-proof.txt', dataDir), `npm run rebuild\n${messages.join('\n')}\n`);
for (const message of messages) console.log(message);
