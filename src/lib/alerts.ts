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
  /** Data from the trigger, used to resolve {{price}}, {{asset}}, etc. */
  variables?: Record<string, unknown>;
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function getPath(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}

export function formatAlertPrice(value: number): string {
  if (!Number.isFinite(value)) return "";
  const absolute = Math.abs(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: absolute > 0 && absolute < 1 ? 8 : 2,
  }).format(value);
}

function formatAlertValue(key: string, value: unknown, variables: Record<string, unknown>): string {
  const normalizedKey = key.split(".").pop()?.toLowerCase() || "";
  const condition = String(variables.condition || "").toLowerCase();
  const numericValue = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : Number.NaN;

  if (
    Number.isFinite(numericValue) &&
    (normalizedKey === "price" || normalizedKey === "priceusd")
  ) {
    return formatAlertPrice(numericValue);
  }

  if (
    Number.isFinite(numericValue) &&
    (normalizedKey === "value" || normalizedKey === "threshold")
  ) {
    return condition === "change_pct" ? `${numericValue}%` : formatAlertPrice(numericValue);
  }

  if (normalizedKey === "asset") return String(value).toUpperCase();
  if (normalizedKey === "timestamp") {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("es");
  }

  return String(value);
}

/**
 * Replaces `{{price}}`, `{{asset}}`, `{{condition}}`, `{{value}}`, etc. in an
 * alert title/message. If the message doesn't reference the price but the
 * trigger provides one, a compact price line is appended automatically.
 */
export function resolveAlertMessage(
  template: string,
  variables?: Record<string, unknown>,
  options?: { appendPriceContext?: boolean },
): string {
  const input = String(template || "");
  const source = asRecord(variables);
  const trigger = asRecord(source.trigger);
  const flat: Record<string, unknown> = {
    ...trigger,
    ...source,
    trigger: source.trigger ?? trigger,
    timestamp: source.timestamp ?? new Date().toISOString(),
  };

  let resolved = input.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (token, path: string) => {
    const value = getPath(flat, path);
    if (value === undefined || value === null || value === "") return token;
    return formatAlertValue(path, value, flat);
  });

  if (options?.appendPriceContext !== false && input.trim()) {
    const rawPrice = flat.price;
    const price = typeof rawPrice === "number"
      ? rawPrice
      : rawPrice === null || rawPrice === undefined || rawPrice === ""
        ? Number.NaN
        : Number(rawPrice);
    if (Number.isFinite(price)) {
      const priceText = formatAlertPrice(price);
      if (priceText && !resolved.includes(priceText) && !resolved.includes(String(price))) {
        const asset = String(flat.asset || "Token").toUpperCase();
        resolved = `${resolved}\n\n${asset}: ${priceText}`;
      }
    }
  }

  return resolved.trim();
}

function resolvePayload(input: AlertInput) {
  const settings = getSettings();
  const variables = input.variables || {};
  return {
    channel: normalizeAlertChannel(input.channel),
    message: resolveAlertMessage(String(input.message || "").trim(), variables),
    title: resolveAlertMessage(
      String(input.title || "").trim() || "Alerta de Solana Workflow",
      variables,
      { appendPriceContext: false },
    ),
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
