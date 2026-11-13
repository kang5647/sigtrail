# Capture Test

**In a November mainnet sample, three contracts initiated 72 of 80 direct Chain Signatures requests (90%). Across twelve spaced windows on the same day, the pooled top three made 1,219 of 1,482 (82.3%). Is use becoming a broad application platform, or still concentrated in infrastructure?**

Capture Test is an independent, reproducible research dashboard for the NEAR Hackathon **Investment Thesis** track. It turns transactions involving the mainnet `v1.signer` contract into a method-level audit: direct `sign` requests, MPC `respond` callbacks, internal completions, and other calls. It then shows which contracts initiated the direct requests. A separate panel reports NEAR Intents fee and holder-revenue data as economic context; it does not attribute Intents revenue to Chain Signatures.

## Run

Requires Node.js 20+ and Python 3 for the local server. There are no npm dependencies, credentials, wallet transactions, or contract deployments.

```sh
npm test
npm run refresh
npm run serve
```

Open `http://localhost:4177`. The committed `public/data/snapshot.json` also lets the dashboard work without a fresh API call. `npm run refresh` replaces it only after all sources, seven historical windows, and the twelve-window day audit rebuild successfully. Public FastNear access can be throttled; retry later if it fails.

The default refresh reuses already audited fixed windows from the committed snapshot and saves newly completed windows in ignored `.cache/` files, so an API throttle can be resumed without downloading earlier traces again. Use `npm run refresh -- --full-audit` to re-fetch every window from FastNear; this can take several minutes and is subject to its public rate limits. Cached receipts are reclassified and checked against their stored counts before reuse.

## What is measured

The [FastNear Transactions API](https://docs.fastnear.com/tx) supplies a raw-activity count for 25 fixed 1,000-block windows, one every million block heights from 200,000,000 to 224,000,000. Seven of those windows—starting at blocks 200,000,000, 204,000,000, 208,000,000, 212,000,000, 216,000,000, 220,000,000, and 224,000,000—are fully audited. The script paginates every matching transaction in those seven windows, fetches complete traces, and deduplicates receipts by ID. The block range selects **parent transactions**; their receipts can execute after the range. A direct request is a receipt with `receiver_id = v1.signer` and a `FunctionCall` method named `sign`. The initiating contract is that receipt's `predecessor_id`. See [NEAR's Chain Signatures documentation](https://docs.near.org/chain-abstraction/chain-signatures) for why `sign` is the relevant method.

The block ranges are equally sized; the seven fully audited ranges are separated by four million block heights. The original three ranges were fixed before the first audit; the four new ranges were selected at equal intervals before their method classification. They are **not random or full-day samples**. The comparison is descriptive, not a statistically representative growth estimate. The dashboard links five recent requests per audited window. The downloadable `public/data/receipt-audit.csv` contains every classified receipt with its transaction hash, method, caller, and timestamp for independent checking.

A separate, denser audit fixes twelve nonoverlapping 1,000-block ranges starting at block 224,000,000, each 12,000 block heights apart, from 01:50 to 23:34 UTC on 11 November. The first overlaps the final historical window and is counted only once in the CSV. The other eleven ranges were fixed before method classification. The dashboard reports top-three concentration both per window (78.3%–90.6%) and after pooling deduplicated requests across the twelve windows (1,219/1,482, or 82.3%). This samples the day at roughly two-hour intervals; it is **not a census of every request that day**.

The economic panel uses the [DeFiLlama NEAR chain app-fees feed](https://api.llama.fi/overview/fees/near), its `dailyRevenue` and `dailyHoldersRevenue` variants, and [NEAR DeFi TVL](https://api.llama.fi/v2/historicalChainTvl/NEAR). The UI shows a complete 30-day UTC window aligned across feeds, excluding today's partial UTC day. [DeFiLlama's NEAR Intents methodology](https://api.llama.fi/summary/fees/near-intents) defines gross fees as protocol plus affiliate swap fees and holders revenue as captured revenue used to buy back NEAR, **not burn it**. App fees are not NEAR base-chain fees.

A separate native-fee measurement re-fetches the **80 direct `sign` receipt outcomes** in the latest historical window and sums FastNear's `tokens_burnt` field: **0.033515 NEAR total**, or **0.000418941 NEAR per sign receipt**. The exact receipt-level values are in [fee-audit.csv](public/data/fee-audit.csv). Holding that observed average constant for a hypothetical **one million direct requests/day** gives **418.94 NEAR/day** for only the `sign` receipt stage. This is a sensitivity calculation, **not** observed demand, full workflow cost, net holder accrual, or a token burn forecast. It excludes parent transactions, MPC responses, internal completions, other contracts, and destination-chain fees. NEAR fee allocation rules and any issuance comparison require separate verification.

One clearly labeled case study uses a [NearBlocks indexed multichain-signature association](https://api.nearblocks.io/v3/multichain/signatures?chain=BITCOIN&txn=75a2455fdab91a57c89980f39df4ae50b8d094b28d6e74a87e46468f1148edd7): NEAR transaction [`FrBQ…UrFG`](https://nearblocks.io/txns/FrBQdrUigUK1JYaXyVqA7uJH4PvLYJVCHD1iPUn1UrFG) contains a `v1.signer.sign` receipt initiated by `btc-connector.bridge.near`, and the associated [Bitcoin transaction](https://mempool.space/tx/75a2455fdab91a57c89980f39df4ae50b8d094b28d6e74a87e46468f1148edd7) is confirmed in block 975,572. `npm run refresh` now rechecks the exact NearBlocks record linking both transaction IDs and the NEAR receipt, then verifies the NEAR receipt via FastNear and Bitcoin confirmation independently via Mempool.space and Blockstream. The association relies on NearBlocks' index; we do not cryptographically match MPC signature bytes to the Bitcoin script. This single case is **not** a settlement-rate estimate.

## Interpretation boundary

- A `sign` request is not proof that an outbound Bitcoin/EVM/Solana transaction settled.
- Initiating contract accounts are not unique users, and multiple accounts may belong to one application.
- Raw account activity includes callbacks and internal work. It must not be described as signature demand.
- Seven historical short windows and one day of spaced sampling cannot establish a long-term adoption trend. Read [THESIS.md](THESIS.md) for the evidence, countercase, and falsification criteria.
- This is a research tool, not investment advice or a prediction of NEAR's price.

## Demo

Watch the [live app walkthrough](public/demo.mp4). It was recorded from a clean browser session while clicking and scrolling the actual dashboard; captions and narration explain the proof. [DEMO.md](DEMO.md) has a longer manual judge walkthrough.

## Independence and hackathon scope

Capture Test was built during the November 2026 NEAR Hackathon as a new research product. It has its own code, data pipeline, and local repository. It is **not yet publicly submitted**. Orbit (agent spending controls) and PrizeKey (Bitcoin prize claim transfer) are separate team projects with separate repositories and submissions. Capture Test does not reuse their code or submit the same product twice. The third submission is led by a different teammate, consistent with the [official two-submission-per-person rule](https://nearhackathon.com/HACKATHON.md).

## License

MIT. See [LICENSE](LICENSE).
