const NS=1000000n,near=v=>Number(v)/1e24;
const quote=v=>`"${String(v??'').replaceAll('"','""')}"`;
const nsIso=n=>new Date(Number(BigInt(n)/NS)).toISOString();
export function rebuildComparison(source){
 if(source.schemaVersion!==1||source.periods?.length!==2||source.periods.map(p=>p.date).join(',')!=='2026-11-10,2026-11-11')throw Error('Invalid comparison source');
 const csv=['period,receipt_id,parent_transaction_hash,initiating_account,receipt_created_utc,execution_utc,tokens_burnt_yoctonear,execution_status'];
 const periods=source.periods.map(p=>{
  if(p.startUtc!==`${p.date}T00:00:00.000Z`||p.endUtc!==`${p.date}T01:00:00.000Z`)throw Error('Wrong matched-hour selection');
  const start=BigInt(Date.parse(p.startUtc))*NS,end=BigInt(Date.parse(p.endUtc))*NS;
  if(end-start!==3600000000000n)throw Error('Comparison must use equal one-hour cohorts');
  for(const [boundary,target]of [[p.startBoundary,start],[p.endBoundary,end]]){
   if(BigInt(boundary.before.header.timestamp_nanosec)>=target||BigInt(boundary.inside.header.timestamp_nanosec)<target||boundary.before.header.height+1!==boundary.inside.header.height)throw Error('Invalid UTC boundary');
  }
  if(p.parentBlockRange[0]!==p.startBoundary.inside.header.height||p.parentBlockRange[1]!==p.endBoundary.before.header.height)throw Error('Wrong parent range');
  if(p.query.account_id!=='v1.signer'||p.query.from_tx_block_height!==p.parentBlockRange[0]||p.query.to_tx_block_height!==p.parentBlockRange[1]||p.query.is_function_call!==true||p.query.desc!==false)throw Error('Wrong source query');
  const rows=p.indexPages.flatMap(page=>page.account_txs),hashes=new Set(rows.map(r=>r.transaction_hash));
  if(hashes.size!==p.indexPages[0].txs_count||p.indexPages.some(page=>page.txs_count!=null&&page.txs_count!==hashes.size)||p.indexPages.at(-1).resume_token)throw Error('Incomplete index');
  const parents=new Set();for(const row of rows){const time=BigInt(row.tx_block_timestamp);if(row.account_id!=='v1.signer'||row.tx_block_height<p.parentBlockRange[0]||row.tx_block_height>p.parentBlockRange[1]||time<start||time>=end)throw Error('Parent outside UTC cohort');}
  for(const t of p.traces){if(!hashes.has(t.transaction.hash)||parents.has(t.transaction.hash))throw Error('Mismatched hydration');parents.add(t.transaction.hash);const h=t.execution_outcome.block_height;if(h<p.parentBlockRange[0]||h>p.parentBlockRange[1])throw Error('Trace outside parent range');}
  if(parents.size!==hashes.size)throw Error('Incomplete hydration');
  const indexedByHash = new Map(rows.map(r => [r.transaction_hash, r]));
  for (const t of p.traces) {
   if (t.execution_outcome.block_height !== indexedByHash.get(t.transaction.hash).tx_block_height) throw Error('Parent height differs from index');
   if (!Array.isArray(t.receipts)) throw Error('Incomplete receipt graph');
   const ids = new Set(t.receipts.map(e => e.receipt?.receipt_id));
   if (ids.has(undefined) || ids.has('') || ids.size !== t.receipts.length) throw Error('Invalid receipt graph IDs');
   if (t.receipts.some(e => e.execution_outcome?.id !== e.receipt.receipt_id)) throw Error('Receipt outcome ID mismatch');
   for (const outcome of [t.execution_outcome, ...t.receipts.map(e => e.execution_outcome)]) {
    if (!Array.isArray(outcome?.outcome?.receipt_ids) || outcome.outcome.receipt_ids.some(id => !ids.has(id))) throw Error('Incomplete receipt graph');
   }
  }
  const receipts=new Map(),callers=new Map();let total=0n,failures=0,outside=0,signerActionReceipts=0;const categories={request:0,mpc_response:0,internal_completion:0,other_method:0};
  for(const t of p.traces)for(const entry of t.receipts||[]){const r=entry.receipt;if(r?.receiver_id!=='v1.signer')continue;const actions=r.receipt?.Action?.actions||[],methods=actions.flatMap(a=>a.FunctionCall?[a.FunctionCall.method_name]:[]);if(!methods.length)continue;
   if(receipts.has(r.receipt_id)){if(receipts.get(r.receipt_id)!==JSON.stringify(entry))throw Error('Conflicting duplicate');continue;}receipts.set(r.receipt_id,JSON.stringify(entry));signerActionReceipts++;
   const category=methods.includes('sign')?'request':methods.includes('respond')?'mpc_response':methods.includes('return_signature_and_clean_state_on_success')?'internal_completion':'other_method';categories[category]++;
   if(category!=='request')continue;const outcome=entry.execution_outcome;if(outcome?.id!==r.receipt_id||outcome.outcome?.executor_id!=='v1.signer'||!/^\d+$/.test(outcome.outcome.tokens_burnt))throw Error('Missing exact sign fee outcome');
   total+=BigInt(outcome.outcome.tokens_burnt);callers.set(r.predecessor_id,(callers.get(r.predecessor_id)||0)+1);
   const status=Object.keys(outcome.outcome.status)[0];if(status==='Failure')failures++;const executionTime=BigInt(outcome.block_timestamp);if(executionTime<start||executionTime>=end)outside++;
   csv.push([p.date,r.receipt_id,t.transaction.hash,r.predecessor_id,nsIso(r.block_timestamp),nsIso(outcome.block_timestamp),outcome.outcome.tokens_burnt,status].map(quote).join(','));
  }
  const fraction=p.protocolConfig.runtime_config.transaction_costs?.burnt_gas_reward;if(!Array.isArray(fraction)||fraction.length!==2||!fraction.every(Number.isSafeInteger)||fraction[0]<0||fraction[1]<=0||fraction[0]>fraction[1])throw Error('Missing protocol gas rebate');
  if(p.protocolConfig.chain_id!=='mainnet'||p.endProtocolConfig?.protocol_version!==p.protocolConfig.protocol_version||JSON.stringify(p.endProtocolConfig.runtime_config.transaction_costs?.burnt_gas_reward)!==JSON.stringify(fraction))throw Error('Protocol changed within comparison hour');
  const topCallers=[...callers].map(([account,count])=>({account,count})).sort((a,b)=>b.count-a.count||a.account.localeCompare(b.account));
  const topThreeCount=topCallers.slice(0,3).reduce((s,r)=>s+r.count,0),directRequests=categories.request;
  return {date:p.date,startUtc:p.startUtc,endUtc:p.endUtc,parentBlockRange:p.parentBlockRange,touchingTransactions:hashes.size,signerActionReceipts,categories,directRequests,distinctAccounts:callers.size,topCallers,topOneShare:directRequests?topCallers[0].count/directRequests:null,topThreeCount,topThreeShare:directRequests?topThreeCount/directRequests:null,totalTokensBurntYocto:total.toString(),signStageChargeNear:near(total),meanSignStageChargeNear:directRequests?near(total)/directRequests:null,protocolVersion:p.protocolConfig.protocol_version,contractRewardFraction:fraction[0]/fraction[1],signStageSupplyBurnNear:near(total)*(1-fraction[0]/fraction[1]),directStageFailures:failures,directExecutionOutsideHour:outside};
 });
 const [a,b]=periods,am=new Map(a.topCallers.map(r=>[r.account,r.count])),bm=new Map(b.topCallers.map(r=>[r.account,r.count]));
 const accountChanges=[...new Set([...am.keys(),...bm.keys()])].map(account=>({account,before:am.get(account)||0,after:bm.get(account)||0,delta:(bm.get(account)||0)-(am.get(account)||0)})).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)||a.account.localeCompare(b.account));
 const summary={schemaVersion:1,fetchedAtUtc:source.fetchedAtUtc,selection:source.selection,sources:source.sources,periods,change:{directRequests:b.directRequests-a.directRequests,directRequestsPct:a.directRequests?b.directRequests/a.directRequests-1:null,distinctAccounts:b.distinctAccounts-a.distinctAccounts,topThreePercentagePoints:(b.topThreeShare-a.topThreeShare)*100,signStageChargeNear:b.signStageChargeNear-a.signStageChargeNear,enteredAccounts:[...bm.keys()].filter(k=>!am.has(k)),exitedAccounts:[...am.keys()].filter(k=>!bm.has(k)),retainedAccounts:[...am.keys()].filter(k=>bm.has(k)),accountChanges},limits:['Two post hoc matched one-hour parent cohorts cannot establish daily growth or a sustained trend.','Initiating account IDs are not independently verified application operators or unique users.','Direct receipt execution status does not establish signature completion or destination settlement.','Exact charges cover direct sign execution only; other workflow stages and destination-chain costs are excluded.','FastNear index completeness is not independently checked against a full node.','Receipt creation time and execution time are retained separately; parent inclusion defines cohort membership.']};
 return {summary,csv:csv.join('\n')+'\n'};
}
