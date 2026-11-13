# Thesis: demand quality is the missing Chain Signatures metric

**Question.** Does NEAR's Chain Signatures primitive become a platform used by a diverse set of applications, or does apparent activity mainly reflect callbacks and a few infrastructure integrations?

**Why NEAR matters.** A NEAR account or contract can request an MPC signature for transactions on other chains from `v1.signer`, removing the need for each app to operate separate signing infrastructure. That shared primitive is the potential network advantage. The investment case depends on independent applications adopting it repeatedly and on some durable route from usage to NEAR-token value. Usage alone is insufficient.

## Evidence refreshed 13 November 2026 UTC

The mainnet audit was rebuilt from [FastNear indexed transaction traces](https://docs.fastnear.com/tx). The 25-point raw-activity series samples one 1,000-parent-transaction-block interval every million block heights. Seven of those windows are fully hydrated to classify methods, at fixed four-million-block intervals. Each window spans around 9–10 minutes. The original three audited windows were fixed before the first method classification; the four extra windows were chosen at equal intervals before classifying their methods. The samples are neither random nor exhaustive. Signer receipts may execute after their parent transaction's block range.

| Window start | Transactions involving `v1.signer` | Direct `sign` receipts | Initiating accounts | Top three share |
| --- | ---: | ---: | ---: | ---: |
| 26 May · block 200000000 | 418 | 210 | 9 | 88.6% |
| 23 Jun · block 204000000 | 427 | 210 | 9 | 82.4% |
| 22 Jul · block 208000000 | 292 | 145 | 8 | 86.9% |
| 19 Aug · block 212000000 | 534 | 264 | 12 | 79.5% |
| 17 Sep · block 216000000 | 247 | 119 | 9 | 74.8% |
| 14 Oct · block 220000000 | 140 | 69 | 11 | 81.2% |
| 11 Nov · block 224000000 | 170 | 80 | 8 | 90.0% |

The **11 November top three**—`omni.bridge.near` (43), `fast-auth.near` (22), and `btc-connector.bridge.near` (7)—accounted for **72 of 80 direct requests, or 90%**. This is the sharpest result. The top-three share in the seven windows ranged from **74.8% to 90.0%**. `fast-auth.near` and bridge accounts recur; `tx-bench.near` appears among the leaders in two windows, which is not evidence of independent production application demand. These samples show repeated concentration, but their short duration cannot establish a network-wide adoption trend or measure unique applications. An account is not necessarily a distinct business.

The 11 November window also contained 85 MPC `respond` receipts, 80 internal signature completions, and eight other calls. Those are real contract work, but not additional direct signature requests. The data neither proves broad adoption nor proves decline; these short windows do not support a network-wide growth estimate.

### One-day concentration stress test

We also fixed twelve 1,000-block windows starting at block 224,000,000 and separated by 12,000 block heights, before classifying the additional eleven. They run from **01:50 to 23:34 UTC on 11 November**, at roughly two-hour intervals. The first is the 11 November historical window above, not an extra independent observation. The twelve windows contain **1,482 direct `sign` receipts** from **18 initiating accounts**. Pooling and deduplicating those receipts, `omni.bridge.near` (686), `fast-auth.near` (287), and `btc-connector.bridge.near` (246) made **1,219 of 1,482 requests, or 82.3%**. Each window's own top-three share ranged from **78.3% to 90.6%**.

This is stronger evidence that concentration persists across the sampled day; it is still **spaced sampling, not a full-day census**. The selected windows cover about nine minutes every two hours. They do not show what happened between windows, and the account labels do not establish independent business ownership. The exact ranges, receipts, and caller labels are in the pipeline and CSV.

The wider series contains 25 fixed 1,000-block raw-activity probes from May to November. Matching transaction counts range from **97 to 534 per window**. They add longitudinal context but cannot be relabeled as `sign` requests because only seven windows are method-audited. The first and last observations (418 and 170) are not a network-wide growth rate.

One separate **illustrative settlement case** came from a [NearBlocks multichain-signature index record](https://api.nearblocks.io/v3/multichain/signatures?chain=BITCOIN&txn=75a2455fdab91a57c89980f39df4ae50b8d094b28d6e74a87e46468f1148edd7): [this NEAR transaction](https://nearblocks.io/txns/FrBQdrUigUK1JYaXyVqA7uJH4PvLYJVCHD1iPUn1UrFG) contains a `v1.signer.sign` receipt whose predecessor is `btc-connector.bridge.near`; the associated [Bitcoin transaction](https://mempool.space/tx/75a2455fdab91a57c89980f39df4ae50b8d094b28d6e74a87e46468f1148edd7) is confirmed in block **975,572**. The refresh now verifies that the index record names those exact NEAR transaction, receipt, and Bitcoin transaction IDs. FastNear confirms the NEAR method, while Mempool.space and Blockstream agree on Bitcoin confirmation. The cross-chain association is indexed, not independently cryptographically reconstructed from signature bytes. One case does not establish a network settlement rate.

### Separate token-value test

The aligned 30-day period **14 October–12 November 2026** shows approximately **$5.81 million** in NEAR Intents gross fees and **$1.84 million** in DeFiLlama's holder-revenue/buyback measure, or **31.6%** of gross fees. Gross fees include integrator affiliate fees. This is a separate Intents metric, **not** revenue caused by `v1.signer`. NEAR's own [revenue dashboard](https://revenue.near.org/) covers Intents capture more comprehensively; Capture Test's original contribution is the method-level signer audit and attribution. An investable Chain Signatures value-capture thesis still needs an evidenced route from its requests to token demand or buybacks.

## Current judgment

**Conditional, with repeated concentration in the sampled windows.** Chain Signatures is a real NEAR primitive; the seven historical windows show direct requests from 8–12 initiating accounts each, with top-three concentration of 74.8–90.0%. The denser day audit puts the pooled top three at 82.3% of 1,482 sampled requests. The evidence is insufficient to claim a broad independent application ecosystem or direct token value capture from Chain Signatures. Intents buybacks support a different, separately measured economic claim.

## What would change the judgment

**Support the thesis:** In a preregistered weekly series of equal-sized block windows, direct `sign` requests remain material while the number of independently identified applications rises and the largest caller's share falls. In parallel, trace destination-chain settlements for a representative cohort and document an actual fee-to-token mechanism for Chain Signatures activity.

**Weaken or falsify it:** A longer series shows that activity grows mainly through one bridge or test infrastructure, method-level requests do not diversify, destination-chain completion is weak, or no defensible token-capture mechanism emerges. A rise in raw `v1.signer` account transactions by itself is not supporting evidence.

These are directional criteria, not ex post thresholds chosen to make the seven current windows look favorable. Future windows must be fixed before reading them and archived with provenance.

## Reproduction and limits

Run `npm run refresh` from this repository. The script uses fixed ranges in `scripts/refresh.mjs`, paginates all matching FastNear account transactions for the seven historical and twelve day windows, hydrates their complete traces in batches of 20, classifies the receipts in `src/analysis.mjs`, and stores the filtered receipt IDs, transaction hashes, methods, callers, and timestamps in `public/data/snapshot.json` and `public/data/receipt-audit.csv`. The overlapping window appears once in the CSV. A one-page count query builds each of the 25 raw-activity points. The same script aligns DeFiLlama feeds on complete UTC dates. Default refresh reuses verified fixed-window receipts from the snapshot and resumable local cache; `npm run refresh -- --full-audit` re-downloads them all, subject to FastNear rate limits.

FastNear is an indexed service, not an independent archival NEAR node. An API outage or policy change may prevent a fresh rebuild, so the snapshot is committed for audit. The data excludes calls that never reached `v1.signer`, and a direct request can fail or never result in an external transaction. The Bitcoin case depends on NearBlocks for the association and is independently checked only for the two chain records. No price target or probability of winning is inferred.
