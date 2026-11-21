import type { SolanaCluster } from "@/lib/network";

export type VaultAssetSymbol = "SOL" | "USDC" | "JUP" | "BONK";

export type VaultAsset = {
  symbol: VaultAssetSymbol;
  label: string;
  /** PublicKey.default.toBase58() for native SOL. */
  mint: string;
  decimals: number;
  /** JUP/BONK have mainnet mints only; devnet has no SPL mint for them. */
  clusterSupport: "all" | "mainnet-beta";
};

/**
 * Assets exposed by the Wallet Transfer node that the vault can transfer.
 * Amount limits are always stored in the asset's smallest unit on-chain.
 */
export const VAULT_ASSETS: Record<VaultAssetSymbol, VaultAsset> = {
  SOL: {
    symbol: "SOL",
    label: "SOL",
    mint: "11111111111111111111111111111111",
    decimals: 9,
    clusterSupport: "all",
  },
  USDC: {
    symbol: "USDC",
    label: "USD Coin",
    mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    decimals: 6,
    clusterSupport: "all",
  },
  JUP: {
    symbol: "JUP",
    label: "Jupiter",
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    decimals: 6,
    clusterSupport: "mainnet-beta",
  },
  BONK: {
    symbol: "BONK",
    label: "Bonk",
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    decimals: 5,
    clusterSupport: "mainnet-beta",
  },
};

export const VAULT_ASSET_LIST: VaultAsset[] = Object.values(VAULT_ASSETS);

export function normalizeVaultAsset(value: unknown): VaultAssetSymbol | null {
  if (typeof value !== "string") return null;
  const symbol = value.trim().toUpperCase() as VaultAssetSymbol;
  return symbol in VAULT_ASSETS ? symbol : null;
}

export function findVaultAssetByMint(mint: string): VaultAsset | null {
  return (
    VAULT_ASSET_LIST.find((asset) => asset.mint === mint.trim()) || null
  );
}

export function isAssetSupportedOnCluster(
  symbol: VaultAssetSymbol,
  cluster: SolanaCluster,
): boolean {
  const asset = VAULT_ASSETS[symbol];
  return asset.clusterSupport === "all" || cluster === "mainnet-beta";
}

export function supportedAssetLabel(cluster: SolanaCluster): string {
  return VAULT_ASSET_LIST.filter((asset) =>
    isAssetSupportedOnCluster(asset.symbol, cluster),
  )
    .map((asset) => asset.symbol)
    .join(", ");
}

/** Converts a human decimal amount into the asset's smallest unit. */
export function assetToBaseUnits(
  symbol: VaultAssetSymbol,
  value: string | number,
): number {
  const asset = VAULT_ASSETS[symbol];
  const raw = String(value).trim();
  if (!/^\d*(\.\d*)?$/.test(raw) || raw === "" || raw === ".") {
    throw new Error(`Importe ${symbol} inválido`);
  }
  const [whole, fraction = ""] = raw.split(".");
  if (fraction.length > asset.decimals) {
    throw new Error(`${symbol} admite como máximo ${asset.decimals} decimales`);
  }
  const padded = (fraction + "0".repeat(asset.decimals)).slice(0, asset.decimals);
  const baseUnits =
    BigInt(whole || "0") * BigInt(10) ** BigInt(asset.decimals) +
    BigInt(padded || "0");
  if (baseUnits > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`El importe ${symbol} es demasiado grande`);
  }
  return Number(baseUnits);
}

/** Formats smallest units as a human decimal string, without trailing zeros. */
export function baseUnitsToAmount(
  symbol: VaultAssetSymbol,
  baseUnits: number | bigint,
): string {
  const asset = VAULT_ASSETS[symbol];
  const negative = BigInt(baseUnits) < BigInt(0);
  const digits = (negative ? -BigInt(baseUnits) : BigInt(baseUnits))
    .toString()
    .padStart(asset.decimals + 1, "0");
  const whole = digits.slice(0, digits.length - asset.decimals) || "0";
  const fraction = digits.slice(digits.length - asset.decimals).replace(/0+$/, "");
  const formatted = fraction ? `${whole}.${fraction}` : whole;
  return negative ? `-${formatted}` : formatted;
}
