import { analyzeCohorts } from './investigate.mjs';
const $ = s => document.querySelector(s);
const number = value => Number(value).toLocaleString('en-US');
const signed = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${number(Math.abs(value))}`;
const percentage = value => value === null ? 'No baseline' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value * 100).toFixed(1)}%`;
const time = ns => new Date(Number(BigInt(ns) / 1000000n)).toISOString().replace('T', ' ').replace('Z', ' UTC');
const windowLabels = { hour: '00:00–01:00 UTC', first15: '00:00–00:15 UTC', first30: '00:00–00:30 UTC', last30: '00:30–01:00 UTC' };
let data, result, combinedGroups = [], selectedInput = '', recordPage = 0;
const pageSize = 8;
function element(tag, text, className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
function controls() { return { lens: $('input[name=lens]:checked').value, window: $('#window').value, account: $('#account').value }; }
function errorText(error) {
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object') return String(error);
  if (typeof error.ExecutionError === 'string') return error.ExecutionError;
  for (const value of Object.values(error)) { if (value && typeof value === 'object') { const found = errorText(value); if (found && !found.startsWith('{')) return found; } }
  return JSON.stringify(error);
}
function mergeGroups(periods) {
  const groups = new Map();
  periods.forEach((period, i) => period.groups.forEach(group => {
    if (!groups.has(group.id)) groups.set(group.id, { id: group.id, account: group.account, canonicalArgs: group.canonicalArgs, counts: [0, 0], rows: [[], []], repeated: false });
    const merged = groups.get(group.id); merged.counts[i] = group.requestCount; merged.rows[i] = group.rows; merged.repeated ||= group.repeatExcess > 0;
  }));
  return [...groups.values()].sort((a,b) => Math.max(...b.counts) - Math.max(...a.counts) || a.account.localeCompare(b.account) || a.id.localeCompare(b.id));
}
function render() {
  const options = controls(); result = analyzeCohorts(data, options); recordPage = 0;
  if(!result.available){$('#load-error').hidden=false;$('#load-error').textContent='At least one cohort is unavailable. No change or adoption inference is established.';$('#chart').replaceChildren();$('#change').textContent='Unavailable';$('#change-detail').textContent='The evidence is incomplete.';$('#samples').replaceChildren();$('#lens-comparison').replaceChildren();$('#group-rows').replaceChildren();$('#download-analysis').disabled=true;$('#download-rows').disabled=true;resetInspector();return;}
  $('#download-analysis').disabled=false;$('#download-rows').disabled=false;
  $('#definition').textContent = options.lens === 'receipts'
    ? 'One request = one distinct receipt with an exact sign action on v1.signer. Repeated arguments still count as separate request receipts.'
    : 'One input group = initiating account + identical decoded signing arguments, grouped separately inside each selected period. This is a measurement lens, not a user or intent count.';
  $('#chart-title').textContent = options.lens === 'receipts' ? 'Direct signing request receipts' : 'Distinct observed signing inputs';
  $('#selection-note').textContent = windowLabels[options.window];
  const max = Math.max(1, ...result.periods.map(p => p.requestCount));
  const chart = $('#chart'); chart.replaceChildren();
  result.periods.forEach(period => {
    const row = element('div',undefined,'period-row'), label = element('div',undefined,'period-label');
    label.append(element('span',`${period.date.slice(8)} November 2026`),element('strong',number(period.metricCount)));
    const track = element('div',undefined,'bar-track'); track.setAttribute('aria-hidden','true');
    const unique = element('span',undefined,'bar-inputs'); unique.style.width = `${period.inputCount / max * 100}%`;
    const extra = element('span',undefined,'bar-repeats'); extra.style.width = `${options.lens === 'receipts' ? period.repeatExcess / max * 100 : 0}%`;
    track.append(unique,extra); row.append(label,track,element('p',`${number(period.inputCount)} input groups + ${number(period.repeatExcess)} additional receipts for repeated inputs`, 'period-note')); chart.append(row);
  });
  const axis = element('div',undefined,'chart-axis'); axis.append(element('span','0'),element('span',number(max))); chart.append(axis);
  $('#change').textContent = percentage(result.change.relative);
  $('#change').classList.toggle('no-baseline',result.change.zeroDenominator);
  $('#change-detail').textContent = result.change.zeroDenominator
    ? `The earlier selection has zero observations; a percentage change is undefined. Absolute difference: ${signed(result.change.absolute)}.`
    : `${signed(result.change.absolute)} ${options.lens === 'receipts' ? 'request receipts' : 'input groups'} across the two selected periods. This is a sample comparison, not a long-term adoption rate.`;
  $('#change-title').textContent = options.account ? options.account : 'All observed initiating accounts';
  const raw = analyzeCohorts(data,{...options,lens:'receipts'}), grouped = analyzeCohorts(data,{...options,lens:'inputs'});
  const comparisons = $('#lens-comparison'); comparisons.replaceChildren();
  [['Request receipts',raw,'receipts'],['Distinct signing inputs',grouped,'inputs']].forEach(([name,analysis,lens])=>{ const line=element('div',undefined,`comparison-line${options.lens===lens?' is-selected':''}`); line.append(element('span',name),element('strong',percentage(analysis.change.relative))); comparisons.append(line); });
  const opposite = raw.change.absolute * grouped.change.absolute < 0;
  $('#sensitivity-note').textContent = opposite
    ? 'The direction reverses under the other counting definition for this selection. That sensitivity is the finding; neither definition measures adoption.'
    : 'The two definitions agree on direction for this selection. The whole-hour reversal is not invariant to shorter time windows.';
  $('#samples').replaceChildren(...result.periods.map(period=>{const node=element('div');node.append(element('strong',`${period.date} · selected sample`),element('span',`${number(period.requestCount)} receipts · ${number(period.inputCount)} inputs · ${number(period.accountCount)} account IDs`));return node;}));
  $('#results').setAttribute('aria-busy','false'); $('#export-status').textContent='';
  combinedGroups=mergeGroups(result.periods); if (!combinedGroups.some(g=>g.id===selectedInput)) selectedInput='';
  renderGroups(); if(selectedInput)showInput(selectedInput,false);else resetInspector();
  const query=new URLSearchParams(); if(options.lens!=='receipts')query.set('lens',options.lens);if(options.window!=='hour')query.set('window',options.window);if(options.account)query.set('account',options.account);
  history.replaceState(null,'',`${location.pathname}${query.size?'?'+query:''}${location.hash}`);
}
function resetInspector() {
  const root=$('#input-detail');root.replaceChildren(element('p','Evidence inspector','eyebrow'),element('h3','Choose an input group'),element('p','Inspect the exact arguments, every selected receipt, and its public parent transaction. Same-parent receipt failures are shown as separate facts.'));
}
function renderGroups() {
  const search=$('#record-search').value.trim().toLowerCase();
  const groups=combinedGroups.filter(group=>(!$('#repeats-only').checked||group.repeated)&&(!search||group.account.toLowerCase().includes(search)||group.id.includes(search)));
  const pages=Math.max(1,Math.ceil(groups.length/pageSize));recordPage=Math.min(recordPage,pages-1);
  $('#group-count').textContent=`${number(groups.length)} groups shown · record filter only`;
  const body=$('#group-rows');body.replaceChildren();
  groups.slice(recordPage*pageSize,(recordPage+1)*pageSize).forEach(group=>{
    const tr=element('tr');if(group.id===selectedInput)tr.className='selected';const account=element('td');account.append(element('strong',group.account),element('code',`SHA-256 ${group.id.slice(0,12)}…`));
    const action=element('td'),button=element('button','Inspect');button.type='button';button.setAttribute('aria-label',`Inspect input ${group.id.slice(0,12)} from ${group.account}`);button.addEventListener('click',()=>showInput(group.id));action.append(button);
    tr.append(account,element('td',number(group.counts[0])),element('td',number(group.counts[1])),action);body.append(tr);
  });
  if(!groups.length){const tr=element('tr'),td=element('td','No input groups match this record filter. Try another window, account, or clear the repeated-input filter.','empty-state');td.colSpan=4;tr.append(td);body.append(tr);}
  const pager=$('#record-pagination');pager.replaceChildren();
  const previous=element('button','Previous','quiet'),next=element('button','Next','quiet');previous.type=next.type='button';previous.disabled=recordPage===0;next.disabled=recordPage>=pages-1;previous.addEventListener('click',()=>{recordPage--;renderGroups();});next.addEventListener('click',()=>{recordPage++;renderGroups();});pager.append(previous,element('span',`Page ${recordPage+1} / ${pages}`),next);
}
function showInput(id,focus=true){
  const group=combinedGroups.find(g=>g.id===id);if(!group)return;selectedInput=id;renderGroups();const root=$('#input-detail');root.replaceChildren(element('p','Exact input group · not a user','eyebrow'),element('h3',group.account),element('p',`SHA-256 ${group.id}`,'fingerprint'));
  root.append(element('p',`${group.counts[0]} receipts in the earlier window; ${group.counts[1]} in the later window. Identical inputs are grouped only within each selected period.`));
  group.rows.forEach((rows,i)=>rows.forEach(row=>{
    const card=element('article',undefined,'receipt-record');card.append(element('strong',`${data.periods[i].date} · request receipt`),element('p',`Parent included: ${time(row.parentTimestampNs)}`),element('p',`Receipt created: ${time(row.createdTimestampNs)}`),element('code',row.receiptId));
    const link=element('a','Open parent transaction ↗');link.href=`https://pikespeak.ai/transaction-viewer/${encodeURIComponent(row.parentHash)}`;link.target='_blank';link.rel='noreferrer';card.append(element('p',`Parent: ${row.parentHash}`),link);
    if(row.callbackFailures.length){row.callbackFailures.forEach(f=>{const text=element('p',`Same-parent receipt failed: ${f.method||'unknown method'} on ${f.receiverId}. ${errorText(f.error)}`,'error-fact');card.append(text,element('code',`Failed receipt: ${f.receiptId}`));});}
    else card.append(element('p','No failed receipt recorded in this returned parent trace. Destination execution is not checked.','status-fact'));
    const provenance=element('details'),summary=element('summary','Raw trace pointer & checksum');provenance.append(summary,element('p',`${row.sourceTrace.archive} ${row.sourceTrace.jsonPointer}`),element('code',`Trace SHA-256: ${row.sourceTrace.sha256}`),element('p','Hash encoding: UTF-8 JSON.stringify of the parsed trace. The compressed archive has its own separate seal.'));card.append(provenance);root.append(card);
  }));
  const args=element('details'),summary=element('summary','Exact decoded signing arguments');args.append(summary,element('pre',JSON.stringify(JSON.parse(group.canonicalArgs),null,2)));root.append(args,element('p','An “Already signed” application error does not prove that signing failed, funds were lost, or a retry is safe. Input equality is not settlement evidence.','micro'));
  const download=element('button','Export this input group ↓');download.type='button';download.addEventListener('click',()=>downloadFile(`sigtrail-input-${id.slice(0,12)}.json`,JSON.stringify({selection:controls(),definition:data.canonicalization,sourceArchive:data.sourceArchive,group},null,2)+'\n','application/json'));root.append(download);
  if(focus&&matchMedia('(max-width:900px)').matches)root.scrollIntoView({block:'start'});
}
function downloadFile(name,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=element('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('#export-status').textContent=`Downloaded ${name}`;}
function exportAnalysis(){const selection=controls();downloadFile('sigtrail-analysis.json',JSON.stringify({project:'Sigtrail',question:'Does observed NEAR Chain Signatures activity support the claim that chain abstraction is becoming a platform?',selection,definition:data.countUnits,canonicalization:data.canonicalization,sourceArchive:data.sourceArchive,sourceSelection:data.metadata.selection,result,limits:result.limits},null,2)+'\n','application/json');}
function exportRows(){const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';const rows=result.periods.flatMap(period=>period.rows.map(row=>[period.date,row.receiptId,row.parentHash,row.account,row.parentTimestampNs,row.createdTimestampNs,row.executedTimestampNs,row.inputIds.join(';'),JSON.stringify(row.callbackFailures)]));const csv=['period,receipt_id,parent_transaction_hash,initiating_account,parent_timestamp_ns,receipt_created_ns,receipt_executed_ns,input_sha256,same_parent_receipt_failures',...rows.map(row=>row.map(quote).join(','))].join('\n')+'\n';downloadFile('sigtrail-selected-receipts.csv',csv,'text/csv;charset=utf-8');$('#export-status').textContent=`Exported all ${number(rows.length)} selected receipt rows. Input grouping does not remove observed receipts from this evidence export.`;}
async function init(){
  try{
    const response=await fetch('./data/investigation.json');if(!response.ok)throw Error(`HTTP ${response.status}`);data=await response.json();
    if(data.sourceArchive.sha256!=='350e06ff3fe99ab378d2c3bd46bff6e8c25225274df052e5860a44b1f200fd1d')throw Error('Unexpected raw archive version');
    const accounts=[...new Set(data.periods.flatMap(p=>p.rows.map(r=>r.account)))].sort();accounts.forEach(account=>$('#account').append(new Option(account,account)));
    const q=new URLSearchParams(location.search),lens=q.get('lens'),window=q.get('window'),account=q.get('account');if(['receipts','inputs'].includes(lens))$(`input[name=lens][value=${lens}]`).checked=true;if(Object.hasOwn(windowLabels,window))$('#window').value=window;if(accounts.includes(account))$('#account').value=account;
    document.querySelectorAll('input[name=lens]').forEach(input=>input.addEventListener('change',render));$('#window').addEventListener('change',render);$('#account').addEventListener('change',render);$('#repeats-only').addEventListener('change',()=>{recordPage=0;renderGroups();});$('#record-search').addEventListener('input',()=>{recordPage=0;renderGroups();});$('#reset').addEventListener('click',()=>{$('input[name=lens][value=receipts]').checked=true;$('#window').value='hour';$('#account').value='';$('#repeats-only').checked=true;$('#record-search').value='';selectedInput='';render();});$('#download-analysis').addEventListener('click',exportAnalysis);$('#download-rows').addEventListener('click',exportRows);
    const full=analyzeCohorts(data,{}),inputs=analyzeCohorts(data,{lens:'inputs'});$('#original-finding').textContent=`In the whole archived hour, ${number(full.periods[0].requestCount)} → ${number(full.periods[1].requestCount)} request receipts (${percentage(full.change.relative)}) become ${number(inputs.periods[0].inputCount)} → ${number(inputs.periods[1].inputCount)} distinct account-and-input groups (${percentage(inputs.change.relative)}). Shorter matched windows do not all show this reversal.`;
    $('#coverage-counts').textContent=`The raw archive contains ${number(data.periods[0].indexedParents)} and ${number(data.periods[1].indexedParents)} distinct indexed parent transactions, respectively, yielding ${number(full.periods[0].requestCount)} and ${number(full.periods[1].requestCount)} direct sign receipts. Every observed sign argument is retained. Collected ${data.fetchedAtUtc}.`;
    $('#archive-checksum').textContent=`SHA-256 ${data.sourceArchive.sha256}`;render();
  }catch(error){$('#load-error').hidden=false;$('#load-error').textContent=`Evidence could not be verified: ${error.message}. No analytical result is established. Retry the page or reproduce the archive offline.`;$('#results').setAttribute('aria-busy','false');}
}
init();
