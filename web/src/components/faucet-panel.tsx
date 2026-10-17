"use client";

import { useEffect } from "react";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import {
  erc20Abi,
  faucetAbi,
  faucetAddress,
  faucetExplorerUrl,
  tokenAddress,
} from "@/lib/contracts";
import { formatTokenAmount, shortAddress } from "@/lib/format";

export function FaucetPanel({ onClaimed }: { onClaimed: () => void }) {
  const { address, chainId, isConnected } = useAccount();
  const enabled = Boolean(faucetAddress);

  const claimAmount = useReadContract({
    address: faucetAddress,
    abi: faucetAbi,
    functionName: "claimAmount",
    query: { enabled },
  });
  const { data: alreadyClaimed, refetch: refetchEligibility } = useReadContract({
    address: faucetAddress,
    abi: faucetAbi,
    functionName: "hasClaimed",
    args: address ? [address] : undefined,
    query: { enabled: enabled && Boolean(address) },
  });
  const { data: inventory, refetch: refetchInventory } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: faucetAddress ? [faucetAddress] : undefined,
    query: { enabled },
  });

  const write = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: write.data });

  useEffect(() => {
    if (receipt.isSuccess) {
      void refetchEligibility();
      void refetchInventory();
      onClaimed();
    }
  }, [onClaimed, receipt.isSuccess, refetchEligibility, refetchInventory]);

  async function claim() {
    if (!faucetAddress || !isConnected || chainId !== sepolia.id) return;
    try {
      await write.writeContractAsync({
        address: faucetAddress,
        abi: faucetAbi,
        functionName: "claim",
        chainId: sepolia.id,
      });
    } catch {
      // Wagmi exposes a rejected or reverted transaction below the action.
    }
  }

  const hasInventory =
    inventory !== undefined && claimAmount.data !== undefined && inventory >= claimAmount.data;
  const disabled =
    !enabled ||
    !isConnected ||
    chainId !== sepolia.id ||
    alreadyClaimed ||
    !hasInventory ||
    write.isPending ||
    receipt.isLoading;

  let buttonLabel = "Connect wallet to claim";
  if (!enabled) buttonLabel = "Deployment pending";
  else if (isConnected && chainId !== sepolia.id) buttonLabel = "Switch to Sepolia";
  else if (alreadyClaimed) buttonLabel = "Already claimed";
  else if (inventory !== undefined && !hasInventory) buttonLabel = "Faucet needs funding";
  else if (write.isPending) buttonLabel = "Confirm in wallet…";
  else if (receipt.isLoading) buttonLabel = "Claiming onchain…";
  else if (isConnected) buttonLabel = `Claim ${formatTokenAmount(claimAmount.data, 18, 0)} LRN`;

  return (
    <section className="faucet-panel" aria-labelledby="faucet-title">
      <div className="faucet-copy">
        <p className="eyebrow">Testnet onboarding</p>
        <h3 id="faucet-title">Claim your first LRN.</h3>
        <p>
          One fixed claim per address. The faucet can distribute only the LRN held in its own
          inventory—it has no minting permission.
        </p>
      </div>

      <div className="faucet-stats">
        <span>Claim</span>
        <strong>{formatTokenAmount(claimAmount.data, 18, 0)} LRN</strong>
        <small>
          <a href={faucetExplorerUrl} rel="noreferrer" target="_blank">
            {shortAddress(faucetAddress, 6)} ↗
          </a>
        </small>
      </div>
      <div className="faucet-stats">
        <span>Available</span>
        <strong>{formatTokenAmount(inventory, 18, 0)} LRN</strong>
        <small>{alreadyClaimed ? "Your address has claimed" : "Funded token inventory"}</small>
      </div>

      <div className="faucet-action">
        <button className="button button-faucet" disabled={disabled} onClick={claim} type="button">
          {buttonLabel}
        </button>
        {write.error && <p className="error-text">{write.error.message}</p>}
        {receipt.isSuccess && (
          <p className="success-text">
            Claim confirmed. {write.data && (
              <a href={`https://sepolia.etherscan.io/tx/${write.data}`} rel="noreferrer" target="_blank">
                View transaction ↗
              </a>
            )}
          </p>
        )}
      </div>
    </section>
  );
}
