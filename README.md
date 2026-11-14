# Capture Test

**Is NEAR’s cross-chain infrastructure actually gaining adoption?**

Capture Test is an explorable research application for dated NEAR Chain Signatures activity. Review scope and metrics, compare matched periods, filter initiating accounts, export exact receipts, and inspect the investment implications. Every view is independently accessible; no presentation or reveal step is required.

[NEAR Chain Signatures](https://docs.near.org/chain-abstraction/chain-signatures) lets NEAR accounts authorize actions on other blockchains. The application separates use of that service from unverified claims about growing independent-app adoption, completed destination actions or material token demand.

This is a saved research snapshot, not a live monitor. Its value is making the observations and their interpretation easier to inspect and reproduce. Fresh comparable observations and verified operator/outcome evidence are still needed for a durable adoption assessment.

### Why investigate? Three pieces of evidence

| Evidence | What it tells us | Check it |
| --- | --- | --- |
| **170 signer-touching transactions; 80 direct signing requests** in one fixed 1,000-block window. | Touching the signer is different from making a new signing request. These are different units, not a conversion or success rate. | [Classified receipt rows](public/data/receipt-audit.csv), block range 224000000–224000999; [classification method](METHODOLOGY.md). |
| **14,234 of 17,665 direct requests (80.6%)** came from three initiating accounts in the indexed 11 November 2026 UTC parent-transaction cohort. | Activity is concentrated by account. This does not identify independent operators or prove that demand is artificial. | [Full-day receipt rows](public/data/full-day-receipt-audit.csv), [archive](public/data/full-day-census.json.gz), [cohort boundaries](METHODOLOGY.md). |
| **One million hypothetical requests/day → 418.94 NEAR/day**, about **0.4541%** of the observed daily gross issuance baseline, at the sampled charge. | Even substantial hypothetical demand needs economic scale analysis. This measures the direct signing stage only; it is not total workflow burn or a price forecast. | [80 measured fee outcomes](public/data/fee-audit.csv), [issuance audit and model inputs](public/data/snapshot.json), [full derivation](THESIS.md). |

**Current thesis:** Chain Signatures usage is real. This dated evidence does not yet establish broad independent-application demand or material NEAR token capture. That is a bounded research conclusion, not a claim that the technology lacks value. Read the generated [full thesis and what would change the verdict](THESIS.md).

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
| Open **Overview** | The dated scope, 17,665 requests, 82 initiating account IDs, 37,775 parent transactions and top-three share. Account mix and a bounded interpretation are visible immediately. |
| Select an account in **Account activity**, then **Inspect … receipt rows** | The chart highlights its actual share and the inspector opens with the same full-day account filter. Clear selection restores all accounts. |
| Open **Compare periods** | 615 → 600 requests, −2.4%, in two matched UTC hours; top-three share 75.1% → 83.0%. This is not a lasting trend. |
| Open **Accounts & receipts**, then choose `omni.bridge.near` | 8,492 matching direct requests, with exact receipt and parent IDs. |
| Click **Export matching receipts** | A CSV with every selected row, not only the 20 displayed. |
| Open a row's public parent transaction | Public explorer evidence for that request. Requests do not establish destination settlement. |
| Open **Implications** | Evidence interpretation, explicit unknowns, and concrete signals that would change the research case. |
| Expand **Direct-stage fees and sensitivity assumptions** | At one million hypothetical requests/day, sampled initial-stage charges imply 0.4541% of normalized gross daily issuance; ten million implies 4.5405%. |
| Run `npm run independent-audit` then `npm run build` | Independently recount retained evidence, then reproduce the public artifacts and thesis offline. |

No scenario input identifies independent applications. The burn model includes only direct sign execution and excludes parent transactions, responses, cleanup, other contracts and destination fees. It is not a forecast or price target.

## Reproduce the evidence

- [Snapshot](public/data/snapshot.json): fixed block ranges, source URLs, fetch times, receipt records, 80 fee outcomes, archival epoch IDs and block hashes, reward amounts, and model inputs.
- [Receipt CSV](public/data/receipt-audit.csv): one row per classified receipt action with exact receipt, parent transaction, caller, method, and timestamp.
- [Full-day archive](public/data/full-day-census.json.gz): immutable compressed record of all 37,775 indexed parent transaction hashes and 56,716 normalized signer action receipts, with block-boundary hashes, source query, fetch time, and SHA-256 in the snapshot. [Full-day CSV](public/data/full-day-receipt-audit.csv) is generated from this archive.
- [Fee CSV](public/data/fee-audit.csv): all 80 direct `sign` outcome charges in yoctoNEAR.
- [Concentration method](METHODOLOGY.md): window selection, coverage, every historical top-one/top-three count, alternative offsets, and evidence boundaries for related bridge accounts.
- [Thesis template](THESIS.template.md) and [renderer](src/thesis.mjs): deterministic narrative and tables. `npm run rebuild` recalculates all numbers, writes THESIS.md, and embeds the SHA-256 of the rebuilt snapshot. Sealed archive SHA-256 values are checked before any rebuild output is written. Recollection and deliberate resealing are separate from offline reproduction.

The main method uses [FastNear transaction indexes](https://docs.fastnear.com/tx). Seven equal 1,000-parent-transaction-block historical windows are fixed every four million block heights; the twelve 11 November windows are fixed every 12,000 heights. A separate **post hoc full UTC-day parent cohort** covers blocks 223,988,378–224,135,609, bounded by archived block timestamps. All matching transaction traces are hydrated, receipts deduplicated by ID, and only `FunctionCall` actions addressed to `v1.signer` with method `sign` count as direct requests. The account in the `predecessor_id` field is an initiating **account**, not a unique user or known independent operator. One direct receipt from a 11 November parent was created at 00:00:01.542 on 12 November; the census describes parent transactions **included** on 11 November, not every receipt **executed** that day. The earlier twelve ranges cover 12,000 of 133,000 heights between their first and last boundary (9.02%); they are selected, **not random or exhaustive**. The matching-parent-transaction time inside them sums to about 1.92 hours (8.01% of a day), a coverage proxy.

For the supply comparison, `npm run issuance-check` fetches archived mainnet `block` and `validators` RPC data for a fixed **5–12 November 2026 UTC** interval containing the fee sample. The committed 25 consecutive epoch reward maps sum to **645,868.122 NEAR** minted, or **92,266.875 NEAR/day** normalized over seven days. The annual figure is a 365× sensitivity, not a measured year. A separate `npm run supply-check` re-queries four archived boundary blocks: net `total_supply` grew **640,251.368 NEAR** in the same period, **5,616.754 NEAR** below the gross reward sum. That gap is a chain-wide supply effect, not attributed to Chain Signatures. The [nearcore economics specification](https://github.com/near/nearcore/blob/master/docs/Economics/Economics.md) explains rewards; `npm run protocol-check` verifies the November v88 zero-rebate gas rule before interpreting `tokens_burnt` as supply burn. At the measured mean, direct requests/day needed to offset 1%, 10%, and 100% of gross issuance are **2,202,384**, **22,023,833**, and **220,238,329**. These thresholds cover the `sign` stage only.

Applying the 80 sampled fee outcomes' mean to all 17,665 observed full-day parent-cohort direct receipts gives an **estimated 7.401 NEAR of sign-stage burn**, **0.0080%** of the normalized daily gross issuance baseline. This is not a sum of actual full-day fees; those outcomes were not fetched. It excludes the rest of the NEAR workflow and remains separate from Intents fees and buybacks.

`npm run concentration-check` independently recounts the committed receipt CSV and checks it against the snapshot. `npm run spot-check -- 224006000` queries a post hoc interleaved offset window live. The other reported offsets are `224018000` and `224030000`. These are sensitivity checks, not a random holdout.

The full-day archive is rebuilt offline with `npm run rebuild`. To repeat its **network** collection, run `npm run full-day-census && npm run seal-full-day && npm run rebuild`; the crawler checkpoints public FastNear index pages and 20-transaction trace batches in ignored `.cache/full-day/`. It verifies 37,775 unique indexed hashes and one complete trace response per requested hash before sealing. Recollection can be slow or throttled. The committed archive holds filtered signer action records rather than complete raw transaction traces, so independent archive replay verifies the index-hash population and method classification of retained signer receipts; it cannot independently prove that FastNear indexed every relevant transaction.

`npm run refresh` is the separate network path: it re-queries current FastNear, DeFiLlama, and one indexed Bitcoin case while retaining the fixed archival issuance baseline. Use `npm run refresh -- --full-audit` to re-download all nineteen fixed ranges rather than reuse audited cached receipts; public APIs may throttle. Run `npm run rebuild` after a successful refresh to regenerate THESIS.md. The app and thesis label their dated snapshot. Failed refreshes do not prove freshness.

## Limits and judge path

A direct `sign` request may not lead to an external settlement. The linked [NEAR transaction](https://pikespeak.ai/transaction-viewer/FrBQdrUigUK1JYaXyVqA7uJH4PvLYJVCHD1iPUn1UrFG) and [confirmed Bitcoin transaction](https://mempool.space/tx/75a2455fdab91a57c89980f39df4ae50b8d094b28d6e74a87e46468f1148edd7) are one indexed association, **not a measured settlement rate**. FastNear and NearBlocks are third-party indexes. Operator identities, actual full-day sign-stage fee outcomes, complete NEAR workflow burn, and destination-chain settlement rate remain unmeasured. The [current demonstration route and narration](DEMO.md) describe the verified UI. The current approximately 80-second preview is a natural desktop walkthrough with real scrolling, account selection, receipt inspection and CSV export. Final authorized Michael narration is pending; there is no finished voiced video or public video URL yet. The superseded 32-second preview is archived privately and excluded from the current app bundle.

## Architecture, provenance and release status

This is a static browser application: `public/app.js` loads the dated JSON ledgers; `src/` validates and analyzes evidence; `scripts/rebuild.mjs` regenerates public artifacts and the thesis. No backend, wallet or signing is required. `public/` is the production bundle; `npm run rebuild` is the build command. The independent Python program imports no production JavaScript.

NEAR's role is the object of the research: Chain Signatures accepts requests from NEAR accounts and contracts for derived-key signatures. Public NEAR receipts and execution charges make the activity and its direct economic footprint inspectable. This research application reads historical mainnet evidence; it deploys no contract and sends no transaction.

**Track:** Investment Thesis (`thesis`). **Local demo:** http://127.0.0.1:4177. **Hosted demo / public repository / final video / X post:** not published. The [Pages workflow](.github/workflows/pages.yml) is prepared for a later approved release; it is not evidence of deployment. Local-only demos are permitted by [Q-012](https://nearhackathon.com/HACKATHON.md) with a public reproducible repository and a public human demo video post.

Capture Test belongs to kang / Michael, as confirmed by the owner. Connected GitHub access verifies `kang5647`; team membership and each person’s total entries still require accurate disclosure. Authentic local history begins on 12 November 2026 UTC and includes contributions recorded under both `bibimoh` and `kang5647`. Existing author metadata is preserved. AI assistance was used for implementation, research verification and production preparation. The actual human contribution and team declaration must be confirmed before submission.

Related independent projects in the same production portfolio are Orbit, PrizeKey and AfterVote. No shared implementation is imported here. Their participation and each person's maximum two-project limit require an accurate, human-confirmed disclosure; two GitHub accounts do not establish eligibility. Public cross-reference URLs will be added only when verified and authorized.

Dependencies: Node.js 20+ for analysis, Python 3 standard library for independent audit/serving, and Google Fonts (DM Sans / Manrope) with system fallbacks for the UI. Vendored GSAP remains from the earlier UI under its [standard license](https://gsap.com/standard-license/); the current app does not load it. Data providers are FastNear, archival NEAR RPC, DeFiLlama and the separately labeled Bitcoin case endpoints. No private keys, personal submission payloads, raw voice samples or voice IDs belong in this repository.

MIT license applies to this project’s own code: [LICENSE](LICENSE). Third-party GSAP retains its license banner.
