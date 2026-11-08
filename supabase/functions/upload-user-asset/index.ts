import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import bs58 from "npm:bs58@6.0.0";
import nacl from "npm:tweetnacl@1.0.3";
import { walletGroupName } from "../_shared/pinata.ts";

const Body = z.object({
  owner_wallet: z.string().min(32).max(64),
  name: z.string().min(1).max(120),
  kind: z.enum(["profile", "asset", "document"]).optional(),
  mime_type: z.string().max(120).optional(),
  data_base64: z.string().min(1).max(6_000_000),
  signature: z.string().min(1),
});

const PINATA_JWT = Deno.env.get("PINATA_JWT");
const FALLBACK_GROUP_ID = Deno.env.get("PINATA_GROUP_ID");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function pinJson(content: Record<string, unknown>, name: string, groupId: string | null) {
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
  return cid as string;
}

async function getOrCreateGroup(
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
  ownerWallet: string,
  groupId: string | null,
): Promise<string | null> {
  try {
    const { data: workflows } = await supabase
      .from("workflows")
      .select("workflow_id, name, cid, schedule, execution_mode, updated_at")
      .eq("owner_wallet", ownerWallet)
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    if (!PINATA_JWT) return json({ error: "PINATA_JWT is not configured" }, 503);

    const { owner_wallet, name, kind, mime_type, data_base64, signature } = parsed.data;

    const message = new TextEncoder().encode(
      `Autorizo subir este asset\nWallet: ${owner_wallet}\nNombre: ${name}\nTipo: ${kind || "asset"}`,
    );
    const isValid = nacl.sign.detached.verify(
      message,
      bs58.decode(signature),
      bs58.decode(owner_wallet),
    );
    if (!isValid) return json({ error: "Invalid signature" }, 401);

    let bytes: Uint8Array;
    try {
      const binary = atob(data_base64.includes(",") ? data_base64.split(",").pop()! : data_base64);
      bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    } catch {
      return json({ error: "Invalid base64 payload" }, 400);
    }

    if (bytes.byteLength > 4_000_000) {
      return json({ error: "Asset is too large (max 4 MB)" }, 413);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const groupId = await getOrCreateGroup(supabase, owner_wallet);

    const form = new FormData();
    form.append("file", new Blob([bytes], { type: mime_type || "application/octet-stream" }), name);
    form.append("pinataMetadata", JSON.stringify({ name }));
    if (groupId) form.append("pinataOptions", JSON.stringify({ groupId }));

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${PINATA_JWT}` },
      body: form,
    });

    if (!res.ok) throw new Error(`Pinata error: ${await res.text()}`);
    const { IpfsHash: cid } = await res.json();
    if (!cid) throw new Error("Pinata did not return a CID");

    const { data: asset, error: dbError } = await supabase
      .from("user_assets")
      .upsert({
        owner_wallet,
        kind: kind || "asset",
        name,
        mime_type: mime_type || "application/octet-stream",
        cid,
        size_bytes: bytes.byteLength,
        metadata: {},
      }, { onConflict: "owner_wallet,cid" })
      .select("id")
      .single();

    if (dbError) throw new Error(`DB Error: ${dbError.message}`);

    const manifestCid = await refreshManifest(supabase, owner_wallet, groupId);

    return json({
      cid,
      id: asset.id,
      group_id: groupId,
      manifest_cid: manifestCid,
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unknown" }, 500);
  }
});
