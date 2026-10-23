import type { Hash } from "viem";

export type TimelineKind =
  | "claim"
  | "principal"
  | "received"
  | "reward"
  | "self"
  | "sent"
  | "stake";

export type TimelineItem = {
  amount: bigint;
  blockNumber: bigint;
  detail: string;
  id: string;
  kind: TimelineKind;
  logIndex: number;
  timestamp?: bigint;
  title: string;
  transactionHash: Hash;
};

const transferKinds = new Set<TimelineKind>(["received", "self", "sent"]);

export function finalizeTimeline(items: TimelineItem[], limit = 50) {
  const businessTransactions = new Set(
    items
      .filter((item) => !transferKinds.has(item.kind))
      .map((item) => item.transactionHash.toLowerCase()),
  );

  return items
    .filter((item) => (
      !transferKinds.has(item.kind)
      || !businessTransactions.has(item.transactionHash.toLowerCase())
    ))
    .sort((left, right) => {
      if (left.blockNumber !== right.blockNumber) {
        return left.blockNumber > right.blockNumber ? -1 : 1;
      }
      return right.logIndex - left.logIndex;
    })
    .slice(0, limit);
}

export function formatTimelineDate(timestamp?: bigint) {
  if (timestamp === undefined) return "Block time unavailable";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(Number(timestamp) * 1000));
}
