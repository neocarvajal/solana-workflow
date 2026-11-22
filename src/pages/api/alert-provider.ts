import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { isAlertProvider, isValidAlertFrom } from "@/lib/alertProviders";

type StatusRow = {
  provider: string | null;
  from_email: string | null;
  configured: boolean | null;
  updated_at: string | null;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase server configuration is missing");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function walletFrom(value: unknown): string | null {
  const wallet = String(value || "").trim();
  return wallet.length >= 10 ? wallet : null;
}

async function readStatus(ownerWallet: string) {
  const { data, error } = await adminClient().rpc("get_alert_provider_status", {
    p_owner_wallet: ownerWallet,
  });
  if (error) throw error;
  const row = (data as StatusRow[] | null)?.[0];
  return {
    provider: row?.provider || "resend",
    fromEmail: row?.from_email || "",
    configured: Boolean(row?.configured),
    updatedAt: row?.updated_at || null,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const ownerWallet = walletFrom(
      req.method === "GET" ? req.query.ownerWallet : req.body?.ownerWallet,
    );
    if (!ownerWallet) {
      return res.status(400).json({ error: "Falta la wallet del propietario." });
    }

    if (req.method === "GET") {
      return res.status(200).json(await readStatus(ownerWallet));
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { provider, apiKey, fromEmail } = req.body || {};
    if (!isAlertProvider(provider)) {
      return res.status(400).json({ error: "Proveedor no soportado." });
    }

    const from = String(fromEmail || "").trim();
    if (!isValidAlertFrom(from)) {
      return res.status(400).json({ error: "Introduce un remitente válido." });
    }

    const key = String(apiKey || "").trim();
    const status = await readStatus(ownerWallet);
    const keepsExistingKey = status.configured && provider === status.provider;
    if (key.length < 8 && !keepsExistingKey) {
      return res
        .status(400)
        .json({ error: "Introduce una API key válida para este proveedor." });
    }

    const { error } = await adminClient().rpc("save_alert_provider_config", {
      p_owner_wallet: ownerWallet,
      p_provider: provider,
      p_api_key: key,
      p_from_email: from,
    });
    if (error) throw error;

    return res.status(200).json(await readStatus(ownerWallet));
  } catch (error) {
    console.error("alert-provider:", error instanceof Error ? error.message : error);
    return res
      .status(500)
      .json({ error: "No se pudo guardar la configuración del proveedor." });
  }
}
