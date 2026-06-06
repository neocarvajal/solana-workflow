import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const COIN_IDS: Record<string, string> = {
  SOL: "solana", BONK: "bonk", JUP: "jupiter-exchange-solana", WIF: "dogwifcoin", USDC: "usd-coin",
};

async function getPrice(asset: string): Promise<number | null> {
  const id = COIN_IDS[asset.toUpperCase()] || asset.toLowerCase();
  const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
  if (!r.ok) return null;
  const json = await r.json();
  return json[id]?.usd ?? null;
}

async function getDexPair(addr: string) {
  const r = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${addr}`);
  if (!r.ok) return null;
  return await r.json();
}

type Step = { type: string; params: Record<string, any> };
type Workflow = {
  name: string;
  trigger: { type: string; params: Record<string, any> };
  steps: Step[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const workflow: Workflow = body.workflow;
    const workflowId: string | undefined = body.workflowId;

    if (!workflow) {
      return new Response(JSON.stringify({ error: "workflow required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const logs: any[] = [];
    let triggered = false;
    let triggerData: any = {};

    const t = workflow.trigger;
    if (t.type === "price_monitor") {
      const price = await getPrice(t.params.asset || "SOL");
      triggerData = { asset: t.params.asset, price };
      logs.push({ step: "trigger", type: t.type, price });
      if (price !== null) {
        const cond = t.params.condition;
        const v = Number(t.params.value);
        triggered = cond === "above" ? price > v : cond === "below" ? price < v : Math.abs(price - v) < v * 0.01;
      }
    } else if (t.type === "dexscreener_pair") {
      const data = await getDexPair(t.params.pairAddress);
      triggerData = { pair: data?.pairs?.[0] };
      const pair = data?.pairs?.[0];
      const metric = t.params.metric || "price";
      const val = metric === "price" ? Number(pair?.priceUsd)
        : metric === "volume" ? Number(pair?.volume?.h24)
        : Number(pair?.liquidity?.usd);
      logs.push({ step: "trigger", type: t.type, metric, val });
      if (!isNaN(val)) {
        triggered = t.params.condition === "above" ? val > t.params.value : val < t.params.value;
      }
    } else {
      // schedule / webhook → assume triggered when invoked manually
      triggered = true;
      triggerData = { manual: true };
    }

    if (!triggered) {
      logs.push({ result: "condition_not_met" });
    } else {
      for (const step of workflow.steps) {
        try {
          if (step.type === "send_transaction") {
            logs.push({
              step: "send_transaction",
              simulated: true,
              payload: { to: step.params.to, amount: step.params.amount, asset: step.params.asset || "SOL" },
              note: "Transaction simulated — wallet signing pending integration.",
            });
          } else if (step.type === "send_alert") {
            logs.push({ step: "send_alert", channel: step.params.channel || "app", message: step.params.message });
          } else if (step.type === "http_request") {
            const r = await fetch(step.params.url, {
              method: step.params.method || "GET",
              body: step.params.body ? JSON.stringify(step.params.body) : undefined,
              headers: step.params.body ? { "Content-Type": "application/json" } : undefined,
            });
            logs.push({ step: "http_request", status: r.status });
          } else if (step.type === "dexscreener_lookup") {
            const data = await getDexPair(step.params.pairAddress);
            logs.push({ step: "dexscreener_lookup", pair: data?.pairs?.[0]?.baseToken });
          } else if (step.type === "ai_decision") {
            logs.push({ step: "ai_decision", prompt: step.params.prompt, note: "Stub — wire to AI gateway." });
          } else {
            logs.push({ step: step.type, skipped: true });
          }
        } catch (e) {
          logs.push({ step: step.type, error: String(e) });
        }
      }
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (workflowId && SUPABASE_URL && SERVICE_KEY) {
      const sb = createClient(SUPABASE_URL, SERVICE_KEY);
      await sb.from("workflow_runs").insert({
        workflow_id: workflowId,
        status: triggered ? "executed" : "skipped",
        trigger_data: triggerData,
        output: { logs },
      });
    }

    return new Response(JSON.stringify({ triggered, triggerData, logs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
