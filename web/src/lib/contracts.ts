import { isAddress, type Address } from "viem";

const referenceAddress = "0xA7de34c97693dDe1d23139a7EAd9fBE17797BE7f";
const referenceFaucetAddress = "0x05aF66C0CF3C04790aB01aD85Ab7c63F8b1251a3";
const referenceVaultAddress = "0x8FA2D5f71c5F965E7FAe4860Ae2C720b3d076a7E";
const configuredAddress = process.env.NEXT_PUBLIC_TOKEN_ADDRESS;
const configuredFaucetAddress = process.env.NEXT_PUBLIC_FAUCET_ADDRESS;
const configuredVaultAddress = process.env.NEXT_PUBLIC_VAULT_ADDRESS;

export const tokenAddress: Address = isAddress(configuredAddress ?? "")
  ? (configuredAddress as Address)
  : referenceAddress;

export const faucetAddress: Address = isAddress(configuredFaucetAddress ?? "")
  ? (configuredFaucetAddress as Address)
  : referenceFaucetAddress;

export const vaultAddress: Address = isAddress(configuredVaultAddress ?? "")
  ? (configuredVaultAddress as Address)
  : referenceVaultAddress;

export const deploymentBlock = BigInt(
  process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK ?? "11933147",
);

export const explorerContractUrl = `https://sepolia.etherscan.io/address/${tokenAddress}`;
export const sourcifyContractUrl = `https://sourcify.dev/#/lookup/${tokenAddress}`;
export const faucetExplorerUrl = `https://sepolia.etherscan.io/address/${faucetAddress}`;
export const vaultExplorerUrl = `https://sepolia.etherscan.io/address/${vaultAddress}`;

export const erc20Abi = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "error",
    name: "ERC20InsufficientBalance",
    inputs: [
      { name: "sender", type: "address" },
      { name: "balance", type: "uint256" },
      { name: "needed", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ERC20InsufficientAllowance",
    inputs: [
      { name: "spender", type: "address" },
      { name: "allowance", type: "uint256" },
      { name: "needed", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ERC20InvalidReceiver",
    inputs: [{ name: "receiver", type: "address" }],
  },
  {
    type: "event",
    name: "Transfer",
    anonymous: false,
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;

export const faucetAbi = [
  {
    type: "function",
    name: "claimAmount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "hasClaimed",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "error",
    name: "LRNFaucetAlreadyClaimed",
    inputs: [{ name: "account", type: "address" }],
  },
  {
    type: "error",
    name: "LRNFaucetInsufficientBalance",
    inputs: [
      { name: "available", type: "uint256" },
      { name: "required", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "Claimed",
    anonymous: false,
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export const vaultAbi = [
  {
    type: "function",
    name: "totalLocked",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "rewardReserve",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "positions",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      { name: "amount", type: "uint256" },
      { name: "reward", type: "uint256" },
      { name: "unlockTime", type: "uint256" },
      { name: "planId", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "claimableRewards",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "stake",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "planId", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawPrincipal",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "claimReward",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "error",
    name: "ERC20InsufficientBalance",
    inputs: [
      { name: "sender", type: "address" },
      { name: "balance", type: "uint256" },
      { name: "needed", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ERC20InsufficientAllowance",
    inputs: [
      { name: "spender", type: "address" },
      { name: "allowance", type: "uint256" },
      { name: "needed", type: "uint256" },
    ],
  },
  { type: "error", name: "LRNTimeVaultZeroAmount", inputs: [] },
  {
    type: "error",
    name: "LRNTimeVaultInvalidPlan",
    inputs: [{ name: "planId", type: "uint8" }],
  },
  { type: "error", name: "LRNTimeVaultRewardRoundsToZero", inputs: [] },
  {
    type: "error",
    name: "LRNTimeVaultInsufficientRewardReserve",
    inputs: [
      { name: "available", type: "uint256" },
      { name: "required", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "LRNTimeVaultActivePosition",
    inputs: [{ name: "account", type: "address" }],
  },
  {
    type: "error",
    name: "LRNTimeVaultNoPosition",
    inputs: [{ name: "account", type: "address" }],
  },
  {
    type: "error",
    name: "LRNTimeVaultPositionLocked",
    inputs: [
      { name: "unlockTime", type: "uint256" },
      { name: "currentTime", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "LRNTimeVaultNoClaimableReward",
    inputs: [{ name: "account", type: "address" }],
  },
  {
    type: "event",
    name: "Staked",
    anonymous: false,
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "reward", type: "uint256", indexed: false },
      { name: "unlockTime", type: "uint256", indexed: false },
      { name: "planId", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PrincipalWithdrawn",
    anonymous: false,
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "rewardUnlocked", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RewardClaimed",
    anonymous: false,
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "reward", type: "uint256", indexed: false },
    ],
  },
] as const;
