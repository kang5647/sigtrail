import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { rebuildArtifacts } from '../src/audit.mjs';
import { writeArtifacts } from '../src/write-artifacts.mjs';

const rpcUrl = 'https://archival-rpc.mainnet.fastnear.com';
const windowStartUtc = '2026-11-05T00:00:00.000Z';
const windowEndUtc = '2026-11-12T00:00:00.000Z';
// These inclusive heights bracket the UTC window. Every 20,000th block is
// sampled; consecutive epoch_height values prove no epoch was skipped.
const sampledHeights = Array.from({ length: 61 }, (_, i) => 223_000_000 + 20_000 * i);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function rpc(method, params) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const response = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: `${method}-${attempt}`, method, params }),
      signal: AbortSignal.timeout(25_000) });
    if (response.ok) {
      const payload = await response.json();
      if (payload.result) return payload.result;
      if (!payload.error) throw new Error(`Empty ${method} response`);
      throw new Error(`${method}: ${JSON.stringify(payload.error)}`);
    }
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 7) throw new Error(`${method} HTTP ${response.status}`);
    await delay(response.status === 429 ? Math.max(10_000, Number(response.headers.get('retry-after')) * 1_000 || 0) * (attempt + 1) : 2_000 * (attempt + 1));
  }
}

const samples = [];
for (const height of sampledHeights) {
  samples.push(await rpc('block', { block_id: height }));
  await delay(300);
}
const uniqueEpochIds = [...new Set(samples.map(block => block.header.epoch_id))];
const allEpochs = [];
for (const epochId of uniqueEpochIds) {
  const validatorInfo = await rpc('validators', { epoch_id: epochId });
  const epochStartHeight = validatorInfo.epoch_start_height;
  const startBlock = await rpc('block', { block_id: epochStartHeight });
  if (startBlock.header.epoch_id !== epochId) throw new Error(`Epoch start mismatch at ${epochStartHeight}`);
  const rewardsYoctoByAccount = validatorInfo.validator_reward_paid_prev_epoch;
  if (!rewardsYoctoByAccount || typeof rewardsYoctoByAccount !== 'object') throw new Error(`No rewards for ${epochId}`);
  const rewardsSha256 = createHash('sha256').update(JSON.stringify(Object.entries(rewardsYoctoByAccount).sort(([a], [b]) => a.localeCompare(b)))).digest('hex');
  allEpochs.push({ epochId, epochHeight: validatorInfo.epoch_height,
    epochStartHeight, epochStartTimeUtc: new Date(Number(BigInt(startBlock.header.timestamp_nanosec) / 1_000_000n)).toISOString(),
    epochStartBlockHash: startBlock.header.hash, rewardsSha256, rewardsYoctoByAccount,
    rewardTotalYocto: Object.values(rewardsYoctoByAccount).reduce((sum, amount) => sum + BigInt(amount), 0n).toString() });
}
allEpochs.sort((a, b) => a.epochStartHeight - b.epochStartHeight);
if (allEpochs[0].epochStartTimeUtc >= windowStartUtc || allEpochs.at(-1).epochStartTimeUtc < windowEndUtc ||
    allEpochs.some((epoch, i) => i && epoch.epochHeight !== allEpochs[i - 1].epochHeight + 1)) {
  throw new Error('Sample does not bracket every epoch in the UTC window');
}
const issuanceAudit = { windowStartUtc, windowEndUtc, dayCount: 7,
  source: { rpcUrl, methods: ['block', 'validators'], fetchedAtUtc: new Date().toISOString(),
    protocolDocsUrl: 'https://github.com/near/nearcore/blob/master/docs/Economics/Economics.md',
    selection: `Fixed 20,000-block stride over heights ${sampledHeights[0]}–${sampledHeights.at(-1)}; all returned epoch_height values contiguous; count reward_paid_prev_epoch at starts in UTC interval`,
    sampledHeights },
  bracketingEpochs: [allEpochs.filter(epoch => epoch.epochStartTimeUtc < windowStartUtc).at(-1),
    allEpochs.find(epoch => epoch.epochStartTimeUtc >= windowEndUtc)].map(({ rewardsYoctoByAccount, rewardTotalYocto, rewardsSha256, ...metadata }) => metadata),
  epochs: allEpochs.filter(epoch => epoch.epochStartTimeUtc >= windowStartUtc && epoch.epochStartTimeUtc < windowEndUtc) };
const dataDir = new URL('../public/data/', import.meta.url);
const source = JSON.parse(await readFile(new URL('snapshot.json', dataDir), 'utf8'));
if (source.issuanceAudit?.supplyCrossCheck) issuanceAudit.supplyCrossCheck = source.issuanceAudit.supplyCrossCheck;
const { snapshot, files } = rebuildArtifacts({ ...source, issuanceAudit });
await writeArtifacts(dataDir, files);
console.log(JSON.stringify({ epochCount: snapshot.issuanceAudit.epochs.length,
  totalMintedYocto: snapshot.issuanceAudit.totalMintedYocto,
  mintedNearInWindow: snapshot.issuanceAudit.mintedNearInWindow,
  dailyMintedNear: snapshot.issuanceAudit.dailyMintedNear,
  annualizedMintedNear: snapshot.issuanceAudit.annualizedMintedNear,
  model: snapshot.issuanceAudit.model,
  epochHeights: snapshot.issuanceAudit.epochs.map(epoch => epoch.epochHeight) }, null, 2));
