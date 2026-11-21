import {
  Connection, PublicKey, Transaction, TransactionInstruction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { getCluster, rpcUrlFor, type SolanaCluster } from "@/lib/network";

const connections = new Map<SolanaCluster, Connection>();

/** Returns the RPC connection for the cluster currently selected in the dapp. */
export function getConnection(cluster: SolanaCluster = getCluster()): Connection {
  let active = connections.get(cluster);
  if (!active) {
    active = new Connection(rpcUrlFor(cluster), "confirmed");
    connections.set(cluster, active);
  }
  return active;
}

/**
 * Stable reference for callers that captured `connection` once. Every call is
 * delegated to the active cluster so switching networks never uses a stale RPC.
 */
export const connection: Connection = new Proxy(
  new Connection(rpcUrlFor(getCluster()), "confirmed"),
  {
    get(_target, prop) {
      const active = getConnection() as unknown as Record<string | symbol, unknown>;
      const value = active[prop];
      return typeof value === "function"
        ? (value as (...args: unknown[]) => unknown).bind(active)
        : value;
    },
    set(_target, prop, value) {
      (getConnection() as unknown as Record<string | symbol, unknown>)[prop] = value;
      return true;
    },
  },
);

/** Kept for compatibility; prefer `getCluster()` from `@/lib/network`. */
export const SOLANA_CLUSTER = getCluster();

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

// Mantenemos este tipo por compatibilidad hacia atrás
export type Phantom = {
  isPhantom?: boolean;
  publicKey: PublicKey | null;
  isConnected: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  on: (event: string, cb: (...a: any[]) => void) => void;
};

export interface WalletTools {
  sendTransaction: (
    transaction: Transaction,
    connection: Connection
  ) => Promise<string>;
  publicKey: PublicKey | null;
}

export function getPhantom(): Phantom | null {
  const w = window as any;
  return w?.solana?.isPhantom ? (w.solana as Phantom) : null;
}

function clusterQuery(cluster: SolanaCluster) {
  return cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
}

export function solscanUrl(sig: string, cluster = getCluster()) {
  return `https://solscan.io/tx/${sig}${clusterQuery(cluster)}`;
}

export function solexplorerUrl(sig: string, cluster = getCluster()) {
  return `https://explorer.solana.com/tx/${sig}${clusterQuery(cluster)}`;
}

export function explorerAddrUrl(addr: string, cluster = getCluster()) {
  return `https://solscan.io/account/${addr}${clusterQuery(cluster)}`;
}

export type OnchainEntry = {
  signature: string;
  blockTime: number | null;
  payload: { v: number; name: string; cid: string; version?: number };
};

/**
 * Waits for a signature using HTTP signature statuses only. The WebSocket
 * subscription behind `confirmTransaction` reports "Transaction was not
 * confirmed in 30.00 seconds" when the wallet broadcasts through its own RPC
 * (or the subscription drops), even though the transaction already landed.
 */
export async function confirmTransactionOverHttp(
  connection: Connection,
  signature: string,
): Promise<void> {
  const POLL_INTERVAL_MS = 1_000;
  const TIMEOUT_MS = 60_000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < TIMEOUT_MS) {
    const { value } = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const status = value[0];
    if (status) {
      if (status.err) {
        throw new Error(
          `La transacción falló en la red: ${JSON.stringify(status.err)}`,
        );
      }
      if (
        status.confirmationStatus === "confirmed" ||
        status.confirmationStatus === "finalized"
      ) {
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  // Some RPCs return a known signature without an explicit commitment level.
  // If there is no error the transaction landed, so do not report a false failure.
  const { value } = await connection.getSignatureStatuses([signature], {
    searchTransactionHistory: true,
  });
  if (value[0] && !value[0].err) return;
  throw new Error(
    "La transacción fue enviada pero no se pudo confirmar a tiempo. Revisa el explorer antes de reintentar.",
  );
}

/** A wallet may throw after broadcasting; the error embeds the signature. */
function signatureFromError(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const direct = (error as { signature?: unknown }).signature;
  if (typeof direct === "string" && direct.length >= 60) return direct;
  const message =
    error instanceof Error
      ? error.message
      : String((error as { message?: unknown }).message || "");
  return message.match(/\b[1-9A-HJ-NP-Za-km-z]{80,100}\b/)?.[0] || null;
}

/**
 * Publica un flujo de trabajo on-chain usando cualquier Wallet del Wallet Standard
 */
export async function publishWorkflowMemo(
  walletTools: WalletTools,
  payload: { name: string; cid: string; version: number }
): Promise<{ signature: string }> {
  const { publicKey, sendTransaction } = walletTools;

  if (!publicKey) throw new Error("Wallet not connected");

  const memo = JSON.stringify({ v: 1, app: "solflows", ...payload });
  const ix = new TransactionInstruction({
    keys: [{ pubkey: publicKey, isSigner: true, isWritable: true }],
    programId: MEMO_PROGRAM_ID,
    data: new TextEncoder().encode(memo) as unknown as any,
  });

  const tx = new Transaction().add(ix);
  
  // tx.feePayer = publicKey;
  // const { blockhash } = await connection.getLatestBlockhash();
  // tx.recentBlockhash = blockhash;

  console.log("Tx preparada, instrucciones:", tx.instructions.length);
  console.log("Program ID:", ix.programId.toBase58());
  
  const active = getConnection();
  let sig: string;
  try {
    sig = await sendTransaction(tx, active);
  } catch (error) {
    // Wallets can broadcast and then fail while waiting for their own
    // confirmation. If the error carries a signature, verify it on chain
    // before treating the publication as failed.
    const suspected = signatureFromError(error);
    if (suspected) {
      try {
        await confirmTransactionOverHttp(active, suspected);
        return { signature: suspected };
      } catch {
        // Keep the original wallet error when reconciliation also fails.
      }
    }
    console.error("Detalle del error en Wallet Adapter:", error);
    throw error;
  }

  await confirmTransactionOverHttp(active, sig);

  return { signature: sig };
}

const CHAIN_CACHE_TTL_MS = 60_000;
const chainCache = new Map<string, { entries: OnchainEntry[]; at: number }>();
const chainInFlight = new Map<string, Promise<OnchainEntry[]>>();

/**
 * Reads the memo history with a short-lived cache. The public devnet RPC is
 * slow and rate-limited, so opening the sheet twice must not mean two full
 * transaction-history scans.
 */
export async function listOnchainWorkflows(
  owner: PublicKey,
  limit = 20
): Promise<OnchainEntry[]> {
  const key = `${getCluster()}:${owner.toBase58()}:${limit}`;
  const cached = chainCache.get(key);
  if (cached && Date.now() - cached.at < CHAIN_CACHE_TTL_MS) {
    return cached.entries;
  }
  const inFlight = chainInFlight.get(key);
  if (inFlight) return inFlight;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("RPC timeout")), 12_000);
  });

  const request = readOnchainWorkflows(owner, limit)
    .then((entries) => {
      chainCache.set(key, { entries, at: Date.now() });
      return entries;
    })
    .catch((error) => {
      if (cached) return cached.entries;
      throw error;
    })
    .finally(() => {
      if (timer) clearTimeout(timer);
    });

  const raced = Promise.race([request, timeout]).finally(() => {
    chainInFlight.delete(key);
  });
  chainInFlight.set(key, raced);
  return raced;
}

async function readOnchainWorkflows(
  owner: PublicKey,
  limit: number
): Promise<OnchainEntry[]> {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  let sigs;
  try {
    sigs = await connection.getSignaturesForAddress(owner, { limit });
  } catch (error) {
    // The public devnet RPC throttles aggressively; one short retry usually
    // succeeds before falling back to the Supabase history in the caller.
    console.warn("Signature history request failed, retrying once", error);
    await sleep(900);
    sigs = await connection.getSignaturesForAddress(owner, { limit });
  }
  if (sigs.length === 0) return [];

  type SignatureInfo = (typeof sigs)[number];
  type ParsedTx = Awaited<ReturnType<typeof connection.getParsedTransaction>>;
  let parsed: { info: SignatureInfo; tx: ParsedTx }[] = [];

  try {
    const batch = await connection.getParsedTransactions(
      sigs.map((s) => s.signature),
      { maxSupportedTransactionVersion: 0 }
    );
    parsed = sigs.map((info, i) => ({ info, tx: batch[i] ?? null }));
  } catch (error) {
    // A 429 on the batch call must not blank the whole list. Read the most
    // recent transactions one by one and stop after repeated failures.
    console.warn("Batch transaction read failed, retrying individually", error);
    let failures = 0;
    for (const info of sigs.slice(0, 10)) {
      try {
        const tx = await connection.getParsedTransaction(info.signature, {
          maxSupportedTransactionVersion: 0,
        });
        parsed.push({ info, tx });
        failures = 0;
      } catch {
        parsed.push({ info, tx: null });
        failures += 1;
        if (failures >= 3) break;
      }
      await sleep(250);
    }
  }

  const out: OnchainEntry[] = [];
  parsed.forEach(({ info, tx }) => {
    if (!tx) return;
    for (const ix of tx.transaction.message.instructions as any[]) {
      const pid = (ix.programId as PublicKey)?.toBase58?.() || ix.programId;
      if (pid !== MEMO_PROGRAM_ID.toBase58()) continue;
      let raw: string | undefined;
      if (typeof ix.parsed === "string") raw = ix.parsed;
      else if (ix.parsed?.info) raw = ix.parsed.info;
      else if (ix.data) {
        try { raw = new TextDecoder().decode(bs58.decode(ix.data)); } catch { }
      }
      if (!raw) continue;
      try {
        const p = JSON.parse(raw);
        if (p?.app === "solflows" && p?.cid) {
          out.push({
            signature: info.signature,
            blockTime: info.blockTime ?? tx.blockTime ?? null,
            payload: p,
          });
        }
      } catch { }
    }
  });

  // Deduplicate by name, keep highest version / most recent
  const byName = new Map<string, OnchainEntry>();
  for (const e of out) {
    const prev = byName.get(e.payload.name);
    const newer = !prev || (e.payload.version ?? 0) > (prev.payload.version ?? 0)
      || (e.blockTime ?? 0) > (prev.blockTime ?? 0);
    if (newer) byName.set(e.payload.name, e);
  }
  return Array.from(byName.values()).sort(
    (a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0)
  );
}

export function shortAddr(a: string, n = 4) {
  return a.length > 2 * n + 2 ? `${a.slice(0, n)}…${a.slice(-n)}` : a;
}