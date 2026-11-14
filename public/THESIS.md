# Sigtrail: does Chain Signatures activity establish a platform?

**Question.** Does observed NEAR Chain Signatures activity support the claim that chain abstraction is becoming a platform?

**Current answer.** The shared signing service is demonstrably used. The available receipts do not identify the breadth of independently operated applications or establish sustained adoption. A platform can be successful and concentrated, so account concentration alone neither confirms nor refutes the long-term case. Direct-stage token capture is a separate, incompletely measured question.

**Conditional long-term thesis.** NEAR could become a reusable coordination layer if unrelated applications sustain use of shared signing infrastructure and complete valuable actions on other chains. Observed requests and a documented bridge integration support the capability and actual-use part of that case. The present cohorts cannot identify how broadly independent applications rely on it, and sampled initial-stage fees do not measure its complete economic value or a token price response.

**Original contribution.** The [reproducible measurement investigation](FINDINGS.md) tests the same matched parent cohorts under request-receipt and exact signing-input definitions. The whole-hour comparison changes direction; shorter windows do not all retain that reversal. That is a bounded counterexample to interpreting a raw activity change as adoption. It is not a finding that platform adoption rose or fell.

Separate full-day context shows account-level concentration: in a post hoc census of all signer-touching **parent transactions included in 11 November UTC**, the top three initiating accounts made **14,234/17,665 direct `sign` receipts (80.6%)**. In the earlier fixed 1,000-block window, they made **72/80 (90.0%)**; across twelve spaced windows that day, the pooled top three made **1,219/1,482 (82.3%)**. These are accounts, **not unique users or proven independent companies**. The 12 windows are selected, not random; the full-day parent cohort is a separate post hoc test.

## What the receipts establish

A NEAR account can ask `v1.signer` to sign a payload using a derived key. This can authorize transactions on another chain, but the payload can also serve other purposes; a signing request is not itself a cross-chain transfer. This shared MPC signing primitive and NEAR account-level authorization are the potential platform advantage over each application operating its own signing infrastructure. Its utility depends on MPC threshold security and availability. Outbound signing does not by itself verify inbound chain state. [NEAR documentation](https://docs.near.org/chain-abstraction/chain-signatures) describes the capability; this research does not establish a comparative cost or security advantage over other systems. Sigtrail separates transactions merely touching `v1.signer` from receipts whose `receiver_id` is `v1.signer` and whose method is exactly `sign`; MPC callbacks and internal completion work do not count as new requests. [The committed receipt rows](data/receipt-audit.csv) include receipt IDs, methods, parent transaction hashes, caller accounts, and timestamps. The dashboard opens an exact receipt and its public parent transaction.

The latest historical window has **170 signer-touching transactions** but only **80 direct `sign` receipts**. Its leading callers were `omni.bridge.near` (43), `fast-auth.near` (22), `btc-connector.bridge.near` (7). Across the wider same-day sample, there were **1,482 direct receipts from 18 distinct initiating account IDs**; the largest alone made **686/1,482 (46.3%)**. Account IDs are not people, companies, or independent applications.

The post hoc full-day **parent-transaction** cohort is stronger: **37,775** distinct signer-touching parent transactions between the archived UTC boundary blocks yielded **17,665** direct `sign` receipts from **82** initiating account IDs. The largest account made **8,492/17,665 (48.1%)**; the top three made **14,234/17,665 (80.6%)**. Leading accounts were `omni.bridge.near` (8,492), `fast-auth.near` (3,304), `btc-connector.bridge.near` (2,438), `zcash-connector.bridge.near` (2,151). The archive includes the complete indexed parent-hash list, classified signer receipts, source query, boundary hashes, fetch time, and SHA-256 **`9b36c9c2f86575a788b68b1592b33f1b7a9cdf0c81b73ea7afd6a87b6960c065`**; [`npm run rebuild`](DEMO.md) recomputes the conclusion offline. **1 direct receipt was created just after midnight despite its 11 November parent transaction**, so this is a parent-cohort census, not an exact census of all receipts *executed* during the UTC day (execution timestamps were not retained in this older archive). The index may omit records; we have not independently replayed every block from a full node.

The legacy normalized receipt timestamp is its creation/recorded timestamp, not the execution outcome timestamp. Earlier descriptions of execution-time spillover were incorrect; the retained archive cannot establish exact execution-time boundaries.

The seven historical windows were fixed at 1,000 parent-transaction block heights each, every four million heights from 200,000,000 to 224,000,000. The initial three ranges were fixed before their first method audit; four additions were chosen at equal intervals before method classification. Each top-one and top-three count is calculated within its window:

| Parent block range | Signer-touching tx | Direct `sign` | Initiating accounts | Top one | Top three |
| --- | ---: | ---: | ---: | ---: | ---: |
| 200000000–200000999 | 418 | 210 | 9 | 119/210 (56.7%) | 186/210 (88.6%) |
| 204000000–204000999 | 427 | 210 | 9 | 130/210 (61.9%) | 173/210 (82.4%) |
| 208000000–208000999 | 292 | 145 | 8 | 77/145 (53.1%) | 126/145 (86.9%) |
| 212000000–212000999 | 534 | 264 | 12 | 115/264 (43.6%) | 210/264 (79.5%) |
| 216000000–216000999 | 247 | 119 | 9 | 49/119 (41.2%) | 89/119 (74.8%) |
| 220000000–220000999 | 140 | 69 | 11 | 21/69 (30.4%) | 56/69 (81.2%) |
| 224000000–224000999 | 170 | 80 | 8 | 43/80 (53.8%) | 72/80 (90.0%) |

The latest window is not isolated. Twelve same-day ranges were fixed at starts `224000000 + 12000 × i`, `i = 0…11`, before classifying the additional eleven. The first is also the latest historical window, counted only once. The ranges cover **12,000 selected block heights**, or **9.02% of the 133,000-height first-to-last span**. Matching-parent-transaction time within the ranges sums to **1.92 hours, or 8.01% of a UTC day**; that is only a proxy for exact block-boundary time coverage. We do **not** extrapolate the sample's 1,482 receipts to a daily total. Three post hoc interleaved checks found top-three shares of **78/96 (81.3%)**, **49/58 (84.5%)**, and **94/119 (79.0%)**. They are not pooled. The later full-day parent-cohort census provides the stronger check. [METHODOLOGY.md](METHODOLOGY.md) gives the per-window counts, offsets, full-day boundaries, and classification rules; `node scripts/concentration-report.mjs` checks the selected windows independently against the committed CSV.

The [Omni Bridge repository](https://github.com/Near-One/omni-bridge#contract-addresses) identifies `omni.bridge.near` as a bridge contract. Its [Zcash integration test](https://github.com/Near-One/omni-bridge/blob/main/near/omni-tests/src/zcash_stale_transfer_poc.rs) refers to `zcash-connector.bridge.near`; a [NearBlocks indexed case](https://api.nearblocks.io/v3/multichain/signatures?chain=BITCOIN&txn=75a2455fdab91a57c89980f39df4ae50b8d094b28d6e74a87e46468f1148edd7) shows `btc-connector.bridge.near` initiating a Bitcoin-related request. Together those three bridge-family accounts made **1,099/1,482 (74.2%)** of the same-day sample. That is an architectural grouping sensitivity, **not proof of common ownership**. The operator of `fast-auth.near` and other account IDs is unverified here. We cannot turn 18 account IDs into an independent-application count.

One linked [NEAR `sign` transaction](https://pikespeak.ai/transaction-viewer/FrBQdrUigUK1JYaXyVqA7uJH4PvLYJVCHD1iPUn1UrFG) corresponds, according to NearBlocks' index, to a [confirmed Bitcoin transaction](https://mempool.space/tx/75a2455fdab91a57c89980f39df4ae50b8d094b28d6e74a87e46468f1148edd7). We independently checked the NEAR receipt and Bitcoin confirmation, but did not cryptographically match signature bytes. This is **one cross-chain example, not a measured settlement rate**.

## What usage could mean for the token

**Only the direct `sign` receipt stage is measured.** Its 80 execution outcomes sum to **0.033515283 NEAR** in `tokens_burnt`, averaging **0.000418941041 NEAR per receipt** at the sampled November protocol v88. At v88, burnt gas leaves supply; the archived protocol query reports `burnt_gas_reward = [0,1]`. The fee audit excludes parent transactions, MPC responses, cleanup, other contracts, and destination-chain fees. It is **distinct from NEAR Intents fees and buybacks**. Nothing here forecasts token price, total workflow burn, or net supply change.

Applying that **80-outcome mean** to the **17,665 observed direct receipts in the full-day parent cohort** would imply **7.401 NEAR**, or **0.0080%** of the seven-day baseline's normalized daily gross issuance. This is an **estimate**, not measured full-day fee burn: actual gas charges may differ across receipts, and one included direct receipt was created just after the UTC day ended.

To put the stage charge in scale, we summed gross validator and treasury rewards reported by archival NEAR `validators` RPC at every epoch transition in the fixed **Nov 5, 2026–Nov 12, 2026** UTC interval containing the fee sample. The 25 contiguous epoch rewards total **645,868.122 NEAR** minted in seven days, or **92,266.875 NEAR/day** when normalized by seven. The annual comparison, **33,677,409.2 NEAR**, is 365 times that observed daily rate, **not a claim that future issuance is constant**. This is gross issuance before network-wide fee burn, not net supply growth. Epoch rewards are recorded at transition, so a seven-day window avoids mistaking a quiet transition day for zero structural issuance. The individual epoch IDs, block hashes, timestamps, account rewards, source RPC, and fetch time are in [snapshot.json](data/snapshot.json); `npm run issuance-check` re-queries the archived source. The [NEAR economics specification](https://github.com/near/nearcore/blob/master/docs/Economics/Economics.md) describes validator rewards. A separate archival block-header cross-check measures **640,251.368 NEAR** of net `total_supply` growth over the same UTC interval, **5,616.754 NEAR** below gross rewards. This corroborates the issuance scale, but the difference reflects chain-wide supply effects and is **not attributed to Chain Signatures**. `npm run supply-check` verifies four boundary blocks against their committed heights, hashes, timestamps, and supply values.

Holding the measured receipt mean and the v88 burn rule constant yields these **assumption-driven sensitivities**, with no assumed independent-application share:

| Assumed direct requests/day | Sign-stage burn/day | Burn/year at same daily rate | Share of observed daily gross issuance |
| --- | ---: | ---: | ---: |
| 10,000 (10k daily requests sensitivity) | 4.189 NEAR | 1,529.1 NEAR | 0.0045% |
| 1,000,000 (1m daily requests sensitivity) | 418.941 NEAR | 152,913.5 NEAR | 0.4541% |

Even the aggressive one-million-request/day case would offset only **0.4541%** of the contemporaneous daily gross issuance baseline at the measured `sign`-stage charge. The 1,482 sampled requests are not daily throughput; the separate full-day parent cohort counted 17,665 direct receipts, but its full-day fee burn was **not** measured. To offset these shares of gross issuance through this stage alone at the measured charge would require:

| Gross issuance offset target | Direct `sign` requests/day at observed mean |
| --- | ---: |
| 1% | 2,202,384 |
| 10% | 22,023,833 |
| 100% | 220,238,329 |

The dashboard lets a reader change hypothetical daily direct requests and a fee multiple. Its result is `requests/day × observed per-receipt burn × fee multiple`, compared with the seven-day gross issuance baseline's daily average. All scenario requests count; account independence remains unverified and is not an editable adoption estimate. None is observed traffic or a price target. More complete NEAR workflow burn could be larger; measuring it is necessary before any stronger token-capture conclusion.

NEAR Intents has a separate fee and buyback mechanism. DeFiLlama's gross fees include integrator affiliate fees, and its holders-revenue series tracks NEAR bought back, **not NEAR burned by `v1.signer.sign`**. Intents data provide ecosystem context, not evidence that Chain Signatures requests generated those fees.

## What would change the assessment

**Evidence supporting the platform thesis:** comparable, predeclared complete-day cohorts collected over time; documented unrelated application operators with repeat use; and verified destination outcomes that show utility beyond signature requests. A concentrated integration may aggregate broad real usage, so its user and application composition must be measured rather than inferred from the contract name.

**Evidence weakening the platform thesis:** activity explained mainly by repeated identical inputs, benchmark runs, or a small affiliated set after independently documented attribution, without sustained distinct application use. These are competing explanations to investigate, not diagnoses assigned by this dataset. The present repeat-input cases do not establish that all repetitions are retries or that traffic is artificial.

**Economic evidence:** trace the complete NEAR execution path and destination costs for a predeclared cohort, compare actual fees with contemporaneous issuance, and distinguish protocol utility from token value capture. The existing initial-sign-stage sensitivity is not full-workflow revenue or a price model.

We do not set unsupported numerical adoption pass/fail hurdles. Future sampling, definitions and attribution rules should be declared before observing the comparison. The present two-hour study and one-day context cannot settle a long-term investment case.

## Reproduce and audit limits

Run `npm test && npm run rebuild` offline. The rebuild reads committed window receipts, the compressed full-day parent-cohort record, and epoch rewards; deduplicates IDs, reclassifies methods and callers, recalculates fee sums, concentration, issuance, scenarios, thresholds, dashboard files, and this document. It does not need an API key or network access. `npm run refresh` separately fetches current FastNear, DeFiLlama, and cross-chain context; the fixed full-day audit is refreshed only with `npm run full-day-census` and `npm run seal-full-day`. Public APIs may throttle and a failed refresh proves nothing. The earlier snapshot was fetched on **Nov 13, 2026**; its SHA-256 after rebuild is **`53597467fb8e8e5be27c248d11153464804be6ff305d1fc8877d80bba6c6cdeb`**. Source URLs, ranges, timestamps, classifications, and row-level CSV are committed.

FastNear is an index, not an independently operated archival NEAR node. Parent-transaction block selection can include receipts executed after the range. The selected historical and 12 spaced windows are not random or representative monthly estimates. The post hoc parent-cohort census covers the full UTC day's indexed parent block range, but not an exact receipt execution-time cohort. A direct `sign` receipt can fail to produce an external settlement. The scenario burn applies the November v88 rule only to hypothetical future calls; older historical windows used different gas-rebate rules and are **not** a historical burn series. The most important missing measurements are verified operator independence, full-workflow burn, and destination-chain settlement rates.
