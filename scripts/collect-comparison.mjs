import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { rebuildComparison } from '../src/comparison.mjs';
const rpcUrl='https://archival-rpc.mainnet.fastnear.com', base='https://tx.main.fastnear.com/v0';
const cache=new URL('../.cache/comparison/',import.meta.url); await mkdir(cache,{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function post(url,body){for(let i=0;i<5;i++){try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});if(r.ok)return await r.json();if(![429,500,502,503,504].includes(r.status))throw Error(`HTTP ${r.status}`);}catch(e){if(i===4)throw e;} await pause(1500*(i+1));}throw Error('Public source failed');}
async function rpc(method,params){const j=await post(rpcUrl,{jsonrpc:'2.0',id:'comparison',method,params});if(j.error)throw Error(JSON.stringify(j.error));return j.result;}
const blocks=new Map();
async function block(height){if(!blocks.has(height)){const f=new URL(`block-${height}.json`,cache);let b;try{b=JSON.parse(await readFile(f,'utf8'));}catch{b=await rpc('block',{block_id:height});await writeFile(f,JSON.stringify(b));}blocks.set(height,b);}return blocks.get(height);}
const stamp=b=>BigInt(b.header.timestamp_nanosec);
async function boundary(iso){const target=BigInt(Date.parse(iso))*1000000n;let lo=223700000,hi=224050000;let l=await block(lo),h=await block(hi);if(stamp(l)>=target||stamp(h)<target)throw Error('Boundary bracket');while(hi-lo>1){const fraction=Number(target-stamp(l))/Number(stamp(h)-stamp(l));const mid=Math.max(lo+1,Math.min(hi-1,lo+Math.floor((hi-lo)*fraction)));const b=await block(mid);if(stamp(b)<target){lo=mid;l=b;}else{hi=mid;h=b;}}return {before:l,inside:h};}
const periods=[];
for(const date of ['2026-11-10','2026-11-11']){
 const startUtc=`${date}T00:00:00.000Z`,endUtc=`${date}T01:00:00.000Z`;
 const startBoundary=await boundary(startUtc),endBoundary=await boundary(endUtc);
 const start=startBoundary.inside.header.height,end=endBoundary.before.header.height;
 console.log(date,'parent blocks',start,end);
 const query={account_id:'v1.signer',from_tx_block_height:start,to_tx_block_height:end,is_function_call:true,limit:200,desc:false};
 const indexFile=new URL(`${date}-index.json`,cache);let pages;try{pages=JSON.parse(await readFile(indexFile,'utf8'));}catch{pages=[];let token=null;const seen=new Set();do{const p=await post(`${base}/account`,{...query,...(token?{resume_token:token}:{})});if(!Array.isArray(p.account_txs))throw Error('Malformed index');pages.push(p);token=p.resume_token||null;if(token&&(seen.has(token)||!p.account_txs.length))throw Error('Stalled index');seen.add(token);await pause(500);}while(token);await writeFile(indexFile,JSON.stringify(pages));}
 const rows=pages.flatMap(p=>p.account_txs),count=pages[0].txs_count,hashes=[...new Set(rows.map(r=>r.transaction_hash))];if(hashes.length!==count)throw Error('Incomplete parent index');
 console.log(date,'indexed',count);
 const batches=Array.from({length:Math.ceil(hashes.length/20)},(_,i)=>i*20),savedBatches=new Map();let cursor=0,done=0;
 async function worker(){while(cursor<batches.length){const i=batches[cursor++],batch=hashes.slice(i,i+20),file=new URL(`${date}-batch-${i}.json`,cache);let result;try{result=JSON.parse(await readFile(file,'utf8'));}catch{result=await post(`${base}/transactions`,{tx_hashes:batch});await writeFile(file,JSON.stringify(result));await pause(700);}const returned=result.transactions?.map(t=>t.transaction.hash);if(returned?.length!==batch.length||new Set(returned).size!==batch.length||returned.some(h=>!batch.includes(h)))throw Error('Incomplete hydration');savedBatches.set(i,result.transactions);done+=batch.length;if(done%200<20)console.log(date,'hydrated',done,'/',count);}}
 await Promise.all([worker(),worker()]);
 const traces=batches.flatMap(i=>savedBatches.get(i));
 const protocolConfig=await rpc('EXPERIMENTAL_protocol_config',{block_id:start});
 const endProtocolConfig=await rpc('EXPERIMENTAL_protocol_config',{block_id:end});
 periods.push({date,startUtc,endUtc,parentBlockRange:[start,end],startBoundary,endBoundary,query,indexPages:pages,traces,protocolConfig,endProtocolConfig});
}
const source={schemaVersion:1,selection:'First UTC hour on 10 and 11 November 2026, selected post hoc before collection; two narrow matched cohorts, not full days or an adoption trend.',fetchedAtUtc:new Date().toISOString(),sources:{rpc:rpcUrl,index:`${base}/account`,traces:`${base}/transactions`},periods};
const {summary,csv}=rebuildComparison(source);
const data=new URL('../public/data/',import.meta.url);
await writeFile(new URL('comparison-source.json.gz',data),gzipSync(Buffer.from(JSON.stringify(source)+'\n'),{level:9}));
await writeFile(new URL('comparison.json',data),JSON.stringify(summary,null,2)+'\n');
await writeFile(new URL('comparison-receipts.csv',data),csv);
console.log(JSON.stringify(summary,null,2));
