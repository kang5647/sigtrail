# Chain Signatures concentration audit

**Scope.** These are counts of distinct `v1.signer` receipts whose action calls `sign`, selected by the block height of their parent transaction. A receipt may execute after its parent range. The `predecessor_id` on that receipt identifies the initiating NEAR account. It does **not** identify a unique user, company, human, or independent application. A contract can serve many people, and multiple accounts can belong to one integration or operator. An independent application would require separate evidence of its product, operator, and non-affiliation with the chain infrastructure; account names alone cannot establish that.

Run `node scripts/concentration-report.mjs` from the repository root to recompute the tables below from the committed [`receipt-audit.csv`](public/data/receipt-audit.csv) and check them against [`snapshot.json`](public/data/snapshot.json). The script deduplicates by receipt ID, fails on conflicting duplicates, filters the exact `sign` method, counts predecessor accounts, and fails when its result disagrees with the snapshot. `npm run rebuild` regenerates the app from committed records; `npm run refresh` is the separate live-source path. The live data source is [FastNear's Transactions API](https://docs.fastnear.com/tx), queried at [`/v0/account`](https://tx.main.fastnear.com/v0/account) and hydrated at [`/v0/transactions`](https://tx.main.fastnear.com/v0/transactions). See [NEAR's Chain Signatures documentation](https://docs.near.org/chain-abstraction/chain-signatures) for the `sign` contract action.

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

Re-run each with `npm run spot-check -- <start>`. The three checks retain high top-three concentration, but only cover three more short intervals. They do not justify a claim about all unobserved hours, and a complete-day census remains the stronger test.

## Related accounts and unresolved ownership

The [Omni Bridge source repository](https://github.com/Near-One/omni-bridge#contract-addresses) explicitly identifies `omni.bridge.near` as its NEAR mainnet bridge contract and explains that outbound transfers use Chain Signatures. Its [Zcash integration test](https://github.com/Near-One/omni-bridge/blob/main/near/omni-tests/src/zcash_stale_transfer_poc.rs) explicitly describes a mock connector playing the role of `zcash-connector.bridge.near`. A [specific NearBlocks indexed Bitcoin case](https://api.nearblocks.io/v3/multichain/signatures?chain=BITCOIN&txn=75a2455fdab91a57c89980f39df4ae50b8d094b28d6e74a87e46468f1148edd7) links a `btc-connector.bridge.near` `sign` receipt to an outbound Bitcoin transaction. These support an **architectural bridge-family grouping**, not a conclusion that all three accounts share one legal owner, team, or control key. Their counts total **1,099/1,482 (74.2%)** in the same-day pool. Treat that as a sensitivity grouping, not a count of independent companies.

`fast-auth.near` (287) is shown separately. Its account name suggests FastAuth infrastructure, but this audit has no source proving operator identity or independence. `tx-bench.near` (46) and the four `kernel-*.meteor-vaults.near` accounts (38 combined) are also unverified at the operator level. The remaining initiating account ownership is unknown. Grouping solely by name, prefix, or account suffix would overstate what the evidence proves. No reliable lower bound for independent application operators follows from 18 account IDs.

**Implication for the thesis:** the evidence establishes live Chain Signatures requests and substantial concentration in identifiable infrastructure-shaped callers. It cannot establish broad independent application adoption. Evidence that would change that assessment is a sustained full-day or multi-day receipt census with operator attribution, documented unrelated applications, and repeated requests outside the bridge and auth clusters.
