# Capture Test

**In a November mainnet sample, three contracts initiated 72 of 80 direct Chain Signatures requests (90%). Across twelve spaced windows on the same day, the pooled top three made 1,219 of 1,482 (82.3%). Is use becoming a broad application platform, or still concentrated in infrastructure?**

Capture Test is an independent, reproducible research dashboard for the NEAR Hackathon **Investment Thesis** track. It turns transactions involving the mainnet `v1.signer` contract into a method-level audit: direct `sign` requests, MPC `respond` callbacks, internal completions, and other calls. It then shows which contracts initiated the direct requests. A separate panel reports NEAR Intents fee and holder-revenue data as economic context; it does not attribute Intents revenue to Chain Signatures.

**Current conclusion:** Chain Signatures has observable use and a measurable `sign`-stage NEAR supply burn, but these samples do not establish broad independent application demand or material net token impact. [THESIS.md](THESIS.md) states the evidence for and against that conditional investment case.

## Run

Requires Node.js 20+ and Python 3 for the local server. There are no npm dependencies, credentials, wallet transactions, or contract deployments.

```sh
npm test
npm run rebuild
npm run refresh
npm run serve
```

Open `http://localhost:4177`. `npm run rebuild` recomputes the dashboard artifacts from committed records without a network call. `npm run refresh` checks live sources and replaces the snapshot only after all sources, seven historical windows, and the twelve-window day audit rebuild successfully. Public FastNear access can be throttled; retry later if it fails.

For a quick independent check, open the dashboard and select **11 November** under “Seven windows.” See **170** transactions touching `v1.signer` resolve to **80** direct `sign` requests. Scroll to the twelve-window day audit for the pooled **1,219 / 1,482 (82.3%)** top-three concentration, then download the receipt CSV and inspect a linked NEAR transaction. The separate Bitcoin panel links one indexed, confirmed cross-chain case. The fee panel links all **80** execution outcomes behind its **0.033515 NEAR** sign-receipt total. `npm test` checks the snapshot's reconciliations; it does not independently re-query mainnet.

For one additional live check outside the twelve sampled windows, run `npm run spot-check -- 224006000`. The selected offset window at blocks 224,006,000–224,006,999 contained **96** direct `sign` receipts; its top three callers made **78 (81.25%)** across **11** initiating accounts. This single offset is not pooled with the day audit and is not a statistical validation of unobserved intervals.

The editable economic model has one measured input, the sign-receipt mean. Its daily request volume, independent-application share, and fee multiple are user assumptions; it reports hypothetical independent-app `sign`-stage supply burn per day and year. The default 25% independent share is **not** derived from the account concentration chart; caller accounts have not been identified as independent businesses. The default 1× fee multiple holds the observed mean constant. See [THESIS.md](THESIS.md) before interpreting a model output.

The default refresh reuses already audited fixed windows from the committed snapshot and saves newly completed windows in ignored `.cache/` files, so an API throttle can be resumed without downloading earlier traces again. Use `npm run refresh -- --full-audit` for a fresh source-to-result rebuild of every fixed window; this can take several minutes and is subject to public rate limits. Cached receipts are reclassified and checked against their stored counts before reuse. The numbers in THESIS.md describe its dated research snapshot; refresh updates the dashboard data, not that written interpretation.

## What is measured

The [FastNear Transactions API](https://docs.fastnear.com/tx) supplies a raw-activity count for 25 fixed 1,000-block windows, one every million block heights from 200,000,000 to 224,000,000. Seven of those windows—starting at blocks 200,000,000, 204,000,000, 208,000,000, 212,000,000, 216,000,000, 220,000,000, and 224,000,000—are fully audited. The script paginates every matching transaction in those seven windows, fetches complete traces, and deduplicates receipts by ID. The block range selects **parent transactions**; their receipts can execute after the range. A direct request is a receipt with `receiver_id = v1.signer` and a `FunctionCall` method named `sign`. The initiating contract is that receipt's `predecessor_id`. See [NEAR's Chain Signatures documentation](https://docs.near.org/chain-abstraction/chain-signatures) for why `sign` is the relevant method.

The block ranges are equally sized; the seven fully audited ranges are separated by four million block heights. The original three ranges were fixed before the first audit; the four new ranges were selected at equal intervals before their method classification. They are **not random or full-day samples**. The comparison is descriptive, not a statistically representative growth estimate. The dashboard links five recent requests per audited window. The downloadable `public/data/receipt-audit.csv` contains every classified receipt with its transaction hash, method, caller, and timestamp for independent checking.

A separate, denser audit fixes twelve nonoverlapping 1,000-block ranges starting at block 224,000,000, each 12,000 block heights apart, from 01:50 to 23:34 UTC on 11 November. The first overlaps the final historical window and is counted only once in the CSV. The other eleven ranges were fixed before method classification. The dashboard reports top-three concentration both per window (78.3%–90.6%) and after pooling deduplicated requests across the twelve windows (1,219/1,482, or 82.3%). This samples the day at roughly two-hour intervals; it is **not a census of every request that day**.

The economic panel uses the [DeFiLlama NEAR chain app-fees feed](https://api.llama.fi/overview/fees/near), its `dailyRevenue` and `dailyHoldersRevenue` variants, and [NEAR DeFi TVL](https://api.llama.fi/v2/historicalChainTvl/NEAR). The UI shows a complete 30-day UTC window aligned across feeds, excluding today's partial UTC day. [DeFiLlama's NEAR Intents methodology](https://api.llama.fi/summary/fees/near-intents) defines gross fees as protocol plus affiliate swap fees and holders revenue as captured revenue used to buy back NEAR, **not burn it**. App fees are not NEAR base-chain fees.

A separate native-fee measurement re-fetches the **80 direct `sign` receipt outcomes** in the latest historical window and sums FastNear's `tokens_burnt` field: **0.033515 NEAR total**, or **0.000418941 NEAR per sign receipt**. The exact receipt-level values are in [fee-audit.csv](public/data/fee-audit.csv). Archived mainnet protocol configuration at block 224,000,000 reported version 88 and `burnt_gas_reward = [0, 1]`; [nearcore documents](https://github.com/near/nearcore/blob/master/docs/architecture/how/gas.md) that, from version 87, burnt execution gas leaves total supply. Holding the observed average and protocol rule constant gives **4.19, 41.89, or 418.94 NEAR/day** of hypothetical `sign`-stage supply burn at 10,000, 100,000, or one million direct requests/day. These are sensitivities, **not** observed demand, full workflow burn, net deflation, holder income, or price forecasts. The day audit observed 1,482 requests in spaced windows, not a full-day total. Parent transactions, MPC responses, internal completions, other contracts, destination-chain fees, and an issuance comparison remain outside this measurement.

Run `npm run protocol-check` to query archived mainnet configuration for the November block and two earlier samples. It verifies that the November supply-burn interpretation is not applied to the older protocol versions.

This version-88 burn conclusion applies only to the November fee sample. Earlier sampled months used protocol versions with a contract gas rebate; their fees are not audited here, so the historical request chart is **not** a historical burn chart.

One clearly labeled case study uses a [NearBlocks indexed multichain-signature association](https://api.nearblocks.io/v3/multichain/signatures?chain=BITCOIN&txn=75a2455fdab91a57c89980f39df4ae50b8d094b28d6e74a87e46468f1148edd7): NEAR transaction [`FrBQ…UrFG`](https://pikespeak.ai/transaction-viewer/FrBQdrUigUK1JYaXyVqA7uJH4PvLYJVCHD1iPUn1UrFG) contains a `v1.signer.sign` receipt initiated by `btc-connector.bridge.near`, and the associated [Bitcoin transaction](https://mempool.space/tx/75a2455fdab91a57c89980f39df4ae50b8d094b28d6e74a87e46468f1148edd7) is confirmed in block 975,572. `npm run refresh` now rechecks the exact NearBlocks record linking both transaction IDs and the NEAR receipt, then verifies the NEAR receipt via FastNear and Bitcoin confirmation independently via Mempool.space and Blockstream. The association relies on NearBlocks' index; we do not cryptographically match MPC signature bytes to the Bitcoin script. This single case is **not** a settlement-rate estimate.

## Interpretation boundary

- A `sign` request is not proof that an outbound Bitcoin/EVM/Solana transaction settled.
- Initiating contract accounts are not unique users, and multiple accounts may belong to one application.
- Raw account activity includes callbacks and internal work. It must not be described as signature demand.
- Seven historical short windows and one day of spaced sampling cannot establish a long-term adoption trend. Read [THESIS.md](THESIS.md) for the evidence, countercase, and falsification criteria.
- This is a research tool, not investment advice or a prediction of NEAR's price.

## Demo

Watch the [live app walkthrough](public/demo.mp4). It was recorded from a clean browser session while clicking and scrolling the actual dashboard; captions and narration explain the proof. [DEMO.md](DEMO.md) has a longer manual judge walkthrough.

The repository includes a [GitHub Pages workflow](.github/workflows/pages.yml) that tests, rebuilds offline, and deploys only `public/` after a push to `main` and Pages activation. The repository remains local; there is no public dashboard or repository URL yet. The owner must explicitly authorize publication before the workflow can run on GitHub.

## Independence and hackathon scope

Capture Test was built during the November 2026 NEAR Hackathon as a new research product. It has its own code, data pipeline, and local repository. It is **not yet publicly submitted**. Orbit (agent spending controls) and PrizeKey (Bitcoin prize claim transfer) are separate team projects with separate repositories and submissions. Capture Test does not reuse their code or submit the same product twice. The third submission is led by a different teammate, consistent with the [official two-submission-per-person rule](https://nearhackathon.com/HACKATHON.md).

## License

MIT. See [LICENSE](LICENSE).
