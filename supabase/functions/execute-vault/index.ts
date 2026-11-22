import { Buffer } from "node:buffer";
import {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "npm:@solana/web3.js@1.99.0";
import { TOKEN_PROGRAM_ID } from "npm:@solana/spl-token@0.4.9";
import {
  buildCreateAtaInstruction,
  buildExecuteTransferSolInstruction,
  buildExecuteTransferSplInstruction,
  decodeVaultPolicy,
  getVaultAddresses,
  getVaultTokenAccounts,
  json,
  loadCrank,
  VAULT_PROGRAM_ID,
} from "../_shared/vault.ts";
import {
  isAssetSupportedOnCluster,
  normalizeVaultAsset,
  VAULT_ASSETS,
} from "../_shared/vaultTokens.ts";

function unauthorized() {
  return json({ error: "Unauthorized" }, 401);
}

/**
 * The Supabase gateway verifies the JWT signature before invoking this function
 * (default verify_jwt). Read the role from the already-verified token so the
 * function also works when the platform injects a rotated service key.
 */
function jwtRole(token: string): string | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded =
      normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (Deno.env.get("VAULT_EXECUTION_ENABLED") !== "true") {
    return json(
      {
        error: "Vault execution is disabled",
        code: "VAULT_EXECUTION_DISABLED",
        note: "Kill switch operativo: la ejecución de la bóveda está en pausa en el servidor.",
      },
      503,
    );
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authorization = req.headers.get("authorization") || "";
  const bearer = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const authorized =
    (serviceKey && authorization === `Bearer ${serviceKey}`) ||
    (bearer && jwtRole(bearer) === "service_role") ||
    (cronSecret && req.headers.get("x-cron-secret") === cronSecret);
  if (!authorized) return unauthorized();

  try {
    const body = await req.json();
    const ownerWallet = String(body.owner_wallet || "");
    const workflowId = String(body.workflow_id || "");
    const assetSymbol = normalizeVaultAsset(body.asset || "SOL");
    const cluster = Deno.env.get("SOLANA_CLUSTER") || "devnet";
    const rawAmount = body.amount_base_units ?? body.amount_lamports;
    const amountBaseUnits = Number(rawAmount);
    const requestedDestination = body.destination
      ? String(body.destination)
      : null;

    if (!ownerWallet) throw new Error("owner_wallet is required");
    if (!workflowId || workflowId.length > 64) {
      throw new Error("workflow_id is required and must be at most 64 bytes");
    }
    if (!assetSymbol) {
      return json(
        {
          error: "unsupported_asset",
          note: "Activos compatibles: SOL, USDC, JUP, BONK.",
        },
        400,
      );
    }
    if (!isAssetSupportedOnCluster(assetSymbol, cluster)) {
      return json(
        {
          error: "asset_not_available_on_network",
          asset: assetSymbol,
          cluster,
          note: `${assetSymbol} no tiene un mint SPL válido en ${cluster}.`,
        },
        400,
      );
    }
    if (
      !Number.isSafeInteger(amountBaseUnits) ||
      amountBaseUnits <= 0
    ) {
      throw new Error("amount_base_units must be a positive safe integer");
    }

    const asset = VAULT_ASSETS[assetSymbol];
    const assetMint = new PublicKey(asset.mint);
    const owner = new PublicKey(ownerWallet);
    const addresses = await getVaultAddresses(owner, workflowId);
    const rpcUrl =
      Deno.env.get("SOLANA_RPC_URL") || "https://api.devnet.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");

    const policyAccount = await connection.getAccountInfo(addresses.policy);
    if (!policyAccount) {
      return json({ error: "Vault policy not found", code: "POLICY_NOT_FOUND" }, 404);
    }
    if (!policyAccount.owner.equals(VAULT_PROGRAM_ID)) {
      return json({ error: "Policy belongs to another program" }, 400);
    }
    const policy = await decodeVaultPolicy(policyAccount.data);
    if (!policy) return json({ error: "Invalid vault policy" }, 400);

    if (!policy.owner.equals(owner)) {
      return json({ error: "Policy owner mismatch" }, 400);
    }
    if (!Buffer.from(policy.workflowHash).equals(Buffer.from(addresses.workflowHash))) {
      return json({ error: "Workflow hash mismatch" }, 400);
    }
    if (!policy.assetMint.equals(assetMint)) {
      return json(
        {
          error: "asset_mint_mismatch",
          note: "El activo solicitado no coincide con el mint autorizado por la política.",
          policyAssetMint: policy.assetMint.toBase58(),
          requestedAssetMint: assetMint.toBase58(),
        },
        400,
      );
    }

    const destination = requestedDestination
      ? new PublicKey(requestedDestination)
      : policy.destination;
    if (!destination.equals(policy.destination)) {
      return json({ error: "Destination is not authorized by the policy" }, 400);
    }

    const crank = loadCrank();
    if (policy.keeper && !policy.keeper.equals(crank.publicKey)) {
      return json({ error: "Crank is not the authorized keeper" }, 403);
    }
    if (policy.paused) {
      return json({ error: "Vault policy is paused", code: "POLICY_PAUSED" }, 409);
    }

    const now = BigInt(Math.floor(Date.now() / 1000));
    if (policy.expiresAt > 0n && policy.expiresAt <= now) {
      return json({ error: "Vault policy has expired" }, 409);
    }
    if (
      policy.minIntervalSeconds > 0n &&
      policy.lastExecutionAt > 0n &&
      policy.lastExecutionAt + policy.minIntervalSeconds > now
    ) {
      return json({ error: "Vault minimum interval has not elapsed" }, 429);
    }

    const amount = BigInt(amountBaseUnits);
    if (amount > policy.maxPerRun) {
      return json({ error: "Amount exceeds max_per_run" }, 400);
    }
    if (policy.totalSpent + amount > policy.maxTotal) {
      return json({ error: "Amount exceeds max_total" }, 400);
    }

    const crankBalance = await connection.getBalance(crank.publicKey);
    if (crankBalance <= 0) {
      return json({ error: "Crank has no SOL for fees" }, 503);
    }

    const instructions = [];
    let programAmount = amountBaseUnits;

    if (assetSymbol === "SOL") {
      const [vaultBalance, rentExemption] = await Promise.all([
        connection.getBalance(addresses.vault),
        connection.getMinimumBalanceForRentExemption(0),
      ]);
      if (vaultBalance - amountBaseUnits < rentExemption) {
        return json({ error: "Vault would fall below rent exemption" }, 400);
      }
      instructions.push(
        await buildExecuteTransferSolInstruction({
          policy: addresses.policy,
          vault: addresses.vault,
          destination,
          crank: crank.publicKey,
          amountLamports: amountBaseUnits,
        }),
      );
    } else {
      const mintAccount = await connection.getAccountInfo(assetMint);
      if (
        !mintAccount ||
        !mintAccount.owner.equals(TOKEN_PROGRAM_ID) ||
        mintAccount.data.length !== 82
      ) {
        return json(
          {
            error: "asset_not_available_on_network",
            asset: assetSymbol,
            cluster,
            note: `${assetSymbol} no es un mint SPL inicializado en ${cluster}.`,
          },
          400,
        );
      }

      const { vaultAta, destinationAta } = getVaultTokenAccounts(
        assetMint,
        addresses.vault,
        destination,
      );
      const [vaultAtaAccount, destinationAtaAccount, vaultTokenBalance] =
        await Promise.all([
          connection.getAccountInfo(vaultAta),
          connection.getAccountInfo(destinationAta),
          connection.getTokenAccountBalance(vaultAta),
        ]);
      if (!vaultAtaAccount) {
        return json(
          {
            error: "vault_token_account_missing",
            note: "La bóveda no tiene un ATA para este activo. Deposita tokens primero.",
          },
          400,
        );
      }
      if (BigInt(vaultTokenBalance.value.amount) < amount) {
        return json({ error: "Insufficient token balance in vault" }, 400);
      }
      if (!destinationAtaAccount) {
        instructions.push(
          buildCreateAtaInstruction({
            payer: crank.publicKey,
            owner: destination,
            mint: assetMint,
            ata: destinationAta,
          }),
        );
      }
      instructions.push(
        await buildExecuteTransferSplInstruction({
          policy: addresses.policy,
          vault: addresses.vault,
          assetMint,
          vaultAta,
          destination,
          destinationAta,
          crank: crank.publicKey,
          amountBaseUnits,
        }),
      );
    }

    const transaction = new Transaction().add(...instructions);
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [crank],
      { commitment: "confirmed", maxRetries: 5 },
    );

    return json({
      ok: true,
      signature,
      policy: addresses.policy.toBase58(),
      vault: addresses.vault.toBase58(),
      destination: destination.toBase58(),
      asset: assetSymbol,
      amount_base_units: programAmount,
      amount_lamports: assetSymbol === "SOL" ? programAmount : undefined,
    });
  } catch (error) {
    console.error("execute-vault failed", error);
    const logs =
      error && typeof error === "object" && "logs" in error
        ? (error as { logs?: unknown }).logs
        : undefined;
    return json(
      {
        error: error instanceof Error ? error.message : String(error),
        logs,
      },
      500,
    );
  }
});
