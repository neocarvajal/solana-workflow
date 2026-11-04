import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Jupiter es un aggregator de MAINNET. Estos mints son los de mainnet.
const MAINNET_TOKENS: Record<string, { mint: string; decimals: number }> = {
  SOL: {
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
  },
  USDC: {
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
  },
  USDT: {
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    decimals: 6,
  },
  JUP: {
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    decimals: 6,
  },
  BONK: {
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    decimals: 5,
  },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function isPublicKey(value: string): boolean {
  return BASE58_RE.test(value);
}

function resolveToken(value: unknown): { mint: string; decimals: number | null } | null {
  if (typeof value !== "string" || value.trim() === "") return null;

  const raw = value.trim();
  const symbol = raw.toUpperCase();
  const known = MAINNET_TOKENS[symbol];

  if (known) return known;

  // Si ya es un mint con formato base58 válido, no conocemos sus decimales.
  return isPublicKey(raw) ? { mint: raw, decimals: null } : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { owner, params } = await req.json();

    if (!owner || !params) {
      return json({ error: "Faltan owner o params" }, 400);
    }

    if (typeof owner !== "string" || !isPublicKey(owner)) {
      return json({ error: "Dirección de wallet inválida" }, 400);
    }

    const input = resolveToken(params.fromMint ?? params.from);
    const output = resolveToken(params.toMint ?? params.to);

    if (!input || !output) {
      return json(
        { error: "Token inválido. Usa SOL, USDC, USDT, JUP, BONK o un mint válido." },
        400
      );
    }

    if (input.mint === output.mint) {
      return json({ error: "Los tokens de entrada y salida son iguales" }, 400);
    }

    const amount = Number(params.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ error: "Monto inválido" }, 400);
    }

    let amountAtomic: number;

    if (params.amountAtomic !== undefined) {
      amountAtomic = Math.round(Number(params.amountAtomic));
    } else if (input.decimals === null) {
      // Si el cliente manda un mint, asumimos que ya viene en unidades atómicas.
      amountAtomic = Math.round(amount);
    } else {
      amountAtomic = Math.round(amount * Math.pow(10, input.decimals));
    }

    if (!Number.isSafeInteger(amountAtomic) || amountAtomic <= 0) {
      return json({ error: "Monto inválido para el token de entrada" }, 400);
    }

    const slippageBps = Number.isFinite(Number(params.slippageBps))
      ? Math.max(1, Math.min(5000, Math.round(Number(params.slippageBps))))
      : 50;

    const apiKey = Deno.env.get("JUPITER_API_KEY");
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    // No mandamos el header vacío: Jupiter responde 401 Unauthorized.
    if (apiKey) headers["x-api-key"] = apiKey;

    const orderUrl =
      "https://api.jup.ag/swap/v2/order?" +
      new URLSearchParams({
        inputMint: input.mint,
        outputMint: output.mint,
        amount: amountAtomic.toString(),
        taker: owner,
        slippageBps: slippageBps.toString(),
      }).toString();

    const response = await fetch(orderUrl, { headers });
    const rawBody = await response.text();

    let order: Record<string, unknown> = {};

    try {
      order = rawBody ? JSON.parse(rawBody) : {};
    } catch (_e) {
      order = {};
    }

    if (!response.ok) {
      const detail =
        (order.error as string) ||
        (order.errorMessage as string) ||
        (order.message as string) ||
        rawBody.slice(0, 200) ||
        `HTTP ${response.status}`;

      console.error("Jupiter order failed:", response.status, detail);

      return json(
        {
          error: `Jupiter: ${detail}`,
          status: response.status,
        },
        response.status === 401 ? 502 : response.status
      );
    }

    // Jupiter puede responder 200 con un error de negocio (p. ej. saldo).
    const businessError =
      (order.error as string) || (order.errorMessage as string);

    if (businessError) {
      return json(
        {
          error: `Jupiter: ${businessError}`,
          code: order.errorCode,
        },
        400
      );
    }

    if (!order.transaction || !order.requestId) {
      return json({ error: "Jupiter no devolvió una transacción válida" }, 502);
    }

    return json({
      transaction: order.transaction,
      requestId: order.requestId,
      inputMint: input.mint,
      outputMint: output.mint,
      inAmount: order.inAmount ?? amountAtomic.toString(),
      outAmount: order.outAmount,
      priceImpactPct: order.priceImpactPct,
      cluster: "mainnet-beta",
    });
  } catch (e) {
    console.error("EDGE ERROR:", e);
    return json(
      { error: e instanceof Error ? e.message : "Error desconocido" },
      500
    );
  }
});
