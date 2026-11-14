# Sigtrail

**Does observed NEAR Chain Signatures activity support the claim that chain abstraction is becoming a platform?**

Sigtrail is an interactive research submission for the NEAR **Investment Thesis** track. It lets a visitor change a counting definition, filter the same matched periods and initiating accounts, inspect exact signing inputs and receipts, and export a reproducible analysis.

**Original contribution:** in two audited matched UTC hours, request receipts decline **615 → 600 (−2.4%)**, while distinct account-and-signing-input groups increase **567 → 574 (+1.2%)**. The whole-hour direction reverses with the measurement definition, but shorter matched windows do not all reproduce that reversal. This is a record-level measurement finding, not an adoption growth estimate.

The shared service is demonstrably used. Independent application breadth, long-term adoption, destination execution and complete token capture remain unresolved. A successful platform can also be concentrated if a few integrations aggregate many users. Neither the positive nor negative platform conclusion is forced.

[Public app](https://kang5647.github.io/sigtrail/) · [Findings and sensitivity table](FINDINGS.md) · [Long-term thesis](THESIS.md) · [Methodology](METHODOLOGY.md) · [60–90-second demonstration](DEMO.md)

## Investigate it

| Do this | See this |
| --- | --- |
| Open the workbench with **Request receipts** selected | 615 → 600, −2.4%, in the two saved matched parent cohorts. |
| Switch to **Distinct signing inputs** | 567 → 574, +1.2%, using the same receipt population. Account and complete decoded sign arguments define an input group; groups are recomputed within each date/window. |
| Change to **First 30 min** | Both metrics decline: 306 → 242 receipts, 283 → 235 input groups. The whole-hour sign reversal is not invariant to sampling time. |
| Choose **Last 30 min** | Both rise: 309 → 358 receipts, 284 → 339 input groups. This is a within-sample comparison, not a trend. |
| Filter **zcash-connector.bridge.near**, then inspect a repeated input | Two distinct request receipt IDs carry identical complete arguments. In the observed repeated pairs one parent trace contains “Already signed”; the other has no failed receipt. This does not classify all repetition as retries. |
| Filter **fast-auth.near** or **omni.bridge.near** | Other repeated inputs have no recorded failure. Repeated input is not synonymous with error, artificial activity or a unique intent. |
| Open either parent transaction | Exact public NEAR evidence for that selected record, with the application error kept separate from the signing request. No settlement rate is inferred. |
| Export the analysis or all selected receipt rows | The active definition, period, account, source seal, exact records and input fingerprints. Grouping does not silently delete receipt evidence from the CSV. |
| Open **Full-day & historical context** | The preserved complete indexed-day account census, selected historical windows, underlying ledger, and direct-stage fee sensitivity. This population is separate from the two-hour input comparison. |

The interface is freely explorable; there is no presentation gate, reveal sequence, wallet or signing action.

## Reproduce offline

Requires Node.js 20+ and Python 3. No npm install, API key or network request is required:

```sh
npm test
npm run rebuild
npm run independent-audit
npm run investigation-check
npm run concentration-check
npm run serve
```

Open http://localhost:4177. `public/` is the static production bundle. The build rejects changed raw-archive bytes before writing outputs; it does not silently recollect or reseal evidence.

- [investigation.json](public/data/investigation.json) is generated from the sealed [raw comparison archive](public/data/comparison-source.json.gz). It retains all 1,215 request records, exact input fingerprints and arguments, three timestamps, same-parent failure facts, raw JSON pointers and trace checksums.
- [JavaScript builder](src/investigation.mjs) validates the complete archived index/hydration sets, emitted receipts, exact receiver/method and argument representation. Duplicate receipt IDs are errors, while separate receipt IDs with matching inputs remain distinct observations.
- [Browser analysis](public/investigate.mjs) applies half-open parent-time windows and account filters, then groups independently inside each selected period.
- [Independent Python recount](scripts/investigation-check.py) imports no production JavaScript. It rebuilds all fingerprints, verifies all 1,215 rows against raw traces, checks every account/window aggregation and the same-parent failure joins. Its [deterministic output](evidence/investigation-independent.json) is committed.
- [Tests](tests/investigation.test.mjs) challenge malformed inputs, ambiguous JSON, duplicate receipts, multi-action receipts, missing graph records, account/time filters, zero denominators and unavailable evidence.
- [Artifact manifest](public/data/evidence-manifest.json) seals the generated data and public document copies. [FINDINGS.md](FINDINGS.md) is generated from the same calculation, not independently typed metrics.

Live recollection is separate: `npm run collect-comparison` or the full-day collection scripts may require provider access, be throttled or return changed index results. Anonymous access observed during preparation is not a permanent service guarantee. Offline reproduction uses the committed archive.

## Coverage and uncertainty

| Population | Coverage and role |
| --- | --- |
| Primary measurement study | Two post hoc first-hour mainnet parent cohorts, 10 and 11 Nov 2026 UTC. FastNear reports 1,295 and 1,253 indexed parents, yielding 615 and 600 exact sign receipt IDs. Full raw transaction traces, arguments, outcomes, boundaries and protocol configurations are archived. |
| Full-day context | 11 Nov 2026 UTC indexed parent range 223,988,378–224,135,609: 37,775 parents, 56,716 normalized signer action receipts, 17,665 direct requests, 82 initiating account IDs, top-three share 80.6%. The older archive omits raw arguments/outcomes, so the input-group lens cannot be applied to it. |
| Historical context | Seven selected 1,000-block windows between May and Nov, plus twelve spaced windows on 11 Nov. Not random, not a continuous time series, and not equal wall-clock exposures. |
| Direct-stage economics | 80 measured initial sign receipt outcomes; validator issuance and supply cross-checks are separate. Whole-workflow burn, service revenue and destination-chain fees are not measured. |

One request receipt is not one signature, person, application or completed destination action. A repeated exact signing input is not necessarily a retry or the same economic intent. An account can aggregate users; several accounts may share one operator. Only the documented Omni Bridge contract role is directly attributed; architectural bridge-family relationships are heuristic, and other operator identities remain unknown. Account names and periodic activity do not establish test or artificial traffic.

Provider parent-set equality and complete returned receipt graphs are checked, but index completeness is not independently validated against a full node. Two selected hours cannot establish sustained growth. The full-day cohort is based on parent inclusion, not all receipts executed during that day. See [METHODOLOGY.md](METHODOLOGY.md) for corrections and alternative explanations.

## Track fit and contribution history

The [Investment Thesis track](https://nearhackathon.com/HACKATHON.md) asks for a long-term NEAR thesis backed by rerunnable data; a conventional software product or generic debugger is not required. Sigtrail keeps the thesis, evidence for/against it and what would change the assessment. The workbench tests the quality of an activity signal used to argue for the platform thesis. Public explorers show individual hashes/statuses; this submission joins a sealed population across dates and exposes exact-input and window sensitivity at record level. It does not claim the pattern generalizes beyond these cohorts or is the first observation of repetition anywhere.

NEAR's role is concrete: `v1.signer` accepts derived-key signing requests from NEAR accounts/contracts for use on other chains. NEAR receipts and parent inclusion provide the observable substrate. The research reads historical mainnet evidence; it deploys no contract and sends no transaction. Shared signing utility and long-term token value are separate hypotheses.

Sigtrail was previously named Capture Test. It is the same project and authentic repository history, not an additional submission. Owner assignment remains kang / Michael. Existing commits include contributions under bibimoh and kang5647; author metadata is preserved. AI assistance was used for implementation, verification and production preparation. Actual contributors and each person's total entries require truthful disclosure before submission.

Related independent projects in this production portfolio are Orbit, PrizeKey and AfterVote. No implementation is imported here. The per-person maximum of two projects and cross-project participation must be reconciled; two accounts do not establish eligibility. No X post or hackathon form submission has been performed.

Hosting uses free GitHub Pages from the `gh-pages` branch; full source remains on `main`. The rejected generated voice clone is excluded from every public artifact. The research demo uses captions unless an acceptable authorized voice asset is supplied.

MIT covers this project's own code. Vendored GSAP from the earlier interface retains its [standard license](https://gsap.com/standard-license/); the present workbench does not load it. UI uses DM Sans with system fallbacks. No credentials, private strategy, raw voice samples, voice IDs, signing service or personal submission payload belongs in the public bundle.
