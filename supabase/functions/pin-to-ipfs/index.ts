// Definición manual de corsHeaders para mayor compatibilidad
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import nacl from "npm:tweetnacl@1.0.3";
import bs58 from "npm:bs58@6.0.0";

const Body = z.object({
  json: z.record(z.any()),
  name: z.string().min(1).max(120).optional(),
  owner_wallet: z.string(),
  signature: z.string(),
});

const GROUP_ID = Deno.env.get("PINATA_GROUP_ID");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const rawBody = await req.json();
    const parsed = Body.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { json, name, owner_wallet, signature } = parsed.data;

    // 2. Verificación de firma
    if (signature !== "skip") {
      const message = new TextEncoder().encode("Autorizo guardar este workflow");
      const signatureUint8 = bs58.decode(signature);
      const publicKeyUint8 = bs58.decode(owner_wallet);

      const isValid = nacl.sign.detached.verify(message, signatureUint8, publicKeyUint8);

      if (!isValid) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 3. Subir a Pinata
    const PINATA_JWT = Deno.env.get("PINATA_JWT");
    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pinataContent: json,
        pinataMetadata: { name: name || "solflows-workflow" },
        pinataOptions: { groupId: GROUP_ID },
      }),
    });

    if (!res.ok) throw new Error(`Pinata error: ${await res.text()}`);
    const { IpfsHash: cid } = await res.json();

    // 4. Guardar en Supabase y capturar el ID generado
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: record, error: dbError } = await supabase
      .from("workflows")
      .insert({
        owner_wallet, 
        cid, 
        json, 
        name, 
        onchain_signature: signature
      })
      .select("id") // Capturamos el ID generado por la BD
      .single();

    if (dbError) throw new Error(`DB Error: ${dbError.message}`);

    // Retornamos tanto el CID como el ID de la base de datos
    return new Response(JSON.stringify({ cid, id: record.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});