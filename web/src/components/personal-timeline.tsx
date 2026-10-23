"use client";

import { useQuery } from "@tanstack/react-query";
import {
  createPublicClient,
  isAddressEqual,
  http,
  parseAbiItem,
  type Address,
} from "viem";
import { sepolia } from "viem/chains";
import { useAccount } from "wagmi";
import {
  deploymentBlock,
  faucetAddress,
  tokenAddress,
  vaultAddress,
} from "@/lib/contracts";
import { formatTokenAmount, shortAddress } from "@/lib/format";
import {
  finalizeTimeline,
  formatTimelineDate,
  type TimelineItem,
  type TimelineKind,
} from "@/lib/timeline";
import { sepoliaRpcUrl } from "@/lib/wagmi";
import { WalletButton } from "./wallet-button";

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);
const claimedEvent = parseAbiItem(
  "event Claimed(address indexed account, uint256 amount)",
);
const stakedEvent = parseAbiItem(
  "event Staked(address indexed account, uint256 amount, uint256 reward, uint256 unlockTime, uint8 planId)",
);
const principalEvent = parseAbiItem(
  "event PrincipalWithdrawn(address indexed account, uint256 amount, uint256 rewardUnlocked)",
);
const rewardEvent = parseAbiItem(
  "event RewardClaimed(address indexed account, uint256 reward)",
);

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(sepoliaRpcUrl),
});

const kindLabels: Record<TimelineKind, string> = {
  claim: "Faucet",
  principal: "Principal",
  received: "Received",
  reward: "Reward",
  self: "Self",
  sent: "Sent",
  stake: "Vault",
};

async function readTimeline(account: Address) {
  const [sent, received, claims, stakes, principalWithdrawals, rewards] = await Promise.all([
    publicClient.getLogs({ address: tokenAddress, event: transferEvent, args: { from: account }, fromBlock: deploymentBlock, toBlock: "latest" }),
    publicClient.getLogs({ address: tokenAddress, event: transferEvent, args: { to: account }, fromBlock: deploymentBlock, toBlock: "latest" }),
    publicClient.getLogs({ address: faucetAddress, event: claimedEvent, args: { account }, fromBlock: deploymentBlock, toBlock: "latest" }),
    publicClient.getLogs({ address: vaultAddress, event: stakedEvent, args: { account }, fromBlock: deploymentBlock, toBlock: "latest" }),
    publicClient.getLogs({ address: vaultAddress, event: principalEvent, args: { account }, fromBlock: deploymentBlock, toBlock: "latest" }),
    publicClient.getLogs({ address: vaultAddress, event: rewardEvent, args: { account }, fromBlock: deploymentBlock, toBlock: "latest" }),
  ]);

  const items: TimelineItem[] = [];
  const transferLogs = new Map<string, (typeof sent)[number]>();
  for (const log of [...sent, ...received]) {
    if (log.transactionHash && log.logIndex !== null) {
      transferLogs.set(`${log.transactionHash}-${log.logIndex}`, log);
    }
  }

  for (const log of transferLogs.values()) {
    const { from, to, value } = log.args;
    if (!from || !to || value === undefined || !log.transactionHash || log.blockNumber === null || log.logIndex === null) continue;
    const fromSelf = isAddressEqual(from, account);
    const toSelf = isAddressEqual(to, account);
    const kind: TimelineKind = fromSelf && toSelf ? "self" : fromSelf ? "sent" : "received";

    items.push({
      amount: value,
      blockNumber: log.blockNumber,
      detail: fromSelf && toSelf
        ? "Moved between the same wallet"
        : fromSelf
          ? `To ${shortAddress(to, 6)}`
          : `From ${shortAddress(from, 6)}`,
      id: `${log.transactionHash}-${log.logIndex}`,
      kind,
      logIndex: log.logIndex,
      title: fromSelf && toSelf ? "Self transfer" : fromSelf ? "Sent LRN" : "Received LRN",
      transactionHash: log.transactionHash,
    });
  }

  for (const log of claims) {
    if (log.args.amount === undefined || !log.transactionHash || log.blockNumber === null || log.logIndex === null) continue;
    items.push({ amount: log.args.amount, blockNumber: log.blockNumber, detail: "One-time testnet distribution", id: `${log.transactionHash}-${log.logIndex}`, kind: "claim", logIndex: log.logIndex, title: "Claimed faucet tokens", transactionHash: log.transactionHash });
  }
  for (const log of stakes) {
    const { amount, reward, planId } = log.args;
    if (amount === undefined || reward === undefined || planId === undefined || !log.transactionHash || log.blockNumber === null || log.logIndex === null) continue;
    items.push({ amount, blockNumber: log.blockNumber, detail: `Plan ${Number(planId) + 1} · ${formatTokenAmount(reward, 18)} LRN reward reserved`, id: `${log.transactionHash}-${log.logIndex}`, kind: "stake", logIndex: log.logIndex, title: "Opened vault position", transactionHash: log.transactionHash });
  }
  for (const log of principalWithdrawals) {
    const { amount, rewardUnlocked } = log.args;
    if (amount === undefined || rewardUnlocked === undefined || !log.transactionHash || log.blockNumber === null || log.logIndex === null) continue;
    items.push({ amount, blockNumber: log.blockNumber, detail: `${formatTokenAmount(rewardUnlocked, 18)} LRN reward unlocked`, id: `${log.transactionHash}-${log.logIndex}`, kind: "principal", logIndex: log.logIndex, title: "Withdrew principal", transactionHash: log.transactionHash });
  }
  for (const log of rewards) {
    if (log.args.reward === undefined || !log.transactionHash || log.blockNumber === null || log.logIndex === null) continue;
    items.push({ amount: log.args.reward, blockNumber: log.blockNumber, detail: "Claimed separately from principal", id: `${log.transactionHash}-${log.logIndex}`, kind: "reward", logIndex: log.logIndex, title: "Claimed vault reward", transactionHash: log.transactionHash });
  }

  const timeline = finalizeTimeline(items);
  const blockNumbers = [...new Set(timeline.map((item) => item.blockNumber))];
  const blocks = await Promise.allSettled(
    blockNumbers.map((blockNumber) => publicClient.getBlock({ blockNumber })),
  );
  const timestamps = new Map<bigint, bigint>();
  blocks.forEach((result, index) => {
    if (result.status === "fulfilled") timestamps.set(blockNumbers[index], result.value.timestamp);
  });

  return timeline.map((item) => ({ ...item, timestamp: timestamps.get(item.blockNumber) }));
}

export function PersonalTimeline() {
  const { address, chainId, isConnected } = useAccount();
  const wrongNetwork = isConnected && chainId !== sepolia.id;
  const timeline = useQuery({
    queryKey: ["personal-timeline", address?.toLowerCase()],
    queryFn: () => readTimeline(address as Address),
    enabled: Boolean(address) && !wrongNetwork,
    refetchInterval: 30_000,
    retry: 1,
    staleTime: 15_000,
  });

  if (!isConnected || wrongNetwork) {
    return (
      <section className="timeline-empty" aria-labelledby="timeline-empty-title">
        <span className="timeline-empty-mark">◎</span>
        <div>
          <p className="eyebrow">Wallet-scoped view</p>
          <h2 id="timeline-empty-title">{wrongNetwork ? "Switch to Sepolia." : "Connect to reveal your trail."}</h2>
          <p>The page reads public events for the connected address. Connecting does not sign a message or expose a private key.</p>
        </div>
        <WalletButton />
      </section>
    );
  }

  const inflow = timeline.data?.reduce((total, item) => (
    ["claim", "principal", "received", "reward"].includes(item.kind) ? total + item.amount : total
  ), BigInt(0));
  const outflow = timeline.data?.reduce((total, item) => (
    ["sent", "stake"].includes(item.kind) ? total + item.amount : total
  ), BigInt(0));

  return (
    <section className="timeline-shell" aria-labelledby="timeline-title">
      <div className="timeline-account-bar">
        <div>
          <p className="eyebrow">Connected identity</p>
          <h2 id="timeline-title">{address ? shortAddress(address, 8) : "Your wallet"}</h2>
        </div>
        <WalletButton />
      </div>

      <div className="timeline-summary">
        <div><span>Recorded actions</span><strong>{timeline.data?.length ?? "—"}</strong><small>latest 50</small></div>
        <div><span>Tracked inflow</span><strong>{formatTokenAmount(inflow, 18)} LRN</strong><small>received · rewards · principal</small></div>
        <div><span>Tracked outflow</span><strong>{formatTokenAmount(outflow, 18)} LRN</strong><small>sent · staked</small></div>
      </div>

      {timeline.isPending && <p className="timeline-message">Reading your Sepolia history…</p>}
      {timeline.isError && <p className="timeline-message timeline-message-error">Could not load the complete timeline. The public RPC may be rate limited; retry in a moment.</p>}
      {timeline.data?.length === 0 && <p className="timeline-message">No LRN activity was found for this wallet.</p>}

      <div className="personal-timeline">
        {timeline.data?.map((item) => (
          <a className={`timeline-entry timeline-entry-${item.kind}`} href={`https://sepolia.etherscan.io/tx/${item.transactionHash}`} key={item.id} rel="noreferrer" target="_blank">
            <span className="timeline-entry-mark" aria-hidden="true" />
            <span className="timeline-entry-copy">
              <span className="timeline-entry-meta"><span>{kindLabels[item.kind]}</span><time>{formatTimelineDate(item.timestamp)}</time></span>
              <strong>{item.title}</strong>
              <small>{item.detail} · block #{item.blockNumber.toString()}</small>
            </span>
            <span className="timeline-entry-value">{item.kind === "self" ? "" : ["sent", "stake"].includes(item.kind) ? "−" : "+"}{formatTokenAmount(item.amount, 18)} <small>LRN</small></span>
          </a>
        ))}
      </div>
    </section>
  );
}
