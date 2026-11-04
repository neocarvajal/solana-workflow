import { supabase } from "@/integrations/supabase/client";
import { getSettings } from "@/lib/workflowStore";
import { addNotification } from "@/lib/notificationStore";

export type AlertChannel = "app" | "telegram" | "discord" | "email" | "whatsapp";

export const ALERT_CHANNEL_OPTIONS: { value: AlertChannel; label: string }[] = [
  { value: "app", label: "In-App Notification" },
  { value: "telegram", label: "Telegram" },
  { value: "discord", label: "Discord Webhook" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
];

export interface AlertInput {
  channel?: string;
  message: string;
  title?: string;
  email?: string;
  chatId?: string;
  webhookUrl?: string;
  phone?: string;
  ownerWallet?: string;
}

export interface AlertResult {
  ok: boolean;
  channel: AlertChannel;
  provider?: string;
  message: string;
  status?: number;
}

export function normalizeAlertChannel(value: unknown): AlertChannel {
  const channel = String(value || "").trim().toLowerCase();
  if (channel === "telegram" || channel === "discord" || channel === "email" || channel === "whatsapp") {
    return channel;
  }
  return "app";
}

export function alertChannelLabel(channel: unknown): string {
  const value = normalizeAlertChannel(channel);
  return ALERT_CHANNEL_OPTIONS.find((item) => item.value === value)?.label || "In-App Notification";
}

function resolvePayload(input: AlertInput) {
  const settings = getSettings();
  return {
    channel: normalizeAlertChannel(input.channel),
    message: String(input.message || "").trim(),
    title: String(input.title || "").trim() || "Alerta de Solana Workflow",
    email: String(input.email || "").trim() || settings.alertEmail.trim(),
    chatId: String(input.chatId || "").trim() || settings.telegramChatId.trim(),
    webhookUrl: String(input.webhookUrl || "").trim() || settings.discordWebhookUrl.trim(),
    phone: String(input.phone || "").trim() || settings.whatsappPhone.trim(),
    ownerWallet: input.ownerWallet || "",
  };
}

async function readFunctionError(error: unknown): Promise<string> {
  const candidate = error as { message?: string; context?: Response };
  const context = candidate?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.json();
      if (typeof body?.error === "string" && body.error.trim()) return body.error;
      if (typeof body?.message === "string" && body.message.trim()) return body.message;
    } catch {
      /* ignore non-JSON error bodies */
    }
  }
  return candidate?.message || "No se pudo enviar la alerta.";
}

export async function sendAlert(input: AlertInput): Promise<AlertResult> {
  const payload = resolvePayload(input);
  const channel = payload.channel;
  const channelName = alertChannelLabel(channel);

  if (!payload.message) {
    const message = "El mensaje de la alerta está vacío.";
    addNotification({
      title: `No se pudo enviar por ${channelName}`,
      message,
      channel,
      status: "error",
    });
    return { ok: false, channel, message };
  }

  if (channel === "app") {
    addNotification({
      title: payload.title,
      message: payload.message,
      channel,
      status: "success",
    });
    return {
      ok: true,
      channel,
      provider: "in-app",
      message: "Notificación in-app creada.",
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke("send-alert", {
      body: payload,
    });

    if (error) {
      const message = await readFunctionError(error);
      addNotification({
        title: `No se pudo enviar por ${channelName}`,
        message: `${payload.message}\n\n${message}`,
        channel,
        status: "error",
      });
      return { ok: false, channel, message };
    }

    const result = data as AlertResult | null;
    if (!result || result.ok !== true) {
      const message = result?.message || `El canal ${channelName} no confirmó el envío.`;
      addNotification({
        title: `No se pudo enviar por ${channelName}`,
        message: `${payload.message}\n\n${message}`,
        channel,
        status: "error",
      });
      return { ok: false, channel, message };
    }

    addNotification({
      title: `${channelName}: alerta enviada`,
      message: payload.message,
      channel,
      status: "success",
    });
    return {
      ...result,
      ok: true,
      channel,
      message: result.message || `Alerta enviada por ${channelName}.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error de red al enviar la alerta.";
    addNotification({
      title: `No se pudo enviar por ${channelName}`,
      message: `${payload.message}\n\n${message}`,
      channel,
      status: "error",
    });
    return { ok: false, channel, message };
  }
}
