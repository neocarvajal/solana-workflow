export type ExecutionMode =
  | "manual"
  | "notify"
  | "vault_transfer"
  | "vault_dca"
  | "subscription";

export const DEFAULT_EXECUTION_MODE: ExecutionMode = "notify";

const SCHEDULE_SECONDS: Record<string, number> = {
  "30s": 30,
  "1m": 60,
  "2m": 120,
  "5m": 300,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "6h": 21600,
  "24h": 86400,
};

export function scheduleToSeconds(schedule: string | undefined | null): number {
  if (!schedule || schedule === "manual") return 0;
  return SCHEDULE_SECONDS[schedule] ?? 900;
}

export function normalizeExecutionMode(value: unknown): ExecutionMode {
  return value === "manual" ||
    value === "notify" ||
    value === "vault_transfer" ||
    value === "vault_dca" ||
    value === "subscription"
    ? value
    : DEFAULT_EXECUTION_MODE;
}
