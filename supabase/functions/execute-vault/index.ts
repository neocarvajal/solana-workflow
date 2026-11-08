import { Buffer } from "node:buffer";
import {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "npm:@solana/web3.js@1.99.0";
import {
  buildExecuteTransferSolInstruction,
  decodeVaultPolicy,
  getVaultAddresses,
  json,
  loadCrank,
  VAULT_PROGRAM_ID,
} from "../_shared/vault.ts";

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
        note: "Enable it only after the devnet vault has been audited.",
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
    const amountLamports = Number(body.amount_lamports);
    const requestedDestination = body.destination
      ? String(body.destination)
      : null;

    if (!ownerWallet) throw new Error("owner_wallet is required");
    if (!workflowId || workflowId.length > 64) {
      throw new Error("workflow_id is required and must be at most 64 bytes");
    }
    if (
      !Number.isSafeInteger(amountLamports) ||
      amountLamports <= 0
    ) {
      throw new Error("amount_lamports must be a positive safe integer");
    }

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
    if (!policy.assetMint.equals(PublicKey.default)) {
      return json(
        { error: "Only SOL policies are supported in this version" },
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

    const amount = BigInt(amountLamports);
    if (amount > policy.maxPerRun) {
      return json({ error: "Amount exceeds max_per_run" }, 400);
    }
    if (policy.totalSpent + amount > policy.maxTotal) {
      return json({ error: "Amount exceeds max_total" }, 400);
    }

    const [vaultBalance, rentExemption, crankBalance] = await Promise.all([
      connection.getBalance(addresses.vault),
      connection.getMinimumBalanceForRentExemption(0),
      connection.getBalance(crank.publicKey),
    ]);
    if (vaultBalance - amountLamports < rentExemption) {
      return json({ error: "Vault would fall below rent exemption" }, 400);
    }
    if (crankBalance <= 0) {
      return json({ error: "Crank has no SOL for fees" }, 503);
    }

    const instruction = await buildExecuteTransferSolInstruction({
      policy: addresses.policy,
      vault: addresses.vault,
      destination,
      crank: crank.publicKey,
      amountLamports,
    });
    const transaction = new Transaction().add(instruction);
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
      amount_lamports: amountLamports,
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
