import type { Hash } from "viem";

type ErrorLike = {
  cause?: unknown;
  code?: number;
  message?: string;
  name?: string;
  shortMessage?: string;
};

const friendlyErrors: Array<[needle: string, message: string]> = [
  ["LRNFaucetAlreadyClaimed", "This wallet has already claimed its test tokens."],
  ["LRNFaucetInsufficientBalance", "The faucet does not hold enough LRN for another claim."],
  ["LRNTimeVaultZeroAmount", "Enter an amount greater than zero."],
  ["LRNTimeVaultInvalidPlan", "The selected lock plan is not supported."],
  ["LRNTimeVaultRewardRoundsToZero", "This amount is too small to earn a reward."],
  ["LRNTimeVaultInsufficientRewardReserve", "The vault reward reserve cannot cover this position."],
  ["LRNTimeVaultActivePosition", "This wallet already has an active vault position."],
  ["LRNTimeVaultNoPosition", "This wallet does not have an active vault position."],
  ["LRNTimeVaultPositionLocked", "The principal is still locked."],
  ["LRNTimeVaultNoClaimableReward", "There is no unlocked reward to claim."],
  ["ERC20InsufficientBalance", "Your LRN balance is too low for this transaction."],
  ["ERC20InsufficientAllowance", "The vault allowance is lower than the requested amount."],
  ["ERC20InvalidReceiver", "The recipient address cannot receive this transfer."],
];

function errorChain(error: unknown) {
  const chain: ErrorLike[] = [];
  const seen = new Set<unknown>();
  let current = error;

  while (current && typeof current === "object" && !seen.has(current) && chain.length < 8) {
    seen.add(current);
    chain.push(current as ErrorLike);
    current = (current as ErrorLike).cause;
  }

  return chain;
}

export function transactionExplorerUrl(hash: Hash) {
  return `https://sepolia.etherscan.io/tx/${hash}`;
}

export function transactionErrorMessage(error: unknown) {
  const chain = errorChain(error);
  const combined = chain
    .flatMap((item) => [item.name, item.shortMessage, item.message])
    .filter(Boolean)
    .join("\n");
  const normalized = combined.toLowerCase();

  if (chain.some((item) => item.code === 4001) || normalized.includes("user rejected") || normalized.includes("user denied")) {
    return "The wallet request was cancelled. No transaction was sent.";
  }
  if (normalized.includes("insufficient funds")) {
    return "This wallet does not have enough Sepolia ETH to pay gas.";
  }
  if (normalized.includes("nonce too low")) {
    return "This wallet nonce is already used. Refresh the wallet activity and try again.";
  }
  if (normalized.includes("replacement transaction underpriced")) {
    return "The replacement gas fee is too low. Increase the fee in your wallet and retry.";
  }

  for (const [needle, message] of friendlyErrors) {
    if (combined.includes(needle)) return message;
  }

  const shortMessage = chain.find((item) => item.shortMessage)?.shortMessage;
  if (shortMessage) return shortMessage.split("\n")[0];

  if (normalized.includes("execution reverted")) {
    return "The contract rejected this transaction. Refresh the onchain data and check the requirements.";
  }

  return "The transaction could not be completed. Check the wallet details and try again.";
}
