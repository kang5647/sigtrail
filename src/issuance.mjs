import { createHash } from 'node:crypto';

const YOCTO = 10n ** 24n;
const integer = value => /^\d+$/.test(String(value));
const ceilDiv = (a, b) => (a + b - 1n) / b;

export function scenarioAtRequestsPerDay(requestsPerDay, averageSignBurnNear, dailyMintedNear) {
  if (!Number.isSafeInteger(requestsPerDay) || requestsPerDay < 0 ||
      !Number.isFinite(averageSignBurnNear) || averageSignBurnNear <= 0 ||
      !Number.isFinite(dailyMintedNear) || dailyMintedNear <= 0) {
    throw new Error('Invalid adoption sensitivity input');
  }
  const burnNearPerDay = averageSignBurnNear * requestsPerDay;
  return { requestsPerDay, burnNearPerDay, burnNearPerYear: burnNearPerDay * 365,
    shareOfDailyIssuancePct: burnNearPerDay / dailyMintedNear * 100 };
}

// All comparisons use gross rewards minted at epoch transitions. This does not
// subtract chain-wide fee burn and is not a net-supply or price forecast.
export function analyzeIssuanceAudit(audit, feeFootprint) {
  if (!audit || !Array.isArray(audit.epochs) || !audit.epochs.length ||
      !Number.isSafeInteger(audit.dayCount) || audit.dayCount <= 0 ||
      Date.parse(audit.windowEndUtc) - Date.parse(audit.windowStartUtc) !== audit.dayCount * 86_400_000) {
    throw new Error('Invalid issuance window');
  }
  if (audit.bracketingEpochs) {
    const [before, after] = audit.bracketingEpochs;
    if (!before || !after || before.epochStartTimeUtc >= audit.windowStartUtc ||
        after.epochStartTimeUtc < audit.windowEndUtc ||
        before.epochHeight + 1 !== audit.epochs[0].epochHeight ||
        audit.epochs.at(-1).epochHeight + 1 !== after.epochHeight) {
      throw new Error('Issuance epoch boundaries are not fully bracketed');
    }
  }
  if (!integer(feeFootprint.totalTokensBurntYocto) || !Number.isSafeInteger(feeFootprint.receiptCount) ||
      feeFootprint.receiptCount <= 0 || BigInt(feeFootprint.totalTokensBurntYocto) <= 0n) {
    throw new Error('Invalid direct-sign fee sample');
  }
  let total = 0n;
  let previousHeight = -1;
  let previousEpochHeight = null;
  const ids = new Set();
  for (const epoch of audit.epochs) {
    if (typeof epoch.epochId !== 'string' || ids.has(epoch.epochId) ||
        !Number.isSafeInteger(epoch.epochHeight) || !Number.isSafeInteger(epoch.epochStartHeight) ||
        epoch.epochStartHeight <= previousHeight ||
        (previousEpochHeight !== null && epoch.epochHeight !== previousEpochHeight + 1) ||
        Date.parse(epoch.epochStartTimeUtc) < Date.parse(audit.windowStartUtc) ||
        Date.parse(epoch.epochStartTimeUtc) >= Date.parse(audit.windowEndUtc) ||
        !epoch.rewardsYoctoByAccount || typeof epoch.rewardsYoctoByAccount !== 'object') {
      throw new Error('Malformed, out-of-window, or noncontiguous issuance epoch');
    }
    const values = Object.values(epoch.rewardsYoctoByAccount);
    if (!values.length || values.some(value => !integer(value))) throw new Error('Invalid issuance rewards');
    if (epoch.rewardsSha256 && createHash('sha256').update(JSON.stringify(Object.entries(epoch.rewardsYoctoByAccount).sort(([a], [b]) => a.localeCompare(b)))).digest('hex') !== epoch.rewardsSha256) {
      throw new Error('Issuance rewards hash mismatch');
    }
    const reward = values.reduce((sum, value) => sum + BigInt(value), 0n);
    if (reward <= 0n || reward.toString() !== epoch.rewardTotalYocto) throw new Error('Issuance reward sum differs from snapshot');
    total += reward;
    ids.add(epoch.epochId);
    previousHeight = epoch.epochStartHeight;
    previousEpochHeight = epoch.epochHeight;
  }
  const feeYocto = BigInt(feeFootprint.totalTokensBurntYocto);
  const receipts = BigInt(feeFootprint.receiptCount);
  const days = BigInt(audit.dayCount);
  let supplyCrossCheck;
  if (audit.supplyCrossCheck) {
    const blocks = audit.supplyCrossCheck.boundaryBlocks;
    const ordered = [blocks?.startBefore, blocks?.startInside, blocks?.endInside, blocks?.endAfter];
    if (ordered.some(block => !block || !Number.isSafeInteger(block.height) || !block.hash ||
        !integer(block.totalSupplyYocto) || !Number.isFinite(Date.parse(block.timeUtc))) ||
        ordered[0].height + 1 !== ordered[1].height || ordered[2].height + 1 !== ordered[3].height ||
        ordered[0].timeUtc >= audit.windowStartUtc || ordered[1].timeUtc < audit.windowStartUtc ||
        ordered[2].timeUtc >= audit.windowEndUtc || ordered[3].timeUtc < audit.windowEndUtc) {
      throw new Error('Invalid supply boundary cross-check');
    }
    const netYocto = BigInt(ordered[2].totalSupplyYocto) - BigInt(ordered[0].totalSupplyYocto);
    if (netYocto <= 0n || netYocto > total) throw new Error('Net supply change exceeds gross issuance audit');
    supplyCrossCheck = { ...audit.supplyCrossCheck,
      netSupplyChangeNear: Number(netYocto) / Number(YOCTO),
      grossMinusNetNear: Number(total - netYocto) / Number(YOCTO) };
  }
  const dailyMintedNear = Number(total) / Number(YOCTO) / audit.dayCount;
  const averageSignBurnNear = Number(feeYocto) / Number(YOCTO) / feeFootprint.receiptCount;
  const scenarios = [10_000, 1_000_000].map((requestsPerDay, i) => ({
    label: i === 0 ? '10k daily requests sensitivity' : '1m daily requests sensitivity',
    ...scenarioAtRequestsPerDay(requestsPerDay, averageSignBurnNear, dailyMintedNear),
  }));
  const thresholds = [1, 10, 100].map(issuanceSharePct => ({ issuanceSharePct,
    requestsPerDay: Number(ceilDiv(total * BigInt(issuanceSharePct) * receipts,
      days * 100n * feeYocto)) }));
  return { ...audit, supplyCrossCheck, totalMintedYocto: total.toString(), mintedNearInWindow: Number(total) / Number(YOCTO),
    dailyMintedNear, annualizedMintedNear: dailyMintedNear * 365,
    model: { averageSignBurnNear, scenarios, thresholds } };
}
