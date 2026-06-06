import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SYSTEM = `You translate natural language Solana automation requests into a strict JSON workflow.

Available triggers:
- price_monitor: { asset: string (e.g. "SOL","BONK"), condition: "above"|"below"|"crosses", value: number, interval?: "1m"|"5m"|"15m"|"1h" }
- schedule:      { cron?: string, every?: "15m"|"1h"|"1d" }
- webhook:       { path?: string }
- dexscreener_pair: { pairAddress: string, metric: "price"|"volume"|"liquidity", condition: "above"|"below", value: number }

Available steps (actions, executed in order):
- send_transaction: { to: string, amount: number, asset: string }
- send_alert:       { channel: "app"|"email", message: string }
- http_request:     { method: "GET"|"POST", url: string, body?: any }
- ai_decision:      { prompt: string }
- dexscreener_lookup: { pairAddress: string }

Always return a valid object via the tool. If the user request is vague, make reasonable defaults.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "prompt required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const tool = {
      type: "function",
      function: {
        name: "emit_workflow",
        description: "Emit the parsed Solana automation workflow",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            trigger: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["price_monitor","schedule","webhook","dexscreener_pair"] },
                params: { type: "object", additionalProperties: true },
              },
              required: ["type","params"],
              additionalProperties: false,
            },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["send_transaction","send_alert","http_request","ai_decision","dexscreener_lookup"] },
                  params: { type: "object", additionalProperties: true },
                },
                required: ["type","params"],
                additionalProperties: false,
              },
            },
          },
          required: ["name","trigger","steps"],
          additionalProperties: false,
        },
      },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "emit_workflow" } },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded, try later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (res.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await res.text();
      console.error("AI error", res.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await res.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : null;
    if (!args) throw new Error("No workflow returned");

    return new Response(JSON.stringify({ workflow: args }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
