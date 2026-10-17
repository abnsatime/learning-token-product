"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { isAddress, parseUnits } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import {
  erc20Abi,
  explorerContractUrl,
  sourcifyContractUrl,
  tokenAddress,
} from "@/lib/contracts";
import { formatTokenAmount, shortAddress } from "@/lib/format";
import { RecentTransfers } from "./recent-transfers";
import { WalletButton } from "./wallet-button";
import { FaucetPanel } from "./faucet-panel";

export function TokenDashboard() {
  const { address, chainId, isConnected } = useAccount();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState<string>();

  const name = useReadContract({ address: tokenAddress, abi: erc20Abi, functionName: "name" });
  const symbol = useReadContract({ address: tokenAddress, abi: erc20Abi, functionName: "symbol" });
  const decimals = useReadContract({ address: tokenAddress, abi: erc20Abi, functionName: "decimals" });
  const supply = useReadContract({ address: tokenAddress, abi: erc20Abi, functionName: "totalSupply" });
  const { data: balanceData, refetch: refetchBalance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const write = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: write.data });
  const refreshBalance = useCallback(() => {
    void refetchBalance();
  }, [refetchBalance]);

  useEffect(() => {
    if (receipt.isSuccess) {
      void refetchBalance();
    }
  }, [receipt.isSuccess, refetchBalance]);

  async function submitTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);

    if (!isConnected) {
      setFormError("Connect a wallet before sending a transfer.");
      return;
    }
    if (chainId !== sepolia.id) {
      setFormError("Switch your wallet to Sepolia first.");
      return;
    }
    if (!isAddress(recipient)) {
      setFormError("Enter a valid recipient address.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setFormError("Enter an amount greater than zero.");
      return;
    }

    try {
      await write.writeContractAsync({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "transfer",
        args: [recipient, parseUnits(amount, decimals.data ?? 18)],
        chainId: sepolia.id,
      });
      setAmount("");
      setRecipient("");
    } catch {
      // Wagmi exposes the wallet or simulation error below the form.
    }
  }

  const transactionUrl = write.data
    ? `https://sepolia.etherscan.io/tx/${write.data}`
    : undefined;

  return (
    <div className="console-shell">
      <div className="console-topbar">
        <div>
          <p className="eyebrow">Sepolia console</p>
          <p className="contract-line">
            <span className="status-dot" />
            Contract {shortAddress(tokenAddress, 6)}
          </p>
        </div>
        <WalletButton />
      </div>

      <div className="token-overview">
        <div className="token-identity">
          <div className="token-orb">L</div>
          <div>
            <p>{name.data ?? "Learning Token"}</p>
            <span>{symbol.data ?? "LRN"} · ERC-20</span>
          </div>
        </div>
        <div className="contract-links">
          <a className="text-link" href={sourcifyContractUrl} rel="noreferrer" target="_blank">
            Exact source match ↗
          </a>
          <a className="text-link text-link-muted" href={explorerContractUrl} rel="noreferrer" target="_blank">
            Etherscan ↗
          </a>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric">
          <span>Total supply</span>
          <strong>{formatTokenAmount(supply.data, decimals.data ?? 18, 0)} LRN</strong>
          <small>Read from Sepolia</small>
        </div>
        <div className="metric metric-accent">
          <span>Your balance</span>
          <strong>
            {address ? `${formatTokenAmount(balanceData, decimals.data ?? 18)} LRN` : "Connect wallet"}
          </strong>
          <small>{address ? shortAddress(address, 6) : "No signature required to connect"}</small>
        </div>
      </div>

      <FaucetPanel onClaimed={refreshBalance} />

      <div className="console-grid">
        <form className="transfer-panel" onSubmit={submitTransfer}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Write transaction</p>
              <h3>Transfer LRN</h3>
            </div>
            <span className="step-badge">01</span>
          </div>

          <label htmlFor="recipient">Recipient</label>
          <input
            id="recipient"
            onChange={(event) => setRecipient(event.target.value)}
            placeholder="0x…"
            spellCheck={false}
            value={recipient}
          />

          <label htmlFor="amount">Amount</label>
          <div className="amount-field">
            <input
              id="amount"
              inputMode="decimal"
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              value={amount}
            />
            <span>LRN</span>
          </div>

          <button className="button button-primary button-wide" disabled={write.isPending || receipt.isLoading}>
            {write.isPending
              ? "Confirm in wallet…"
              : receipt.isLoading
                ? "Waiting for confirmation…"
                : "Review transfer"}
          </button>

          {(formError || write.error) && (
            <p className="error-text">{formError ?? write.error?.message}</p>
          )}
          {receipt.isSuccess && transactionUrl && (
            <p className="success-text">
              Confirmed on Sepolia. {" "}
              <a href={transactionUrl} rel="noreferrer" target="_blank">View transaction ↗</a>
            </p>
          )}
        </form>

        <RecentTransfers />
      </div>
    </div>
  );
}
