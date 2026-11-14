import { readFile } from 'node:fs/promises';
import { rebuildArtifacts } from '../src/audit.mjs';

const source = JSON.parse(await readFile(new URL('../public/data/snapshot.json', import.meta.url), 'utf8'));
const { snapshot } = rebuildArtifacts(source);
const audit = snapshot.issuanceAudit;
const crossCheck = audit.supplyCrossCheck;
if (!crossCheck) throw new Error('No committed supply cross-check');
for (const [label, block] of Object.entries(crossCheck.boundaryBlocks)) {
  const response = await fetch(crossCheck.source, { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: block.height, method: 'block', params: { block_id: block.height } }),
    signal: AbortSignal.timeout(20_000) });
  const payload = await response.json();
  const header = payload.result?.header;
  if (!header) throw new Error(`No archival block ${block.height}: ${JSON.stringify(payload.error)}`);
  const timeUtc = new Date(Number(BigInt(header.timestamp_nanosec) / 1_000_000n)).toISOString();
  if (header.hash !== block.hash || header.total_supply !== block.totalSupplyYocto || timeUtc !== block.timeUtc) {
    throw new Error(`Archived ${label} block differs from committed record`);
  }
}
console.log(JSON.stringify({ source: crossCheck.source, window: [audit.windowStartUtc, audit.windowEndUtc],
  grossMintedNear: audit.mintedNearInWindow, netSupplyChangeNear: crossCheck.netSupplyChangeNear,
  grossMinusNetNear: crossCheck.grossMinusNetNear,
  note: 'Gross-minus-net is not attributed to Chain Signatures; it includes chain-wide supply effects.' }, null, 2));
