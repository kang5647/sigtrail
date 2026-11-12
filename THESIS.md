# Thesis: demand quality is the missing Chain Signatures metric

**Question.** Does NEAR's Chain Signatures primitive become a platform used by a diverse set of applications, or does apparent activity mainly reflect callbacks and a few infrastructure integrations?

**Why NEAR matters.** A NEAR account or contract can request an MPC signature for transactions on other chains from `v1.signer`, removing the need for each app to operate separate signing infrastructure. That shared primitive is the potential network advantage. The investment case depends on independent applications adopting it repeatedly and on some durable route from usage to NEAR-token value. Usage alone is insufficient.

## Evidence as of 12 November 2026 UTC

The mainnet audit was rebuilt from [FastNear indexed transaction traces](https://docs.fastnear.com/tx). The 25-point raw-activity series samples one 1,000-parent-transaction-block interval every million block heights. Three of those windows are fully hydrated to classify methods. Each window spans around 9–10 minutes. The three audited windows are fixed at 12-million-block intervals, but are not random or exhaustive. Signer receipts may execute after their parent transaction's block range.

| Window | Transactions involving `v1.signer` with function calls | Direct `sign` receipts | Initiating contracts | Largest caller share |
| --- | ---: | ---: | ---: | ---: |
| 26 May, blocks 200000000–200000999 | 418 | 210 | 9 | 56.7% (`fast-auth.near`) |
| 19 Aug, blocks 212000000–212000999 | 534 | 264 | 12 | 43.6% (`fast-auth.near`) |
| 11 Nov, blocks 224000000–224000999 | 170 | 80 | 8 | 53.8% (`omni.bridge.near`) |

The 11 November window also contained 85 MPC `respond` receipts, 80 internal signature completions, and eight other calls. Those are real contract work, but not additional direct signature requests. The largest initiating contract accounted for 43 of the 80 requests. The data neither proves broad adoption nor proves decline; these short, deliberately chosen windows do not support a network-wide trend estimate.

Economic context: the aligned 30-day period **13 October–11 November 2026** shows approximately **$5.99 million** in NEAR Intents gross fees and **$1.80 million** in DeFiLlama's holder-revenue/buyback measure, or 30.0% of gross fees. This is a separate Intents metric, **not** revenue caused by `v1.signer`. NEAR's own [revenue dashboard](https://revenue.near.org/) covers Intents capture more comprehensively; Capture Test's original contribution is the method-level signer audit and attribution.

## Current judgment

**Conditional, with material concentration risk.** Chain Signatures is a real NEAR primitive and the audited windows show real direct requests from multiple contracts. But the latest sampled window is dominated by three accounts (`omni.bridge.near`, `fast-auth.near`, `btc-connector.bridge.near`). The evidence is not yet sufficient to say that a broad application ecosystem or direct token value capture has emerged from Chain Signatures.

## What would change the judgment

**Support the thesis:** In a preregistered weekly series of equal-sized block windows, direct `sign` requests remain material while the number of independently identified applications rises and the largest caller's share falls. In parallel, trace destination-chain settlements for a representative cohort and document an actual fee-to-token mechanism for Chain Signatures activity.

**Weaken or falsify it:** A longer series shows that activity grows mainly through one bridge or test infrastructure, method-level requests do not diversify, destination-chain completion is weak, or no defensible token-capture mechanism emerges. A rise in raw `v1.signer` account transactions by itself is not supporting evidence.

These are directional criteria, not ex post thresholds chosen to make the three current windows look favorable. Future windows must be fixed before reading them and archived with provenance.

## Reproduction and limits

Run `npm run refresh` from this repository. The script uses fixed ranges in `scripts/refresh.mjs`, paginates all matching FastNear account transactions for the three audited windows, hydrates their complete traces in batches of 20, classifies the receipts in `src/analysis.mjs`, and stores the filtered receipt IDs, transaction hashes, methods, callers, and timestamps in `public/data/snapshot.json` and `public/data/receipt-audit.csv`. A one-page count query builds each of the 25 raw-activity points. The same script aligns DeFiLlama feeds on complete UTC dates.

FastNear is an indexed service, not an independent archival NEAR node. An API outage or policy change may prevent a fresh rebuild, so the snapshot is committed for audit. The data excludes calls that never reached `v1.signer`, and a direct request can fail or never result in an external transaction. No price target or probability of winning is inferred.
