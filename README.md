# LRN Portal

LRN Portal is a production-shaped ERC-20 reference application built for learning how a complete onchain product fits together. It combines a minimal OpenZeppelin token, Foundry tests and deployment scripts, and a wallet-enabled Next.js interface.

The repository intentionally avoids an application server and database in its first version. Reads go through a Sepolia RPC endpoint, signed writes go from the user's wallet to the token contract, and transfer history is reconstructed from onchain events.

## Repository layout

```text
contracts/             OpenZeppelin ERC-20, Foundry tests, deployment script
web/                   Next.js App Router DApp
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

## Contract deployment

```bash
cp contracts/.env.example contracts/.env
source contracts/.env

forge script contracts/script/DeployLRNToken.s.sol:DeployLRNToken \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --account "$FOUNDRY_ACCOUNT" \
  --broadcast \
  --verify
```

Never commit private keys, keystore passwords, API keys, or populated `.env` files.

## Current scope

- Fixed-supply ERC-20 using OpenZeppelin Contracts
- Unit and fuzz tests for project-specific configuration
- Sepolia deployment script
- Wallet connect, live token reads, and transfers
- Recent `Transfer` events read directly from chain logs
- CI checks for both Solidity and TypeScript

This is an educational reference app, not a financial product. It has not been audited.
