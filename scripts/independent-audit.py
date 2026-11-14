#!/usr/bin/env python3
"""Independent stdlib audit. No imports from the production JS analyzer.

python3 scripts/independent-audit.py [--live]
Live mode independently rechecks the 80 fee receipts, 25 reward maps, UTC
boundary blocks and sampled protocol configs. It does not replay the full day.
"""
import collections
import concurrent.futures
import csv
import datetime
import gzip
import hashlib
import json
import pathlib
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / 'public/data'
S = json.loads((DATA / 'snapshot.json').read_text())
A = json.loads(gzip.decompress((DATA / 'full-day-census.json.gz').read_bytes()))
YOCTO = 10 ** 24


def count(receipts):
    unique = {}
    for receipt in receipts:
        if receipt['id'] in unique:
            assert unique[receipt['id']] == receipt, 'Conflicting duplicate receipt'
        unique[receipt['id']] = receipt
    counts = collections.Counter()
    methods = collections.Counter()
    for receipt in unique.values():
        action_methods = [a['method'] for a in receipt['actions'] if a['action'] == 'FUNCTION_CALL']
        methods.update(action_methods)
        if 'sign' in action_methods:
            counts[receipt['predecessor_account_id']] += 1
    top = counts.most_common(3)
    return {'receipts': len(unique), 'methods': dict(methods), 'directSign': sum(counts.values()),
            'initiatingAccounts': len(counts), 'topThree': top,
            'topThreeCount': sum(n for _, n in top)}


def post(url, body):
    request = urllib.request.Request(url, data=json.dumps(body).encode(),
                                    headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def rpc(method, params):
    response = post(S['issuanceAudit']['source']['rpcUrl'],
                    {'jsonrpc': '2.0', 'id': 'independent-audit', 'method': method, 'params': params})
    assert 'error' not in response, response.get('error')
    return response['result']


full = count(A['receipts'])
assert len(A['transactionHashes']) == len(set(A['transactionHashes'])) == A['touchingTransactions']
parents = set(A['transactionHashes'])
assert all(r['transaction_hash'] in parents for r in A['receipts'])
assert hashlib.sha256('\n'.join(A['transactionHashes']).encode()).hexdigest() == A['transactionHashesSha256']
assert full['directSign'] == S['fullDayCensus']['categories']['request']
assert full['topThreeCount'] == S['fullDayCensus']['topThreeCount']
assert full['initiatingAccounts'] == S['fullDayCensus']['initiatingAccounts']
archive_rows = {(r['id'], r['transaction_hash'], r['predecessor_account_id'], a['method'])
                for r in A['receipts'] for a in r['actions']}
with (DATA / 'full-day-receipt-audit.csv').open() as handle:
    csv_rows = {(r['receipt_id'], r['parent_transaction_hash'], r['initiating_account'], r['method'])
                for r in csv.DictReader(handle)}
assert csv_rows == archive_rows, 'Full-day CSV differs from archive'
windows = []
for window in S['signerWindows'] + S['dayWindows']:
    result = count(window['receipts'])
    assert result['directSign'] == window['categories']['request']
    assert result['initiatingAccounts'] == window['uniqueCallers']
    assert result['topThreeCount'] == window['topThreeCount']
    windows.append({'blocks': window['blocks'], 'parentObservedRange': window['observedRange'], **result})
pooled = count([r for w in S['dayWindows'] for r in w['receipts']])
assert pooled['directSign'] == S['daySummary']['categories']['request']
fees = S['feeFootprint']['receipts']
fee_ids = {r['receiptId'] for r in fees}
latest = {r['id']: r for r in S['signerWindows'][-1]['receipts']
          if any(a['action'] == 'FUNCTION_CALL' and a['method'] == 'sign' for a in r['actions'])}
assert fee_ids == set(latest) and len(fees) == len(latest)
assert all(r['transactionHash'] == latest[r['receiptId']]['transaction_hash'] for r in fees)
fee_sum = sum(int(r['tokensBurntYocto']) for r in fees)
assert str(fee_sum) == S['feeFootprint']['totalTokensBurntYocto']
reward_sum = 0
for epoch in S['issuanceAudit']['epochs']:
    reward = sum(int(n) for n in epoch['rewardsYoctoByAccount'].values())
    assert str(reward) == epoch['rewardTotalYocto']
    reward_sum += reward
assert str(reward_sum) == S['issuanceAudit']['totalMintedYocto']
boundary_supply = S['issuanceAudit']['supplyCrossCheck']['boundaryBlocks']
net_supply = int(boundary_supply['endInside']['totalSupplyYocto']) - int(boundary_supply['startBefore']['totalSupplyYocto'])
series = S['series'][-30:]
prior = S['series'][-60:-30]
series_sums = {key: sum(r[key] for r in series)
               for key in ['intentsFees', 'intentsNetRevenue', 'intentsHoldersRevenue', 'appFees']}
assert abs(series_sums['intentsFees'] - S['summary']['intentsFees30d']) < 0.01
assert abs(series_sums['appFees'] - S['summary']['ecosystemAppFees30d']) < 0.01
assert abs(series_sums['intentsNetRevenue'] - S['summary']['intentsNetRevenue30d']) < 0.01
assert abs(series_sums['intentsHoldersRevenue'] - S['summary']['intentsHoldersRevenue30d']) < 0.01
assert abs(sum(r['defiTvl'] for r in series) / 30 - S['summary']['averageDefiTvl30d']) < 0.01
series_change = series_sums['intentsFees'] / sum(r['intentsFees'] for r in prior) - 1
assert abs(series_change - S['summary']['intentsChangeVsPrior']) < 1e-10
report = {'scope': 'Independent recount of committed records; no production analyzer imports',
          'archiveSha256': hashlib.sha256((DATA / 'full-day-census.json.gz').read_bytes()).hexdigest(),
          'indexedParents': len(A['transactionHashes']), 'fullDay': full,
          'historicalAndSpacedWindows': windows, 'pooledSpaced': pooled,
          'feeOutcomes': len(fees), 'feeSumYocto': str(fee_sum),
          'averageSignChargeNear': fee_sum / YOCTO / len(fees),
          'rewardMaps': len(S['issuanceAudit']['epochs']), 'grossRewardsYocto': str(reward_sum),
          'grossRewardsDailyNear': reward_sum / YOCTO / S['issuanceAudit']['dayCount'],
          'netSupplyChangeYocto': str(net_supply), 'grossMinusNetYocto': str(reward_sum - net_supply),
          'separateIntentsContext': {'currentPeriod': [series[0]['date'], series[-1]['date']],
                                     'sums': series_sums, 'changeVsPrior': series_change}}

# A second implementation of the matched-hour counts and fee sums.
comparison_source = json.loads(gzip.decompress((DATA / 'comparison-source.json.gz').read_bytes()))
comparison_saved = json.loads((DATA / 'comparison.json').read_text())
seals = json.loads((ROOT / 'evidence/archive-checksums.json').read_text())
for filename, expected in seals.items():
    assert hashlib.sha256((DATA / filename).read_bytes()).hexdigest() == expected, 'Archive seal differs'
assert report['archiveSha256'] == S['fullDayCensus']['archiveSha256']
comparison_checks = []
assert len(comparison_source['periods']) == len(comparison_saved['periods']) == 2
for period, saved in zip(comparison_source['periods'], comparison_saved['periods']):
    indexed = {r['transaction_hash'] for page in period['indexPages'] for r in page['account_txs']}
    hydrated = [t['transaction']['hash'] for t in period['traces']]
    assert indexed == set(hydrated) and len(hydrated) == len(indexed) == period['indexPages'][0]['txs_count']
    direct = {}
    for t in period['traces']:
        ids = {e['receipt']['receipt_id'] for e in t['receipts']}
        assert len(ids) == len(t['receipts'])
        for outcome in [t['execution_outcome']] + [e['execution_outcome'] for e in t['receipts']]:
            assert set(outcome['outcome']['receipt_ids']) <= ids
        for entry in t['receipts']:
            r = entry['receipt']
            if r['receiver_id'] == 'v1.signer' and any(a.get('FunctionCall', {}).get('method_name') == 'sign' for a in r.get('receipt', {}).get('Action', {}).get('actions', [])):
                assert entry['execution_outcome']['id'] == r['receipt_id']
                direct[r['receipt_id']] = (r['predecessor_id'], int(entry['execution_outcome']['outcome']['tokens_burnt']))
    callers = collections.Counter(v[0] for v in direct.values())
    charge = sum(v[1] for v in direct.values())
    assert len(direct) == saved['directRequests']
    assert len(callers) == saved['distinctAccounts']
    assert sum(v for _, v in callers.most_common(3)) == saved['topThreeCount']
    assert str(charge) == saved['totalTokensBurntYocto']
    with (DATA / 'comparison-receipts.csv').open() as handle:
        csv_rows = [r for r in csv.DictReader(handle) if r['period'] == period['date']]
    assert len(csv_rows) == len(direct)
    assert {r['receipt_id'] for r in csv_rows} == set(direct)
    assert all(int(r['tokens_burnt_yoctonear']) == direct[r['receipt_id']][1] for r in csv_rows)
    comparison_checks.append({'date': period['date'], 'indexedParents': len(indexed), 'directRequests': len(direct), 'initiatingAccounts': len(callers), 'totalTokensBurntYocto': str(charge), 'topThreeCount': saved['topThreeCount']})
report['matchedComparison'] = comparison_checks

if '--live' in sys.argv:
    expected = {r['receiptId']: r for r in fees}
    hashes = list(dict.fromkeys(r['transactionHash'] for r in fees))
    checked = set()
    samples = []
    for start in range(0, len(hashes), 20):
        batch = hashes[start:start+20]
        transactions = post('https://tx.main.fastnear.com/v0/transactions', {'tx_hashes': batch})['transactions']
        assert {t['transaction']['hash'] for t in transactions} == set(batch)
        for transaction in transactions:
            for entry in transaction['receipts']:
                receipt = entry['receipt']
                receipt_id = receipt['receipt_id']
                if receipt_id not in expected:
                    continue
                assert receipt['receiver_id'] == 'v1.signer'
                assert any(a.get('FunctionCall', {}).get('method_name') == 'sign'
                           for a in receipt['receipt']['Action']['actions'])
                outcome = entry['execution_outcome']
                assert outcome['outcome']['tokens_burnt'] == expected[receipt_id]['tokensBurntYocto']
                assert outcome['outcome']['gas_burnt'] == expected[receipt_id]['gasBurnt']
                assert transaction['transaction']['hash'] == expected[receipt_id]['transactionHash']
                checked.add(receipt_id)
                samples.append({'receiptId': receipt_id, 'parentTransaction': transaction['transaction']['hash'],
                                'receiptRecordedTimestampNs': str(receipt['block_timestamp']),
                                'executionTimestampNs': str(outcome['block_timestamp']),
                                'status': list(outcome['outcome']['status'])[0]})
    assert checked == fee_ids

    def check_reward(epoch):
        live = rpc('validators', {'epoch_id': epoch['epochId']})
        assert live['validator_reward_paid_prev_epoch'] == epoch['rewardsYoctoByAccount']
        assert live['epoch_height'] == epoch['epochHeight']
        assert live['epoch_start_height'] == epoch['epochStartHeight']
        return epoch['epochId']

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        checked_epochs = list(pool.map(check_reward, S['issuanceAudit']['epochs']))
    boundaries = []
    for block in A['boundaryBlocks'].values():
        live = rpc('block', {'block_id': block['height']})['header']
        assert live['hash'] == block['hash']
        timestamp_ms = int(live['timestamp_nanosec']) // 1000000
        iso = datetime.datetime.fromtimestamp(timestamp_ms / 1000, datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
        assert iso == block['timeUtc']
        boundaries.append(block)
    for block in boundary_supply.values():
        live = rpc('block', {'block_id': block['height']})['header']
        assert live['hash'] == block['hash']
        assert live['total_supply'] == block['totalSupplyYocto']
    configs = []
    for height in [200000000, 220000000, 224000000]:
        config = rpc('EXPERIMENTAL_protocol_config', {'block_id': height})
        configs.append({'height': height, 'version': config['protocol_version'],
                        'burntGasReward': config['runtime_config']['transaction_costs']['burnt_gas_reward']})
    report['liveRecheck'] = {'checkedAtUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                           'feeReceiptsVerified': len(checked), 'rewardMapsVerified': len(checked_epochs),
                           'supplyBoundaryBlocksVerified': len(boundary_supply),
                           'fullDayBoundaryBlocks': boundaries, 'protocolConfigs': configs,
                           'feeReceiptTimestampChecks': samples,
                           'limits': 'Same public providers, not independent full-node replay; does not verify every full-day trace.'}

(ROOT / ('evidence/independent-verification.json' if '--live' in sys.argv else 'evidence/independent-offline.json')).write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k not in ['historicalAndSpacedWindows', 'liveRecheck']}, indent=2))
if 'liveRecheck' in report:
    print('Live verified:', report['liveRecheck']['feeReceiptsVerified'], 'fee receipts,',
          report['liveRecheck']['rewardMapsVerified'], 'reward maps, 4 UTC boundaries, 3 protocol configs')
