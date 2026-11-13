# Capture Test judge walkthrough

The [75-second phone-format video](public/demo.mp4) records the actual local dashboard. It shows a tab change, a receipt inspection, and an editable token-burn sensitivity. It does not imply a live network call occurred during playback: the dashboard reads the committed mainnet snapshot. The dated claims can be rebuilt offline or refreshed separately.

## The complete action

1. Open the dashboard and choose **11 November** in the historical windows. See **170 signer-touching parent transactions** resolve to **80 direct `sign` receipts** after method classification. The top three initiating accounts made **72/80 (90%)**.
2. Select a row under **Inspect a direct request**. The dashboard reveals the full receipt ID, caller, `sign` method, timestamp, parent transaction hash, and an explorer link. Download the complete receipt CSV to count the same 80 rows.
3. Inspect the twelve spaced windows from 11 November: **1,219/1,482 (82.3%)** direct requests came from the same pooled top three. This is sampled coverage, not a full-day total. `npm run spot-check` fetches a separate offset window and prints **78/96 (81.25%)** for the same three; it is one selected check, not a random sample.
4. Open the linked NEAR-to-Bitcoin case. NearBlocks supplies the exact association; FastNear confirms the NEAR `sign` receipt; Mempool.space and Blockstream confirm the Bitcoin transaction. One case does not estimate settlement reliability.
5. Compare **80 direct-sign receipt outcomes** with the protocol. They report **0.033515 NEAR** in `tokens_burnt`. `npm run protocol-check` checks archived protocol v88 at the sample height, with zero contract gas reward; [nearcore gas documentation](https://github.com/near/nearcore/blob/master/docs/architecture/how/gas.md#contract-reward) says all burnt gas then leaves supply. Change the model's assumed daily requests, independent-app share, and future fee multiple. The outcome is a conditional gross sign-stage burn sensitivity, not full-workflow burn, net deflation, holder income, or a price target.
6. Read the verdict: direct use is real and concentrated; broad independent application demand and material net token impact remain unproven.

## Reproduce

```sh
npm test
npm run rebuild
npm run serve
```

`npm run rebuild` works offline from committed receipts and fee outcomes. It regenerates the snapshot and CSVs. `npm run refresh` checks live sources; `npm run refresh -- --full-audit` re-downloads every fixed window and can be delayed by FastNear public throttling. A failed live refresh leaves the dated committed snapshot in place. No API key is required.

## Before public submission

The repository and demo remain local by the owner's instruction. Once publication is explicitly authorized, put the real public repository and hosted dashboard links in the app and final video shot, verify both in a fresh browser, then publish the human-authored X demo post. A local-only dashboard is eligible if the repository is public, reproducible, and accompanied by the video post under the [official rules](https://nearhackathon.com/HACKATHON.md).
