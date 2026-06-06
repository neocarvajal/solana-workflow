import type { Workflow, FlowNode } from "./workflow";
import { nodesToWorkflow } from "./workflow";

/* ── Workflow (derived from nodes) ─────────────────────────── */
type Listener = (wf: Workflow | null) => void;
let current: Workflow | null = null;
let onchainMeta: { cid?: string; signature?: string; version?: number } = {};
const listeners = new Set<Listener>();

export function getWorkflow() { return current; }
export function getOnchainMeta() { return onchainMeta; }

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

/** Keep the Workflow object in sync with the canvas nodes */
function syncWorkflow() {
  const wf = nodesToWorkflow(scenarioName, flowNodes);
  setWorkflow(wf);
}

/* ── Settings (localStorage) ──────────────────────────────── */
const SETTINGS_KEY = "solflows_settings";

export interface AppSettings {
  recipientWallet: string;
  alertChannel: string;
}

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
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

// ----- Saved workflows handling -----
const SAVED_WORKFLOWS_KEY = "solflows_saved_workflows";

export interface SavedWorkflow {
  id: string;
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
    return allWorkflows.filter((w) => w.ownerWallet === walletAddress);
  } catch {
    return [];
  }
}

export function saveWorkflow(name: string, wf: Workflow, walletAddress: string, cid?: string) {
  try {
    const raw = localStorage.getItem(SAVED_WORKFLOWS_KEY);
    const saved: SavedWorkflow[] = raw ? JSON.parse(raw) : [];
    const id = `wf-${Date.now()}`;
    saved.push({ id, name, created: Date.now(), workflow: wf, ownerWallet: walletAddress, cid });
    localStorage.setItem(SAVED_WORKFLOWS_KEY, JSON.stringify(saved));
  } catch (e) {
    console.error("Failed to save workflow locally", e);
  }
}

export function deleteWorkflow(id: string) {
  try {
    const raw = localStorage.getItem(SAVED_WORKFLOWS_KEY);
    const saved: SavedWorkflow[] = raw ? JSON.parse(raw) : [];
    const filtered = saved.filter((w) => w.id !== id);
    localStorage.setItem(SAVED_WORKFLOWS_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error("Failed to delete workflow locally", e);
  }
}

// Ensure file ends with a newline
