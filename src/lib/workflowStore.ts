import type { Workflow, FlowNode, ModuleDef } from "./workflow";
import { nodesToWorkflow, workflowToNodes } from "./workflow";
import {
  DEFAULT_EXECUTION_MODE,
  normalizeExecutionMode,
  scheduleToSeconds,
  type ExecutionMode,
} from "./schedule";
import { supabase } from "@/integrations/supabase/client";

/* ── Workflow (derived from nodes) ─────────────────────────── */
type Listener = (wf: Workflow | null) => void;
let currentEditingId: string | null = null;
let current: Workflow | null = null;
let onchainMeta: { cid?: string; signature?: string; version?: number } = {};
const listeners = new Set<Listener>();

export function getWorkflow() { return current; }
export function getOnchainMeta() { return onchainMeta; }

export function getEditingId() { return currentEditingId; }
export function setEditingId(id: string | null) { currentEditingId = id; }

export function setWorkflow(wf: Workflow | null) {
  current = wf;
  listeners.forEach((l) => l(current));
}

export function setOnchainMeta(meta: typeof onchainMeta) {
  onchainMeta = meta;
}

export function subscribeWorkflow(l: Listener) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/* ── FlowNodes (canvas state) ─────────────────────────────── */
type NodesListener = (nodes: FlowNode[]) => void;
let flowNodes: FlowNode[] = [];
let scenarioName = "My Scenario";
const nodesListeners = new Set<NodesListener>();

export function getFlowNodes() { return flowNodes; }
export function getScenarioName() { return scenarioName; }

export function setScenarioName(name: string) {
  scenarioName = name;
  syncWorkflow();
}

export function setFlowNodes(nodes: FlowNode[]) {
  flowNodes = nodes;
  nodesListeners.forEach((l) => l(flowNodes));
  syncWorkflow();
}

export function subscribeNodes(l: NodesListener) {
  nodesListeners.add(l);
  return () => nodesListeners.delete(l);
}

function syncWorkflow() {
  const wf = nodesToWorkflow(scenarioName, flowNodes);
  setWorkflow(wf);
}

/* ── Settings (localStorage) ──────────────────────────────── */
const SETTINGS_KEY = "solflows_settings";
export interface AppSettings {
  recipientWallet: string;
  alertChannel: string;
  alertEmail: string;
  telegramChatId: string;
  discordWebhookUrl: string;
  whatsappPhone: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  recipientWallet: "",
  alertChannel: "app",
  alertEmail: "",
  telegramChatId: "",
  discordWebhookUrl: "",
  whatsappPhone: "",
};

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, ...s }));
}

/* ── Global execution frequency ───────────────────────────── */
const EXECUTION_FREQUENCY_KEY = "solflows_execution_frequency";
export type ExecutionFrequency =
  | "30s" | "1m" | "2m" | "5m" | "15m" | "30m" | "1h" | "6h" | "24h" | "manual";

const EXECUTION_FREQUENCIES: ExecutionFrequency[] = [
  "30s", "1m", "2m", "5m", "15m", "30m", "1h", "6h", "24h", "manual",
];
const DEFAULT_EXECUTION_FREQUENCY: ExecutionFrequency = "15m";

type FrequencyListener = (value: ExecutionFrequency) => void;
const frequencyListeners = new Set<FrequencyListener>();
let executionFrequency: ExecutionFrequency | null = null;

function normalizeExecutionFrequency(value: unknown): ExecutionFrequency {
  return EXECUTION_FREQUENCIES.includes(value as ExecutionFrequency)
    ? (value as ExecutionFrequency)
    : DEFAULT_EXECUTION_FREQUENCY;
}

export function getExecutionFrequency(): ExecutionFrequency {
  if (executionFrequency) return executionFrequency;
  try {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(EXECUTION_FREQUENCY_KEY);
      if (saved) {
        executionFrequency = normalizeExecutionFrequency(saved);
        return executionFrequency;
      }
    }
  } catch { }
  executionFrequency = DEFAULT_EXECUTION_FREQUENCY;
  return executionFrequency;
}

export function setExecutionFrequency(
  value: string,
  options: { sync?: boolean } = {},
) {
  const next = normalizeExecutionFrequency(value);
  executionFrequency = next;
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(EXECUTION_FREQUENCY_KEY, next);
    }
  } catch { }
  frequencyListeners.forEach((listener) => listener(next));
  if (options.sync !== false) syncWorkflow();
}

export function subscribeExecutionFrequency(listener: FrequencyListener) {
  frequencyListeners.add(listener);
  return () => frequencyListeners.delete(listener);
}

/* ── Automation mode ──────────────────────────────────────── */
const EXECUTION_MODE_KEY = "solflows_execution_mode";
type ExecutionModeListener = (value: ExecutionMode) => void;
const executionModeListeners = new Set<ExecutionModeListener>();
let executionMode: ExecutionMode | null = null;

export function getExecutionMode(): ExecutionMode {
  if (executionMode) return executionMode;
  try {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(EXECUTION_MODE_KEY);
      if (saved) {
        executionMode = normalizeExecutionMode(saved);
        return executionMode;
      }
    }
  } catch { }
  executionMode = DEFAULT_EXECUTION_MODE;
  return executionMode;
}

export function setExecutionMode(
  value: string,
  options: { sync?: boolean } = {},
) {
  const next = normalizeExecutionMode(value);
  executionMode = next;
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(EXECUTION_MODE_KEY, next);
    }
  } catch { }
  executionModeListeners.forEach((listener) => listener(next));
  if (options.sync !== false) syncWorkflow();
}

export function subscribeExecutionMode(listener: ExecutionModeListener) {
  executionModeListeners.add(listener);
  return () => executionModeListeners.delete(listener);
}

/* ── Stable workflow identifier ───────────────────────────── */
const WORKFLOW_ID_KEY = "solflows_workflow_id";
let currentWorkflowId: string | null = null;

export function getWorkflowId(): string {
  if (currentWorkflowId) return currentWorkflowId;
  try {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(WORKFLOW_ID_KEY);
      if (saved) {
        currentWorkflowId = saved;
        return saved;
      }
    }
  } catch { }
  currentWorkflowId = crypto.randomUUID();
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(WORKFLOW_ID_KEY, currentWorkflowId);
    }
  } catch { }
  return currentWorkflowId;
}

export function setWorkflowId(value: string | null | undefined) {
  currentWorkflowId = value?.trim() ? value : crypto.randomUUID();
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(WORKFLOW_ID_KEY, currentWorkflowId);
    }
  } catch { }
}

function withAutomationMeta(wf: Workflow): Workflow {
  const schedule = wf.schedule || getExecutionFrequency();
  return {
    ...wf,
    schedule,
    scheduleSeconds: wf.scheduleSeconds ?? scheduleToSeconds(schedule),
    executionMode: wf.executionMode || getExecutionMode(),
    workflowId: wf.workflowId || getWorkflowId(),
  };
}

/* ── Scale / Zoom State ──────────────────────── */
type ScaleListener = (scale: number) => void;
let canvasScale = 1;
const scaleListeners = new Set<ScaleListener>();

export function getCanvasScale() { return canvasScale; }
export function setCanvasScale(s: number) {
  canvasScale = Math.min(2, Math.max(0.3, s));
  scaleListeners.forEach((l) => l(canvasScale));
}
export function subscribeScale(l: ScaleListener) {
  scaleListeners.add(l);
  return () => scaleListeners.delete(l);
}

/* ── Simulation State ──────────────────────── */
type RunningNodeListener = (nodeId: string | null) => void;
let runningNodeId: string | null = null;
const runningNodeListeners = new Set<RunningNodeListener>();

export function getRunningNodeId() { return runningNodeId; }
export function setRunningNodeId(id: string | null) {
  runningNodeId = id;
  runningNodeListeners.forEach((l) => l(runningNodeId));
}
export function subscribeRunningNode(l: RunningNodeListener) {
  runningNodeListeners.add(l);
  return () => runningNodeListeners.delete(l);
}

type ErrorNodeListener = (nodeId: string | null) => void;
let errorNodeId: string | null = null;
const errorNodeListeners = new Set<ErrorNodeListener>();

export function getErrorNodeId() { return errorNodeId; }
export function setErrorNodeId(id: string | null) {
  errorNodeId = id;
  errorNodeListeners.forEach((l) => l(errorNodeId));
}
export function subscribeErrorNode(l: ErrorNodeListener) {
  errorNodeListeners.add(l);
  return () => errorNodeListeners.delete(l);
}

type AnimatingLineListener = (index: number) => void;
let animatingLineIndex: number = -1;
const animatingLineListeners = new Set<AnimatingLineListener>();

export function getAnimatingLineIndex() { return animatingLineIndex; }
export function setAnimatingLineIndex(index: number) {
  animatingLineIndex = index;
  animatingLineListeners.forEach((l) => l(animatingLineIndex));
}
export function subscribeAnimatingLine(l: AnimatingLineListener) {
  animatingLineListeners.add(l);
  return () => animatingLineListeners.delete(l);
}

/* ── Scheduled execution state ─────────────── */
export type ScheduledRunStatus = "idle" | "queued" | "running" | "success" | "error";

export interface ScheduledRunState {
  status: ScheduledRunStatus;
  workflowName?: string;
  scheduledFor?: string | null;
  message?: string | null;
  updatedAt?: number;
}

type ScheduledRunListener = (state: ScheduledRunState) => void;
let scheduledRunState: ScheduledRunState = { status: "idle" };
const scheduledRunListeners = new Set<ScheduledRunListener>();

export function getScheduledRunState() { return scheduledRunState; }
export function setScheduledRunState(state: ScheduledRunState) {
  scheduledRunState = { ...state, updatedAt: Date.now() };
  scheduledRunListeners.forEach((l) => l(scheduledRunState));
}
export function subscribeScheduledRun(l: ScheduledRunListener) {
  scheduledRunListeners.add(l);
  return () => scheduledRunListeners.delete(l);
}

export const normalizeParams = (module: ModuleDef, params: Record<string, any> = {}) => {
  return {
    ...(module.defaultParams || {}),
    ...(params || {})
  };
};

/* ── Saved workflows handling (Secure Integration) ────────── */
const SAVED_WORKFLOWS_KEY = "solflows_saved_workflows";

export interface SavedWorkflow {
  id: string;
  pinataId?: string;
  name: string;
  created: number;
  workflow: Workflow;
  ownerWallet: string;
  cid?: string;
  workflowId?: string;
  executionMode?: ExecutionMode;
}

export function getSavedWorkflows(walletAddress: string): SavedWorkflow[] {
  try {
    const raw = localStorage.getItem(SAVED_WORKFLOWS_KEY);
    const allWorkflows: SavedWorkflow[] = raw ? JSON.parse(raw) : [];
    // Filter by wallet
    const walletWorkflows = allWorkflows.filter((w) => w.ownerWallet === walletAddress);
    // Deduplicate: if there are both a CID and a local-only entry for the same workflow (by id), keep the one with cid.
    const deduped = walletWorkflows.reduce((acc: SavedWorkflow[], cur) => {
      const existing = acc.find(
        (item) =>
          item.id === cur.id ||
          (Boolean(item.pinataId) && item.pinataId === cur.pinataId),
      );
      if (!existing) {
        return acc.concat([cur]);
      }
      // Prefer entry with cid
      if (cur.cid && !existing.cid) {
        // replace existing with cur
        return acc.map(item => (item.id === existing.id && item.pinataId === existing.pinataId ? cur : item));
      }
      // otherwise keep existing
      return acc;
    }, []);
    return deduped;
  } catch { return []; }
}


/**
 * Upserts the local "My Workflows" record after a publish or an on-chain load.
 * It does not pin anything; the caller already has the CID from Pinata.
 */
export function rememberSavedWorkflow(input: {
  id?: string;
  pinataId?: string;
  name: string;
  workflow: Workflow;
  ownerWallet: string;
  cid?: string;
  workflowId?: string;
  executionMode?: ExecutionMode;
  created?: number;
}): SavedWorkflow {
  const raw = localStorage.getItem(SAVED_WORKFLOWS_KEY);
  const saved: SavedWorkflow[] = raw ? JSON.parse(raw) : [];
  const workflowId = input.workflowId || input.workflow.workflowId;

  let index = -1;
  if (input.id) {
    index = saved.findIndex((item) => item.id === input.id || item.pinataId === input.id);
  }
  if (index === -1 && input.pinataId) {
    index = saved.findIndex((item) => item.pinataId === input.pinataId);
  }
  if (index === -1 && workflowId) {
    index = saved.findIndex(
      (item) =>
        item.ownerWallet === input.ownerWallet &&
        (item.workflowId === workflowId || item.workflow?.workflowId === workflowId),
    );
  }
  if (index === -1 && input.cid) {
    index = saved.findIndex(
      (item) => item.ownerWallet === input.ownerWallet && item.cid === input.cid,
    );
  }

  const existing = index >= 0 ? saved[index] : undefined;
  const record: SavedWorkflow = {
    id: existing?.id || input.id || `wf-${Date.now()}`,
    pinataId: input.pinataId || existing?.pinataId,
    name: input.name,
    created: existing?.created || input.created || Date.now(),
    workflow: { ...input.workflow, workflowId },
    ownerWallet: input.ownerWallet,
    cid: input.cid || existing?.cid,
    workflowId,
    executionMode:
      input.executionMode || input.workflow.executionMode || existing?.executionMode,
  };

  if (index >= 0) saved[index] = record;
  else saved.push(record);
  localStorage.setItem(SAVED_WORKFLOWS_KEY, JSON.stringify(saved));
  return record;
}

export async function saveWorkflow(
  name: string,
  wf: Workflow,
  walletAddress: string,
  signature: string,
  existingPinataId?: string
) {
  try {
    const enrichedWorkflow = withAutomationMeta(wf);
    const workflowId = enrichedWorkflow.workflowId!;
    const schedule = enrichedWorkflow.schedule!;

    // Always pin the workflow via the 'pin-to-ipfs' function.
    const endpoint = 'pin-to-ipfs';
    const body = {
      json: enrichedWorkflow,
      name,
      owner_wallet: walletAddress,
      signature,
      schedule,
      workflow_id: workflowId,
      execution_mode: enrichedWorkflow.executionMode!,
      schedule_seconds: enrichedWorkflow.scheduleSeconds!,
    };

    // Attempt to pin to IPFS. If it fails, fallback to local-only storage.
    let result: any;
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(endpoint, { body });

      if (invokeError) {
        console.error('Supabase Function Error (pin-to-ipfs):', invokeError);
        throw new Error(`Cloud save failed: ${invokeError.message}`);
      }

      console.log('Cloud save response (pin-to-ipfs):', data);
      result = data; // { cid, id }
    } catch (pinErr) {
      console.error('Pinning to IPFS failed, falling back to local storage:', pinErr);
      // Save locally only
      const fallbackResult = { cid: undefined, id: undefined };
      const raw = localStorage.getItem(SAVED_WORKFLOWS_KEY);
      const saved: SavedWorkflow[] = raw ? JSON.parse(raw) : [];
      saved.push({
        id: `wf-${Date.now()}`,
        pinataId: undefined,
        name,
        created: Date.now(),
        workflow: enrichedWorkflow,
        ownerWallet: walletAddress,
        cid: undefined,
        workflowId,
        executionMode: enrichedWorkflow.executionMode,
      });
      localStorage.setItem(SAVED_WORKFLOWS_KEY, JSON.stringify(saved));
      return fallbackResult;
    }

    // If we had an old Pinata ID, clean up the previous IPFS asset.
    // Update local storage: replace existing entry if we have an old Pinata ID, otherwise add new.
    const raw = localStorage.getItem(SAVED_WORKFLOWS_KEY);
    const saved: SavedWorkflow[] = raw ? JSON.parse(raw) : [];

    if (existingPinataId) {
      const index = saved.findIndex(s => s.pinataId === existingPinataId || s.id === existingPinataId);
      if (index !== -1) {
        const oldPinataId = saved[index].pinataId;
        const oldCid = saved[index].cid;
        saved[index] = {
          ...saved[index],
          name,
          workflow: enrichedWorkflow,
          cid: result.cid,
          pinataId: result.id || saved[index].pinataId,
          workflowId,
          executionMode: enrichedWorkflow.executionMode,
        };
        if (oldPinataId && oldPinataId !== result.id) {
          supabase
            .functions.invoke('delete-ipfs-file', {
              body: { pinata_file_id: oldPinataId, cid: oldCid },
            })
            .catch(err => console.error('[Cleanup] Failed to delete old IPFS file:', err));
        }
      } else {
        // Fallback: treat as new workflow
        saved.push({
          id: `wf-${Date.now()}`,
          pinataId: result.id,
          name,
          created: Date.now(),
          workflow: enrichedWorkflow,
          ownerWallet: walletAddress,
          cid: result.cid,
          workflowId,
          executionMode: enrichedWorkflow.executionMode,
        });
      }
    } else {
      // New workflow (no previous Pinata ID)
      saved.push({
        id: `wf-${Date.now()}`,
        pinataId: result.id,
        name,
        created: Date.now(),
        workflow: enrichedWorkflow,
        ownerWallet: walletAddress,
        cid: result.cid,
        workflowId,
        executionMode: enrichedWorkflow.executionMode,
      });
    }

    localStorage.setItem(SAVED_WORKFLOWS_KEY, JSON.stringify(saved));

    return result;
  } catch (e) {
    console.error("Failed to save workflow securely", e);
    throw e;
  }
}

export function saveLocalOnly(name: string, wf: Workflow, walletAddress: string) {
  try {
    const raw = localStorage.getItem(SAVED_WORKFLOWS_KEY);
    const saved: SavedWorkflow[] = raw ? JSON.parse(raw) : [];
    const id = `wf-${Date.now()}`;
    const enrichedWorkflow = withAutomationMeta(wf);

    saved.push({
      id,
      name,
      created: Date.now(),
      workflow: enrichedWorkflow,
      ownerWallet: walletAddress,
      cid: undefined,
      workflowId: enrichedWorkflow.workflowId,
      executionMode: enrichedWorkflow.executionMode,
    });
    localStorage.setItem(SAVED_WORKFLOWS_KEY, JSON.stringify(saved));
  } catch (e) {
    console.error("Failed to save workflow locally", e);
    throw e;
  }
}

export async function updateWorkflow(
  id: string,          // -> editingId
  name: string,        // -> wf.name
  updatedData: any,    // -> wf
  walletAddress: string, // -> walletAddress
  signature: string
) {
  const SAVED_WORKFLOWS_KEY = "solflows_saved_workflows";

  // Extraemos el JSON limpio del workflow sin capas intermedias
  const cleanWorkflowJson = withAutomationMeta(
    updatedData.workflow ? updatedData.workflow : updatedData,
  );

  // 1. Recuperamos el registro actual del LocalStorage para capturar los IDs viejos antes de sobreescribirlos
  const raw = localStorage.getItem(SAVED_WORKFLOWS_KEY);
  const saved = raw ? JSON.parse(raw) : [];
  const existingIndex = saved.findIndex((w: any) => w.id === id || w.pinataId === id);

  // Capture existing Pinata file ID and CID before overwriting
  const oldPinataId = saved[existingIndex]?.pinataId;
  const oldCid = saved[existingIndex]?.cid;
  console.log(`[updateWorkflow] Updating ID: ${id}, Old PinataId: ${oldPinataId}, Old CID: ${oldCid}`);

  // 2. PIN: Subimos el nuevo archivo usando la función que maneja actualización si existe Pinata ID
  // Si existe oldPinataId, la Edge Function 'update-ipfs-file' borrará la versión anterior
  const result = await saveWorkflow(
    name,
    cleanWorkflowJson,
    walletAddress,
    signature,
    oldPinataId
  );

  if (!result || !result.cid) {
    throw new Error("Failed to pin the new workflow version to IPFS");
  }

  // 3. LOCALSTORAGE: Actualizamos el registro local reemplazando los hashes con los datos nuevos de la nube
  const updatedRecord = {
    id: id, // Mantenemos tu ID local/base de datos original para no romper el estado de la UI
    name: name,
    created: saved[existingIndex]?.created || Date.now(),
    ownerWallet: walletAddress,
    workflow: cleanWorkflowJson,
    cid: result.cid,
    pinataId: result.id || result.pinataId,
    workflowId: cleanWorkflowJson.workflowId,
    executionMode: cleanWorkflowJson.executionMode,
  };

  // (No longer needed) oldPinataId was captured earlier for cleanup.

  if (existingIndex > -1) {
    saved[existingIndex] = updatedRecord;
  } else {
    saved.push(updatedRecord);
  }

  // Reload UI nodes to reflect the updated workflow
  try {
    const freshNodes = workflowToNodes(cleanWorkflowJson);
    setFlowNodes(freshNodes);
  } catch (e) {
    console.error('[updateWorkflow] Failed to reload nodes after IPFS update:', e);
  }
  localStorage.setItem(SAVED_WORKFLOWS_KEY, JSON.stringify(saved));

  // Clean up any stale local‑only entries for the same workflow (same name & wallet) that lack a CID
  const cleaned = saved.filter(item => {
    // Keep the updated record (by id) and any entries that have a CID
    if (item.id === id) return true;
    if (item.cid) return true;
    // Remove entries with same name & wallet but no CID (old fallback)
    if (item.name === name && item.ownerWallet === walletAddress && !item.cid) return false;
    return true;
  });
  localStorage.setItem(SAVED_WORKFLOWS_KEY, JSON.stringify(cleaned));

  // Return the updated record
  return updatedRecord;
}


export async function deleteWorkflow(id: string, pinataFileId?: string, cid?: string) {
  try {
    // 1. SI EXISTE EL ID DE PINATA O EL CID, LE AVISAMOS A LA EDGE FUNCTION
    if (pinataFileId || cid) {
      console.log(`[FRONTEND] Solicitando borrado en IPFS para file_id: ${pinataFileId} y cid: ${cid}`);

      const { data: result, error } = await supabase.functions.invoke("delete-ipfs-file", {
        body: {
          pinata_file_id: pinataFileId,
          cid: cid,
        },
      });

      if (error) {
        console.error("[FRONTEND] La Edge Function rechazó el borrado en IPFS:", error.message);
      } else {
        console.log("[FRONTEND] ¡Archivo eliminado con éxito de IPFS/Pinata!", result);
      }
    } else {
      console.warn("[FRONTEND] No se detectaron credenciales de IPFS, se borrará solo localmente.");
    }

    const raw = localStorage.getItem(SAVED_WORKFLOWS_KEY);
    const saved: SavedWorkflow[] = raw ? JSON.parse(raw) : [];
    const filtered = saved.filter((w) => w.id !== id);
    localStorage.setItem(SAVED_WORKFLOWS_KEY, JSON.stringify(filtered));
    console.log("[FRONTEND] Workflow eliminado del LocalStorage.");

  } catch (e) {
    console.error("Failed to execute complete deletion workflow", e);
  }
}