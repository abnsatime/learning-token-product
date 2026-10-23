import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TransactionStatus } from "./transaction-status";

const hash = `0x${"2".repeat(64)}` as const;

afterEach(cleanup);

describe("TransactionStatus", () => {
  it("renders nothing before a transaction begins", () => {
    const { container } = render(<TransactionStatus successMessage="Done" />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the wallet confirmation stage", () => {
    render(<TransactionStatus isWaitingForWallet successMessage="Done" />);
    expect(screen.getByRole("status").textContent).toContain("Waiting for your wallet");
  });

  it("shows a broadcast hash while confirmation is pending", () => {
    render(<TransactionStatus hash={hash} isConfirming successMessage="Done" />);

    const status = screen.getByRole("status");
    const link = screen.getByRole("link");
    expect(status.textContent).toContain("Submitted to Sepolia");
    expect(link.getAttribute("href")).toBe(`https://sepolia.etherscan.io/tx/${hash}`);
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("shows the caller-provided success message", () => {
    render(<TransactionStatus hash={hash} isSuccess successMessage="Balance refreshed." />);
    expect(screen.getByRole("status").textContent).toContain("Confirmed onchain");
    expect(screen.getByRole("status").textContent).toContain("Balance refreshed.");
  });

  it("shows a friendly failure instead of a raw provider error", () => {
    render(
      <TransactionStatus
        error={{ message: "execution reverted: ERC20InsufficientBalance" }}
        successMessage="Done"
      />,
    );

    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Transaction stopped");
    expect(status.textContent).toContain("Your LRN balance is too low");
  });
});
