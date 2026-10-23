"use client";

import { useEffect, useState } from "react";
import { parseUnits } from "viem";
import {
  useAccount,
  useBlock,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import { erc20Abi, tokenAddress, vaultAbi, vaultAddress } from "@/lib/contracts";
import { formatTokenAmount, shortAddress } from "@/lib/format";
import { TransactionStatus } from "./transaction-status";

const ZERO = BigInt(0);
const BPS_DENOMINATOR = BigInt(10_000);
const plans = [
  { id: 0, label: "5 min", rewardBps: 100, rewardLabel: "1.0%" },
  { id: 1, label: "10 min", rewardBps: 130, rewardLabel: "1.3%" },
  { id: 2, label: "30 min", rewardBps: 150, rewardLabel: "1.5%" },
] as const;

type VaultAction = "approve" | "stake" | "withdraw" | "reward";

const successMessages: Record<VaultAction, string> = {
  approve: "Allowance confirmed. The position is ready for the Stake transaction.",
  stake: "Position opened and its reward has been reserved.",
  withdraw: "Principal returned. The promised reward is now separately claimable.",
  reward: "Reward claimed and the vault reserve has been refreshed.",
};

function formatUnlockTime(timestamp?: bigint) {
  if (!timestamp || timestamp === ZERO) return "No active lock";
  return new Date(Number(timestamp) * 1000).toLocaleString();
}

export function VaultPanel({ onBalanceChange }: { onBalanceChange: () => void }) {
  const { address, chainId, isConnected } = useAccount();
  const [amount, setAmount] = useState("");
  const [planId, setPlanId] = useState(0);
  const [activeAction, setActiveAction] = useState<VaultAction>();
  const enabled = Boolean(vaultAddress);

  let parsedAmount: bigint | undefined;
  try {
    parsedAmount = amount && Number(amount) > 0 ? parseUnits(amount, 18) : undefined;
  } catch {
    parsedAmount = undefined;
  }

  const selectedPlan = plans[planId];
  const expectedReward = parsedAmount
    ? parsedAmount * BigInt(selectedPlan.rewardBps) / BPS_DENOMINATOR
    : undefined;

  const { data: totalLocked, refetch: refetchTotalLocked } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "totalLocked",
    query: { enabled },
  });
  const { data: rewardReserve, refetch: refetchRewardReserve } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "rewardReserve",
    query: { enabled },
  });
  const { data: position, refetch: refetchPosition } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "positions",
    args: address ? [address] : undefined,
    query: { enabled: enabled && Boolean(address) },
  });
  const { data: claimableReward, refetch: refetchClaimableReward } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "claimableRewards",
    args: address ? [address] : undefined,
    query: { enabled: enabled && Boolean(address) },
  });
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && vaultAddress ? [address, vaultAddress] : undefined,
    query: { enabled: enabled && Boolean(address) },
  });
  const latestBlock = useBlock({ chainId: sepolia.id, watch: true });

  const approveWrite = useWriteContract();
  const stakeWrite = useWriteContract();
  const withdrawWrite = useWriteContract();
  const rewardWrite = useWriteContract();
  const approveReceipt = useWaitForTransactionReceipt({ hash: approveWrite.data });
  const stakeReceipt = useWaitForTransactionReceipt({ hash: stakeWrite.data });
  const withdrawReceipt = useWaitForTransactionReceipt({ hash: withdrawWrite.data });
  const rewardReceipt = useWaitForTransactionReceipt({ hash: rewardWrite.data });

  useEffect(() => {
    if (approveReceipt.isSuccess) void refetchAllowance();
  }, [approveReceipt.isSuccess, refetchAllowance]);

  useEffect(() => {
    if (stakeReceipt.isSuccess) {
      void refetchPosition();
      void refetchAllowance();
      void refetchTotalLocked();
      void refetchRewardReserve();
      onBalanceChange();
    }
  }, [onBalanceChange, refetchAllowance, refetchPosition, refetchRewardReserve, refetchTotalLocked, stakeReceipt.isSuccess]);

  useEffect(() => {
    if (withdrawReceipt.isSuccess) {
      void refetchPosition();
      void refetchClaimableReward();
      void refetchTotalLocked();
      onBalanceChange();
    }
  }, [onBalanceChange, refetchClaimableReward, refetchPosition, refetchTotalLocked, withdrawReceipt.isSuccess]);

  useEffect(() => {
    if (rewardReceipt.isSuccess) {
      void refetchClaimableReward();
      void refetchRewardReserve();
      onBalanceChange();
    }
  }, [onBalanceChange, refetchClaimableReward, refetchRewardReserve, rewardReceipt.isSuccess]);

  const positionAmount = position?.[0] ?? ZERO;
  const positionReward = position?.[1] ?? ZERO;
  const unlockTime = position?.[2] ?? ZERO;
  const storedPlanId = Number(position?.[3] ?? ZERO);
  const hasPosition = positionAmount > ZERO;
  const isUnlocked = hasPosition && latestBlock.data?.timestamp !== undefined
    ? latestBlock.data.timestamp >= unlockTime
    : false;
  const approvalReady = parsedAmount !== undefined && allowance !== undefined && allowance >= parsedAmount;
  const reserveReady = expectedReward !== undefined && rewardReserve !== undefined && rewardReserve >= expectedReward;
  const wrongNetwork = isConnected && chainId !== sepolia.id;
  const transactionPending = approveWrite.isPending || stakeWrite.isPending || withdrawWrite.isPending || rewardWrite.isPending || approveReceipt.isLoading || stakeReceipt.isLoading || withdrawReceipt.isLoading || rewardReceipt.isLoading;

  async function approve() {
    if (!vaultAddress || !parsedAmount || wrongNetwork) return;
    setActiveAction("approve");
    try {
      await approveWrite.writeContractAsync({ address: tokenAddress, abi: erc20Abi, functionName: "approve", args: [vaultAddress, parsedAmount], chainId: sepolia.id });
    } catch {}
  }

  async function stake() {
    if (!vaultAddress || !parsedAmount || !approvalReady || !reserveReady || wrongNetwork) return;
    setActiveAction("stake");
    try {
      await stakeWrite.writeContractAsync({ address: vaultAddress, abi: vaultAbi, functionName: "stake", args: [parsedAmount, planId], chainId: sepolia.id });
      setAmount("");
    } catch {}
  }

  async function withdrawPrincipal() {
    if (!vaultAddress || !isUnlocked || wrongNetwork) return;
    setActiveAction("withdraw");
    try {
      await withdrawWrite.writeContractAsync({ address: vaultAddress, abi: vaultAbi, functionName: "withdrawPrincipal", chainId: sepolia.id });
    } catch {}
  }

  async function claimReward() {
    if (!vaultAddress || !claimableReward || wrongNetwork) return;
    setActiveAction("reward");
    try {
      await rewardWrite.writeContractAsync({ address: vaultAddress, abi: vaultAbi, functionName: "claimReward", chainId: sepolia.id });
    } catch {}
  }

  const activeTransaction = activeAction === "approve"
    ? { write: approveWrite, receipt: approveReceipt }
    : activeAction === "stake"
      ? { write: stakeWrite, receipt: stakeReceipt }
      : activeAction === "withdraw"
        ? { write: withdrawWrite, receipt: withdrawReceipt }
        : activeAction === "reward"
          ? { write: rewardWrite, receipt: rewardReceipt }
          : undefined;

  return (
    <section className="vault-panel" aria-labelledby="vault-title">
      <div className="vault-heading">
        <div>
          <p className="eyebrow">Testnet reward vault</p>
          <h3 id="vault-title">Choose a lock. Reserve a bonus.</h3>
          <p>Fixed testnet bonuses—not APR. Principal and reward withdrawals remain separate.</p>
        </div>
        <div className="vault-total">
          <span>Total locked</span>
          <strong>{formatTokenAmount(totalLocked, 18)} LRN</strong>
          <small>{vaultAddress ? shortAddress(vaultAddress, 6) : "Deployment pending"}</small>
          <span className="vault-reserve">Reward reserve: {formatTokenAmount(rewardReserve, 18)} LRN</span>
        </div>
      </div>

      <div className="vault-grid">
        <div className="vault-action-card">
          <span className="step-badge">02</span>
          <h4>Open a position</h4>
          <div className="plan-grid" aria-label="Lock plan">
            {plans.map((plan) => (
              <button aria-pressed={planId === plan.id} className={`plan-option ${planId === plan.id ? "plan-option-active" : ""}`} key={plan.id} onClick={() => setPlanId(plan.id)} type="button">
                <strong>{plan.label}</strong><span>{plan.rewardLabel} bonus</span>
              </button>
            ))}
          </div>
          <label htmlFor="stake-amount">Amount</label>
          <div className="amount-field vault-amount">
            <input id="stake-amount" inputMode="decimal" onChange={(event) => setAmount(event.target.value)} placeholder="0.00" value={amount} />
            <span>LRN</span>
          </div>
          <p className="vault-preview">Expected bonus: <strong>{formatTokenAmount(expectedReward, 18)} LRN</strong></p>
          <div className="vault-buttons">
            <button className="button button-vault-secondary" disabled={!enabled || !isConnected || wrongNetwork || hasPosition || !parsedAmount || transactionPending || approvalReady} onClick={approve} type="button">{approvalReady ? "Approved" : "1. Approve"}</button>
            <button className="button button-vault-primary" disabled={!enabled || !isConnected || wrongNetwork || hasPosition || !approvalReady || !reserveReady || transactionPending} onClick={stake} type="button">2. Stake</button>
          </div>
          {expectedReward !== undefined && !reserveReady && <p className="error-text">The reward reserve cannot cover this position.</p>}
        </div>

        <div className="vault-position-card">
          <span>Your active principal</span>
          <strong>{formatTokenAmount(positionAmount, 18)} LRN</strong>
          <dl>
            <div><dt>Plan</dt><dd>{hasPosition ? plans[storedPlanId]?.label : "—"}</dd></div>
            <div><dt>Promised bonus</dt><dd>{formatTokenAmount(positionReward, 18)} LRN</dd></div>
            <div><dt>Unlock</dt><dd>{formatUnlockTime(unlockTime)}</dd></div>
            <div><dt>Status</dt><dd>{hasPosition ? (isUnlocked ? "Ready" : "Locked") : "Empty"}</dd></div>
            <div><dt>Claimable reward</dt><dd>{formatTokenAmount(claimableReward, 18)} LRN</dd></div>
            <div><dt>Allowance</dt><dd>{formatTokenAmount(allowance, 18)} LRN</dd></div>
          </dl>
          <div className="vault-withdraw-actions">
            <button className="button button-vault-primary button-wide" disabled={!enabled || !isConnected || wrongNetwork || !isUnlocked || transactionPending} onClick={withdrawPrincipal} type="button">{hasPosition && !isUnlocked ? "Principal locked" : "Withdraw principal"}</button>
            <button className="button button-vault-secondary button-wide" disabled={!enabled || !isConnected || wrongNetwork || !claimableReward || transactionPending} onClick={claimReward} type="button">Claim reward separately</button>
          </div>
        </div>
      </div>

      {activeAction && activeTransaction && (
        <TransactionStatus
          error={activeTransaction.write.error ?? activeTransaction.receipt.error}
          hash={activeTransaction.write.data}
          isConfirming={activeTransaction.receipt.isLoading}
          isSuccess={activeTransaction.receipt.isSuccess}
          isWaitingForWallet={activeTransaction.write.isPending}
          successMessage={successMessages[activeAction]}
        />
      )}
    </section>
  );
}
