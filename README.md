# LRN Portal

LRN Portal is a production-shaped ERC-20 reference application built for learning how a complete onchain product fits together. It combines a minimal OpenZeppelin token, Foundry tests and deployment scripts, and a wallet-enabled Next.js interface.

**Live DApp:** <https://abnsatime.github.io/learning-token-product/>

The repository intentionally avoids an application server and database in its first version. Reads go through a Sepolia RPC endpoint, signed writes go from the user's wallet to the token contract, and transfer history is reconstructed from onchain events.

## Live Sepolia deployment

- Contract: [`0xA7de34c97693dDe1d23139a7EAd9fBE17797BE7f`](https://sepolia.etherscan.io/address/0xA7de34c97693dDe1d23139a7EAd9fBE17797BE7f)
- Faucet: [`0x05aF66C0CF3C04790aB01aD85Ab7c63F8b1251a3`](https://sepolia.etherscan.io/address/0x05aF66C0CF3C04790aB01aD85Ab7c63F8b1251a3)
- Time Vault: [`0x8FA2D5f71c5F965E7FAe4860Ae2C720b3d076a7E`](https://sepolia.etherscan.io/address/0x8FA2D5f71c5F965E7FAe4860Ae2C720b3d076a7E)
- Deployment transaction: [`0x9cc399…69ca11`](https://sepolia.etherscan.io/tx/0x9cc39950889d737d966b655a5a4a32b5d32a471d16cc1c693faf532eaa69ca11)
- Faucet funding: [`10,000 LRN`](https://sepolia.etherscan.io/tx/0x26888fb7d77511e69bd6ceaddf7c2e561ffa4be0bdae20fc1c25b32db77e0a70)
- Vault reward reserve: [`10,000 LRN`](https://sepolia.etherscan.io/tx/0x1f3edf0984e38bf560ecbfb258ec1aaa62765616c6f19b1a706352d75fd813c5)
- Source verification: Sourcify `exact_match` for all contracts
- Deployment metadata: [`deployments/sepolia.json`](deployments/sepolia.json)

## Repository layout

```text
contracts/             OpenZeppelin ERC-20, Foundry tests, deployment script
web/                   Next.js App Router DApp
indexer/               Sepolia event sync, SQLite storage, read-only HTTP API
.github/workflows/     Continuous integration
```

## Quick start

Requirements: Node.js 22, pnpm, and Foundry.

```bash
# Smart contracts
forge build --root contracts
forge test --root contracts -vvv

# Web application
cp web/.env.example web/.env.local
pnpm --dir web install
pnpm --dir web dev
```

Open <http://localhost:3000>. The default configuration points to a verified Sepolia learning deployment, so read-only data works without connecting a wallet.

## DApp transaction lifecycle

Read-only contract calls use the configured RPC endpoint and require no wallet signature. A write moves through four distinct UI states:

```text
wallet confirmation -> transaction broadcast -> block confirmation -> refreshed contract state
```

A wallet signature authorizes a transaction but does not prove that it succeeded. The shared transaction status component follows the transaction hash until a receipt is available, links the hash to Etherscan, and refreshes the affected reads only after confirmation. Wallet rejection, insufficient Sepolia ETH, decoded contract custom errors, and common nonce errors are converted into concise user-facing messages.

The contract ABIs include custom error definitions as well as functions and events. Those error entries do not change the deployed contracts; they give the client enough type information to decode revert data returned by the EVM.

## Event indexer

The optional local indexer converts confirmed blockchain logs into queryable application data:

```bash
cp indexer/.env.example indexer/.env
pnpm --dir indexer install
pnpm --dir indexer sync:once
pnpm --dir indexer start
```

Read <http://127.0.0.1:8787/health> for sync status and `/events` for recent activity. `/events?account=0x...&event=Staked&limit=20` applies address and event filters.

The learning implementation uses Node 22's experimental built-in SQLite module and begins at the Time Vault deployment block because the free RPC does not provide older archive history. It waits for 12 confirmations, syncs in bounded chunks, stores token quantities as exact decimal strings, and uses transaction hash plus log index as an idempotency key. A production multi-instance service should use an archive RPC and PostgreSQL.

## Contract deployment

```bash
cp contracts/.env.example contracts/.env
source contracts/.env

forge script contracts/script/DeployLRNToken.s.sol:DeployLRNToken \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --sender "$TOKEN_INITIAL_HOLDER" \
  --gas-estimate-multiplier 1500 \
  --browser \
  --broadcast \
  --verify \
  --verifier sourcify
```

The explicit gas multiplier is retained because the current Sepolia execution cost for this deployment is materially higher than Foundry's local estimate. Re-check this value when tooling or network rules change. Never commit private keys, keystore passwords, API keys, or populated `.env` files.

### Faucet deployment

The faucet is deployed after the token because its constructor permanently records the token address and fixed claim amount:

```bash
forge script contracts/script/DeployLRNFaucet.s.sol:DeployLRNFaucet \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --sender "$TOKEN_INITIAL_HOLDER" \
  --gas-estimate-multiplier 1500 \
  --browser \
  --broadcast \
  --verify \
  --verifier sourcify
```

After deployment, fund the faucet with an ordinary LRN transfer and set `NEXT_PUBLIC_FAUCET_ADDRESS` for the web build. The faucet cannot mint or withdraw tokens; it only distributes its existing inventory.

### Time Vault development

`LRNTimeVault` introduces the standard two-transaction custody flow used by staking contracts, vaults, and many DeFi protocols:

```text
approve(vault, amount) -> stake(amount, plan) -> wait -> withdrawPrincipal() -> claimReward()
```

The Sepolia learning plans are five minutes at 1%, ten minutes at 1.3%, and thirty minutes at 1.5%. These are fixed testnet bonuses, not APRs and not production economics. Each address may hold one active position. Rewards are reserved when staking, principal withdrawal is separate from reward claiming, and direct token transfers fund the reward reserve rather than creating positions.

The OpenZeppelin `Ownable` administrator may recover only the uncommitted reward reserve. Accounting prevents recovery of user principal or rewards already promised to active and completed positions. The administrator cannot modify the plans or extend an existing lock.

## Current scope

- Fixed-supply ERC-20 using OpenZeppelin Contracts
- Claim-once testnet faucet using `SafeERC20`
- Pre-funded time vault with separate principal and reward withdrawals
- Unit and fuzz tests for project-specific configuration
- Sepolia deployment script
- Wallet connect, live token reads, and transfers
- Recent `Transfer` events read directly from chain logs
- CI checks for both Solidity and TypeScript
- Static deployment to GitHub Pages after changes reach `main`

This is an educational reference app, not a financial product. It has not been audited.
