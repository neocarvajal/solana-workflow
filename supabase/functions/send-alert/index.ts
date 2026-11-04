import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { alertChannelHealth, deliverAlert } from "../_shared/alerts.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return json({ ok: true, channels: alertChannelHealth() });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json(
      { ok: false, channel: "app", message: "El cuerpo de la petición no es JSON válido." },
      400,
    );
  }

  try {
    const result = await deliverAlert(payload);
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno enviando la alerta.";
    console.error("send-alert:", message);
    return json({ ok: false, channel: "app", message }, 500);
  }
});
