import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "npm:@solana/web3.js@1.98.4";
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from "npm:@solana/spl-token@0.4.9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Tokens disponibles en devnet. Los mints de JUP y BONK son los de mainnet
// porque en devnet no hay liquidez oficial para ellos.
const DEVNET_TOKENS: Record<string, { mint: PublicKey; decimals: number }> = {
  USDC: {
    mint: new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
    decimals: 6,
  },
  JUP: {
    mint: new PublicKey("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"),
    decimals: 6,
  },
  BONK: {
    mint: new PublicKey("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"),
    decimals: 5,
  },
};

const LAMPORTS_PER_SOL = 1_000_000_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Igual que el RPC, nunca devolvemos URLs internas ni claves al cliente.
 */
function safeErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/https?:\/\//i.test(message) || /(alchemy|helius)/i.test(message)) {
    return "No se pudo contactar el RPC de Solana. Intenta de nuevo.";
  }
  return message;
}

/**
 * btoa(String.fromCharCode(...bytes)) revienta con transacciones grandes.
 */
function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const rpc = Deno.env.get("SOLANA_RPC_URL");

    if (!rpc) {
      console.error("Missing SOLANA_RPC_URL secret");
      return json({ error: "RPC de Solana no configurado" }, 500);
    }

    const connection = new Connection(rpc, "confirmed");

    const { owner, params } = await req.json();

    if (!owner || !params) {
      return json({ error: "Faltan owner o params" }, 400);
    }

    const asset = typeof params.asset === "string" ? params.asset.toUpperCase() : "";
    const to = params.to;
    const amount = Number(params.amount);

    if (!asset || !to || !Number.isFinite(amount) || amount <= 0) {
      return json({ error: "Parámetros inválidos" }, 400);
    }

    let ownerPk: PublicKey;
    let toPk: PublicKey;

    try {
      ownerPk = new PublicKey(owner);
      toPk = new PublicKey(to);
    } catch (_e) {
      return json({ error: "Dirección de wallet inválida" }, 400);
    }

    const transaction = new Transaction();

    if (asset === "SOL") {
      const lamports = Math.round(amount * LAMPORTS_PER_SOL);

      if (!Number.isSafeInteger(lamports) || lamports <= 0) {
        return json({ error: "Monto inválido para SOL" }, 400);
      }

      transaction.add(
        SystemProgram.transfer({
          fromPubkey: ownerPk,
          toPubkey: toPk,
          lamports,
        })
      );
    } else {
      const token = DEVNET_TOKENS[asset];

      if (!token) {
        return json({ error: `Token ${asset} no soportado` }, 400);
      }

      const sourceATA = await getAssociatedTokenAddress(token.mint, ownerPk);
      const destinationATA = await getAssociatedTokenAddress(token.mint, toPk);

      const sourceInfo = await connection.getAccountInfo(sourceATA);

      if (!sourceInfo) {
        return json(
          { error: `No tienes cuenta de ${asset} en esta wallet` },
          400
        );
      }

      const destinationInfo = await connection.getAccountInfo(destinationATA);

      if (!destinationInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            ownerPk,
            destinationATA,
            toPk,
            token.mint
          )
        );
      }

      const rawAmount = Math.round(amount * Math.pow(10, token.decimals));

      if (!Number.isSafeInteger(rawAmount) || rawAmount <= 0) {
        return json({ error: "Monto inválido para el token" }, 400);
      }

      transaction.add(
        createTransferCheckedInstruction(
          sourceATA,
          token.mint,
          destinationATA,
          ownerPk,
          rawAmount,
          token.decimals
        )
      );
    }

    let blockhash: string;

    try {
      const latest = await connection.getLatestBlockhash("confirmed");
      blockhash = latest.blockhash;
    } catch (e) {
      // Reintento único: los RPC públicos a veces fallan de forma transitoria.
      console.error("getLatestBlockhash failed, retrying once:", safeErrorMessage(e));
      await sleep(400);
      const latest = await connection.getLatestBlockhash("confirmed");
      blockhash = latest.blockhash;
    }

    transaction.feePayer = ownerPk;
    transaction.recentBlockhash = blockhash;

    const serialized = transaction.serialize({ requireAllSignatures: false });

    return json({
      serializedTx: encodeBase64(serialized),
      asset,
      amount,
      network: "devnet",
    });
  } catch (e) {
    console.error("EDGE ERROR:", e);
    return json({ error: safeErrorMessage(e) }, 500);
  }
});
