import { isAddress, type Address } from "viem";

const referenceAddress = "0xA7de34c97693dDe1d23139a7EAd9fBE17797BE7f";
const referenceFaucetAddress = "0x05aF66C0CF3C04790aB01aD85Ab7c63F8b1251a3";
const configuredAddress = process.env.NEXT_PUBLIC_TOKEN_ADDRESS;
const configuredFaucetAddress = process.env.NEXT_PUBLIC_FAUCET_ADDRESS;

export const tokenAddress: Address = isAddress(configuredAddress ?? "")
  ? (configuredAddress as Address)
  : referenceAddress;

export const faucetAddress: Address = isAddress(configuredFaucetAddress ?? "")
  ? (configuredFaucetAddress as Address)
  : referenceFaucetAddress;

export const deploymentBlock = BigInt(
  process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK ?? "11933147",
);

export const explorerContractUrl = `https://sepolia.etherscan.io/address/${tokenAddress}`;
export const sourcifyContractUrl = `https://sourcify.dev/#/lookup/${tokenAddress}`;
export const faucetExplorerUrl = `https://sepolia.etherscan.io/address/${faucetAddress}`;

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
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
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
    type: "event",
    name: "Claimed",
    anonymous: false,
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;
