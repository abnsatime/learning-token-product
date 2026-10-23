import { describe, expect, it } from "vitest";
import { transactionErrorMessage, transactionExplorerUrl } from "./transaction";

describe("transactionErrorMessage", () => {
  it("explains a rejected wallet request", () => {
    expect(transactionErrorMessage({ code: 4001, message: "User rejected the request" }))
      .toBe("The wallet request was cancelled. No transaction was sent.");
  });

  it("finds decoded custom errors in a nested cause", () => {
    const error = {
      message: "Contract call failed",
      cause: { shortMessage: "Execution reverted with reason: LRNTimeVaultPositionLocked" },
    };

    expect(transactionErrorMessage(error)).toBe("The principal is still locked.");
  });

  it("explains insufficient native gas funds", () => {
    expect(transactionErrorMessage(new Error("insufficient funds for gas * price + value")))
      .toBe("This wallet does not have enough Sepolia ETH to pay gas.");
  });

  it("keeps a concise provider short message when no known error matches", () => {
    expect(transactionErrorMessage({ shortMessage: "RPC request timed out\nRequest details" }))
      .toBe("RPC request timed out");
  });

  it("uses a safe fallback for unknown values", () => {
    expect(transactionErrorMessage("unstructured failure"))
      .toBe("The transaction could not be completed. Check the wallet details and try again.");
  });
});

describe("transactionExplorerUrl", () => {
  it("builds a Sepolia Etherscan transaction URL", () => {
    const hash = `0x${"1".repeat(64)}` as const;
    expect(transactionExplorerUrl(hash)).toBe(`https://sepolia.etherscan.io/tx/${hash}`);
  });
});
