import { describe, expect, it } from "vitest";
import { finalizeTimeline, type TimelineItem } from "./timeline";

function item(overrides: Partial<TimelineItem> = {}): TimelineItem {
  return {
    amount: BigInt(1),
    blockNumber: BigInt(10),
    detail: "detail",
    id: "default",
    kind: "received",
    logIndex: 0,
    title: "title",
    transactionHash: `0x${"1".repeat(64)}`,
    ...overrides,
  };
}

describe("finalizeTimeline", () => {
  it("hides a transfer emitted by the same business transaction", () => {
    const transactionHash = `0x${"2".repeat(64)}` as const;
    const result = finalizeTimeline([
      item({ id: "transfer", kind: "received", transactionHash }),
      item({ id: "claim", kind: "claim", logIndex: 1, transactionHash }),
    ]);

    expect(result.map((entry) => entry.id)).toEqual(["claim"]);
  });

  it("keeps ordinary transfers and sorts newest logs first", () => {
    const result = finalizeTimeline([
      item({ id: "old", blockNumber: BigInt(9) }),
      item({ id: "new-low", blockNumber: BigInt(11), logIndex: 2 }),
      item({ id: "new-high", blockNumber: BigInt(11), logIndex: 3 }),
    ]);

    expect(result.map((entry) => entry.id)).toEqual(["new-high", "new-low", "old"]);
  });

  it("limits large histories", () => {
    const entries = Array.from({ length: 5 }, (_, index) => item({
      blockNumber: BigInt(index),
      id: `event-${index}`,
      transactionHash: `0x${String(index + 1).repeat(64).slice(0, 64)}` as `0x${string}`,
    }));

    expect(finalizeTimeline(entries, 2)).toHaveLength(2);
  });
});
