import { supabase } from "@/integrations/supabase/client";
import { normalizeExecutionMode, scheduleToSeconds } from "@/lib/schedule";
import type { Workflow } from "@/lib/workflow";
import type { OnchainEntry } from "@/lib/solana";
import { rememberSavedWorkflow, type SavedWorkflow } from "@/lib/workflowStore";

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
  created_at?: string | null;
  updated_at?: string | null;
  json?: unknown;
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
  options: { includeUnpublished?: boolean } = {},
): Promise<WorkflowAutomationRow[]> {
  const { data, error } = await supabase
    .from("workflows")
    .select(
      "id,workflow_id,cid,name,enabled,automation_status,schedule,execution_mode,onchain_signature,created_at,updated_at,json",
    )
    .eq("owner_wallet", ownerWallet)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  const rows = (data || []) as WorkflowAutomationRow[];
  return options.includeUnpublished ? rows : rows.filter(isPublishedOnchain);
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

function rowTimestamp(row: WorkflowAutomationRow): number | null {
  const value = row.created_at || row.updated_at;
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

/**
 * Builds on-chain list entries from the workflow rows stored in Supabase so a
 * busy public RPC does not hide workflows the user already published.
 */
export function entriesFromAutomation(
  rows: WorkflowAutomationRow[],
): OnchainEntry[] {
  const entries: OnchainEntry[] = [];

  rows.forEach((row) => {
    if (!row.cid || !isPublishedOnchain(row)) return;
    const signature = String(row.onchain_signature || "").trim();
    const time = rowTimestamp(row);
    entries.push({
      signature,
      blockTime: time ? Math.floor(time / 1000) : null,
      payload: { v: 1, name: row.name, cid: row.cid },
    });
  });

  return entries;
}

/**
 * Merges the entries read from the chain with the ones recovered from
 * Supabase. A CID already seen on-chain keeps the chain signature, but
 * workflows missing from the chain response are still listed.
 */
export function mergeOnchainEntries(
  chainEntries: OnchainEntry[],
  rows: WorkflowAutomationRow[],
): OnchainEntry[] {
  const byCid = new Map<string, OnchainEntry>();

  entriesFromAutomation(rows).forEach((entry) => {
    byCid.set(entry.payload.cid, entry);
  });
  chainEntries.forEach((entry) => {
    byCid.set(entry.payload.cid, entry);
  });

  // Keep one card per workflow name, preferring the most recent publish.
  const byName = new Map<string, OnchainEntry>();
  byCid.forEach((entry) => {
    const previous = byName.get(entry.payload.name);
    if (!previous || (entry.blockTime ?? 0) > (previous.blockTime ?? 0)) {
      byName.set(entry.payload.name, entry);
    }
  });

  return Array.from(byName.values()).sort(
    (a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0),
  );
}

function parseWorkflowJson(json: unknown): Workflow | null {
  if (!json || typeof json !== "object") return null;
  const candidate = json as Partial<Workflow>;
  if (!candidate.trigger || typeof candidate.trigger !== "object") return null;
  if (!Array.isArray(candidate.steps)) return null;
  return candidate as Workflow;
}

/**
 * Restores locally missing "My Workflows" records from the published rows in
 * Supabase. Earlier app versions only kept these records in localStorage, so
 * clearing storage (or using another browser) hid workflows that were still
 * scheduled on-chain.
 */
export function backfillSavedWorkflows(
  rows: WorkflowAutomationRow[],
  ownerWallet: string,
): SavedWorkflow[] {
  if (typeof window === "undefined") return [];

  // One entry per workflow name, preferring the active row and then the most
  // recently updated one, so repeated publishes do not create duplicates.
  const byName = new Map<string, WorkflowAutomationRow>();
  rows.forEach((row) => {
    const current = byName.get(row.name);
    if (!current) {
      byName.set(row.name, row);
      return;
    }
    const score = (item: WorkflowAutomationRow) =>
      (item.enabled && item.automation_status === "active" ? 1 : 0) * 10_000_000_000_000 +
      (item.updated_at ? new Date(item.updated_at).getTime() : 0);
    if (score(row) > score(current)) byName.set(row.name, row);
  });

  const restored: SavedWorkflow[] = [];
  byName.forEach((row) => {
    const workflow = parseWorkflowJson(row.json);
    if (!workflow) return;

    const record = rememberSavedWorkflow({
      id: row.workflow_id ? `wf-${row.workflow_id}` : `wf-${row.id}`,
      name: row.name,
      workflow: {
        ...workflow,
        name: row.name,
        schedule: row.schedule || workflow.schedule,
        executionMode: normalizeExecutionMode(
          row.execution_mode || workflow.executionMode,
        ),
        workflowId: row.workflow_id || workflow.workflowId,
      },
      ownerWallet,
      cid: row.cid || undefined,
      workflowId: row.workflow_id || undefined,
      executionMode: normalizeExecutionMode(
        row.execution_mode || workflow.executionMode,
      ),
      created: rowTimestamp(row) || undefined,
    });
    restored.push(record);
  });

  return restored;
}
