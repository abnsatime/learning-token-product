"use client";

import { useQuery } from "@tanstack/react-query";
import { createPublicClient, formatUnits, http, parseAbiItem } from "viem";
import { sepolia } from "viem/chains";
import { deploymentBlock, tokenAddress } from "@/lib/contracts";
import { shortAddress } from "@/lib/format";
import { sepoliaRpcUrl } from "@/lib/wagmi";

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(sepoliaRpcUrl),
});

export function RecentTransfers() {
  const transfers = useQuery({
    queryKey: ["transfers", tokenAddress, deploymentBlock.toString()],
    queryFn: async () => {
      const logs = await publicClient.getLogs({
        address: tokenAddress,
        event: transferEvent,
        fromBlock: deploymentBlock,
        toBlock: "latest",
      });
      return logs.slice(-6).reverse();
    },
    refetchInterval: 15_000,
  });

  return (
    <section className="activity-panel" aria-labelledby="activity-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Onchain activity</p>
          <h3 id="activity-title">Recent transfers</h3>
        </div>
        <span className="live-label"><span />Live</span>
      </div>

      {transfers.isPending && <p className="muted">Reading Sepolia logs…</p>}
      {transfers.isError && (
        <p className="error-text">Could not load logs. The public RPC may be rate limited.</p>
      )}
      {transfers.data?.length === 0 && <p className="muted">No transfers found yet.</p>}

      <div className="activity-list">
        {transfers.data?.map((log) => {
          const { from, to, value } = log.args;
          if (!from || !to || value === undefined) return null;

          return (
            <a
              className="activity-row"
              href={`https://sepolia.etherscan.io/tx/${log.transactionHash}`}
              key={`${log.transactionHash}-${log.logIndex}`}
              rel="noreferrer"
              target="_blank"
            >
              <span className="activity-mark">↗</span>
              <span className="activity-route">
                <strong>{shortAddress(from)}</strong>
                <span>to {shortAddress(to)}</span>
              </span>
              <span className="activity-value">
                {Number(formatUnits(value, 18)).toLocaleString("en-US", {
                  maximumFractionDigits: 3,
                })} {" "}
                LRN
              </span>
              <span className="activity-block">#{log.blockNumber.toString()}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
