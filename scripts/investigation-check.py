"""Independent offline recount: standard library only; imports no production JS."""
from pathlib import Path
from collections import Counter,defaultdict
import base64,csv,gzip,hashlib,json

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'public/data'
archive=(DATA/'comparison-source.json.gz').read_bytes()
seal=json.loads((ROOT/'evidence/archive-checksums.json').read_text())['comparison-source.json.gz']
assert hashlib.sha256(archive).hexdigest()==seal,'Raw archive differs from seal'
source=json.loads(gzip.decompress(archive))
generated_bytes=(DATA/'investigation.json').read_bytes()
generated=json.loads(generated_bytes)
assert generated['sourceArchive']['sha256']==seal

def unique_keys(pairs):
    result={}
    for key,value in pairs:
        assert key not in result,'Duplicate JSON argument key'
        result[key]=value
    return result

def safe_int(text):
    value=int(text)
    assert abs(value)<=9007199254740991,'Unsafe JSON argument integer'
    return value

def canonical(args):
    return json.dumps(args,sort_keys=True,ensure_ascii=False,separators=(',',':'))

periods=[]
for pi,period in enumerate(source['periods']):
    index={}
    for page in period['indexPages']:
        for row in page['account_txs']:
            if row['transaction_hash'] in index:assert index[row['transaction_hash']]==row
            index[row['transaction_hash']]=row
    assert len(index)==period['indexPages'][0]['txs_count']==len(period['traces'])
    assert not period['indexPages'][-1].get('resume_token')
    actual={r['receiptId']:r for r in generated['periods'][pi]['rows']}
    assert len(actual)==len(generated['periods'][pi]['rows'])
    rows=[];seen=set();raw_groups=set();text_groups=set()
    for ti,trace in enumerate(period['traces']):
        parent=trace['transaction']['hash'];indexed=index[parent]
        assert trace['execution_outcome']['block_height']==indexed['tx_block_height']
        receipt_ids={e['receipt']['receipt_id'] for e in trace['receipts']}
        assert len(receipt_ids)==len(trace['receipts'])
        for outcome in [trace['execution_outcome']]+[e['execution_outcome'] for e in trace['receipts']]:
            assert set(outcome['outcome']['receipt_ids'])<=receipt_ids,'Missing emitted receipt'
        failures=[]
        for entry in trace['receipts']:
            failure=entry['execution_outcome']['outcome']['status'].get('Failure')
            if failure:
                r=entry['receipt'];methods=[a['FunctionCall']['method_name'] for a in r.get('receipt',{}).get('Action',{}).get('actions',[]) if 'FunctionCall' in a]
                failures.append({'receiptId':r['receipt_id'],'receiverId':r['receiver_id'],'method':', '.join(methods) or None,'error':failure})
        for entry in trace['receipts']:
            r=entry['receipt']
            if r['receiver_id']!='v1.signer':continue
            calls=[a['FunctionCall'] for a in r.get('receipt',{}).get('Action',{}).get('actions',[]) if a.get('FunctionCall',{}).get('method_name')=='sign']
            if not calls:continue
            rid=r['receipt_id'];assert rid not in seen;seen.add(rid)
            inputs=[]
            for call in calls:
                raw=call['args'];decoded=base64.b64decode(raw,validate=True).decode('utf-8')
                args=json.loads(decoded,object_pairs_hook=unique_keys,parse_int=safe_int)
                assert isinstance(args,dict)
                text=canonical(args);identifier=hashlib.sha256((r['predecessor_id']+'\n'+text).encode()).hexdigest()
                assert generated['inputs'][identifier]['canonicalArgs']==text
                raw_groups.add((r['predecessor_id'],raw));text_groups.add((r['predecessor_id'],decoded))
                if identifier not in inputs:inputs.append(identifier)
            actual_row=actual[rid]
            assert actual_row['parentHash']==parent
            assert actual_row['account']==r['predecessor_id']
            assert actual_row['parentTimestampNs']==str(indexed['tx_block_timestamp'])
            assert actual_row['createdTimestampNs']==str(r['block_timestamp'])
            assert actual_row['executedTimestampNs']==str(entry['execution_outcome']['block_timestamp'])
            assert actual_row['inputIds']==inputs
            assert actual_row['callbackFailures']==failures
            assert actual_row['sourceTrace']['jsonPointer']==f'/periods/{pi}/traces/{ti}'
            rows.append({'receiptId':rid,'parent':parent,'account':r['predecessor_id'],'time':int(indexed['tx_block_timestamp']),'inputs':inputs,'failures':failures})
    assert set(actual)==seen,'Missing or extra generated receipt'
    canonical_groups={i for row in rows for i in row['inputs']}
    assert len(raw_groups)==len(text_groups)==len(canonical_groups),'Grouping changes under raw representation'
    periods.append({'date':period['date'],'start':int(period['indexPages'][0]['account_txs'][0]['tx_block_timestamp'])//10**9,'rows':rows,'indexedParents':len(index)})

WINDOWS={'hour':(0,3600),'first15':(0,900),'first30':(0,1800),'last30':(1800,3600)}
from datetime import datetime,timezone

def measure(pi,window,account=''):
    period=source['periods'][pi];start=int(datetime.fromisoformat(period['startUtc'].replace('Z','+00:00')).timestamp())*10**9
    lo,hi=WINDOWS[window];rows=[r for r in periods[pi]['rows'] if (not account or r['account']==account) and start+lo*10**9<=r['time']<start+hi*10**9]
    groups=defaultdict(list)
    for row in rows:
        for i in row['inputs']:groups[i].append(row)
    return {'receipts':len(rows),'inputs':len(groups),'excess':sum(len(r['inputs']) for r in rows)-len(groups),'accounts':len({r['account'] for r in rows}),'groups':groups}

expected={'hour':[[615,567,48],[600,574,26]],'first15':[[157,139,18],[125,121,4]],'first30':[[306,283,23],[242,235,7]],'last30':[[309,284,25],[358,339,19]]}
summary={}
for window in WINDOWS:
    measured=[measure(pi,window) for pi in range(2)]
    assert [[m['receipts'],m['inputs'],m['excess']] for m in measured]==expected[window]
    summary[window]=[{k:m[k] for k in ['receipts','inputs','excess','accounts']} for m in measured]

pair_checks=[]
for pi,expected_pairs in enumerate([47,24]):
    groups=measure(pi,'hour')['groups'];zcash=0;neutral=0;distribution=Counter()
    for identifier,rows in groups.items():
        distribution[len(rows)]+=1
        if len(rows)<=1:continue
        assert len(rows)==2
        ordered=sorted(rows,key=lambda r:(r['time'],r['parent'],r['receiptId']))
        failures=[f for row in rows for f in row['failures']]
        if rows[0]['account']=='zcash-connector.bridge.near':
            assert not ordered[0]['failures'] and len(ordered[1]['failures'])==1
            assert 'Already signed' in json.dumps(ordered[1]['failures'][0]['error'])
            zcash+=1
        if not failures:neutral+=1
    assert zcash==expected_pairs and neutral==[1,2][pi]
    pair_checks.append({'date':periods[pi]['date'],'sameParentAlreadySignedPairs':zcash,'repeatPairsWithoutRecordedFailure':neutral,'groupMultiplicity':dict(sorted(distribution.items()))})

accounts=sorted({row['account'] for p in periods for row in p['rows']})
account_results={account:{window:[{k:v for k,v in measure(pi,window,account).items() if k!='groups'} for pi in range(2)] for window in WINDOWS} for account in accounts}
grid=json.loads((DATA/'investigation-checks.json').read_text())
assert grid['sourceArchiveSha256']==seal
for window in WINDOWS:
    for account in ['']+accounts:
        expected=[{k:v for k,v in measure(pi,window,account).items() if k!='groups'} for pi in range(2)]
        assert grid['results'][window][account]==expected,(window,account)
assert len(grid['results'])==len(WINDOWS)

result={'method':'Independent Python standard library reconstruction from sealed raw archive; no production JS imported','archiveSha256':seal,'generatedDatasetSha256':hashlib.sha256(generated_bytes).hexdigest(),'all1215RowsAndFingerprintsVerified':True,'everyAccountAndWindowAggregationVerified':True,'parentCounts':[p['indexedParents'] for p in periods],'windows':summary,'repeatPairChecks':pair_checks,'accountWindowResults':account_results,'inferenceLimit':'Input repeats are not automatically retries, users, applications or destination outcomes; two selected hours are not a sustained trend.'}
(ROOT/'evidence/investigation-independent.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['all1215RowsAndFingerprintsVerified','parentCounts','windows','repeatPairChecks']},indent=2))
