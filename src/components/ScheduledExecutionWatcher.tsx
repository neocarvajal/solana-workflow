import { useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getFlowNodes,
  getRunningNodeId,
  getScheduledRunState,
  getWorkflowId,
  setAnimatingLineIndex,
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
  | { status: "success"; label: string; txSignature: string | null }
  | { status: "skipped"; label: string }
  | { status: "error"; label: string };

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

function describeTrigger(triggerData: unknown) {
  if (!triggerData || typeof triggerData !== "object") return "";
  const data = triggerData as Record<string, unknown>;
  const asset = typeof data.asset === "string" ? data.asset : null;
  const price = typeof data.price === "number" ? data.price : null;
  if (asset && price !== null) return `${asset}: $${price.toFixed(2)}`;
  return "";
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
  isCancelled: () => boolean,
): Promise<Outcome | null> {
  const targetMs = new Date(scheduledFor).getTime();
  const deadline = Date.now() + RESULT_TIMEOUT_MS;

  while (!isCancelled() && Date.now() < deadline) {
    const { data: run } = await supabase
      .from("workflow_runs")
      .select("status,error,trigger_data,tx_signature")
      .eq("workflow_id", rowId)
      .eq("scheduled_for", scheduledFor)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (run) {
      if (run.error || run.status === "failed") {
        return { status: "error", label: run.error || "La ejecución falló" };
      }

      const detail = describeTrigger(run.trigger_data);

      if (run.status === "skipped") {
        return { status: "skipped", label: detail || "La condición del trigger no se cumplió" };
      }

      return {
        status: "success",
        label: detail || "Ejecución completada",
        txSignature: run.tx_signature ?? null,
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
      if (fresh.last_error) return { status: "error", label: fresh.last_error };
      return { status: "success", label: "Ejecución completada", txSignature: null };
    }

    await sleep(1500);
  }

  return null;
}

async function animateNodes(isCancelled: () => boolean) {
  const nodes = getFlowNodes();
  // A manual "Ejecutar" is already driving the canvas; do not fight it.
  if (nodes.length === 0 || getRunningNodeId()) return;

  for (let i = 0; i < nodes.length; i++) {
    if (isCancelled()) break;
    setRunningNodeId(nodes[i].id);
    setAnimatingLineIndex(-1);
    await sleep(650);

    if (i < nodes.length - 1) {
      if (isCancelled()) break;
      setRunningNodeId(null);
      setAnimatingLineIndex(i);
      await sleep(450);
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

    const runVisualExecution = async (row: AutomationRow, scheduledFor: string, quick: boolean) => {
      if (cancelled) return;

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

      const animation = quick
        ? (async () => {
            if (getRunningNodeId()) return;
            const nodes = getFlowNodes();
            for (let i = 0; i < nodes.length; i++) {
              if (isCancelled()) return;
              setRunningNodeId(nodes[i].id);
              await sleep(350);
              if (i < nodes.length - 1) {
                setRunningNodeId(null);
                setAnimatingLineIndex(i);
                await sleep(250);
              }
            }
            if (!isCancelled()) {
              setRunningNodeId(null);
              setAnimatingLineIndex(-1);
            }
          })()
        : animateNodes(isCancelled);

      const outcome = await fetchOutcome(row.id, scheduledFor, isCancelled);
      await animation;

      if (cancelled) return;

      if (!outcome) {
        resetIdle();
        toast.info(`"${row.name}" se ejecutó`, {
          id: toastId,
          description:
            "La ejecución no devolvió un resultado en 90 s. Revisa la actividad y las notificaciones.",
        });
        return;
      }

      if (outcome.status === "error") {
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
        return;
      }

      setScheduledRunState({
        status: "success",
        workflowName: row.name,
        scheduledFor,
        message: outcome.label,
      });
      toast.success(
        outcome.status === "skipped"
          ? `"${row.name}" evaluado`
          : `"${row.name}" ejecutado`,
        { id: toastId, description: outcome.label },
      );
      setTimeout(() => {
        if (!cancelled && getScheduledRunState().status === "success") {
          setScheduledRunState({ status: "idle" });
        }
      }, 8000);
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
      if (queued) toast.dismiss(queued.toastId);
      setScheduledRunState({ status: "idle" });
      setRunningNodeId(null);
      setAnimatingLineIndex(-1);
    };
  }, [owner]);

  return null;
};

export default ScheduledExecutionWatcher;
