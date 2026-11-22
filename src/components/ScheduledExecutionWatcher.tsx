import { useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getNotifications,
  refreshNotifications,
  subscribeNotifications,
  type AppNotification,
} from "@/lib/notificationStore";
import { isFinancialExecutionMode } from "@/lib/schedule";
import { notifyTxSuccess } from "@/lib/tx-toast";
import {
  getFlowNodes,
  getRunningNodeId,
  getScheduledRunState,
  getWorkflowId,
  setAnimatingLineIndex,
  setErrorNodeId,
  setRunningNodeId,
  setScheduledRunState,
} from "@/lib/workflowStore";

/**
 * Watches the automation row of the workflow currently open in the editor and
 * mirrors scheduled on-chain executions on the canvas. It only animates nodes
 * and reports status: it never sends transactions or alerts, because the cron
 * (dispatch-due-workflows → run-workflow) already performed the real run.
 */

const IDLE_POLL_MS = 10_000;
const DUE_POLL_MS = 600;
const NEAR_DUE_MS = 20_000;
const CLAIM_TIMEOUT_MS = 90_000;
const RESULT_TIMEOUT_MS = 90_000;
/** Give the bottom toast time to be read/clicked before the bell takes over. */
const TOAST_MIN_VISIBLE_MS = 8_000;
/** Stop watching for the bell row if the server never persisted one. */
const BELL_HANDOFF_TIMEOUT_MS = 30_000;

type AutomationRow = {
  id: string;
  workflow_id: string | null;
  name: string;
  cid: string | null;
  enabled: boolean;
  automation_status: string;
  schedule: string;
  execution_mode: string;
  onchain_signature: string | null;
  next_run_at: string | null;
  last_run_at: string | null;
  last_error: string | null;
  claimed_by: string | null;
  lease_until: string | null;
};

type Outcome =
  | { status: "success"; label: string; txSignature: string | null; failedStepIndex: number | null }
  | { status: "skipped"; label: string; txSignature?: null; failedStepIndex: number | null }
  | { status: "error"; label: string; txSignature?: null; failedStepIndex: number | null };

type RunLog = {
  step?: string;
  skipped?: boolean;
  reason?: string;
  status?: number;
  error?: string;
  executed?: boolean;
  signature?: string;
  amount_lamports?: number;
  destination?: string;
  payload?: { to?: string; amount?: number; asset?: string };
  note?: string;
};

/** Identifiers shared by the bottom toast and the persisted bell notification. */
type BellMatch = {
  txSignature: string | null;
  workflowId: string | null;
  scheduledFor: string;
  workflowName: string;
  scheduledAtMs: number;
};

/**
 * The cron writes the same run into `user_notifications`. Match by signature
 * first (unambiguous), then by scheduled time + workflow, then by a tight
 * workflow-name/time window as a last resort.
 */
function notificationMatchesRun(item: AppNotification, match: BellMatch) {
  if (item.source !== "server") return false;
  if (match.txSignature && item.txSignature === match.txSignature) return true;
  if (item.scheduledFor && item.scheduledFor === match.scheduledFor) {
    if (!match.workflowId || !item.workflowId || item.workflowId === match.workflowId) {
      return true;
    }
  }
  if (item.workflowName === match.workflowName) {
    const delta = Math.abs(item.createdAt - match.scheduledAtMs);
    if (Number.isFinite(delta) && delta <= 3 * 60 * 1000) return true;
  }
  return false;
}

/** The vault's 60s guard is a normal timing skip, not a failed workflow run. */
function isVaultMinIntervalSkip(log: RunLog) {
  const reason = String(log.reason || "");
  const error = String(log.error || "");
  return (
    reason === "vault_min_interval" ||
    (reason === "vault_execution_failed" && /minimum interval/i.test(error))
  );
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function formatTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function isWatchable(row: AutomationRow) {
  const signature = String(row.onchain_signature || "").trim();
  return (
    row.enabled &&
    row.automation_status === "active" &&
    row.schedule !== "manual" &&
    row.execution_mode !== "manual" &&
    signature !== "" &&
    signature !== "skip"
  );
}

/**
 * `failedStepIndex` is an index into `workflow.steps`, while the canvas also
 * contains the trigger as its first node. Stop the animation on the exact node
 * that blocked the chain instead of walking into the following Alert.
 */
function nodeIndexForFailedStep(
  nodes: ReturnType<typeof getFlowNodes>,
  failedStepIndex: number | null,
) {
  if (typeof failedStepIndex !== "number" || failedStepIndex < 0) return null;
  const firstStep = nodes.findIndex((node) => node.module.kind === "step");
  if (firstStep < 0) return null;
  const index = firstStep + failedStepIndex;
  return index >= 0 && index < nodes.length ? index : null;
}

function describeTrigger(triggerData: unknown) {
  if (!triggerData || typeof triggerData !== "object") return "";
  const data = triggerData as Record<string, unknown>;
  const asset = typeof data.asset === "string" ? data.asset : null;
  const price = typeof data.price === "number" ? data.price : null;
  if (asset && price !== null) return `${asset}: $${price.toFixed(2)}`;
  return "";
}

function shortAddress(value: string | undefined | null) {
  if (!value) return "";
  return value.length > 12 ? `${value.slice(0, 4)}…${value.slice(-4)}` : value;
}

/**
 * Financial runs are reported by what happened to the funds, not by the price
 * that fired the trigger. A run with no signature never moved money.
 */
function describeFinancialOutcome(logs: RunLog[], txSignature: string | null) {
  const transfer = logs.find((entry) => entry?.step === "send_transaction");

  if (transfer?.executed === true) {
    const amountSol =
      typeof transfer.amount_lamports === "number"
        ? transfer.amount_lamports / 1_000_000_000
        : Number(transfer.payload?.amount || 0);
    const destination = shortAddress(transfer.destination || transfer.payload?.to);
    return {
      status: "success" as const,
      label: `Transferencia de ${amountSol} SOL${destination ? ` a ${destination}` : ""}`,
      txSignature: transfer.signature || txSignature,
    };
  }

  if (transfer && isVaultMinIntervalSkip(transfer)) {
    return {
      status: "skipped" as const,
      label:
        "Transferencia omitida: la bóveda aún está dentro de su intervalo mínimo. " +
        "No se movieron fondos y se reintentará en el próximo ciclo.",
      txSignature: null,
    };
  }

  if (transfer?.executed === false || transfer?.reason === "vault_execution_failed") {
    const detail = String(
      transfer.note || transfer.error || "La transferencia de la bóveda falló",
    );
    return {
      status: "error" as const,
      label: `No se movieron fondos: ${detail}`,
      txSignature: null,
    };
  }

  if (transfer?.skipped) {
    const reason =
      transfer.reason === "vault_execution_disabled"
        ? "el ejecutor de la bóveda está pausado en el servidor"
        : transfer.reason === "owner_or_workflow_missing"
          ? "faltan datos de la bóveda para transferir"
          : transfer.reason === "vault_min_interval"
            ? "la bóveda aún está dentro de su intervalo mínimo; se reintentará en el próximo ciclo"
            : transfer.reason === "unsupported_asset"
              ? "el activo configurado no es compatible con la bóveda"
              : transfer.reason === "invalid_amount"
                ? "el monto configurado no es válido"
                : transfer.reason || "la transferencia fue omitida";
    return {
      status: "skipped" as const,
      label: `No se movieron fondos: ${reason}`,
      txSignature: null,
    };
  }

  return {
    status: "skipped" as const,
    label: "El workflow se evaluó; no se registró ninguna transferencia",
    txSignature: null,
  };
}

async function fetchAutomationRow(owner: string, workflowId: string) {
  const { data, error } = await supabase
    .from("workflows")
    .select(
      "id,workflow_id,name,cid,enabled,automation_status,schedule,execution_mode,onchain_signature,next_run_at,last_run_at,last_error,claimed_by,lease_until",
    )
    .eq("owner_wallet", owner)
    .eq("workflow_id", workflowId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as AutomationRow | null) ?? null;
}

async function fetchOutcome(
  rowId: string,
  scheduledFor: string,
  executionMode: string,
  isCancelled: () => boolean,
): Promise<Outcome | null> {
  const targetMs = new Date(scheduledFor).getTime();
  const deadline = Date.now() + RESULT_TIMEOUT_MS;

  while (!isCancelled() && Date.now() < deadline) {
    const { data: run } = await supabase
      .from("workflow_runs")
      .select("status,error,trigger_data,tx_signature,output")
      .eq("workflow_id", rowId)
      .eq("scheduled_for", scheduledFor)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (run) {
      const output = run.output && typeof run.output === "object"
        ? (run.output as { logs?: RunLog[]; failedStepIndex?: number | null })
        : {};
      const failedStepIndex =
        typeof output.failedStepIndex === "number" ? output.failedStepIndex : null;
      const detail = describeTrigger(run.trigger_data);
      const logs = Array.isArray(output.logs) ? output.logs : [];
      const txSignature = run.tx_signature ?? null;

      if (run.error || run.status === "failed") {
        return {
          status: "error",
          label: run.error || "La ejecución falló",
          failedStepIndex,
        };
      }

      if (isFinancialExecutionMode(executionMode)) {
        const financial = describeFinancialOutcome(logs, txSignature);
        return { ...financial, failedStepIndex };
      }

      if (run.status === "skipped") {
        return {
          status: "skipped",
          label: detail || "La condición del trigger no se cumplió",
          failedStepIndex,
        };
      }

      return {
        status: "success",
        label: detail || "Ejecución completada",
        txSignature,
        failedStepIndex,
      };
    }

    // `run-workflow` inserts the run before returning, but a hard failure can
    // skip that insert. `finish_workflow_run` always stamps `last_run_at`.
    const { data: fresh } = await supabase
      .from("workflows")
      .select("last_run_at,last_error")
      .eq("id", rowId)
      .maybeSingle();

    if (fresh?.last_run_at && new Date(fresh.last_run_at).getTime() >= targetMs - 1000) {
      if (fresh.last_error) {
        return { status: "error", label: fresh.last_error, failedStepIndex: null };
      }
      return isFinancialExecutionMode(executionMode)
        ? {
            status: "skipped",
            label: "El workflow se evaluó; no se registró ninguna transferencia",
            failedStepIndex: null,
          }
        : {
            status: "success",
            label: "Ejecución completada",
            txSignature: null,
            failedStepIndex: null,
          };
    }

    await sleep(1500);
  }

  return null;
}

async function animateNodes(
  isCancelled: () => boolean,
  stopIndex: number | null = null,
  quick = false,
) {
  const nodes = getFlowNodes();
  // A manual "Ejecutar" is already driving the canvas; do not fight it.
  if (nodes.length === 0 || getRunningNodeId()) return;

  const validStop = stopIndex !== null && stopIndex >= 0 && stopIndex < nodes.length;
  const last = validStop ? (stopIndex as number) : nodes.length - 1;
  const nodeMs = quick ? 350 : 650;
  const lineMs = quick ? 250 : 450;

  for (let i = 0; i <= last; i++) {
    if (isCancelled()) break;
    setRunningNodeId(nodes[i].id);
    setAnimatingLineIndex(-1);
    await sleep(nodeMs);

    if (i < last) {
      if (isCancelled()) break;
      setRunningNodeId(null);
      setAnimatingLineIndex(i);
      await sleep(lineMs);
    }
  }

  if (!isCancelled()) {
    setRunningNodeId(null);
    setAnimatingLineIndex(-1);
  }
}

function nextDelay(nextRunAt: string | null) {
  if (!nextRunAt) return IDLE_POLL_MS;
  const remaining = new Date(nextRunAt).getTime() - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) return DUE_POLL_MS;
  return Math.min(IDLE_POLL_MS, Math.max(DUE_POLL_MS, remaining - NEAR_DUE_MS + 2000));
}

const ScheduledExecutionWatcher: React.FC = () => {
  const { publicKey } = useWallet();
  const owner = publicKey ? publicKey.toBase58() : null;

  useEffect(() => {
    if (!owner) {
      setScheduledRunState({ status: "idle" });
      return;
    }

    let cancelled = false;
    let baseline: {
      rowId: string;
      target: string | null;
      lastRunAt: string | null;
    } | null = null;
    let pending: string | null = null;
    let queued: { target: string; toastId: string | number; since: number; timedOut: boolean } | null =
      null;
    const handoffCleanups = new Set<() => void>();

    const isCancelled = () => cancelled;

    const resetIdle = () => {
      if (getScheduledRunState().status !== "idle") {
        setScheduledRunState({ status: "idle" });
      }
    };

    const clearQueued = () => {
      if (queued) {
        toast.dismiss(queued.toastId);
        queued = null;
      }
    };

    /**
     * The bottom toast is the first, primary confirmation. Once the same run
     * shows up as a bell notification, the toast can step aside. Nothing is
     * deleted from the notification center - only the transient toast closes.
     */
    const handOffToastToBell = (
      toastId: string | number,
      shownAt: number,
      match: BellMatch,
    ) => {
      if (cancelled) return;

      const hasMatch = (items: AppNotification[]) =>
        items.some(
          (item) => item.source === "server" && notificationMatchesRun(item, match),
        );

      let unsubscribe: (() => void) | null = null;
      let watchTimeout: number | undefined;
      let dismissTimeout: number | undefined;
      let active = true;

      const cleanup = () => {
        active = false;
        unsubscribe?.();
        if (watchTimeout !== undefined) window.clearTimeout(watchTimeout);
        if (dismissTimeout !== undefined) window.clearTimeout(dismissTimeout);
        handoffCleanups.delete(cleanup);
      };

      handoffCleanups.add(cleanup);

      const onMatched = () => {
        if (!active || cancelled) return;
        unsubscribe?.();
        if (watchTimeout !== undefined) window.clearTimeout(watchTimeout);
        const remaining = Math.max(0, TOAST_MIN_VISIBLE_MS - (Date.now() - shownAt));
        const close = () => {
          if (!cancelled) toast.dismiss(toastId);
          cleanup();
        };
        if (remaining > 0) {
          dismissTimeout = window.setTimeout(close, remaining + 25);
        } else {
          close();
        }
      };

      if (hasMatch(getNotifications())) {
        onMatched();
        return;
      }

      // If the server never persisted a row, leave the toast as-is so the
      // user still has the explorer link instead of losing both confirmations.
      watchTimeout = window.setTimeout(cleanup, BELL_HANDOFF_TIMEOUT_MS);
      unsubscribe = subscribeNotifications((items) => {
        if (!active || cancelled) return;
        if (hasMatch(items)) onMatched();
      });
    };

    const runVisualExecution = async (row: AutomationRow, scheduledFor: string, quick: boolean) => {
      if (cancelled) return;
      setErrorNodeId(null);

      const toastId =
        queued && queued.target === scheduledFor
          ? queued.toastId
          : toast.loading(`Ejecutando "${row.name}"`, {
              description: `Ejecución programada on-chain · ${formatTime(scheduledFor)}`,
            });

      if (queued && queued.target === scheduledFor) queued = null;

      setScheduledRunState({
        status: "running",
        workflowName: row.name,
        scheduledFor,
        message: null,
      });

      // The server result is needed before animating so a failed or skipped
      // transfer can stop the canvas on that node instead of walking into the
      // Alert step (the cron already decided not to run it).
      const outcome = await fetchOutcome(
        row.id,
        scheduledFor,
        row.execution_mode,
        isCancelled,
      );
      if (cancelled) return;

      const stopIndex = outcome
        ? nodeIndexForFailedStep(getFlowNodes(), outcome.failedStepIndex)
        : null;
      await animateNodes(isCancelled, stopIndex, quick);
      if (cancelled) return;

      if (stopIndex !== null && outcome?.status === "error") {
        const nodes = getFlowNodes();
        if (nodes[stopIndex]) setErrorNodeId(nodes[stopIndex].id);
      }

      const toastShownAt = Date.now();
      let handoffMatch: BellMatch | null = null;

      if (!outcome) {
        resetIdle();
        toast.info(`"${row.name}" se ejecutó`, {
          id: toastId,
          description:
            "La ejecución no devolvió un resultado en 90 s. Revisa la actividad y las notificaciones.",
        });
      } else if (outcome.status === "error") {
        setScheduledRunState({
          status: "error",
          workflowName: row.name,
          scheduledFor,
          message: outcome.label,
        });
        toast.error(`"${row.name}" falló`, { id: toastId, description: outcome.label });
        setTimeout(() => {
          if (!cancelled && getScheduledRunState().status === "error") {
            setScheduledRunState({ status: "idle" });
          }
        }, 8000);
      } else {
        setScheduledRunState({
          status: "success",
          workflowName: row.name,
          scheduledFor,
          message: outcome.label,
        });
        const outcomeTitle =
          outcome.status === "skipped"
            ? `"${row.name}" evaluado`
            : `"${row.name}" ejecutado`;

        if (outcome.txSignature) {
          notifyTxSuccess(outcomeTitle, outcome.txSignature, {
            id: toastId,
            description: outcome.label,
          });
        } else {
          toast.success(outcomeTitle, { id: toastId, description: outcome.label });
        }

        handoffMatch = {
          txSignature: outcome.txSignature ?? null,
          workflowId: row.workflow_id,
          scheduledFor,
          workflowName: row.name,
          scheduledAtMs: new Date(scheduledFor).getTime(),
        };

        setTimeout(() => {
          if (!cancelled && getScheduledRunState().status === "success") {
            setScheduledRunState({ status: "idle" });
          }
        }, 8000);
      }

      // The cron stores the in-app notification for the run. Pull it now so the
      // bell updates together with the end of the node animation, exactly like
      // the manual "Ejecutar" flow. The bottom toast stays first and only
      // steps aside once that same entry is available in the bell.
      await refreshNotifications().catch(() => undefined);

      if (handoffMatch && !cancelled) {
        handOffToastToBell(toastId, toastShownAt, handoffMatch);
      }
    };

    const loop = async () => {
      while (!cancelled) {
        let delay = IDLE_POLL_MS;

        try {
          const row = await fetchAutomationRow(owner, getWorkflowId());

          if (!row || !isWatchable(row) || getFlowNodes().length === 0) {
            if (baseline) {
              clearQueued();
              baseline = null;
            }
            pending = null;
            resetIdle();
            delay = IDLE_POLL_MS;
          } else if (!baseline || baseline.rowId !== row.id) {
            baseline = {
              rowId: row.id,
              target: row.next_run_at,
              lastRunAt: row.last_run_at,
            };
            pending = null;
            clearQueued();
            resetIdle();
            delay = nextDelay(row.next_run_at);
          } else {
            const targetTime = baseline.target ? new Date(baseline.target).getTime() : null;
            const claimSeen =
              Boolean(row.claimed_by) ||
              Boolean(row.lease_until && new Date(row.lease_until).getTime() > Date.now());
            const runFinished = row.last_run_at !== baseline.lastRunAt;
            const targetAdvanced = row.next_run_at !== baseline.target;
            const runRecently =
              targetTime !== null && Date.now() - targetTime <= 2 * 60 * 1000;

            if (pending) {
              // Keep the baseline aligned with the run being visualized so a
              // finished run is not mistaken for a brand-new one.
              baseline.target = row.next_run_at;
              baseline.lastRunAt = row.last_run_at;
              delay = DUE_POLL_MS;
            } else if (targetTime !== null && (claimSeen || (runFinished && runRecently))) {
              const scheduledFor = baseline.target as string;

              baseline.target = row.next_run_at;
              baseline.lastRunAt = row.last_run_at;
              pending = scheduledFor;
              void runVisualExecution(row, scheduledFor, !claimSeen)
                .finally(() => {
                  pending = null;
                })
                .catch((error) => {
                  console.error("Scheduled execution visualization failed", error);
                });
              delay = DUE_POLL_MS;
            } else if (targetAdvanced) {
              baseline.target = row.next_run_at;
              baseline.lastRunAt = row.last_run_at;
              clearQueued();
              resetIdle();
              delay = nextDelay(row.next_run_at);
            } else if (targetTime !== null && Date.now() >= targetTime) {
              // The scheduled time arrived. The cron claims due rows every 30s,
              // so surface the queued state while waiting for that claim.
              if (!queued) {
                queued = {
                  target: baseline.target as string,
                  toastId: toast.loading(`Ejecución programada: "${row.name}"`, {
                    description: `Esperando al cron · ${formatTime(baseline.target)}`,
                  }),
                  since: Date.now(),
                  timedOut: false,
                };
                setScheduledRunState({
                  status: "queued",
                  workflowName: row.name,
                  scheduledFor: baseline.target,
                  message: "Esperando al cron",
                });
              } else if (!queued.timedOut && Date.now() - queued.since > CLAIM_TIMEOUT_MS) {
                queued.timedOut = true;
                toast.dismiss(queued.toastId);
                toast.info("El cron aún no reclamó esta ejecución", {
                  description:
                    "El workflow sigue activo. Verifica el estado del scheduler si el retraso continúa.",
                });
              }

              delay = DUE_POLL_MS;
            } else {
              delay = nextDelay(row.next_run_at);
            }
          }
        } catch (error) {
          console.error("Scheduled execution watcher failed", error);
          delay = IDLE_POLL_MS;
        }

        await sleep(delay);
      }
    };

    void loop();

    return () => {
      cancelled = true;
      handoffCleanups.forEach((cleanup) => cleanup());
      if (queued) toast.dismiss(queued.toastId);
      setScheduledRunState({ status: "idle" });
      setRunningNodeId(null);
      setAnimatingLineIndex(-1);
    };
  }, [owner]);

  return null;
};

export default ScheduledExecutionWatcher;
