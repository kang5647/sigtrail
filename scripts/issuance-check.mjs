import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { analyzeIssuanceAudit } from '../src/issuance.mjs';

const source = JSON.parse(await readFile(new URL('../public/data/snapshot.json', import.meta.url), 'utf8'));
const committed = source.issuanceAudit;
const recalculated = analyzeIssuanceAudit(committed, source.feeFootprint);
const rpcUrl = committed.source.rpcUrl;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function rpc(method, params) {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const response = await fetch(rpcUrl, { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: `${method}-${attempt}`, method, params }),
        signal: AbortSignal.timeout(30_000) });
      if (response.ok) {
        const payload = await response.json();
        if (payload.result) return payload.result;
        throw new Error(`${method}: ${JSON.stringify(payload.error)}`);
      }
      if (![429, 500, 502, 503, 504].includes(response.status)) throw new Error(`${method} HTTP ${response.status}`);
      if (attempt === 5) throw new Error(`${method} HTTP ${response.status}`);
      await delay(response.status === 429 ? 10_000 * (attempt + 1) : 1_500 * (attempt + 1));
    } catch (error) {
      if (attempt === 5 || !['TimeoutError', 'TypeError'].includes(error.name)) throw error;
      await delay(1_500 * (attempt + 1));
    }
  }
}

const epochs = [committed.bracketingEpochs[0], ...committed.epochs, committed.bracketingEpochs[1]];
let cursor = 0;
const verified = [];
async function worker() {
  while (cursor < epochs.length) {
    const epoch = epochs[cursor++];
    const info = await rpc('validators', { epoch_id: epoch.epochId });
    const block = await rpc('block', { block_id: epoch.epochStartHeight });
    const timeUtc = new Date(Number(BigInt(block.header.timestamp_nanosec) / 1_000_000n)).toISOString();
    if (info.epoch_height !== epoch.epochHeight || info.epoch_start_height !== epoch.epochStartHeight ||
        block.header.hash !== epoch.epochStartBlockHash || block.header.epoch_id !== epoch.epochId ||
        timeUtc !== epoch.epochStartTimeUtc) throw new Error(`Archived epoch metadata changed: ${epoch.epochId}`);
    if (epoch.rewardTotalYocto) {
      const rewards = info.validator_reward_paid_prev_epoch;
      const ordered = Object.entries(rewards || {}).sort(([a], [b]) => a.localeCompare(b));
      const hash = createHash('sha256').update(JSON.stringify(ordered)).digest('hex');
      const total = ordered.reduce((sum, [, amount]) => sum + BigInt(amount), 0n).toString();
      if (hash !== epoch.rewardsSha256 || total !== epoch.rewardTotalYocto) {
        throw new Error(`Archived reward payload changed: ${epoch.epochId}`);
      }
    }
    verified.push(epoch.epochId);
  }
}
await Promise.all([worker(), worker(), worker()]);
if (verified.length !== epochs.length) throw new Error('Incomplete archival epoch recheck');
console.log(JSON.stringify({ source: rpcUrl, checkedEpochs: committed.epochs.length,
  checkedBracketingEpochs: committed.bracketingEpochs.length,
  totalMintedYocto: recalculated.totalMintedYocto,
  mintedNearInWindow: recalculated.mintedNearInWindow,
  dailyMintedNear: recalculated.dailyMintedNear,
  note: 'Read-only requery; committed snapshot was not modified.' }, null, 2));
