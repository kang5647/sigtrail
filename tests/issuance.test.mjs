import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIssuanceAudit, scenarioAtRequestsPerDay } from '../src/issuance.mjs';

const makeAudit = () => ({ windowStartUtc: '2026-11-05T00:00:00.000Z',
  windowEndUtc: '2026-11-07T00:00:00.000Z', dayCount: 2,
  epochs: [
    { epochId: 'first', epochHeight: 20, epochStartHeight: 100,
      epochStartTimeUtc: '2026-11-05T12:00:00.000Z',
      rewardsYoctoByAccount: { validator: (14_000n * 10n ** 24n).toString(), treasury: (1_000n * 10n ** 24n).toString() },
      rewardTotalYocto: (15_000n * 10n ** 24n).toString() },
    { epochId: 'second', epochHeight: 21, epochStartHeight: 150,
      epochStartTimeUtc: '2026-11-06T12:00:00.000Z',
      rewardsYoctoByAccount: { validator: (14_000n * 10n ** 24n).toString(), treasury: (1_000n * 10n ** 24n).toString() },
      rewardTotalYocto: (15_000n * 10n ** 24n).toString() },
  ] });
const fee = { receiptCount: 2, totalTokensBurntYocto: '1000000000000000000000000' };

test('gross minted reward sums include every account and normalize to exact day count', () => {
  const result = analyzeIssuanceAudit(makeAudit(), fee);
  assert.equal(result.totalMintedYocto, (30_000n * 10n ** 24n).toString());
  assert.equal(result.mintedNearInWindow, 30_000);
  assert.equal(result.dailyMintedNear, 15_000);
  assert.equal(result.annualizedMintedNear, 5_475_000);
  assert.equal(result.model.averageSignBurnNear, 0.5);
  assert.deepEqual(result.model.thresholds.map(row => row.requestsPerDay), [300, 3_000, 30_000]);
});

test('scenario arithmetic is available for an arbitrary adoption assumption', () => {
  assert.deepEqual(scenarioAtRequestsPerDay(1_000, 0.5, 15_000), {
    requestsPerDay: 1_000, burnNearPerDay: 500, burnNearPerYear: 182_500,
    shareOfDailyIssuancePct: 500 / 15_000 * 100,
  });
  assert.throws(() => scenarioAtRequestsPerDay(-1, 0.5, 15_000));
});

test('rejects skipped epochs, reward mismatches, and epochs outside the fixed window', () => {
  const gap = makeAudit(); gap.epochs[1].epochHeight = 22;
  assert.throws(() => analyzeIssuanceAudit(gap, fee), /noncontiguous/);
  const mismatch = makeAudit(); mismatch.epochs[0].rewardsYoctoByAccount.treasury = '0';
  assert.throws(() => analyzeIssuanceAudit(mismatch, fee), /reward sum/);
  const outOfWindow = makeAudit(); outOfWindow.epochs[1].epochStartTimeUtc = outOfWindow.windowEndUtc;
  assert.throws(() => analyzeIssuanceAudit(outOfWindow, fee), /out-of-window/);
});

test('rejects a changed archived reward payload when its hash is committed', () => {
  const audit = makeAudit();
  audit.epochs[0].rewardsSha256 = '0'.repeat(64);
  assert.throws(() => analyzeIssuanceAudit(audit, fee), /rewards hash mismatch/);
});
