# Capture Test

**Is NEAR Chain Signatures becoming a broadly used platform, or mostly infrastructure for a few applications?**

Capture Test is an independent, reproducible research dashboard for the NEAR Hackathon **Investment Thesis** track. It turns transactions involving the mainnet `v1.signer` contract into a method-level audit: direct `sign` requests, MPC `respond` callbacks, internal completions, and other calls. It then shows which contracts initiated the direct requests. A separate panel reports NEAR Intents fee and holder-revenue data as economic context; it does not attribute Intents revenue to Chain Signatures.

## Run

Requires Node.js 20+ and Python 3 for the local server. There are no npm dependencies, credentials, wallet transactions, or contract deployments.

```sh
npm test
npm run refresh
npm run serve
```

Open `http://localhost:4177`. The committed `public/data/snapshot.json` also lets the dashboard work without a fresh API call. `npm run refresh` replaces it only after all sources and three signer windows rebuild successfully. Public FastNear access can be throttled; retry later if it fails.

## What is measured

The [FastNear Transactions API](https://docs.fastnear.com/tx) supplies a raw-activity count for 25 fixed 1,000-block windows, one every million block heights from 200,000,000 to 224,000,000. Three of those windows—`200000000–200000999`, `212000000–212000999`, and `224000000–224000999`—are fully audited. The script paginates every matching transaction in those three windows, fetches complete traces, and deduplicates receipts by ID. The block range selects **parent transactions**; their receipts can execute after the range. A direct request is a receipt with `receiver_id = v1.signer` and a `FunctionCall` method named `sign`. The initiating contract is that receipt's `predecessor_id`. See [NEAR's Chain Signatures documentation](https://docs.near.org/chain-abstraction/chain-signatures) for why `sign` is the relevant method.

The block ranges are equally sized; the three fully audited ranges are separated by 12 million block heights. We fixed them before classifying methods, but they are **not random samples**. The comparison is descriptive, not a statistically representative growth estimate. The dashboard links five recent requests per audited window. The downloadable `public/data/receipt-audit.csv` contains every classified receipt with its transaction hash, method, caller, and timestamp for independent checking.

The economic panel uses the [DeFiLlama NEAR chain app-fees feed](https://api.llama.fi/overview/fees/near), its `dailyRevenue` and `dailyHoldersRevenue` variants, and [NEAR DeFi TVL](https://api.llama.fi/v2/historicalChainTvl/NEAR). The UI shows a complete 30-day UTC window aligned across feeds, excluding today's partial UTC day. [DeFiLlama's NEAR Intents methodology](https://api.llama.fi/summary/fees/near-intents) defines gross fees as protocol plus affiliate swap fees and holders revenue as captured revenue used to buy back NEAR, **not burn it**. App fees are not NEAR base-chain fees.

## Interpretation boundary

- A `sign` request is not proof that an outbound Bitcoin/EVM/Solana transaction settled.
- Initiating contract accounts are not unique users, and multiple accounts may belong to one application.
- Raw account activity includes callbacks and internal work. It must not be described as signature demand.
- Three short windows cannot establish a long-term adoption trend. Read [THESIS.md](THESIS.md) for the evidence, countercase, and falsification criteria.
- This is a research tool, not investment advice or a prediction of NEAR's price.

## Demo

Follow [DEMO.md](DEMO.md) for a 60-second live walkthrough with the actual dashboard and linked receipts.

## Independence and hackathon scope

Capture Test was built during the November 2026 NEAR Hackathon as a new research product. It has its own code, data pipeline, repository, and Investment Thesis submission. Orbit (agent spending controls) and PrizeKey (Bitcoin prize claim transfer) are separate team projects with separate repositories and submissions. Capture Test does not reuse their code or submit the same product twice. The third submission is led by a different teammate, consistent with the [official two-submission-per-person rule](https://nearhackathon.com/HACKATHON.md).

## License

MIT. See [LICENSE](LICENSE).
