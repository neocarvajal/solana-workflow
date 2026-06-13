// supabase/functions/delete-ipfs-file/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const PINATA_JWT = Deno.env.get("PINATA_JWT");
    
    // Feedback Punto 5: Verificar que el JWT realmente existe en Deno
    console.log("[DETECTIVE] ¿PINATA_JWT presente?:", !!PINATA_JWT);
    if (!PINATA_JWT) throw new Error("Falta la variable PINATA_JWT en Supabase");

    // Feedback Punto 6: Evitar que falle si el body viene vacío
    const body = await req.json().catch(() => null);
    if (!body || (!body.pinata_file_id && !body.cid)) {
      throw new Error("Se requiere 'pinata_file_id' o 'cid' en el body.");
    }

    const { pinata_file_id, cid } = body;
    console.log(`[DETECTIVE] Datos recibidos -> file_id: ${pinata_file_id}, cid: ${cid}`);

    // --- INTENTO 1: Borrado por API V3 (El del Curl exitoso) ---
    if (pinata_file_id) {
      console.log(`[INTENTO 1] Probando DELETE V3 /public/${pinata_file_id}`);
      
      const v3Response = await fetch(`https://api.pinata.cloud/v3/files/public/${pinata_file_id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${PINATA_JWT}` }
      });

      // Feedback Punto 4: Imprimir los estados antes de evaluar el .ok
      console.log("[V3 STATUS]:", v3Response.status);
      console.log("[V3 STATUS TEXT]:", v3Response.statusText);
      const v3Text = await v3Response.text();
      console.log("[V3 BODY]:", v3Text);

      // Feedback Punto 2: Si devuelve 200 o 204 (No content), fue exitoso
      if (v3Response.ok || v3Response.status === 204) {
        console.log("[OK] Eliminado exitosamente vía API V3.");
        return new Response(JSON.stringify({ success: true, method: "v3" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // --- INTENTO 2: Fallback por API Clásica Unpin (Feedback Punto 3) ---
    if (cid) {
      console.log(`[INTENTO 2] El método V3 falló o no había file_id. Probando UNPIN clásico con CID: ${cid}`);
      
      const unpinResponse = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${PINATA_JWT}` }
      });

      console.log("[UNPIN STATUS]:", unpinResponse.status);
      const unpinText = await unpinResponse.text();
      console.log("[UNPIN BODY]:", unpinText);

      if (unpinResponse.ok) {
        console.log("[OK] Eliminado exitosamente vía Unpin clásico.");
        return new Response(JSON.stringify({ success: true, method: "unpin" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      
      throw new Error(`Ambos métodos de borrado fallaron. Pinata Unpin Status: ${unpinResponse.status} - ${unpinText}`);
    }

    throw new Error("El borrado falló en la API V3 y no se proporcionó un CID para intentar el Unpin de respaldo.");

  } catch (e: any) {
    console.error(`[CRÍTICO] Error en la ejecución:`, e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});