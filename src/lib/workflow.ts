import {
  Activity, Bell, Braces, Clock, Globe, LineChart, Send,
  Sparkles, Webhook, ArrowLeftRight, type LucideIcon,
} from "lucide-react";

import { getSettings } from "@/lib/workflowStore";

export type TriggerType = "price_monitor" | "schedule" | "webhook" | "dexscreener_pair";
export type StepType =
  | "send_transaction" | "send_alert" | "http_request"
  | "ai_decision" | "dexscreener_lookup" | "swap";

export interface Workflow {
  name: string;
  trigger: { type: TriggerType; params: Record<string, any> };
  steps: { type: StepType; params: Record<string, any> }[];
}

export interface ModuleDef {
  type: TriggerType | StepType;
  kind: "trigger" | "step";
  name: string;
  description?: string;
  color: string;
  icon: LucideIcon;
  defaultParams: Record<string, any>;
}

export const TRIGGER_MODULES: ModuleDef[] = [
  {
    type: "price_monitor", kind: "trigger", name: "Price Monitor", description: "Triggers on token price", color: "#14F195", icon: LineChart,
    defaultParams: { asset: "SOL", condition: "below", value: 80, interval: "1m" }
  },
  {
    type: "dexscreener_pair", kind: "trigger", name: "DexScreener Pair", description: "Watch a pair", color: "#FF6B6B", icon: Activity,
    defaultParams: { pairAddress: "", metric: "price", condition: "above", value: 0 }
  },
  {
    type: "schedule", kind: "trigger", name: "Schedule", description: "Run periodically", color: "#FFB020", icon: Clock,
    defaultParams: { every: "15m" }
  },
  {
    type: "webhook", kind: "trigger", name: "Webhook In", description: "HTTP entry point", color: "#D85A6A", icon: Webhook,
    defaultParams: { path: "/incoming" }
  },
];

export const STEP_MODULES: ModuleDef[] = [
  {
    type: "send_transaction", kind: "step", name: "Wallet Transfer", description: "Send SOL / SPL", color: "#9945FF", icon: Send,
    defaultParams: { to: "", amount: 1, asset: "USDC" }
  },
  {
    type: "send_alert", kind: "step", name: "Alert", description: "Notify user", color: "#F59E0B", icon: Bell,
    defaultParams: { channel: "app", message: "Trigger fired!" }
  },
  {
    type: "swap", kind: "step", name: "Jupiter Swap", description: "Token swap", color: "#22D3EE", icon: ArrowLeftRight,
    defaultParams: { from: "SOL", to: "USDC", amount: 1 }
  },
  {
    type: "http_request", kind: "step", name: "HTTP Request", description: "Call an API", color: "#2196F3", icon: Globe,
    defaultParams: { method: "POST", url: "", body: {} }
  },
  {
    type: "ai_decision", kind: "step", name: "AI Agent", description: "LLM reasoning", color: "#10A37F", icon: Sparkles,
    defaultParams: { prompt: "Analyze the data and decide next action." }
  },
  {
    type: "dexscreener_lookup", kind: "step", name: "DexScreener Lookup", description: "Fetch pair data", color: "#FF6B6B", icon: Braces,
    defaultParams: { pairAddress: "" }
  },
];

export const ALL_MODULES = [...TRIGGER_MODULES, ...STEP_MODULES];

export function moduleFor(type: string): ModuleDef | undefined {
  return ALL_MODULES.find((m) => m.type === type);
}

export interface FlowNode {
  id: string;
  module: ModuleDef;
  params: Record<string, any>;
  x: number;
  y: number;
}

const NODE_SPACING_X = 220;
const START_X = 200;
const START_Y = 300;

export function workflowToNodes(wf: Workflow): FlowNode[] {
  console.log('[workflowToNodes] Received workflow:', JSON.stringify(wf, null, 2));
  const nodes: FlowNode[] = [];

  let idx = 0;

  const settings = getSettings();
  const globalWallet = settings?.recipientWallet || "";

  const normalize = (module: ModuleDef, params: any) => {
    const defaults = module.defaultParams || {};
    const allowedKeys = Object.keys(defaults);

    const cleanParams: any = { ...defaults };

    if (params) {
      allowedKeys.forEach(key => {
        if (params[key] !== undefined) {
          cleanParams[key] = params[key];
        }
      });
    }

    if (params?.fromAsset && !cleanParams.asset) {
      cleanParams.asset = params.fromAsset;
    }

    if (module.type === "send_transaction") {
      if (globalWallet) {
        cleanParams.to = globalWallet;
      } else {
        cleanParams.to = "";
      }
    }

    return cleanParams;
  };

  const t = moduleFor(wf.trigger.type);

  if (t) {
    const pos = wf.trigger.params?._pos;
    console.log('[workflowToNodes] Added Trigger node', {
      id: `n-${Date.now()}-trig`,
      type: t.type,
      params: normalize(t, wf.trigger.params)
    });
    nodes.push({
      id: `n-${Date.now()}-trig`,
      module: t,
      params: normalize(t, wf.trigger.params),
      x: pos?.x ?? START_X + idx * NODE_SPACING_X,
      y: pos?.y ?? START_Y,
    });
    idx++;
  }
  wf.steps.forEach((s, i) => {
    const m = moduleFor(s.type);
    if (m) {
      const pos = s.params?._pos;
      nodes.push({
        id: `n-${Date.now()}-${i}`,
        module: m,
        params: normalize(m, s.params),
        x: pos?.x ?? START_X + idx * NODE_SPACING_X,
        y: pos?.y ?? START_Y,
      });
      console.log('[workflowToNodes] Added Step node', {
        id: `n-${Date.now()}-${i}`,
        type: m.type,
        params: normalize(m, s.params)
      });
      idx++;
    }
  });
  return nodes;
}

export function nodesToWorkflow(name: string, nodes: FlowNode[]): Workflow | null {
  if (nodes.length === 0) return null;
  const [first, ...rest] = nodes;
  if (first.module.kind !== "trigger") return null;
  return {
    name,
    trigger: {
      type: first.module.type as TriggerType,
      params: { ...first.params, _pos: { x: first.x, y: first.y } },
    },
    steps: rest.map((n) => ({
      type: n.module.type as StepType,
      params: { ...n.params, _pos: { x: n.x, y: n.y } },
    })),
  };
}

const KEY = "solflows_device_id";
export function getDeviceId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
