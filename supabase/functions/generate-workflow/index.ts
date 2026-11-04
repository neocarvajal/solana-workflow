import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SYSTEM = `You translate natural language Solana automation requests into a strict JSON workflow.

[STRICT RULES]
- NEVER use placeholder values like "tu_recipient"
- If recipientWallet is empty, set "to" field as an empty string ""
- Do not invent wallet addresses
- alertChannel default only if provided
If recipientWallet is empty, set "to" field as ""

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
        "to": "string",
        "amount": "number",
        "asset": "string",
        "channel": "app" | "telegram" | "discord" | "email" | "whatsapp",
        "title": "string",
        "message": "string",
        "email": "string",
        "chatId": "string",
        "webhookUrl": "string",
        "phone": "string",
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

// Modelos vigentes. Se prueban en orden hasta que uno responda.
const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "meta-llama/llama-4-scout-17b-16e-instruct",
];

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash-lite",
];

const TIMEOUT_MS = 25_000;

function parseJsonContent(content: string): unknown {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;

  return JSON.parse(candidate);
}

async function callGroq(prompt: string, apiKey: string) {
  const errors: string[] = [];

  for (const model of GROQ_MODELS) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: prompt },
          ],
          temperature: 0,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      const text = await res.text();

      if (!res.ok) {
        errors.push(`${model}: HTTP ${res.status} ${text.slice(0, 140)}`);
        continue;
      }

      const data = JSON.parse(text);
      const content = data?.choices?.[0]?.message?.content;

      if (!content) {
        errors.push(`${model}: respuesta vacía`);
        continue;
      }

      return parseJsonContent(content);
    } catch (e) {
      errors.push(`${model}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  throw new Error(`Groq falló (${errors.join(" | ")})`);
}

async function callGemini(prompt: string, apiKey: string) {
  const errors: string[] = [];

  for (const model of GEMINI_MODELS) {
    try {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${SYSTEM}\n\nRequest: ${prompt}` }] }],
          generationConfig: { response_mime_type: "application/json" },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      const text = await res.text();

      if (!res.ok) {
        errors.push(`${model}: HTTP ${res.status} ${text.slice(0, 140)}`);
        continue;
      }

      const data = JSON.parse(text);
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        errors.push(`${model}: respuesta vacía`);
        continue;
      }

      return parseJsonContent(content);
    } catch (e) {
      errors.push(`${model}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  throw new Error(`Gemini falló (${errors.join(" | ")})`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();

    if (typeof prompt !== "string" || prompt.trim() === "") {
      return new Response(JSON.stringify({ error: "El prompt es obligatorio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GROQ_KEY = Deno.env.get("GROQ_API_KEY");
    const GEMINI_KEY = Deno.env.get("GOOGLE_API_KEY");

    if (!GROQ_KEY && !GEMINI_KEY) {
      return new Response(
        JSON.stringify({ error: "No hay proveedor de IA configurado" }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const attempts: string[] = [];
    let workflow: unknown = null;

    if (GROQ_KEY) {
      try {
        workflow = await callGroq(prompt, GROQ_KEY);
      } catch (e) {
        attempts.push(e instanceof Error ? e.message : String(e));
      }
    }

    if (!workflow && GEMINI_KEY) {
      try {
        workflow = await callGemini(prompt, GEMINI_KEY);
      } catch (e) {
        attempts.push(e instanceof Error ? e.message : String(e));
      }
    }

    if (!workflow) {
      return new Response(
        JSON.stringify({
          error: "No se pudo generar el workflow con los proveedores disponibles",
          details: attempts,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ workflow }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Error desconocido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
