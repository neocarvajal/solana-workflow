import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const Body = z.object({ cid: z.string().min(10).max(120) });

const GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.io/ipfs/",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { cid } = parsed.data;
    let lastErr = "";
    for (const g of GATEWAYS) {
      try {
        const r = await fetch(g + cid, { signal: AbortSignal.timeout(8000) });
        if (r.ok) {
          const json = await r.json();
          return new Response(JSON.stringify({ json }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        lastErr = `${g} ${r.status}`;
      } catch (e) {
        lastErr = `${g} ${String(e)}`;
      }
    }
    return new Response(JSON.stringify({ error: `All gateways failed. ${lastErr}` }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
