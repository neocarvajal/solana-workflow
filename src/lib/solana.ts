import {
  Connection, PublicKey, Transaction, TransactionInstruction, clusterApiUrl,
} from "@solana/web3.js";
import bs58 from "bs58";

const CLUSTER = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet") as
  "devnet" | "mainnet-beta" | "testnet";

export const SOLANA_CLUSTER = CLUSTER;
export const connection = new Connection(clusterApiUrl(CLUSTER), "confirmed");

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

export function solscanUrl(sig: string) {
  const c = CLUSTER === "mainnet-beta" ? "" : `?cluster=${CLUSTER}`;
  return `https://solscan.io/tx/${sig}${c}`;
}

export function explorerAddrUrl(addr: string) {
  const c = CLUSTER === "mainnet-beta" ? "" : `?cluster=${CLUSTER}`;
  return `https://solscan.io/account/${addr}${c}`;
}

export type OnchainEntry = {
  signature: string;
  blockTime: number | null;
  payload: { v: number; name: string; cid: string; version?: number };
};

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
  tx.feePayer = publicKey;

  // Obtenemos el blockhash más reciente usando la conexión configurada
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;

  // Enviamos y firmamos la transacción delegando el proceso al Adapter de la Wallet activa
  const sig = await sendTransaction(tx, connection);

  // Confirmamos la transacción
  await connection.confirmTransaction(sig, "confirmed");

  return { signature: sig };
}

export async function listOnchainWorkflows(
  owner: PublicKey,
  limit = 30
): Promise<OnchainEntry[]> {
  const sigs = await connection.getSignaturesForAddress(owner, { limit });
  if (sigs.length === 0) return [];
  const txs = await connection.getParsedTransactions(
    sigs.map((s) => s.signature),
    { maxSupportedTransactionVersion: 0 }
  );
  const out: OnchainEntry[] = [];
  txs.forEach((tx, i) => {
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
            signature: sigs[i].signature,
            blockTime: sigs[i].blockTime ?? tx.blockTime ?? null,
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