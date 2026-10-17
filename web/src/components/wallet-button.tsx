"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { shortAddress } from "@/lib/format";

export function WalletButton() {
  const { address, chainId, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  if (!isConnected) {
    const connector = connectors[0];
    return (
      <button
        className="button button-primary"
        disabled={!connector || isPending}
        onClick={() => connector && connect({ connector })}
        type="button"
      >
        {isPending ? "Opening wallet…" : "Connect wallet"}
      </button>
    );
  }

  if (chainId !== sepolia.id) {
    return (
      <button
        className="button button-warning"
        disabled={isSwitching}
        onClick={() => switchChain({ chainId: sepolia.id })}
        type="button"
      >
        {isSwitching ? "Switching…" : "Switch to Sepolia"}
      </button>
    );
  }

  return (
    <button className="wallet-pill" onClick={() => disconnect()} type="button">
      <span className="status-dot" />
      {address ? shortAddress(address) : "Connected"}
      <span className="wallet-action">Disconnect</span>
    </button>
  );
}
