import { useEffect, useState } from "react";
import { clusterApiUrl } from "@solana/web3.js";

export type SolanaCluster = "devnet" | "mainnet-beta" | "testnet";

export const CLUSTER_OPTIONS: {
  value: SolanaCluster;
  label: string;
  hint: string;
  dot: string;
}[] = [
  {
    value: "devnet",
    label: "Devnet",
    hint: "Tokens y SOL de prueba. Recomendado para probar.",
    dot: "bg-amber-400",
  },
  {
    value: "mainnet-beta",
    label: "Mainnet",
    hint: "SOL real: las transacciones tienen coste y son irreversibles.",
    dot: "bg-emerald-400",
  },
  {
    value: "testnet",
    label: "Testnet",
    hint: "Red de prueba para validadores.",
    dot: "bg-sky-400",
  },
];

const STORAGE_KEY = "solflows_cluster_v1";
const CHANGE_EVENT = "solflows-cluster-change";

export const DEFAULT_CLUSTER: SolanaCluster =
  (process.env.NEXT_PUBLIC_SOLANA_CLUSTER as SolanaCluster) || "devnet";

function isCluster(value: unknown): value is SolanaCluster {
  return value === "devnet" || value === "mainnet-beta" || value === "testnet";
}

let current: SolanaCluster = DEFAULT_CLUSTER;
const listeners = new Set<() => void>();

function readStored(): SolanaCluster {
  if (typeof window === "undefined") return DEFAULT_CLUSTER;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isCluster(stored)) return stored;
  } catch {
    // localStorage can be blocked; fall back to the configured cluster.
  }
  return DEFAULT_CLUSTER;
}

/** Current cluster chosen in the dapp. Safe to call during SSR. */
export function getCluster(): SolanaCluster {
  return current;
}

export function setCluster(next: SolanaCluster): void {
  if (!isCluster(next)) return;
  current = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage failures; the switch still applies for this session.
    }
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
  }
  listeners.forEach((listener) => listener());
}

export function subscribeCluster(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    window.addEventListener(CHANGE_EVENT, listener);
    window.addEventListener("storage", listener);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener(CHANGE_EVENT, listener);
      window.removeEventListener("storage", listener);
    }
  };
}

/**
 * Starts from the configured default on both server and first client render,
 * then adopts the persisted choice after mount to avoid hydration mismatches.
 */
export function useCluster(): SolanaCluster {
  const [cluster, setClusterState] = useState<SolanaCluster>(DEFAULT_CLUSTER);
  useEffect(() => {
    const sync = () => setClusterState(isCluster(current) ? current : readStored());
    sync();
    return subscribeCluster(sync);
  }, []);
  return cluster;
}

export function isMainnet(cluster: SolanaCluster = getCluster()): boolean {
  return cluster === "mainnet-beta";
}

/**
 * A single RPC per cluster. Alchemy is used for devnet when configured; mainnet
 * and testnet use the public endpoint unless an explicit override is provided.
 */
export function rpcUrlFor(cluster: SolanaCluster): string {
  const override = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (override) return override;
  if (cluster === "devnet") {
    return process.env.NEXT_PUBLIC_ALCHEMY_HTTP_URL || clusterApiUrl("devnet");
  }
  return clusterApiUrl(cluster);
}

// Keep the module-level value in sync with the browser's persisted choice.
if (typeof window !== "undefined") {
  current = readStored();
}
