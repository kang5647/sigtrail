# Capture Test

**Chain Signatures are demonstrably used, but this evidence does not yet establish broad demand from independently operated applications or material NEAR token capture.** A post hoc census of the 11 November 2026 UTC parent-transaction cohort found **14,234/17,665 direct `v1.signer.sign` receipts (80.6%)** from the top three initiating accounts. The earlier fixed window found **72/80 (90%)**, and twelve spaced windows found **1,219/1,482 (82.3%)**. The observed `sign`-stage burn was **0.000418941041 NEAR per receipt** in the fixed fee sample; at that charge, even one million hypothetical direct requests per day would offset only **0.4541%** of contemporaneous gross issuance.

Capture Test is a receipt-level Investment Thesis dashboard. It asks who actually calls NEAR Chain Signatures, whether those callers are independent applications, and how much the measured execution-stage burn could matter for NEAR supply. It deliberately separates this question from NEAR Intents fees and buybacks. Read the generated [two-sentence verdict and full thesis](THESIS.md).

## Do X → see Y

Requires Node.js 20+ and Python 3. No npm install, API key, wallet, or chain transaction is needed for the offline path.

```sh
npm test
npm run rebuild
npm run serve
```

Open `http://localhost:4177`.

| Do this | See this |
| --- | --- |
| Select **11 November** under Seven windows | 170 transactions touching the signer reduce to 80 direct `sign` receipts; three initiating accounts made 72/80. |
| Select a row under **Inspect a direct request** | The exact receipt ID, caller, method, timestamp, parent hash, and public transaction link. |
| Scroll to the **Full UTC-day parent cohort** | 37,775 indexed signer-touching parent transactions yielded 17,665 direct requests; the top three accounts made 14,234 (80.6%). |
| Continue to the **Earlier spaced check** | 1,219/1,482 pooled direct requests from the top three in twelve selected windows; this was a sample, subsequently checked against the full-day parent cohort. |
| Change **Assumed direct requests/day** to `1000000` and **independent-app share** to `100` | About 418.94 NEAR/day of hypothetical `sign`-stage burn and 0.4541% of the observed daily gross issuance baseline. |
| Run `npm run rebuild` again | Snapshot, CSVs, and THESIS.md regenerate offline; the command prints the 7 historical windows, 12 spaced windows, full-day parent cohort, 80 fee outcomes, 25 issuance epochs, and the 1% offset threshold. |

The independent-app share is a **user assumption**, not an estimate from account IDs. The burn model excludes parent transactions, MPC responses, cleanup, other contracts, and destination-chain fees. It is not a demand forecast, net-supply forecast, holder-income claim, or price target.

## Reproduce the evidence

- [Snapshot](public/data/snapshot.json): fixed block ranges, source URLs, fetch times, receipt records, 80 fee outcomes, archival epoch IDs and block hashes, reward amounts, and model inputs.
- [Receipt CSV](public/data/receipt-audit.csv): one row per classified receipt action with exact receipt, parent transaction, caller, method, and timestamp.
- [Full-day archive](public/data/full-day-census.json.gz): immutable compressed record of all 37,775 indexed parent transaction hashes and 56,716 normalized signer action receipts, with block-boundary hashes, source query, fetch time, and SHA-256 in the snapshot. [Full-day CSV](public/data/full-day-receipt-audit.csv) is generated from this archive.
- [Fee CSV](public/data/fee-audit.csv): all 80 direct `sign` outcome charges in yoctoNEAR.
- [Concentration method](METHODOLOGY.md): window selection, coverage, every historical top-one/top-three count, alternative offsets, and evidence boundaries for related bridge accounts.
- [Thesis template](THESIS.template.md) and [renderer](src/thesis.mjs): deterministic narrative and tables. `npm run rebuild` recalculates all numbers, writes THESIS.md, and embeds the SHA-256 of the rebuilt snapshot. It stops for manual review if concentration falls below the template's current conclusion boundary.

The main method uses [FastNear transaction indexes](https://docs.fastnear.com/tx). Seven equal 1,000-parent-transaction-block historical windows are fixed every four million block heights; the twelve 11 November windows are fixed every 12,000 heights. A separate **post hoc full UTC-day parent cohort** covers blocks 223,988,378–224,135,609, bounded by archived block timestamps. All matching transaction traces are hydrated, receipts deduplicated by ID, and only `FunctionCall` actions addressed to `v1.signer` with method `sign` count as direct requests. The account in the `predecessor_id` field is an initiating **account**, not a unique user or known independent operator. One direct receipt from a 11 November parent executed at 00:00:01.542 on 12 November; the census describes parent transactions **included** on 11 November, not every receipt **executed** that day. The earlier twelve ranges cover 12,000 of 133,000 heights between their first and last boundary (9.02%); they are selected, **not random or exhaustive**. The matching-parent-transaction time inside them sums to about 1.92 hours (8.01% of a day), a coverage proxy.

For the supply comparison, `npm run issuance-check` fetches archived mainnet `block` and `validators` RPC data for a fixed **5–12 November 2026 UTC** interval containing the fee sample. The committed 25 consecutive epoch reward maps sum to **645,868.122 NEAR** minted, or **92,266.875 NEAR/day** normalized over seven days. The annual figure is a 365× sensitivity, not a measured year. A separate `npm run supply-check` re-queries four archived boundary blocks: net `total_supply` grew **640,251.368 NEAR** in the same period, **5,616.754 NEAR** below the gross reward sum. That gap is a chain-wide supply effect, not attributed to Chain Signatures. The [nearcore economics specification](https://github.com/near/nearcore/blob/master/docs/Economics/Economics.md) explains rewards; `npm run protocol-check` verifies the November v88 zero-rebate gas rule before interpreting `tokens_burnt` as supply burn. At the measured mean, direct requests/day needed to offset 1%, 10%, and 100% of gross issuance are **2,202,384**, **22,023,833**, and **220,238,329**. These thresholds cover the `sign` stage only.

Applying the 80 sampled fee outcomes' mean to all 17,665 observed full-day parent-cohort direct receipts gives an **estimated 7.401 NEAR of sign-stage burn**, **0.0080%** of the normalized daily gross issuance baseline. This is not a sum of actual full-day fees; those outcomes were not fetched. It excludes the rest of the NEAR workflow and remains separate from Intents fees and buybacks.

`npm run concentration-check` independently recounts the committed receipt CSV and checks it against the snapshot. `npm run spot-check -- 224006000` queries a post hoc interleaved offset window live. The other reported offsets are `224018000` and `224030000`. These are sensitivity checks, not a random holdout.

The full-day archive is rebuilt offline with `npm run rebuild`. To repeat its **network** collection, run `npm run full-day-census && npm run seal-full-day && npm run rebuild`; the crawler checkpoints public FastNear index pages and 20-transaction trace batches in ignored `.cache/full-day/`. It verifies 37,775 unique indexed hashes and one complete trace response per requested hash before sealing. Recollection can be slow or throttled. The committed archive holds filtered signer action records rather than complete raw transaction traces, so independent archive replay verifies the index-hash population and method classification of retained signer receipts; it cannot independently prove that FastNear indexed every relevant transaction.

`npm run refresh` is the separate network path: it re-queries current FastNear, DeFiLlama, and one indexed Bitcoin case while retaining the fixed archival issuance baseline. Use `npm run refresh -- --full-audit` to re-download all nineteen fixed ranges rather than reuse audited cached receipts; public APIs may throttle. Run `npm run rebuild` after a successful refresh to regenerate THESIS.md. The app and thesis label their dated snapshot. Failed refreshes do not prove freshness.

## Limits and judge path

A direct `sign` request may not lead to an external settlement. The linked [NEAR transaction](https://pikespeak.ai/transaction-viewer/FrBQdrUigUK1JYaXyVqA7uJH4PvLYJVCHD1iPUn1UrFG) and [confirmed Bitcoin transaction](https://mempool.space/tx/75a2455fdab91a57c89980f39df4ae50b8d094b28d6e74a87e46468f1148edd7) are one indexed association, **not a measured settlement rate**. FastNear and NearBlocks are third-party indexes. Operator identities, actual full-day sign-stage fee outcomes, complete NEAR workflow burn, and destination-chain settlement rate remain unmeasured. [DEMO.md](DEMO.md) gives the 60–90-second judge route.

Capture Test is the independent project intended for GitHub user `kang5647`. Orbit and PrizeKey remain separate projects with `bebe0307mz`; none shares this codebase or submission. Its [GitHub Pages workflow](.github/workflows/pages.yml) builds and deploys `public/` after publication. **This repository remains local under the owner's current instruction.** A public repo, accessible demo, and public X post are still required for final submission; no publication or submission has occurred. See the [official hackathon rules](https://nearhackathon.com/HACKATHON.md).

MIT license: [LICENSE](LICENSE).
