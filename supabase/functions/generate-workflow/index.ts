import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SYSTEM = `You translate natural language Solana automation requests into a strict JSON workflow.
You MUST output a valid JSON object matching this schema:
{
  "name": "string",
  "trigger": {
    "type": "price_monitor" | "schedule" | "webhook" | "dexscreener_pair",
    "params": {
      "asset": "string (e.g. USDC)",
      "condition": "above" | "below" | "crosses",
      "value": "number",
      "interval": "1m" | "5m" | "15m" | "1h",
      "cron": "string",
      "every": "15m" | "1h" | "1d",
      "path": "string",
      "pairAddress": "string",
      "metric": "price" | "volume" | "liquidity"
    }
  },
  "steps": [
    {
      "type": "send_transaction" | "send_alert" | "http_request" | "ai_decision" | "dexscreener_lookup" | "swap",
      "params": {
        "fromAsset": "string",
        "toAsset": "string",
        "slippage": "number",
        "to": "string", "channel": "string", "message": "string", "url": "string", "pairAddress": "string",
        "amount": "number",
        "asset": "string",
        "channel": "app" | "email",
        "message": "string",
        "method": "GET" | "POST",
        "url": "string",
        "body": "object",
        "prompt": "string",
        "pairAddress": "string"
      }
    }
  ]
}
If a field is not applicable, omit it. Ensure all values are correctly typed (numbers as numbers, not strings).
Always return a valid JSON object. If the request is vague, make reasonable defaults. Do not include any conversational text.`;

async function callGroq(prompt: string, apiKey: string) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
      temperature: 0,
      response_format: { type: "json_object" }
    }),
  });
  if (!res.ok) throw new Error("Groq failed");
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

async function callGemini(prompt: string, apiKey: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${SYSTEM}\n\nRequest: ${prompt}` }] }],
      generationConfig: { response_mime_type: "application/json" }
    }),
  });
  if (!res.ok) throw new Error("Gemini failed");
  const data = await res.json();
  return JSON.parse(data.candidates[0].content.parts[0].text);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { prompt } = await req.json();
    const GROQ_KEY = Deno.env.get("GROQ_API_KEY");
    const GEMINI_KEY = Deno.env.get("GOOGLE_API_KEY");

    let workflow;
    try {
      if (GROQ_KEY) workflow = await callGroq(prompt, GROQ_KEY);
    } catch (e) {
      if (GEMINI_KEY) workflow = await callGemini(prompt, GEMINI_KEY);
    }

    if (!workflow) throw new Error("Could not generate workflow with available AI providers.");

    return new Response(JSON.stringify({ workflow }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});