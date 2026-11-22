import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type StatusRow = {
  chat_id: string | null;
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

function nodeIdFrom(value: unknown): string | null {
  const nodeId = String(value || "").trim();
  if (!nodeId || nodeId.length > 120 || !/^[A-Za-z0-9_-]+$/.test(nodeId)) return null;
  return nodeId;
}

function isValidChatId(value: unknown): boolean {
  const chatId = String(value || "").trim();
  return chatId.length > 0 && chatId.length <= 120 && /^@?[A-Za-z0-9_-]+$/.test(chatId);
}

async function readStatus(ownerWallet: string, nodeId: string) {
  const { data, error } = await adminClient().rpc("get_alert_telegram_status", {
    p_owner_wallet: ownerWallet,
    p_node_id: nodeId,
  });
  if (error) throw error;
  const row = (data as StatusRow[] | null)?.[0];
  return {
    chatId: row?.chat_id || "",
    configured: Boolean(row?.configured),
    updatedAt: row?.updated_at || null,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const source = req.method === "GET" ? req.query : req.body || {};
    const ownerWallet = walletFrom(source.ownerWallet);
    if (!ownerWallet) {
      return res.status(400).json({ error: "Falta la wallet del propietario." });
    }

    const nodeId = nodeIdFrom(source.nodeId);
    if (!nodeId) {
      return res.status(400).json({ error: "Falta el identificador del nodo." });
    }

    if (req.method === "GET") {
      return res.status(200).json(await readStatus(ownerWallet, nodeId));
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { botToken, chatId } = req.body || {};
    if (!isValidChatId(chatId)) {
      return res.status(400).json({ error: "Introduce un Chat ID válido." });
    }

    const token = String(botToken || "").trim();
    const status = await readStatus(ownerWallet, nodeId);
    if (token.length < 10 && !status.configured) {
      return res.status(400).json({ error: "Introduce el token del bot de Telegram." });
    }

    const { error } = await adminClient().rpc("save_alert_telegram_config", {
      p_owner_wallet: ownerWallet,
      p_node_id: nodeId,
      p_bot_token: token,
      p_chat_id: String(chatId).trim(),
    });
    if (error) throw error;

    return res.status(200).json(await readStatus(ownerWallet, nodeId));
  } catch (error) {
    console.error("alert-telegram:", error instanceof Error ? error.message : error);
    return res
      .status(500)
      .json({ error: "No se pudo guardar la configuración de Telegram." });
  }
}
