import { supabase } from "@/integrations/supabase/client";
import { scheduleToSeconds } from "@/lib/schedule";

export type WorkflowAutomationRow = {
  id: string;
  workflow_id: string | null;
  cid: string | null;
  name: string;
  enabled: boolean;
  automation_status: string;
  schedule: string;
  execution_mode: string;
  onchain_signature: string | null;
};

export type AutomationIndex = Record<string, WorkflowAutomationRow>;

/** Legacy rows stored `"skip"` when they were only pinned to IPFS. */
export function isPublishedOnchain(
  row: Pick<WorkflowAutomationRow, "onchain_signature">,
): boolean {
  const signature = String(row.onchain_signature || "").trim();
  return signature !== "" && signature !== "skip";
}

export async function fetchAutomationRows(
  ownerWallet: string,
): Promise<WorkflowAutomationRow[]> {
  const { data, error } = await supabase
    .from("workflows")
    .select(
      "id,workflow_id,cid,name,enabled,automation_status,schedule,execution_mode,onchain_signature",
    )
    .eq("owner_wallet", ownerWallet);

  if (error) throw error;
  return ((data || []) as WorkflowAutomationRow[]).filter(isPublishedOnchain);
}

export function indexAutomation(rows: WorkflowAutomationRow[]): AutomationIndex {
  const map: AutomationIndex = {};
  rows.forEach((row) => {
    if (row.workflow_id) map[`wf:${row.workflow_id}`] = row;
    if (row.cid) map[`cid:${row.cid}`] = row;
  });
  return map;
}

export function findAutomation(
  map: AutomationIndex,
  workflowId?: string | null,
  cid?: string | null,
): WorkflowAutomationRow | null {
  if (workflowId && map[`wf:${workflowId}`]) return map[`wf:${workflowId}`];
  if (cid && map[`cid:${cid}`]) return map[`cid:${cid}`];
  return null;
}

export function updateAutomationIndex(
  map: AutomationIndex,
  updated: WorkflowAutomationRow,
): AutomationIndex {
  const next: AutomationIndex = { ...map };
  Object.keys(next).forEach((key) => {
    if (next[key].id === updated.id) next[key] = { ...next[key], ...updated };
  });
  return next;
}

export interface ActivationChange {
  row: WorkflowAutomationRow;
  ownerWallet: string;
  nextActive: boolean;
  schedule?: string;
}

/**
 * Enables or disables the cron for a workflow that is already published
 * on-chain. Activation is refused for manual schedules because there would be
 * no `next_run_at` to dispatch.
 */
export async function setAutomationActive({
  row,
  ownerWallet,
  nextActive,
  schedule,
}: ActivationChange): Promise<WorkflowAutomationRow> {
  const effectiveSchedule = schedule || row.schedule || "manual";
  const seconds = scheduleToSeconds(effectiveSchedule);

  if (nextActive && seconds <= 0) {
    throw new Error(
      "Selecciona una frecuencia distinta de manual en el editor para activar este workflow.",
    );
  }

  const now = new Date();
  const update = nextActive
    ? {
        enabled: true,
        automation_status: "active",
        next_run_at: new Date(
          now.getTime() + Math.max(seconds, 30) * 1000,
        ).toISOString(),
        failure_count: 0,
        last_error: null,
        lease_until: null,
        claimed_by: null,
        updated_at: now.toISOString(),
      }
    : {
        enabled: false,
        automation_status: "inactive",
        next_run_at: null,
        lease_until: null,
        claimed_by: null,
        updated_at: now.toISOString(),
      };

  const { error } = await supabase
    .from("workflows")
    .update(update)
    .eq("id", row.id)
    .eq("owner_wallet", ownerWallet);

  if (error) throw error;

  return {
    ...row,
    enabled: update.enabled,
    automation_status: update.automation_status,
  };
}
