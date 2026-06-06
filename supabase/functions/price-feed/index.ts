import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const COIN_IDS: Record<string, string> = {
  SOL: "solana",
  BONK: "bonk",
  JUP: "jupiter-exchange-solana",
  WIF: "dogwifcoin",
  USDC: "usd-coin",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const asset = (url.searchParams.get("asset") || "SOL").toUpperCase();
    const id = COIN_IDS[asset] || asset.toLowerCase();
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
    if (!r.ok) throw new Error(`Price feed ${r.status}`);
    const json = await r.json();
    const price = json[id]?.usd;
    return new Response(JSON.stringify({ asset, price }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
