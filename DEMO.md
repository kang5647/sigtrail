# Live demo, 80 seconds

The recorded [live walkthrough](public/demo.mp4) uses the actual local app, real tabs, and deliberate scrolling. The sequence below is the extended version for a judge or office-hours presentation.

Record the **actual dashboard**, at `http://localhost:4177`, without slides or continuous page motion. Keep the cursor still between clicks. The voiceover should distinguish evidence from inference.

1. **0–8 s — Question.** Show the hero. “NEAR can sign for other chains. But are many apps using that primitive, or are explorers counting contract plumbing?”
2. **8–25 s — The reveal.** Click **Explore the evidence**. In the November window, show **170 transactions touching signer** versus **80 direct sign requests**. Point briefly to the receipt breakdown. “We classified actual function-call receipts. MPC responses and internal completions are separate work.”
3. **25–39 s — Who uses it?** Scroll to **Application mix**. Show `omni.bridge.near` at **43 of 80 requests**, or **53.8%**. The top three callers (`omni.bridge.near`, `fast-auth.near`, `btc-connector.bridge.near`) made **72 of 80**, or **90%**. “There is real use, but this sample is highly concentrated.”
4. **39–49 s — Stress test the day.** Scroll to the twelve-window day audit. “Across spaced samples from 01:50 to 23:34 UTC, the pooled top three initiated 1,219 of 1,482 direct requests, or 82.3%. This is sampled coverage, not a whole-day total.”
5. **49–59 s — Show a completed result.** Scroll to **From a NEAR sign call to a Bitcoin block**. Open the NEAR trace, then the confirmed Bitcoin transaction. State that NearBlocks indexed the exact association and that this one case is not a settlement rate.
6. **59–69 s — Native fee footprint.** Scroll below the separate Intents numbers to the 80-receipt fee audit. “The direct `sign` receipt stage reported 0.033515 NEAR in execution outcomes, about 0.000419 NEAR each. The 10,000 / 100,000 / one-million daily-request ladder shows sensitivity at that unchanged rate, for this stage only. The 1,482 sampled-day requests are not a full-day total or a forecast.”
7. **69–80 s — Judgment.** Show **Two tests, one conditional thesis**. “The primitive is real. Broad, durable application demand is still unproven by these samples. Intents buybacks are a separate economic test. Here is the data and one command to rerun it.”

The figures are from the 13 November 2026 UTC refresh. If refreshing the data changes them, update the narration. Do not describe these windows as a growth trend or a random sample.
