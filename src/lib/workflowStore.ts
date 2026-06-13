import type { Workflow, FlowNode, ModuleDef } from "./workflow";
import { nodesToWorkflow, workflowToNodes } from "./workflow";
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
export interface AppSettings { recipientWallet: string; alertChannel: string; }

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { }
  return { recipientWallet: "", alertChannel: "app" };
}

export function saveSettings(s: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
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
}

export function getSavedWorkflows(walletAddress: string): SavedWorkflow[] {
  try {
    const raw = localStorage.getItem(SAVED_WORKFLOWS_KEY);
    const allWorkflows: SavedWorkflow[] = raw ? JSON.parse(raw) : [];
    // Filter by wallet
    const walletWorkflows = allWorkflows.filter((w) => w.ownerWallet === walletAddress);
    // Deduplicate: if there are both a CID and a local-only entry for the same workflow (by id), keep the one with cid.
    const deduped = walletWorkflows.reduce((acc: SavedWorkflow[], cur) => {
      const existing = acc.find(item => item.id === cur.id || item.pinataId === cur.pinataId);
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


export async function saveWorkflow(
  name: string,
  wf: Workflow,
  walletAddress: string,
  signature: string,
  existingPinataId?: string
) {
  try {

    // Always pin the workflow via the 'pin-to-ipfs' function.
    const endpoint = 'pin-to-ipfs';
    const body = {
      json: wf,
      name,
      owner_wallet: walletAddress,
      signature,
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
        workflow: wf,
        ownerWallet: walletAddress,
        cid: undefined,
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
          workflow: wf,
          cid: result.cid,
          pinataId: result.id || saved[index].pinataId,
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
          workflow: wf,
          ownerWallet: walletAddress,
          cid: result.cid,
        });
      }
    } else {
      // New workflow (no previous Pinata ID)
      saved.push({
        id: `wf-${Date.now()}`,
        pinataId: result.id,
        name,
        created: Date.now(),
        workflow: wf,
        ownerWallet: walletAddress,
        cid: result.cid,
      });
    }

    localStorage.setItem(SAVED_WORKFLOWS_KEY, JSON.stringify(saved));

    return result;
  } catch (e) {
    console.error("Failed to save workflow securely", e);
    throw e;
  }
}

// List IPFS files via Pinata (public list endpoint)
export async function listIpfsFiles(): Promise<any[]> {
  const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT;
  if (!PINATA_JWT) throw new Error('Missing PINATA_JWT env');
  const response = await fetch('https://api.pinata.cloud/data/pinList', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Pinata list failed ${response.status}: ${err}`);
  }
  const data = await response.json();
  return data?.rows || [];
}

export function saveLocalOnly(name: string, wf: Workflow, walletAddress: string) {
  try {
    const raw = localStorage.getItem(SAVED_WORKFLOWS_KEY);
    const saved: SavedWorkflow[] = raw ? JSON.parse(raw) : [];
    const id = `wf-${Date.now()}`;

    saved.push({ id, name, created: Date.now(), workflow: wf, ownerWallet: walletAddress, cid: undefined });
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
  walletAddress: string // -> walletAddress
) {
  const SAVED_WORKFLOWS_KEY = "solflows_saved_workflows";

  // Extraemos el JSON limpio del workflow sin capas intermedias
  const cleanWorkflowJson = updatedData.workflow ? updatedData.workflow : updatedData;

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
    "skip",
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
    pinataId: result.id || result.pinataId
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

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-ipfs-file`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        },

        body: JSON.stringify({
          pinata_file_id: pinataFileId,
          cid: cid
        })
      });

      const result = response.status !== 204 ? await response.json().catch(() => ({})) : {};

      if (!response.ok) {
        console.error("[FRONTEND] La Edge Function rechazó el borrado en IPFS:", result.error || response.statusText);
      } else {
        console.log("[FRONTEND] ¡Archivo eliminado con éxito de IPFS/Pinata!");
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