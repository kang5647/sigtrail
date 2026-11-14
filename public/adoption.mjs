const count = value => Number(value).toLocaleString('en-US');

// This read separates observed service use from unmeasured adoption.
// It never upgrades two hours into a durable trend or account IDs into apps.
export function adoptionRead(snapshot, comparison) {
  const day = snapshot.fullDayCensus;
  if (!Number.isSafeInteger(day?.categories?.request) || day.categories.request < 0) throw Error('Missing dated request evidence');
  const observations = [{
    title: 'The service is being used',
    value: `${count(day.categories.request)} signing requests`,
    detail: `${day.date} UTC parent cohort. A request is not proof of a completed action on another chain.`,
  }];
  const periods = comparison?.periods;
  if (periods?.length === 2) {
    const [a, b] = periods;
    const delta = a.directRequests ? ((b.directRequests / a.directRequests - 1) * 100).toFixed(1) : null;
    observations.push({
      title: `The matched hours had ${b.directRequests < a.directRequests ? 'fewer' : b.directRequests > a.directRequests ? 'more' : 'the same number of'} requests`,
      value: `${count(a.directRequests)} → ${count(b.directRequests)} requests`,
      detail: `00:00–01:00 UTC on ${a.date} and ${b.date}${delta === null ? '' : ` (${Number(delta) > 0 ? '+' : ''}${delta}%)`}. Two hours cannot establish a lasting adoption trend.`,
    });
  } else observations.push({title: 'Growth is not established', value: 'Historical comparison unavailable', detail: 'One dated cohort cannot establish whether adoption is growing.'});
  observations.push({
    title: 'Most requests came through three accounts',
    value: `${(day.topThreeShare * 100).toFixed(1)}% of direct requests`,
    detail: `${count(day.topThreeCount)} / ${count(day.categories.request)} requests. An account can serve many users; this does not count independent applications.`,
  });
  return {
    heading: day.categories.request ? 'Use is visible. Adoption growth is unproven.' : 'This evidence does not establish use or growth.',
    implication: 'Observed signing use is real. The evidence does not establish growing independent-app adoption or material demand for the NEAR token.',
    economics: Number.isFinite(snapshot.feeFootprint?.averageNear) && snapshot.issuanceAudit?.dailyMintedNear > 0
      ? `The estimated direct-signing fees for this day are ${(day.categories.request * snapshot.feeFootprint.averageNear / snapshot.issuanceAudit.dailyMintedNear * 100).toFixed(4)}% of the daily new-NEAR baseline. This extrapolates 80 sampled fees; full-workflow economics are not measured.`
      : 'Direct-signing economic evidence is unavailable. Full-workflow economics are not measured.',
    observations,
    watch: [
      {title: 'Sustained, broader use', status: 'Not established', action: 'comparison', link: 'View matched periods', detail: 'Compare full days over several weeks. Identify unrelated app operators; new account names alone are not enough.'},
      {title: 'Completed external actions', status: 'Not measured', action: 'requests', link: 'Inspect request evidence', detail: 'Link signing requests to completed actions on other chains. Count what actually happened, not only what was requested.'},
      {title: 'Meaningful token economics', status: 'Full workflow not measured', action: 'fees', link: 'Review fee assumptions', detail: 'Measure the whole workflow’s NEAR fees against new NEAR created. Current fee evidence covers only the initial signing stage.'},
    ],
  };
}
