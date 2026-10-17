import { formatUnits, type Address } from "viem";

export function shortAddress(address: Address | string, size = 4) {
  return `${address.slice(0, size + 2)}…${address.slice(-size)}`;
}

export function formatTokenAmount(value?: bigint, decimals = 18, digits = 3) {
  if (value === undefined) return "—";
  const numeric = Number(formatUnits(value, decimals));
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(numeric);
}
