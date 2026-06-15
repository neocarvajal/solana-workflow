import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { owner, params } = await req.json();
    const { fromMint, toMint, amount } = params;

    // La API v2 requiere el x-api-key en el header
    const JUPITER_API_KEY = Deno.env.get("JUPITER_API_KEY");

    // Llamada al Meta-Aggregator v2 (/order)
    // Este endpoint nos da la transacción lista para firmar y un requestId
    const response = await fetch(
      `https://api.jup.ag/swap/v2/order?` + new URLSearchParams({
        inputMint: fromMint,
        outputMint: toMint,
        amount: amount.toString(), // Cantidad en unidades atómicas
        taker: owner,
        slippageBps: "50",
      }),
      { 
        headers: { 
          "x-api-key": JUPITER_API_KEY || "" 
        } 
      }
    );

    const order = await response.json();

    if (!response.ok || order.error) {
      throw new Error(order.error || "Failed to get order from Jupiter v2");
    }

    // Devolvemos el objeto 'order' completo que contiene:
    // 1. transaction (la v0 transaction en base64)
    // 2. requestId (necesario para el posterior /execute)
    return new Response(
      JSON.stringify({ 
        transaction: order.transaction, 
        requestId: order.requestId 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }), 
      { status: 500, headers: corsHeaders }
    );
  }
});