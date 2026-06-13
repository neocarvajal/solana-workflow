import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const PINATA_JWT = Deno.env.get("PINATA_JWT");

    if (!PINATA_JWT) throw new Error("Falta la variable PINATA_JWT en Supabase");

    const body = await req.json().catch(() => null);
    if (!body || (!body.pinata_file_id && !body.cid)) {
      throw new Error("Se requiere 'pinata_file_id' o 'cid' en el body.");
    }

    const { pinata_file_id, cid } = body;

    if (pinata_file_id) {
      const v3Response = await fetch(`https://api.pinata.cloud/v3/files/public/${pinata_file_id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${PINATA_JWT}` }
      });

      console.log("[V3 STATUS]:", v3Response.status);
      console.log("[V3 STATUS TEXT]:", v3Response.statusText);
      const v3Text = await v3Response.text();
      console.log("[V3 BODY]:", v3Text);

      if (v3Response.ok || v3Response.status === 204) {
        console.log("[OK] Eliminado exitosamente vía API V3.");
        return new Response(JSON.stringify({ success: true, method: "v3" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    if (cid) {

      const unpinResponse = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${PINATA_JWT}` }
      });

      const unpinText = await unpinResponse.text();
      console.log("[UNPIN BODY]:", unpinText);

      if (unpinResponse.ok) {
        return new Response(JSON.stringify({ success: true, method: "unpin" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      throw new Error(`Ambos métodos de borrado fallaron. Pinata Unpin Status: ${unpinResponse.status} - ${unpinText}`);
    }

    throw new Error("El borrado falló en la API V3 y no se proporcionó un CID para intentar el Unpin de respaldo.");

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});