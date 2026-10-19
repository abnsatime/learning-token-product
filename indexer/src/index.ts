import { createServer, type ServerResponse } from "node:http";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  createPublicClient,
  http,
  parseAbiItem,
  type Address,
  type Log,
} from "viem";
import { sepolia } from "viem/chains";

const TOKEN_ADDRESS: Address = "0xA7de34c97693dDe1d23139a7EAd9fBE17797BE7f";
const FAUCET_ADDRESS: Address = "0x05aF66C0CF3C04790aB01aD85Ab7c63F8b1251a3";
const VAULT_ADDRESS: Address = "0x8FA2D5f71c5F965E7FAe4860Ae2C720b3d076a7E";
const START_BLOCK = BigInt(process.env.INDEXER_START_BLOCK ?? "11942462");
const CHUNK_SIZE = BigInt(2_000);

const rpcUrl = process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const databasePath = resolve(process.env.INDEXER_DATABASE_PATH ?? "./data/indexer.sqlite");
const port = Number(process.env.INDEXER_PORT ?? "8787");
const confirmations = BigInt(process.env.INDEXER_CONFIRMATIONS ?? "12");
const pollInterval = Number(process.env.INDEXER_POLL_INTERVAL_MS ?? "15000");
const runOnce = process.argv.includes("--once");

mkdirSync(dirname(databasePath), { recursive: true });

const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
const db = new DatabaseSync(databasePath);
db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
db.exec(`
  CREATE TABLE IF NOT EXISTS sync_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chain_id INTEGER NOT NULL,
    contract_name TEXT NOT NULL,
    contract_address TEXT NOT NULL,
    event_name TEXT NOT NULL,
    block_number INTEGER NOT NULL,
    block_hash TEXT NOT NULL,
    transaction_hash TEXT NOT NULL,
    log_index INTEGER NOT NULL,
    account TEXT,
    counterparty TEXT,
    amount TEXT,
    reward TEXT,
    unlock_time INTEGER,
    plan_id INTEGER,
    UNIQUE(transaction_hash, log_index)
  );

  CREATE INDEX IF NOT EXISTS events_account_idx ON events(account, block_number DESC);
  CREATE INDEX IF NOT EXISTS events_counterparty_idx ON events(counterparty, block_number DESC);
  CREATE INDEX IF NOT EXISTS events_name_idx ON events(event_name, block_number DESC);
`);

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);
const claimedEvent = parseAbiItem("event Claimed(address indexed account, uint256 amount)");
const stakedEvent = parseAbiItem(
  "event Staked(address indexed account, uint256 amount, uint256 reward, uint256 unlockTime, uint8 planId)",
);
const principalWithdrawnEvent = parseAbiItem(
  "event PrincipalWithdrawn(address indexed account, uint256 amount, uint256 rewardUnlocked)",
);
const rewardClaimedEvent = parseAbiItem(
  "event RewardClaimed(address indexed account, uint256 reward)",
);

const insertEvent = db.prepare(`
  INSERT OR IGNORE INTO events (
    chain_id, contract_name, contract_address, event_name,
    block_number, block_hash, transaction_hash, log_index,
    account, counterparty, amount, reward, unlock_time, plan_id
  ) VALUES (
    @chainId, @contractName, @contractAddress, @eventName,
    @blockNumber, @blockHash, @transactionHash, @logIndex,
    @account, @counterparty, @amount, @reward, @unlockTime, @planId
  )
`);
const readCursor = db.prepare("SELECT value FROM sync_state WHERE key = 'last_synced_block'");
const writeCursor = db.prepare(`
  INSERT INTO sync_state (key, value) VALUES ('last_synced_block', ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

type EventRow = {
  chainId: number;
  contractName: string;
  contractAddress: string;
  eventName: string;
  blockNumber: number;
  blockHash: string;
  transactionHash: string;
  logIndex: number;
  account: string | null;
  counterparty: string | null;
  amount: string | null;
  reward: string | null;
  unlockTime: number | null;
  planId: number | null;
};

function baseRow(log: Log, contractName: string, eventName: string): EventRow {
  return {
    chainId: sepolia.id,
    contractName,
    contractAddress: log.address.toLowerCase(),
    eventName,
    blockNumber: Number(log.blockNumber ?? BigInt(0)),
    blockHash: log.blockHash ?? "",
    transactionHash: log.transactionHash ?? "",
    logIndex: log.logIndex ?? 0,
    account: null,
    counterparty: null,
    amount: null,
    reward: null,
    unlockTime: null,
    planId: null,
  };
}

function saveRows(rows: EventRow[], toBlock: bigint) {
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const row of rows) insertEvent.run(row);
    writeCursor.run(toBlock.toString());
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

async function fetchRows(fromBlock: bigint, toBlock: bigint) {
  const [transfers, claims, stakes, withdrawals, rewards] = await Promise.all([
    client.getLogs({ address: TOKEN_ADDRESS, event: transferEvent, fromBlock, toBlock }),
    client.getLogs({ address: FAUCET_ADDRESS, event: claimedEvent, fromBlock, toBlock }),
    client.getLogs({ address: VAULT_ADDRESS, event: stakedEvent, fromBlock, toBlock }),
    client.getLogs({ address: VAULT_ADDRESS, event: principalWithdrawnEvent, fromBlock, toBlock }),
    client.getLogs({ address: VAULT_ADDRESS, event: rewardClaimedEvent, fromBlock, toBlock }),
  ]);

  const rows: EventRow[] = [];
  for (const log of transfers) {
    rows.push({
      ...baseRow(log, "LRNToken", "Transfer"),
      account: log.args.from?.toLowerCase() ?? null,
      counterparty: log.args.to?.toLowerCase() ?? null,
      amount: log.args.value?.toString() ?? null,
    });
  }
  for (const log of claims) {
    rows.push({
      ...baseRow(log, "LRNFaucet", "Claimed"),
      account: log.args.account?.toLowerCase() ?? null,
      amount: log.args.amount?.toString() ?? null,
    });
  }
  for (const log of stakes) {
    rows.push({
      ...baseRow(log, "LRNTimeVault", "Staked"),
      account: log.args.account?.toLowerCase() ?? null,
      amount: log.args.amount?.toString() ?? null,
      reward: log.args.reward?.toString() ?? null,
      unlockTime: log.args.unlockTime ? Number(log.args.unlockTime) : null,
      planId: log.args.planId === undefined ? null : Number(log.args.planId),
    });
  }
  for (const log of withdrawals) {
    rows.push({
      ...baseRow(log, "LRNTimeVault", "PrincipalWithdrawn"),
      account: log.args.account?.toLowerCase() ?? null,
      amount: log.args.amount?.toString() ?? null,
      reward: log.args.rewardUnlocked?.toString() ?? null,
    });
  }
  for (const log of rewards) {
    rows.push({
      ...baseRow(log, "LRNTimeVault", "RewardClaimed"),
      account: log.args.account?.toLowerCase() ?? null,
      amount: log.args.reward?.toString() ?? null,
    });
  }
  return rows.sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);
}

async function syncOnce() {
  const head = await client.getBlockNumber();
  const safeHead = head > confirmations ? head - confirmations : BigInt(0);
  const cursor = readCursor.get() as { value: string } | undefined;
  let fromBlock = cursor ? BigInt(cursor.value) + BigInt(1) : START_BLOCK;

  while (fromBlock <= safeHead) {
    const toBlock = fromBlock + CHUNK_SIZE - BigInt(1) > safeHead
      ? safeHead
      : fromBlock + CHUNK_SIZE - BigInt(1);
    const rows = await fetchRows(fromBlock, toBlock);
    saveRows(rows, toBlock);
    console.log(`[sync] ${fromBlock}-${toBlock}: ${rows.length} events`);
    fromBlock = toBlock + BigInt(1);
  }

  return { head, safeHead, lastSynced: fromBlock - BigInt(1) };
}

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function main() {
  const status = await syncOnce();
  if (runOnce) {
    console.log(`[done] synced through ${status.lastSynced}`);
    db.close();
    return;
  }

  createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (url.pathname === "/health") {
      const head = await client.getBlockNumber();
      const cursor = readCursor.get() as { value: string } | undefined;
      json(response, 200, {
        ok: true,
        chainId: sepolia.id,
        head: head.toString(),
        lastSynced: cursor?.value ?? null,
        confirmations: confirmations.toString(),
      });
      return;
    }

    if (url.pathname === "/events") {
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "50"), 1), 100);
      const account = url.searchParams.get("account")?.toLowerCase();
      const eventName = url.searchParams.get("event");
      const clauses: string[] = [];
      const parameters: Array<string | number> = [];
      if (account) {
        clauses.push("(account = ? OR counterparty = ?)");
        parameters.push(account, account);
      }
      if (eventName) {
        clauses.push("event_name = ?");
        parameters.push(eventName);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const rows = db.prepare(`SELECT * FROM events ${where} ORDER BY block_number DESC, log_index DESC LIMIT ?`).all(...parameters, limit);
      json(response, 200, { events: rows });
      return;
    }

    json(response, 404, { error: "not_found" });
  }).listen(port, "127.0.0.1", () => {
    console.log(`[api] http://127.0.0.1:${port}`);
  });

  setInterval(() => {
    void syncOnce().catch((error) => console.error("[sync]", error));
  }, pollInterval);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
