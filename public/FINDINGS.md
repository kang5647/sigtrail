# Sigtrail: an activity signal that changes with its definition

**Research question:** Does observed NEAR Chain Signatures activity support the claim that chain abstraction is becoming a platform?

**The contribution in one sentence:** In two audited matched UTC hours, request receipts change -2.439% while distinct account-and-signing-input groups change +1.235%; an interactive, record-level reconstruction shows this whole-hour reversal disappears under shorter matched windows.

## Observed, not inferred

The indexed parent cohorts contain 1,295 and 1,253 distinct parent transactions, yielding 615 and 600 exact direct sign receipt IDs. All 1,215 signing-argument records parse; none are silently discarded.

In the complete selected hour, 615 → 600 request receipts become 567 → 574 distinct account-and-input groups. The difference is 48 → 26 additional receipts carrying an input already present in their own selected cohort. Both request receipts and grouped inputs are legitimate units for different questions. Neither measures independent people, applications, economic intents or destination settlements.

| Matched parent-time exposure on each date | Request receipts | Receipt change | Exact input groups | Input change |
| --- | ---: | ---: | ---: | ---: |
| Full matched hour | 615 → 600 | -2.439% | 567 → 574 | +1.235% |
| First 15 minutes | 157 → 125 | -20.382% | 139 → 121 | -12.950% |
| First 30 minutes | 306 → 242 | -20.915% | 283 → 235 | -16.961% |
| Last 30 minutes | 309 → 358 | +15.858% | 284 → 339 | +19.366% |

The full hour reverses direction; the first 15 and first 30 minutes both decline and the last 30 minutes both increase. This is not a stable adoption trend or a statistically representative sample. The grouping lens and shorter-window checks were introduced after the original request comparison. They are exploratory, not preregistered tests. Time-of-hour composition is an alternative explanation. We retain these contrary sensitivities rather than select only a dramatic result.

## The repeated inputs are inspectable

There are 48 and 26 repeated-input groups in the earlier/later hour. Every repeated group here has two separate request receipt IDs. Among them, 47 and 24 groups belong to zcash-connector.bridge.near and contain one parent trace with an exact application callback error, “Already signed”, plus another without a recorded failure. The error is joined through the exact parent trace; it does not prove a causal retry or failed signing.

Another 1 and 2 repeated groups have no recorded failed receipt. Repeated inputs therefore cannot all be called errors, retries, test activity or artificial traffic. A returned NEAR trace is not proof of destination execution. Inspect both members and their decoded arguments in the workbench.

## What is original, and what is ordinary description

Explorer-visible facts include transaction hashes, receipt statuses and named accounts. The existing full-day top-three share is an account-concentration description. This submission's added measurement contribution is the sealed population reconstruction, exact input fingerprinting, count decomposition and matched-window sensitivity that exposes an otherwise easy-to-miss sign reversal. It is not a claim to have invented a new cryptographic primitive or to be the first study ever to count these records.

The research can be useful to a builder or ecosystem analyst deciding whether a change reflects more workload, more distinct inputs, a change in application mix, or unmeasured usage breadth. It shows which conclusions the data cannot identify, rather than supplying an automated adoption score.

## Track fit and balanced interpretation

Investment Thesis asks for a long-term NEAR thesis supported by rerunnable onchain evidence. Sigtrail retains [THESIS.md](THESIS.md), its for/against evidence and token-scale assumptions, plus the [full-day and historical context](archive.html). The main interface actively investigates the quality of one activity signal behind the platform claim. A generic transaction debugger alone would not satisfy that research purpose, so no generic debugger pivot was implemented.

The positive evidence is real use of a shared signing service. The potential platform benefit is that NEAR accounts/contracts can authorize signatures for other chains through shared infrastructure. The unresolved questions are independent operator diversity, sustained use, destination outcomes and complete economic capture. A successful platform can be highly concentrated if a few integrations aggregate many users; conversely, many account IDs can belong to one operator. The present dataset does not distinguish those alternatives.

## Exact definitions and reproducibility

- Network/contract: NEAR mainnet, v1.signer. Parents included at 00:00 ≤ UTC < 01:00 on 10 and 11 November 2026; individual windows use lower-inclusive/upper-exclusive parent timestamps from the matching archived index, not receipt creation or execution time.
- Request: one distinct receipt with at least one exact sign FunctionCall and receiver v1.signer. Duplicate receipt IDs are rejected. Multiple sign actions remain one request; every distinct input assignment is retained. Actual archived request receipts each contain one sign action.
- Input: SHA-256(initiating-account + newline + recursively key-sorted JSON of complete base64-decoded sign arguments). Array order and JSON value types are preserved. Duplicate JSON keys, unsafe numbers, invalid UTF-8 or malformed arguments fail the rebuild. No payload aliases, path, domain or key version are dropped. Raw-base64 grouping gives the same counts on this archive.
- Group separately within each selected date/window/account. Do not deduplicate across dates or assume matching arguments identify an economic intent. Input filters never remove receipt evidence from the CSV export.
- Source: FastNear index pages and complete returned transaction traces, with NEAR UTC boundary blocks and protocol configuration. The index's own parent set, hydration and emitted-receipt graph are checked; exhaustive completeness against an independently operated full node is unknown.
- The older full-day normalized archive omits signing arguments and outcomes; the exact-input lens cannot be applied to that archive. It remains separate context, not a comparable full-day input-growth series.

Raw comparison archive SHA-256: `350e06ff3fe99ab378d2c3bd46bff6e8c25225274df052e5860a44b1f200fd1d`. The generated [investigation dataset](data/investigation.json) retains every exact receipt ID, parent hash, parent/creation/execution timestamps, input fingerprint, same-parent failure fact and raw JSON pointer/trace checksum. The complete arguments are retained by fingerprint. The [artifact manifest](data/evidence-manifest.json) seals generated outputs too.

Run from the public source checkout:

```sh
npm test
npm run rebuild
npm run independent-audit
npm run investigation-check
npm run serve
```

The independent Python program re-parses the sealed raw archive without importing the production JavaScript and checks all receipt IDs, fingerprints, account/window aggregations and same-parent failure joins against the generated dataset. No npm install, API key or network request is needed for this path. Live recollection is separate, may require provider access, and can change index results; it does not silently replace the archived evidence.
