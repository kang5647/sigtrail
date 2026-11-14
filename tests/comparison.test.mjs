import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { rebuildComparison } from '../src/comparison.mjs';
const root=new URL('../public/data/',import.meta.url);
const source=JSON.parse(gunzipSync(await readFile(new URL('comparison-source.json.gz',root))));
const saved=JSON.parse(await readFile(new URL('comparison.json',root),'utf8'));
const clone=()=>structuredClone(source);
function firstDirect(s){for(const t of s.periods[0].traces)for(const e of t.receipts||[])if(e.receipt?.receiver_id==='v1.signer'&&e.receipt.receipt?.Action?.actions.some(a=>a.FunctionCall?.method_name==='sign'))return e;throw Error('No request');}
test('matched-hour comparison reproduces summary and CSV from complete archived traces',async()=>{
 const rebuilt=rebuildComparison(source);assert.deepEqual(rebuilt.summary,saved);assert.equal(rebuilt.csv,await readFile(new URL('comparison-receipts.csv',root),'utf8'));
 for(const [i,p]of source.periods.entries()){
  const direct=new Map();for(const t of p.traces)for(const e of t.receipts||[]){const r=e.receipt;if(r?.receiver_id==='v1.signer'&&r.receipt?.Action?.actions.some(a=>a.FunctionCall?.method_name==='sign'))direct.set(r.receipt_id,e);}
  assert.equal(saved.periods[i].directRequests,direct.size);
  assert.equal(saved.periods[i].totalTokensBurntYocto,[...direct.values()].reduce((s,e)=>s+BigInt(e.execution_outcome.outcome.tokens_burnt),0n).toString());
 }
});
test('parent population, hydration, boundaries and fee evidence are required',()=>{
 let s=clone();s.periods[0].traces.pop();assert.throws(()=>rebuildComparison(s),/Incomplete hydration/);
 s=clone();s.periods[0].indexPages[0].txs_count++;assert.throws(()=>rebuildComparison(s),/Incomplete index/);
 s=clone();s.periods[0].startBoundary.inside.header.timestamp_nanosec='0';assert.throws(()=>rebuildComparison(s),/Invalid UTC boundary/);
 s=clone();delete firstDirect(s).execution_outcome.outcome.tokens_burnt;assert.throws(()=>rebuildComparison(s),/Missing exact sign fee outcome/);
});
test('one receipt containing two sign actions remains one request',()=>{
 const s=clone();firstDirect(s).receipt.receipt.Action.actions.push({FunctionCall:{method_name:'sign'}});
 assert.equal(rebuildComparison(s).summary.periods[0].directRequests,saved.periods[0].directRequests);
});
test('creation and execution time are separate and fees are never treated as settlement',()=>{
 const s=clone(),e=firstDirect(s);e.execution_outcome.block_timestamp=Number(BigInt(Date.parse('2026-11-10T01:00:01.000Z'))*1000000n);
 assert.equal(rebuildComparison(s).summary.periods[0].directRequests,saved.periods[0].directRequests);
 assert.ok(rebuildComparison(s).summary.periods[0].directExecutionOutsideHour>=1);
 s.periods[0].endProtocolConfig.protocol_version++;assert.throws(()=>rebuildComparison(s),/Protocol changed/);
});

test('hydrated parents must retain every emitted descendant receipt',()=>{
 const s=clone(), direct=firstDirect(s);
 const owner=s.periods[0].traces.find(t=>t.receipts.includes(direct));
 owner.receipts=owner.receipts.filter(e=>e!==direct);
 assert.throws(()=>rebuildComparison(s),/Incomplete receipt graph/);
});
