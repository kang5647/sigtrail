# Look past the activity — 32 seconds

[Watch the actual-app walkthrough](public/demo.mp4). This captioned cut is currently silent; narration can be added without changing the dated evidence or calculations.

## Problem and evidence opening for the next recording

“If you’re researching NEAR, growing transaction numbers only tell part of the story. They don’t tell you how widely the technology is being used, or how much NEAR those requests burn in fees. Capture Test brings the requests, caller breakdown and fee model into one dashboard, so you can inspect the evidence and test your assumptions.”

Show the dated concentration finding, inspect an actual request, then change a burn-model assumption. The concentration observation and the fee scenario answer different questions; neither is a price forecast. Use the README’s evidence table for exact counts and source links. The existing video linked above predates this revised narration; a new face-led recording is not yet complete.

## Reproduce the moment

Run `npm run serve` and open `http://127.0.0.1:4177`.

1. The opening donut shows **80.6%** of the **17,665** direct signing requests in the dated **11 November UTC parent-transaction cohort** originated from three account IDs. These are accounts, not unique users or verified independent applications.
2. Click **Inspect a real request** (`#explore-proof`). Select a `.proof-row`, then expand **Exact receipt and parent transaction**. This inspector uses the separately documented fixed historical windows; it is not presented as a receipt-level drilldown of the full-day concentration count.
3. Select **Test impact** (`#tab-model`). At **1,000,000 assumed requests/day**, **100% assumed independent-app share** and **1×** sampled fee, estimated sign-stage burn is **418.94 NEAR/day**, or **0.4541%** of the observed normalized gross issuance baseline.
4. Click **10 million** (`[data-requests="10000000"]`). The scenario changes to **4.5405%**. Inputs are assumptions; the result is not measured demand, complete workflow burn, net supply or a price forecast. Outputs include only the assumed independent-app share; other calls also burn fees.

The fee input comes from 80 measured direct-sign outcomes. The issuance baseline is a separate seven-day archival reward audit. A direct signing request does not establish destination-chain settlement. Source data, research conclusions and calculations remain unchanged by this presentation update.

## Capture and validation

The video is actual browser footage sampled about 10 times per second, encoded at 30 fps with short captions. No slides or fabricated screens. [Desktop](evidence/bright-desktop.jpg) and [390px phone](evidence/bright-phone.jpg) were checked; neither had horizontal overflow. Reduced-motion preferences are respected.

All **19 tests** passed, including independent reproduction of cohort counts, fee arithmetic, issuance and the committed thesis. No new network census, wallet, transaction, publication or deployment was performed for this UI update. Follow the README to rebuild the saved evidence or deliberately recollect it.
