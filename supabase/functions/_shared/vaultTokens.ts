export type VaultAssetSymbol = "SOL" | "USDC" | "JUP" | "BONK";

export type VaultAsset = {
  symbol: VaultAssetSymbol;
  mint: string;
  decimals: number;
  clusterSupport: "all" | "mainnet-beta";
};

/** Same registry as the dapp (src/lib/vaultTokens.ts). */
export const VAULT_ASSETS: Record<VaultAssetSymbol, VaultAsset> = {
  SOL: {
    symbol: "SOL",
    mint: "11111111111111111111111111111111",
    decimals: 9,
    clusterSupport: "all",
  },
  USDC: {
    symbol: "USDC",
    mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    decimals: 6,
    clusterSupport: "all",
  },
  JUP: {
    symbol: "JUP",
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    decimals: 6,
    clusterSupport: "mainnet-beta",
  },
  BONK: {
    symbol: "BONK",
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    decimals: 5,
    clusterSupport: "mainnet-beta",
  },
};

export function normalizeVaultAsset(value: unknown): VaultAssetSymbol | null {
  if (typeof value !== "string") return null;
  const symbol = value.trim().toUpperCase() as VaultAssetSymbol;
  return symbol in VAULT_ASSETS ? symbol : null;
}

export function isAssetSupportedOnCluster(
  symbol: VaultAssetSymbol,
  cluster: string,
): boolean {
  const asset = VAULT_ASSETS[symbol];
  return asset.clusterSupport === "all" || cluster === "mainnet-beta";
}

/** Converts a human decimal amount into the asset's smallest unit. */
export function assetToBaseUnits(
  symbol: VaultAssetSymbol,
  value: string | number,
): number {
  const asset = VAULT_ASSETS[symbol];
  const raw = String(value).trim();
  if (!/^\d*(\.\d*)?$/.test(raw) || raw === "" || raw === ".") {
    throw new Error(`Invalid ${symbol} amount`);
  }
  const [whole, fraction = ""] = raw.split(".");
  if (fraction.length > asset.decimals) {
    throw new Error(`${symbol} supports at most ${asset.decimals} decimals`);
  }
  const padded = (fraction + "0".repeat(asset.decimals)).slice(0, asset.decimals);
  const baseUnits =
    BigInt(whole || "0") * 10n ** BigInt(asset.decimals) + BigInt(padded || "0");
  if (baseUnits > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${symbol} amount is too large`);
  }
  return Number(baseUnits);
}

export function baseUnitsToAmount(
  symbol: VaultAssetSymbol,
  baseUnits: number | bigint,
): string {
  const asset = VAULT_ASSETS[symbol];
  const negative = BigInt(baseUnits) < 0n;
  const digits = (negative ? -BigInt(baseUnits) : BigInt(baseUnits))
    .toString()
    .padStart(asset.decimals + 1, "0");
  const whole = digits.slice(0, digits.length - asset.decimals) || "0";
  const fraction = digits.slice(digits.length - asset.decimals).replace(/0+$/, "");
  const formatted = fraction ? `${whole}.${fraction}` : whole;
  return negative ? `-${formatted}` : formatted;
}
