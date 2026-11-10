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
import { normalizeExecutionMode, scheduleToSeconds } from "../_shared/schedule.ts";
import { walletGroupName } from "../_shared/pinata.ts";

const Body = z.object({
  json: z.record(z.any()),
  name: z.string().min(1).max(120).optional(),
  owner_wallet: z.string(),
  signature: z.string(),
  schedule: z.string().max(20).optional(),
  workflow_id: z.string().min(1).max(80).optional(),
  execution_mode: z.enum(["manual", "notify", "vault_transfer", "vault_dca", "subscription"]).optional(),
  schedule_seconds: z.number().int().min(0).max(86400).optional(),
});

const PINATA_JWT = Deno.env.get("PINATA_JWT");
const FALLBACK_GROUP_ID = Deno.env.get("PINATA_GROUP_ID");

async function pinJson(
  content: Record<string, unknown>,
  name: string,
  groupId: string | null,
): Promise<string> {
  if (!PINATA_JWT) throw new Error("PINATA_JWT is not configured");

  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pinataContent: content,
      pinataMetadata: { name },
      ...(groupId ? { pinataOptions: { groupId } } : {}),
    }),
  });

  if (!res.ok) throw new Error(`Pinata error: ${await res.text()}`);
  const { IpfsHash: cid } = await res.json();
  if (!cid) throw new Error("Pinata did not return a CID");
  return cid;
}

async function getOrCreateGroup(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  ownerWallet: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("user_ipfs_spaces")
    .select("group_id")
    .eq("owner_wallet", ownerWallet)
    .maybeSingle();

  if (existing?.group_id) return existing.group_id;
  if (!PINATA_JWT) return FALLBACK_GROUP_ID || null;

  const groupName = await walletGroupName(ownerWallet);
  const res = await fetch("https://api.pinata.cloud/v3/groups/public", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: groupName, is_public: true }),
  });

  if (!res.ok) {
    console.error("Pinata group creation failed", await res.text());
    return FALLBACK_GROUP_ID || null;
  }

  const payload = await res.json();
  const groupId = payload?.data?.id || payload?.id;
  if (!groupId) return FALLBACK_GROUP_ID || null;

  const { error } = await supabase.from("user_ipfs_spaces").upsert({
    owner_wallet: ownerWallet,
    group_id: groupId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "owner_wallet" });

  if (error) console.error("user_ipfs_spaces upsert failed", error);
  return groupId;
}

async function refreshManifest(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  ownerWallet: string,
  groupId: string | null,
): Promise<string | null> {
  try {
    const { data: workflows } = await supabase
      .from("workflows")
      .select("workflow_id, name, cid, schedule, execution_mode, updated_at")
      .eq("owner_wallet", ownerWallet)
      .neq("automation_status", "deleted")
      .order("updated_at", { ascending: false });

    const { data: assets } = await supabase
      .from("user_assets")
      .select("kind, name, cid, mime_type, created_at")
      .eq("owner_wallet", ownerWallet)
      .order("created_at", { ascending: false });

    const manifestCid = await pinJson({
      version: 1,
      kind: "solflows-space",
      owner: ownerWallet,
      updatedAt: new Date().toISOString(),
      workflows: workflows || [],
      assets: assets || [],
    }, "solflows.manifest.json", groupId);

    await supabase
      .from("user_ipfs_spaces")
      .update({ manifest_cid: manifestCid, updated_at: new Date().toISOString() })
      .eq("owner_wallet", ownerWallet);

    return manifestCid;
  } catch (error) {
    console.error("Manifest refresh failed", error);
    return null;
  }
}

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
    const schedule = parsed.data.schedule ||
      (typeof json.schedule === "string" ? json.schedule : "manual");
    const workflowId = parsed.data.workflow_id ||
      (typeof json.workflowId === "string" ? json.workflowId : crypto.randomUUID());
    const executionMode = normalizeExecutionMode(
      parsed.data.execution_mode || json.executionMode || (schedule === "manual" ? "manual" : "notify"),
    );
    const scheduleSeconds = parsed.data.schedule_seconds ?? scheduleToSeconds(schedule);
    const automationStatus = schedule !== "manual" ? "active" : "inactive";
    const nextRunAt = automationStatus === "active"
      ? new Date(Date.now() + scheduleSeconds * 1000).toISOString()
      : null;
    const pinnedJson = {
      ...json,
      schedule,
      scheduleSeconds,
      executionMode,
      workflowId,
    };

    // 2. Verificación de firma ligada a wallet + workflow
    if (!signature || signature === "skip") {
      return new Response(JSON.stringify({ error: "Wallet signature required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = new TextEncoder().encode(
      `Autorizo guardar este workflow\nWallet: ${owner_wallet}\nWorkflow: ${workflowId}`,
    );
    const signatureUint8 = bs58.decode(signature);
    const publicKeyUint8 = bs58.decode(owner_wallet);

    const isValid = nacl.sign.detached.verify(message, signatureUint8, publicKeyUint8);

    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Subir a Pinata dentro del grupo (carpeta) del wallet.
    if (!PINATA_JWT) throw new Error("PINATA_JWT is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const groupId = await getOrCreateGroup(supabase, owner_wallet);
    const cid = await pinJson(pinnedJson, name || "solflows-workflow", groupId);

    // 4. Guardar/actualizar en Supabase. La identidad estable es
    // (owner_wallet, workflow_id), nunca el nombre global del workflow.

    const recordPayload = {
      owner_wallet,
      cid,
      json: pinnedJson,
      name: name || "Untitled workflow",
      schedule,
      schedule_seconds: scheduleSeconds,
      execution_mode: executionMode,
      workflow_id: workflowId,
      automation_status: automationStatus,
      next_run_at: nextRunAt,
      onchain_signature: signature,
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: findError } = await supabase
      .from("workflows")
      .select("id")
      .eq("owner_wallet", owner_wallet)
      .eq("workflow_id", workflowId)
      .maybeSingle();

    if (findError) throw new Error(`DB lookup error: ${findError.message}`);

    let recordId: string;
    if (existing?.id) {
      const { data: updated, error: dbError } = await supabase
        .from("workflows")
        .update(recordPayload)
        .eq("id", existing.id)
        .select("id")
        .single();
      if (dbError) throw new Error(`DB Error: ${dbError.message}`);
      recordId = updated.id;
    } else {
      const { data: inserted, error: dbError } = await supabase
        .from("workflows")
        .insert(recordPayload)
        .select("id")
        .single();
      if (dbError) throw new Error(`DB Error: ${dbError.message}`);
      recordId = inserted.id;
    }

    const manifestCid = await refreshManifest(supabase, owner_wallet, groupId);

    // Retornamos CID, ID de base de datos, grupo y manifiesto del espacio.
    return new Response(JSON.stringify({
      cid,
      id: recordId,
      workflow_id: workflowId,
      group_id: groupId,
      manifest_cid: manifestCid,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});