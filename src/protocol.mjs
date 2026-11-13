export function parseGasReward(config, blockId) {
  if (config?.chain_id !== 'mainnet' || !Number.isSafeInteger(config.protocol_version)) {
    throw new Error(`Invalid mainnet protocol config at block ${blockId}`);
  }
  const reward = config.runtime_config?.transaction_costs?.burnt_gas_reward;
  if (!Array.isArray(reward) || reward.length !== 2 ||
      !reward.every(Number.isSafeInteger) || reward[0] < 0 || reward[1] <= 0 || reward[0] > reward[1]) {
    throw new Error(`Invalid burnt_gas_reward at block ${blockId}`);
  }
  return { blockId, protocolVersion: config.protocol_version,
    contractRewardNumerator: reward[0], contractRewardDenominator: reward[1],
    contractRewardFraction: reward[0] / reward[1],
    // This only interprets the allocation of burnt function-call gas; it does
    // not measure chain issuance, total fee demand, or net holder accrual.
    noContractGasReward: reward[0] === 0 };
}
