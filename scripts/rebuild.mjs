import { readFile } from 'node:fs/promises';
import { rebuildArtifacts } from '../src/audit.mjs';
import { writeArtifacts } from '../src/write-artifacts.mjs';

const dataDir = new URL('../public/data/', import.meta.url);
const source = JSON.parse(await readFile(new URL('snapshot.json', dataDir), 'utf8'));
const { snapshot, files } = rebuildArtifacts(source);
await writeArtifacts(dataDir, files);
console.log(`Offline rebuild: ${snapshot.signerWindows.length} historical windows, ${snapshot.dayWindows.length} spaced windows, ${snapshot.daySummary.categories.request} pooled direct sign requests, ${snapshot.feeFootprint.receiptCount} fee outcomes`);
