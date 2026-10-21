# LRN V2 deployment handoff

## Current decision

Deployment is intentionally deferred. Do not broadcast the V2 script, populate the four `NEXT_PUBLIC_V2_*` variables, or merge the V2 pull request until the checklist below is approved.

The implemented code remains useful before deployment:

- `LRNTokenV2` provides capped minting, permits, vote delegation, and checkpoints.
- `LRNEmissionController` implements fixed linear test emissions.
- `LRNGovernor` and `TimelockController` govern the token administrator role.
- The DApp presents delegation, proposal, voting, queue, and execution stages, but disables them while addresses are absent.

## Decisions required before broadcast

- [ ] Choose three independent Sepolia signer addresses for a Safe 2-of-3 treasury.
- [ ] Create the Safe and independently verify its chain, address, owners, and threshold.
- [ ] Confirm `V2_INITIAL_HOLDER`; this address receives the initial 1,000,000 LRN2.
- [ ] Confirm the Safe as `V2_TREASURY`; emitted LRN2 is sent here.
- [ ] Confirm the temporary deployment address as `V2_ADMIN`.
- [ ] Decide whether the ten-minute epoch and five-minute timelock remain appropriate for this test deployment.
- [ ] Fund only the Sepolia deployment account with enough Sepolia ETH for deployment and verification.

The deployment script removes `V2_ADMIN` from both final administrator roles. After a successful deployment, the Timelock controls the token administrator role, the Governor is the Timelock proposer and canceller, and execution is permissionless.

## Environment preparation

Copy `contracts/.env.example` to the ignored `contracts/.env` file and fill only these V2 values:

```dotenv
SEPOLIA_RPC_URL=
V2_ADMIN=
V2_INITIAL_HOLDER=
V2_TREASURY=
V2_EPOCH_DURATION=600
V2_TIMELOCK_DELAY=300
```

Do not commit the populated file, wallet secrets, private keys, seed phrases, RPC credentials, or keystore passwords.

## Preflight

Run these checks immediately before deployment because the broadcaster nonce and predicted addresses may have changed:

```bash
forge fmt --check --root contracts
forge build --root contracts --sizes
forge test --root contracts -vvv

source contracts/.env
forge script contracts/script/DeployLRNTokenV2.s.sol:DeployLRNTokenV2 \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --sender "$V2_ADMIN"
```

The final command is simulation only. Review all four returned addresses and role changes; do not treat simulated addresses as deployed addresses.

## Broadcast command — intentionally not run

When the checklist is approved, the same script can be broadcast and verified through the browser-wallet flow:

```bash
forge script contracts/script/DeployLRNTokenV2.s.sol:DeployLRNTokenV2 \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --sender "$V2_ADMIN" \
  --gas-estimate-multiplier 1500 \
  --browser \
  --broadcast \
  --verify \
  --verifier sourcify
```

Re-estimate gas before using the retained multiplier. A successful simulation is not evidence of a successful broadcast.

## Post-deployment record

Before enabling the DApp:

- [ ] Record chain ID, block number, transaction hash, and the Token, Controller, Timelock, and Governor addresses in a committed deployment record.
- [ ] Confirm exact source verification for every deployed contract.
- [ ] Read back token cap, initial supply, controller schedule and treasury, timelock delay, Governor threshold, and quorum.
- [ ] Confirm the Controller has `MINTER_ROLE`.
- [ ] Confirm the Timelock has the token administrator role.
- [ ] Confirm the Governor has Timelock proposer and canceller roles.
- [ ] Confirm the temporary deployer no longer has either administrator role.
- [ ] Send a small test transaction through each intended lifecycle before funding anything material.

Only after those checks should these build-time variables be populated:

```dotenv
NEXT_PUBLIC_V2_TOKEN_ADDRESS=
NEXT_PUBLIC_V2_CONTROLLER_ADDRESS=
NEXT_PUBLIC_V2_TIMELOCK_ADDRESS=
NEXT_PUBLIC_V2_GOVERNOR_ADDRESS=
```

Then run `pnpm --dir web lint` and `pnpm --dir web build`, test the governance lifecycle on Sepolia, and merge the pull request to publish the enabled interface.
