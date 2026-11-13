import { parseGasReward } from '../src/protocol.mjs';

const url = 'https://archival-rpc.mainnet.fastnear.com';
const blocks = [200_000_000, 220_000_000, 224_000_000];
const results = [];
for (const blockId of blocks) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: blockId, method: 'EXPERIMENTAL_protocol_config', params: { block_id: blockId } }),
    signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Archival RPC HTTP ${response.status} at block ${blockId}`);
  const payload = await response.json();
  if (payload.error) throw new Error(`Archival RPC error at block ${blockId}: ${JSON.stringify(payload.error)}`);
  results.push(parseGasReward(payload.result, blockId));
}
if (results[0].contractRewardFraction !== 0.3 || results[1].contractRewardFraction !== 0.3 ||
    results[2].contractRewardFraction !== 0 || results[2].protocolVersion < 87) {
  throw new Error('Protocol gas reward differs from the thesis evidence; review token-value interpretation');
}
console.log(JSON.stringify({ source: url, method: 'EXPERIMENTAL_protocol_config', results }, null, 2));
