import { analyzeCohorts } from '../public/investigate.mjs';
const n=v=>v.toLocaleString('en-US');
const pct=v=>v===null?'undefined':`${v>0?'+':''}${(v*100).toFixed(3)}%`;
export function renderMeasurementReport(data){
 const raw=analyzeCohorts(data,{}),grouped=analyzeCohorts(data,{lens:'inputs'});
 const rows=[['Full matched hour','hour'],['First 15 minutes','first15'],['First 30 minutes','first30'],['Last 30 minutes','last30']].map(([label,window])=>{const r=analyzeCohorts(data,{window}),g=analyzeCohorts(data,{window,lens:'inputs'});return `| ${label} | ${r.periods.map(p=>n(p.requestCount)).join(' → ')} | ${pct(r.change.relative)} | ${g.periods.map(p=>n(p.inputCount)).join(' → ')} | ${pct(g.change.relative)} |`;}).join('\n');
 const repeated=raw.periods.map(p=>p.groups.filter(g=>g.repeatExcess));
 const signed=raw.periods.map(p=>p.groups.filter(g=>g.repeatExcess&&g.account==='zcash-connector.bridge.near'&&g.rows.some(r=>r.callbackFailures.some(f=>JSON.stringify(f.error).includes('Already signed')))));
 const neutral=raw.periods.map(p=>p.groups.filter(g=>g.repeatExcess&&!g.callbackFailureCount));
 return `# Sigtrail: an activity signal that changes with its definition

**Research question:** Does observed NEAR Chain Signatures activity support the claim that chain abstraction is becoming a platform?

**The contribution in one sentence:** In two audited matched UTC hours, request receipts change ${pct(raw.change.relative)} while distinct account-and-signing-input groups change ${pct(grouped.change.relative)}; an interactive, record-level reconstruction shows this whole-hour reversal disappears under shorter matched windows.

## Observed, not inferred

The indexed parent cohorts contain ${data.periods.map(p=>n(p.indexedParents)).join(' and ')} distinct parent transactions, yielding ${raw.periods.map(p=>n(p.requestCount)).join(' and ')} exact direct sign receipt IDs. All ${n(raw.periods.reduce((s,p)=>s+p.requestCount,0))} signing-argument records parse; none are silently discarded.

In the complete selected hour, ${raw.periods.map(p=>n(p.requestCount)).join(' → ')} request receipts become ${raw.periods.map(p=>n(p.inputCount)).join(' → ')} distinct account-and-input groups. The difference is ${raw.periods.map(p=>n(p.repeatExcess)).join(' → ')} additional receipts carrying an input already present in their own selected cohort. Both request receipts and grouped inputs are legitimate units for different questions. Neither measures independent people, applications, economic intents or destination settlements.

| Matched parent-time exposure on each date | Request receipts | Receipt change | Exact input groups | Input change |
| --- | ---: | ---: | ---: | ---: |
${rows}

The full hour reverses direction; the first 15 and first 30 minutes both decline and the last 30 minutes both increase. This is not a stable adoption trend or a statistically representative sample. The grouping lens and shorter-window checks were introduced after the original request comparison. They are exploratory, not preregistered tests. Time-of-hour composition is an alternative explanation. We retain these contrary sensitivities rather than select only a dramatic result.

## The repeated inputs are inspectable

There are ${repeated.map(g=>g.length).join(' and ')} repeated-input groups in the earlier/later hour. Every repeated group here has two separate request receipt IDs. Among them, ${signed.map(g=>g.length).join(' and ')} groups belong to zcash-connector.bridge.near and contain one parent trace with an exact application callback error, “Already signed”, plus another without a recorded failure. The error is joined through the exact parent trace; it does not prove a causal retry or failed signing.

Another ${neutral.map(g=>g.length).join(' and ')} repeated groups have no recorded failed receipt. Repeated inputs therefore cannot all be called errors, retries, test activity or artificial traffic. A returned NEAR trace is not proof of destination execution. Inspect both members and their decoded arguments in the workbench.

## What is original, and what is ordinary description

Explorer-visible facts include transaction hashes, receipt statuses and named accounts. The existing full-day top-three share is an account-concentration description. This submission's added measurement contribution is the sealed population reconstruction, exact input fingerprinting, count decomposition and matched-window sensitivity that exposes an otherwise easy-to-miss sign reversal. It is not a claim to have invented a new cryptographic primitive or to be the first study ever to count these records.

The research can be useful to a builder or ecosystem analyst deciding whether a change reflects more workload, more distinct inputs, a change in application mix, or unmeasured usage breadth. It shows which conclusions the data cannot identify, rather than supplying an automated adoption score.

## Track fit and balanced interpretation

Investment Thesis asks for a long-term NEAR thesis supported by rerunnable onchain evidence. Sigtrail retains [THESIS.md](THESIS.md), its for/against evidence and token-scale assumptions, plus the [full-day and historical context](public/archive.html). The main interface actively investigates the quality of one activity signal behind the platform claim. A generic transaction debugger alone would not satisfy that research purpose, so no generic debugger pivot was implemented.

The positive evidence is real use of a shared signing service. The potential platform benefit is that NEAR accounts/contracts can authorize signatures for other chains through shared infrastructure. The unresolved questions are independent operator diversity, sustained use, destination outcomes and complete economic capture. A successful platform can be highly concentrated if a few integrations aggregate many users; conversely, many account IDs can belong to one operator. The present dataset does not distinguish those alternatives.

## Exact definitions and reproducibility

- Network/contract: NEAR mainnet, v1.signer. Parents included at 00:00 ≤ UTC < 01:00 on 10 and 11 November 2026; individual windows use lower-inclusive/upper-exclusive parent timestamps from the matching archived index, not receipt creation or execution time.
- Request: one distinct receipt with at least one exact sign FunctionCall and receiver v1.signer. Duplicate receipt IDs are rejected. Multiple sign actions remain one request; every distinct input assignment is retained. Actual archived request receipts each contain one sign action.
- Input: SHA-256(initiating-account + newline + recursively key-sorted JSON of complete base64-decoded sign arguments). Array order and JSON value types are preserved. Duplicate JSON keys, unsafe numbers, invalid UTF-8 or malformed arguments fail the rebuild. No payload aliases, path, domain or key version are dropped. Raw-base64 grouping gives the same counts on this archive.
- Group separately within each selected date/window/account. Do not deduplicate across dates or assume matching arguments identify an economic intent. Input filters never remove receipt evidence from the CSV export.
- Source: FastNear index pages and complete returned transaction traces, with NEAR UTC boundary blocks and protocol configuration. The index's own parent set, hydration and emitted-receipt graph are checked; exhaustive completeness against an independently operated full node is unknown.
- The older full-day normalized archive omits signing arguments and outcomes; the exact-input lens cannot be applied to that archive. It remains separate context, not a comparable full-day input-growth series.

Raw comparison archive SHA-256: \`${data.sourceArchive.sha256}\`. The generated [investigation dataset](public/data/investigation.json) retains every exact receipt ID, parent hash, parent/creation/execution timestamps, input fingerprint, same-parent failure fact and raw JSON pointer/trace checksum. The complete arguments are retained by fingerprint. The [artifact manifest](public/data/evidence-manifest.json) seals generated outputs too.

Run from the public source checkout:

\`\`\`sh
npm test
npm run rebuild
npm run independent-audit
npm run investigation-check
npm run serve
\`\`\`

The independent Python program re-parses the sealed raw archive without importing the production JavaScript and checks all receipt IDs, fingerprints, account/window aggregations and same-parent failure joins against the generated dataset. No npm install, API key or network request is needed for this path. Live recollection is separate, may require provider access, and can change index results; it does not silently replace the archived evidence.
`;
}

export function measurementAuditGrid(data){
 const accounts=['',...new Set(data.periods.flatMap(p=>p.rows.map(r=>r.account)))].sort();
 const results=Object.fromEntries(['hour','first15','first30','last30'].map(window=>[window,Object.fromEntries(accounts.map(account=>[account,analyzeCohorts(data,{window,account}).periods.map(p=>({receipts:p.requestCount,inputs:p.inputCount,excess:p.repeatExcess,accounts:p.accountCount}))]))]));
 return {sourceArchiveSha256:data.sourceArchive.sha256,results};
}
