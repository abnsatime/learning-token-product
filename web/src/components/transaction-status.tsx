import type { Hash } from "viem";
import { transactionErrorMessage, transactionExplorerUrl } from "@/lib/transaction";

type TransactionStatusProps = {
  error?: unknown;
  hash?: Hash;
  isConfirming?: boolean;
  isSuccess?: boolean;
  isWaitingForWallet?: boolean;
  successMessage: string;
};

export function TransactionStatus({
  error,
  hash,
  isConfirming = false,
  isSuccess = false,
  isWaitingForWallet = false,
  successMessage,
}: TransactionStatusProps) {
  let tone = "idle";
  let label = "Transaction prepared";
  let detail = "Review the request in your wallet before signing.";

  if (error) {
    tone = "error";
    label = "Transaction stopped";
    detail = transactionErrorMessage(error);
  } else if (isWaitingForWallet) {
    tone = "wallet";
    label = "Waiting for your wallet";
    detail = "Review the contract, amount, and estimated gas before confirming.";
  } else if (isConfirming) {
    tone = "confirming";
    label = "Submitted to Sepolia";
    detail = "The wallet signed and broadcast the transaction. It is waiting for block confirmation.";
  } else if (isSuccess) {
    tone = "success";
    label = "Confirmed onchain";
    detail = successMessage;
  } else if (!hash) {
    return null;
  }

  return (
    <div aria-live="polite" className={`transaction-status transaction-status-${tone}`} role="status">
      <span aria-hidden="true" className="transaction-status-dot" />
      <div>
        <strong>{label}</strong>
        <p>{detail}</p>
        {hash && (
          <a href={transactionExplorerUrl(hash)} rel="noreferrer" target="_blank">
            View {hash.slice(0, 10)}… on Etherscan ↗
          </a>
        )}
      </div>
    </div>
  );
}
