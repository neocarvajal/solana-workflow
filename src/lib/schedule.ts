export type ExecutionMode =
  | "manual"
  | "notify"
  | "vault_transfer"
  | "vault_dca"
  | "subscription";

export const DEFAULT_EXECUTION_MODE: ExecutionMode = "notify";

export const EXECUTION_MODE_OPTIONS: {
  value: ExecutionMode;
  label: string;
  description: string;
}[] = [
  {
    value: "manual",
    label: "Manual",
    description: "Solo se ejecuta cuando tú lo lanzas desde la app.",
  },
  {
    value: "notify",
    label: "Solo avisar",
    description: "El cron evalúa el workflow y envía las alertas, sin mover fondos.",
  },
  {
    value: "vault_transfer",
    label: "Bóveda: transferencia",
    description: "Transferencia recurrente desde una bóveda con límites on-chain.",
  },
  {
    value: "vault_dca",
    label: "Bóveda: DCA",
    description: "Compra recurrente con salida mínima protegida por la bóveda.",
  },
  {
    value: "subscription",
    label: "Suscripción",
    description: "Pago recurrente SPL/Token-2022 mediante Solana Subscriptions.",
  },
];

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
  return EXECUTION_MODE_OPTIONS.some((option) => option.value === value)
    ? (value as ExecutionMode)
    : DEFAULT_EXECUTION_MODE;
}

export function executionModeLabel(value: string | undefined | null): string {
  return (
    EXECUTION_MODE_OPTIONS.find((option) => option.value === value)?.label ||
    "Solo avisar"
  );
}

export function isFinancialExecutionMode(value: string | undefined | null): boolean {
  return value === "vault_transfer" || value === "vault_dca" || value === "subscription";
}
