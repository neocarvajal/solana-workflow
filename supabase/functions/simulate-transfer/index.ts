import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Connection, PublicKey, Transaction } from "npm:@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferCheckedInstruction,
  createAssociatedTokenAccountInstruction,
} from "npm:@solana/spl-token";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEVNET_MINTS: Record<string, { mint: PublicKey; decimals: number }> = {
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

const connection = new Connection(
  "https://api.devnet.solana.com",
  "confirmed"
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { owner, params } = await req.json();

    const asset = params?.asset?.toUpperCase();

    if (!asset || !params?.to || !params?.amount) {
      return new Response(
        JSON.stringify({ error: "Missing params" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (asset === "SOL") {
      return new Response(
        JSON.stringify({
          error: "SOL nativo requiere otro flujo (SystemProgram)",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const tokenConfig = DEVNET_MINTS[asset];
    if (!tokenConfig) {
      return new Response(
        JSON.stringify({ error: `Token ${asset} no soportado` }),
        { status: 400, headers: corsHeaders }
      );
    }

    const ownerPk = new PublicKey(owner);
    const toPk = new PublicKey(params.to);

    const transaction = new Transaction();

    const sourceATA = await getAssociatedTokenAddress(
      tokenConfig.mint,
      ownerPk
    );

    const destinationATA = await getAssociatedTokenAddress(
      tokenConfig.mint,
      toPk
    );

    const destinationAccountInfo =
      await connection.getAccountInfo(destinationATA);

    if (!destinationAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          ownerPk,
          destinationATA,
          toPk,
          tokenConfig.mint
        )
      );
    }

    const rawAmount =
      parseFloat(params.amount) * Math.pow(10, tokenConfig.decimals);

    transaction.add(
      createTransferCheckedInstruction(
        sourceATA,
        tokenConfig.mint,
        destinationATA,
        ownerPk,
        rawAmount,
        tokenConfig.decimals
      )
    );

    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    transaction.feePayer = ownerPk;
    transaction.recentBlockhash = blockhash;

    const serialized = transaction.serialize({
      requireAllSignatures: false,
    });

    return new Response(
      JSON.stringify({
        serializedTx: Buffer.from(serialized).toString("base64"),
      }),
      { headers: corsHeaders }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});