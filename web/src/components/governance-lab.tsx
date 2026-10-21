"use client";

import { useEffect, useMemo } from "react";
import { encodeFunctionData, keccak256, stringToHex, zeroAddress } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import {
  emissionControllerAbi,
  governanceReady,
  governorAbi,
  timelockAbi,
  v2ControllerAddress,
  v2GovernorAddress,
  v2TimelockAddress,
  v2TokenAbi,
  v2TokenAddress,
} from "@/lib/contracts";
import { formatTokenAmount, shortAddress } from "@/lib/format";
import { WalletButton } from "./wallet-button";

const MINTER_ROLE = keccak256(stringToHex("MINTER_ROLE"));
const DESCRIPTION = "Stop LRN2 emissions";
const DESCRIPTION_HASH = keccak256(stringToHex(DESCRIPTION));
const ZERO = BigInt(0);
const proposalStates = ["Pending", "Active", "Canceled", "Defeated", "Succeeded", "Queued", "Expired", "Executed"];

function formatTimestamp(value?: bigint) {
  if (!value) return "—";
  return new Date(Number(value) * 1000).toLocaleString();
}

export function GovernanceLab() {
  const { address, chainId, isConnected } = useAccount();
  const wrongNetwork = isConnected && chainId !== sepolia.id;
  const tokenTarget = v2TokenAddress ?? zeroAddress;
  const controllerTarget = v2ControllerAddress ?? zeroAddress;

  const proposal = useMemo(() => {
    const calldata = encodeFunctionData({
      abi: v2TokenAbi,
      functionName: "revokeRole",
      args: [MINTER_ROLE, controllerTarget],
    });
    return {
      targets: [tokenTarget],
      values: [ZERO],
      calldatas: [calldata],
    };
  }, [controllerTarget, tokenTarget]);

  const totalSupply = useReadContract({ address: v2TokenAddress, abi: v2TokenAbi, functionName: "totalSupply", query: { enabled: governanceReady } });
  const cap = useReadContract({ address: v2TokenAddress, abi: v2TokenAbi, functionName: "cap", query: { enabled: governanceReady } });
  const balance = useReadContract({ address: v2TokenAddress, abi: v2TokenAbi, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: governanceReady && Boolean(address) } });
  const { data: votes, refetch: refetchVotes } = useReadContract({ address: v2TokenAddress, abi: v2TokenAbi, functionName: "getVotes", args: address ? [address] : undefined, query: { enabled: governanceReady && Boolean(address) } });
  const { data: delegatee, refetch: refetchDelegatee } = useReadContract({ address: v2TokenAddress, abi: v2TokenAbi, functionName: "delegates", args: address ? [address] : undefined, query: { enabled: governanceReady && Boolean(address) } });
  const emissionAmount = useReadContract({ address: v2ControllerAddress, abi: emissionControllerAbi, functionName: "emissionAmount", query: { enabled: governanceReady } });
  const nextEmission = useReadContract({ address: v2ControllerAddress, abi: emissionControllerAbi, functionName: "nextEmissionTime", query: { enabled: governanceReady } });
  const epochsReleased = useReadContract({ address: v2ControllerAddress, abi: emissionControllerAbi, functionName: "epochsReleased", query: { enabled: governanceReady } });
  const timelockDelay = useReadContract({ address: v2TimelockAddress, abi: timelockAbi, functionName: "getMinDelay", query: { enabled: governanceReady } });
  const threshold = useReadContract({ address: v2GovernorAddress, abi: governorAbi, functionName: "proposalThreshold", query: { enabled: governanceReady } });
  const quorum = useReadContract({ address: v2GovernorAddress, abi: governorAbi, functionName: "quorumNumerator", query: { enabled: governanceReady } });
  const { data: proposalId, refetch: refetchProposalId } = useReadContract({
    address: v2GovernorAddress,
    abi: governorAbi,
    functionName: "hashProposal",
    args: [proposal.targets, proposal.values, proposal.calldatas, DESCRIPTION_HASH],
    query: { enabled: governanceReady },
  });
  const { data: proposalState, refetch: refetchProposalState } = useReadContract({
    address: v2GovernorAddress,
    abi: governorAbi,
    functionName: "state",
    args: proposalId === undefined ? undefined : [proposalId],
    query: { enabled: governanceReady && proposalId !== undefined, retry: false },
  });

  const delegateWrite = useWriteContract();
  const proposeWrite = useWriteContract();
  const voteWrite = useWriteContract();
  const queueWrite = useWriteContract();
  const executeWrite = useWriteContract();
  const delegateReceipt = useWaitForTransactionReceipt({ hash: delegateWrite.data });
  const proposeReceipt = useWaitForTransactionReceipt({ hash: proposeWrite.data });
  const voteReceipt = useWaitForTransactionReceipt({ hash: voteWrite.data });
  const queueReceipt = useWaitForTransactionReceipt({ hash: queueWrite.data });
  const executeReceipt = useWaitForTransactionReceipt({ hash: executeWrite.data });

  useEffect(() => {
    if (delegateReceipt.isSuccess) {
      void refetchVotes();
      void refetchDelegatee();
    }
  }, [delegateReceipt.isSuccess, refetchDelegatee, refetchVotes]);

  useEffect(() => {
    if (proposeReceipt.isSuccess || voteReceipt.isSuccess || queueReceipt.isSuccess || executeReceipt.isSuccess) {
      void refetchProposalId();
      void refetchProposalState();
    }
  }, [executeReceipt.isSuccess, proposeReceipt.isSuccess, queueReceipt.isSuccess, refetchProposalId, refetchProposalState, voteReceipt.isSuccess]);

  const delegatedToSelf = Boolean(address && delegatee && address.toLowerCase() === delegatee.toLowerCase());
  const hasProposalPower = votes !== undefined && threshold.data !== undefined && votes >= threshold.data;
  const stateNumber = proposalState === undefined ? undefined : Number(proposalState);
  const pending = delegateWrite.isPending || proposeWrite.isPending || voteWrite.isPending || queueWrite.isPending || executeWrite.isPending || delegateReceipt.isLoading || proposeReceipt.isLoading || voteReceipt.isLoading || queueReceipt.isLoading || executeReceipt.isLoading;
  const error = delegateWrite.error ?? proposeWrite.error ?? voteWrite.error ?? queueWrite.error ?? executeWrite.error;

  async function delegateSelf() {
    if (!v2TokenAddress || !address || wrongNetwork) return;
    try { await delegateWrite.writeContractAsync({ address: v2TokenAddress, abi: v2TokenAbi, functionName: "delegate", args: [address], chainId: sepolia.id }); } catch {}
  }
  async function propose() {
    if (!v2GovernorAddress || wrongNetwork) return;
    try { await proposeWrite.writeContractAsync({ address: v2GovernorAddress, abi: governorAbi, functionName: "propose", args: [proposal.targets, proposal.values, proposal.calldatas, DESCRIPTION], chainId: sepolia.id }); } catch {}
  }
  async function vote(support: number) {
    if (!v2GovernorAddress || proposalId === undefined || wrongNetwork) return;
    try { await voteWrite.writeContractAsync({ address: v2GovernorAddress, abi: governorAbi, functionName: "castVote", args: [proposalId, support], chainId: sepolia.id }); } catch {}
  }
  async function queue() {
    if (!v2GovernorAddress || wrongNetwork) return;
    try { await queueWrite.writeContractAsync({ address: v2GovernorAddress, abi: governorAbi, functionName: "queue", args: [proposal.targets, proposal.values, proposal.calldatas, DESCRIPTION_HASH], chainId: sepolia.id }); } catch {}
  }
  async function execute() {
    if (!v2GovernorAddress || wrongNetwork) return;
    try { await executeWrite.writeContractAsync({ address: v2GovernorAddress, abi: governorAbi, functionName: "execute", args: [proposal.targets, proposal.values, proposal.calldatas, DESCRIPTION_HASH], chainId: sepolia.id }); } catch {}
  }

  return (
    <section className="governance-lab page-width" id="governance">
      <div className="governance-header">
        <div>
          <p className="eyebrow">V2 governance lab</p>
          <h2>Policy moves slower<br />than capital.</h2>
          <p>Delegate votes, stop emissions through a proposal, and wait for the timelock before protocol authority can act.</p>
        </div>
        <div className={`deployment-status ${governanceReady ? "deployment-ready" : ""}`}>
          <span />{governanceReady ? "Sepolia deployment active" : "Deployment pending"}
        </div>
      </div>

      <div className="governance-metrics">
        <div><span>Supply / cap</span><strong>{formatTokenAmount(totalSupply.data, 18, 0)} / {formatTokenAmount(cap.data, 18, 0)}</strong><small>LRN2</small></div>
        <div><span>Epoch emission</span><strong>{formatTokenAmount(emissionAmount.data, 18, 0)}</strong><small>Every 10 min · testnet</small></div>
        <div><span>Next emission</span><strong className="metric-date">{formatTimestamp(nextEmission.data)}</strong><small>{epochsReleased.data?.toString() ?? "—"} epochs released</small></div>
        <div><span>Governance</span><strong>{quorum.data?.toString() ?? "—"}% quorum</strong><small>{timelockDelay.data?.toString() ?? "—"} sec timelock</small></div>
      </div>

      <div className="governance-grid">
        <div className="governance-card">
          <span className="governance-step">01</span><h3>Activate voting power</h3>
          <p>LRN2 balances do not count until delegated. Self-delegation creates historical checkpoints without transferring tokens.</p>
          <dl><div><dt>Your balance</dt><dd>{formatTokenAmount(balance.data, 18)} LRN2</dd></div><div><dt>Your votes</dt><dd>{formatTokenAmount(votes, 18)} votes</dd></div><div><dt>Delegatee</dt><dd>{delegatee ? shortAddress(delegatee, 6) : "None"}</dd></div></dl>
          <button className="button governance-button" disabled={!governanceReady || !isConnected || wrongNetwork || delegatedToSelf || pending} onClick={delegateSelf} type="button">{delegatedToSelf ? "Delegated to self" : "Delegate to self"}</button>
        </div>

        <div className="governance-card governance-proposal">
          <span className="governance-step">02</span><h3>Stop future emissions</h3>
          <p>A fixed demo proposal asks the Timelock to revoke the controller&apos;s MINTER_ROLE. It cannot move treasury funds.</p>
          <dl><div><dt>Proposal ID</dt><dd className="proposal-id">{proposalId ? `0x${proposalId.toString(16).slice(0, 12)}…` : "Not available"}</dd></div><div><dt>State</dt><dd>{stateNumber === undefined ? "Not created" : proposalStates[stateNumber]}</dd></div><div><dt>Threshold</dt><dd>{formatTokenAmount(threshold.data, 18, 0)} votes</dd></div></dl>
          <button className="button governance-button" disabled={!governanceReady || !isConnected || wrongNetwork || !hasProposalPower || stateNumber !== undefined || pending} onClick={propose} type="button">Create proposal</button>
        </div>

        <div className="governance-card">
          <span className="governance-step">03</span><h3>Vote</h3>
          <p>Voting uses the delegated balance snapshot taken when the proposal becomes active.</p>
          <div className="vote-buttons"><button disabled={stateNumber !== 1 || pending} onClick={() => vote(1)} type="button">For</button><button disabled={stateNumber !== 1 || pending} onClick={() => vote(0)} type="button">Against</button><button disabled={stateNumber !== 1 || pending} onClick={() => vote(2)} type="button">Abstain</button></div>
        </div>

        <div className="governance-card">
          <span className="governance-step">04</span><h3>Queue & execute</h3>
          <p>A successful vote is queued first. Anyone may execute it only after the Timelock delay has elapsed.</p>
          <div className="governance-actions"><button className="button button-vault-secondary" disabled={stateNumber !== 4 || pending} onClick={queue} type="button">Queue</button><button className="button governance-button" disabled={stateNumber !== 5 || pending} onClick={execute} type="button">Execute</button></div>
        </div>
      </div>

      <div className="governance-footer"><WalletButton /><span>Controller {v2ControllerAddress ? shortAddress(v2ControllerAddress, 6) : "pending"}</span></div>
      {error && <p className="error-text governance-error">{error.message}</p>}
    </section>
  );
}
