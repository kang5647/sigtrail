# Chain Signatures concentration audit

**Scope.** These are counts of distinct `v1.signer` receipts whose action calls `sign`, selected by the block height of their parent transaction. A receipt may execute after its parent range. The `predecessor_id` on that receipt identifies the initiating NEAR account. It does **not** identify a unique user, company, human, or independent application. A contract can serve many people, and multiple accounts can belong to one integration or operator. An independent application would require separate evidence of its product, operator, and non-affiliation with the chain infrastructure; account names alone cannot establish that.

Run `node scripts/concentration-report.mjs` from the repository root to recompute the tables below from the committed [`receipt-audit.csv`](data/receipt-audit.csv) and check them against [`snapshot.json`](data/snapshot.json). The script deduplicates by receipt ID, fails on conflicting duplicates, filters the exact `sign` method, counts predecessor accounts, and fails when its result disagrees with the snapshot. `npm run rebuild` regenerates the app from committed records; `npm run refresh` is the separate live-source path. The live data source is [FastNear's Transactions API](https://docs.fastnear.com/tx), queried at [`/v0/account`](https://tx.main.fastnear.com/v0/account) and hydrated at [`/v0/transactions`](https://tx.main.fastnear.com/v0/transactions). See [NEAR's Chain Signatures documentation](https://docs.near.org/chain-abstraction/chain-signatures) for the `sign` contract action.

## Timestamp correction and units

The legacy archive field `block_timestamp` was taken from `entry.receipt.block_timestamp`: it is the receipt creation/recorded time. It is **not** `entry.execution_outcome.block_timestamp`. Old execution-time labels and the claim that exactly one direct receipt executed outside the day were unsupported. Exactly one retained direct receipt has a creation timestamp outside the day; the number executed outside it is unknown. Request and concentration counts are unchanged. A direct request is one unique receipt containing at least one exact `sign` action; it is not an action count, a successful-signature count, or a settlement count. Classification precedence is `sign`, `respond`, completion, other method. The old normalized archive omits receiver IDs and raw outcomes; receiver filtering cannot be re-audited offline from that archive. Fresh comparison data retain complete raw traces.

## Fixed historical windows

The broader scan fixed 25 ranges of 1,000 parent-transaction block heights, at starts 200,000,000 through 224,000,000 in steps of one million. Seven starts were fully hydrated: 200,000,000, 204,000,000, 208,000,000, 212,000,000, 216,000,000, 220,000,000, and 224,000,000. The initial three starts were fixed before their audit; the four added starts were fixed at equal four-million-block intervals before method classification. **These are selected, not random, windows**, and are too short to estimate monthly network traffic or an adoption trend. Each top three is recalculated within its own window.

| Parent blocks | Direct `sign` | Initiating accounts | Largest account | Top three accounts |
|---|---:|---:|---:|---:|
| 200000000–200000999 | 210 | 9 | 119/210 (56.7%) | 186/210 (88.6%) |
| 204000000–204000999 | 210 | 9 | 130/210 (61.9%) | 173/210 (82.4%) |
| 208000000–208000999 | 145 | 8 | 77/145 (53.1%) | 126/145 (86.9%) |
| 212000000–212000999 | 264 | 12 | 115/264 (43.6%) | 210/264 (79.5%) |
| 216000000–216000999 | 119 | 9 | 49/119 (41.2%) | 89/119 (74.8%) |
| 220000000–220000999 | 69 | 11 | 21/69 (30.4%) | 56/69 (81.2%) |
| 224000000–224000999 | 80 | 8 | 43/80 (53.8%) | 72/80 (90.0%) |

The latest window's top three were `omni.bridge.near` (43), `fast-auth.near` (22), and `btc-connector.bridge.near` (7): **72/80**. There is real `sign` use, but this pattern is weak evidence for broad independent application demand.

## Same-day spaced check and coverage

Before classifying the additional windows, the day check fixed starts `224000000 + 12000 × i` for `i = 0…11`, each covering 1,000 block heights. The first repeats the latest historical range; it is not a thirteenth independent observation. The 12 ranges cover **12,000 block heights** across the inclusive span **224,000,000–224,132,999** (133,000 heights, or 9.02% of that span). The first matching parent transaction was at **2026-11-11 01:50:48 UTC** and the last at **23:34:48 UTC**. Summing the first-to-last matching-parent-transaction time *within* each window gives **1.92 hours, or 8.01% of a 24-hour day**. This is only a proxy for time covered, because the matching transactions need not occur exactly at either block boundary. It is also not a full-day census: the other block heights and times were not classified. We do not extrapolate 1,482 to a daily total.

| Parent blocks | Direct `sign` | Initiating accounts | Largest account | Top three accounts |
|---|---:|---:|---:|---:|
| 224000000–224000999 | 80 | 8 | 43/80 (53.8%) | 72/80 (90.0%) |
| 224012000–224012999 | 105 | 7 | 53/105 (50.5%) | 88/105 (83.8%) |
| 224024000–224024999 | 96 | 7 | 50/96 (52.1%) | 86/96 (89.6%) |
| 224036000–224036999 | 119 | 10 | 48/119 (40.3%) | 96/119 (80.7%) |
| 224048000–224048999 | 121 | 10 | 65/121 (53.7%) | 101/121 (83.5%) |
| 224060000–224060999 | 129 | 8 | 66/129 (51.2%) | 107/129 (82.9%) |
| 224072000–224072999 | 144 | 11 | 62/144 (43.1%) | 114/144 (79.2%) |
| 224084000–224084999 | 143 | 10 | 56/143 (39.2%) | 112/143 (78.3%) |
| 224096000–224096999 | 155 | 8 | 57/155 (36.8%) | 135/155 (87.1%) |
| 224108000–224108999 | 111 | 10 | 56/111 (50.5%) | 93/111 (83.8%) |
| 224120000–224120999 | 162 | 8 | 78/162 (48.1%) | 132/162 (81.5%) |
| 224132000–224132999 | 117 | 10 | 52/117 (44.4%) | 106/117 (90.6%) |

Pooling all twelve and deduplicating receipts yields **1,482** direct requests from **18** distinct initiating account IDs. The largest account, `omni.bridge.near`, made **686/1,482 (46.3%)**. The pooled top three—`omni.bridge.near` (686), `fast-auth.near` (287), and `btc-connector.bridge.near` (246)—made **1,219/1,482 (82.3%)**. The pooled ranking and each window's own ranking answer different questions; the table does not sum each local top-three count to derive the pooled figure.

### Alternative offsets

After the fixed twelve were audited, separate live spot checks were run at three interleaved starts, with the same 1,000-block query and classification. They are **post hoc sensitivity checks**, not random samples and not in the 1,482 pool:

| Parent blocks | Direct `sign` | Initiating accounts | Top three |
|---|---:|---:|---:|
| 224006000–224006999 | 96 | 11 | 78/96 (81.3%) |
| 224018000–224018999 | 58 | 7 | 49/58 (84.5%) |
| 224030000–224030999 | 119 | 11 | 94/119 (79.0%) |

Re-run each with `npm run spot-check -- <start>`. The three checks retain high top-three concentration, but only cover three more short intervals. The separate full-day parent-cohort census below is the stronger test; it was decided on after seeing the selected-window results.

## Post hoc full UTC-day parent cohort

The census selects **every transaction indexed by FastNear's `v1.signer` function-call account query** whose **parent transaction block** falls within 11 November 2026 UTC. Archived mainnet block headers bracket the exact range: height **223,988,377** at 10 November 23:59:59.397 UTC; **223,988,378** at 11 November 00:00:00.014; **224,135,609** at 11 November 23:59:59.752; and **224,135,610** at 12 November 00:00:00.223. Their hashes are in the [compressed immutable record](data/full-day-census.json.gz) and rebuilt [snapshot](data/snapshot.json). The query uses `account_id: v1.signer`, `from_tx_block_height: 223988378`, `to_tx_block_height: 224135609`, `is_function_call: true`, ascending pagination. Collection finished **14 November 2026 03:17:07 UTC**.

The index reported **37,775 parent transactions**; the archive holds **37,775 distinct hashes** and **56,716 deduplicated normalized signer action receipts** after hydrating every indexed hash in 20-transaction batches. Counting only exact `sign` methods addressed to `v1.signer` gives **17,665 direct requests from 82 initiating account IDs**. The largest account, `omni.bridge.near`, made **8,492/17,665 (48.1%)**. The top three, `omni.bridge.near` (8,492), `fast-auth.near` (3,304), and `btc-connector.bridge.near` (2,438), made **14,234/17,665 (80.6%)**. `zcash-connector.bridge.near` added 2,151. The architectural bridge-family grouping (`omni`, `btc-connector`, `zcash-connector`) is **13,081/17,665 (74.1%)**; this still does not establish common legal ownership or exclude independent users served by those contracts.

This is a **complete indexed parent-transaction cohort**, not a complete receipt *execution-time* cohort. Two included signer action receipts, one `sign` and one completion, were created at **12 November 00:00:01.542 UTC** after their parent transaction's 11 November block. Excluding that single direct creation-time spillover yields **17,664**, without changing the concentration conclusion. Conversely, a receipt executed just after midnight from a prior-day parent could be outside the query. FastNear is a third-party index; we checked uniqueness and complete returned traces but did **not** replay every block with an independently operated archival node. The archive stores filtered, normalized `v1.signer` action records, not entire raw transaction traces. [`full-day-receipt-audit.csv`](data/full-day-receipt-audit.csv) exposes every retained receipt ID, parent hash, caller, method, and receipt creation timestamp.

`npm run rebuild` reads the committed gzip archive, checks its parent-hash SHA-256 and boundary evidence, reclassifies all retained signer receipts, and writes the dashboard snapshot, row-level CSV, and thesis offline. To recollect from the live public API, run `npm run full-day-census && npm run seal-full-day && npm run rebuild`. The crawler stores resumable index pages and transaction batches in ignored `.cache/full-day/`; `seal-full-day` refuses an incomplete crawl. Recollection may be throttled or yield a changed index. The archive SHA-256 in the snapshot is the immutable version used for the published conclusion.

## Related accounts and unresolved ownership

The [Omni Bridge source repository](https://github.com/Near-One/omni-bridge#contract-addresses) explicitly identifies `omni.bridge.near` as its NEAR mainnet bridge contract and explains that outbound transfers use Chain Signatures. Its [Zcash integration test](https://github.com/Near-One/omni-bridge/blob/main/near/omni-tests/src/zcash_stale_transfer_poc.rs) explicitly describes a mock connector playing the role of `zcash-connector.bridge.near`. A [specific NearBlocks indexed Bitcoin case](https://api.nearblocks.io/v3/multichain/signatures?chain=BITCOIN&txn=75a2455fdab91a57c89980f39df4ae50b8d094b28d6e74a87e46468f1148edd7) links a `btc-connector.bridge.near` `sign` receipt to an outbound Bitcoin transaction. These support an **architectural bridge-family grouping**, not a conclusion that all three accounts share one legal owner, team, or control key. Their counts total **1,099/1,482 (74.2%)** in the same-day pool. Treat that as a sensitivity grouping, not a count of independent companies.

`fast-auth.near` (287) is shown separately. Its account name suggests FastAuth infrastructure, but this audit has no source proving operator identity or independence. `tx-bench.near` (46) and the four `kernel-*.meteor-vaults.near` accounts (38 combined) are also unverified at the operator level. The remaining initiating account ownership is unknown. Grouping solely by name, prefix, or account suffix would overstate what the evidence proves. No reliable lower bound for independent application operators follows from 18 account IDs.

**Implication for the thesis:** the evidence establishes live Chain Signatures requests and substantial concentration in identifiable infrastructure-shaped callers, now checked across a full UTC-day parent cohort. It cannot establish broad independent application adoption. Evidence that would change that assessment is repeated complete-day cohorts with operator attribution, documented unrelated applications, and sustained requests outside the bridge and auth clusters.

## Matched historical comparison

`comparison-source.json.gz` retains raw FastNear index pages, complete hydrated transaction traces, UTC boundary blocks and start/end protocol configurations for 00:00–01:00 UTC on 10 and 11 November 2026. Selection was post hoc. Parent ranges are 223838228–223844259 and 223988378–223994730. Returned indexed parent counts are 1,295 and 1,253; each hash is hydrated once. Emitted descendant receipt IDs must all exist in each trace. Receiver is checked directly from raw receipts, then exact `sign` method receipts are deduplicated by ID.

The comparison reproduces 615 → 600 requests (−15, −2.439%), 12 → 13 initiating accounts, and top-three share 462/615 (75.1%) → 498/600 (83.0%). Actual direct-stage charges sum to 0.2578427190439618 → 0.2514898298270305 NEAR. Both archived endpoint protocol configurations are v88 with zero contract gas reward. One later-cohort direct receipt executes outside its parent hour; parent inclusion defines membership. The CSV keeps creation and execution time separately.

Two selected hours cannot establish daily growth, sustained trends or independent application adoption. Direct receipt status does not prove signature completion or destination settlement. Complete returned trace coverage does not independently establish that the provider indexed every relevant parent.

Offline rebuild verifies compressed archive bytes against `evidence/archive-checksums.json` and verifies the full-day archive against the snapshot's seal before generating outputs. It recomputes comparison summary/CSV from raw traces. It never silently accepts new archive bytes. If deliberate recollection changes bytes, review the new collection and explicitly update seals in a separate evidence change before rebuilding. `npm run independent-audit` writes `independent-offline.json`; live rechecks write `independent-verification.json` separately so offline replay cannot erase dated live checks.
