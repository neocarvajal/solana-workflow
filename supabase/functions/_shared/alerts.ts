export type AlertChannel = "app" | "telegram" | "discord" | "email" | "whatsapp";

export interface AlertPayload {
  channel?: string;
  message?: string;
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

const MAX_MESSAGE_LENGTH = 4000;
const MAX_TITLE_LENGTH = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+[1-9]\d{7,14}$/;
const DISCORD_HOSTS = new Set(["discord.com", "discordapp.com", "ptb.discord.com", "canary.discord.com"]);

const env = (name: string) => (Deno.env.get(name) || "").trim();
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

function success(
  channel: AlertChannel,
  provider: string,
  message: string,
  status = 200,
): AlertResult {
  return { ok: true, channel, provider, message, status };
}

function fail(
  channel: AlertChannel,
  message: string,
  status = 400,
  provider?: string,
): AlertResult {
  return { ok: false, channel, provider, message, status };
}

export function normalizeAlertChannel(value: unknown): AlertChannel | null {
  const channel = text(value).toLowerCase();
  if (channel === "app" || channel === "telegram" || channel === "discord" || channel === "email" || channel === "whatsapp") {
    return channel;
  }
  return null;
}

function composeText(title: string, message: string) {
  return title ? `${title}\n\n${message}` : message;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizePhone(value: string) {
  let phone = value.replace(/[\s\-().]/g, "");
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  if (!phone.startsWith("+")) phone = `+${phone}`;
  return phone;
}

async function providerError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    const message =
      body?.error?.message ||
      body?.error ||
      body?.message ||
      body?.description ||
      body?.detail;
    if (typeof message === "string" && message.trim()) return message.trim();
  } catch {
    /* ignore non-JSON provider responses */
  }
  return `${fallback} (HTTP ${response.status})`;
}

async function sendTelegram(
  payload: AlertPayload,
  body: string,
  fetchImpl: typeof fetch,
): Promise<AlertResult> {
  const token = env("TELEGRAM_BOT_TOKEN");
  const chatId = text(payload.chatId) || env("TELEGRAM_CHAT_ID");

  if (!token) {
    return fail(
      "telegram",
      "Falta configurar TELEGRAM_BOT_TOKEN en Supabase Secrets.",
      503,
      "telegram",
    );
  }
  if (!chatId) {
    return fail(
      "telegram",
      "Falta el Chat ID de Telegram. Configúralo en el nodo o en Ajustes.",
      400,
      "telegram",
    );
  }

  const response = await fetchImpl(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: body,
        disable_web_page_preview: true,
      }),
    },
  );

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    /* ignore */
  }

  if (!response.ok || data?.ok === false) {
    return fail(
      "telegram",
      `Telegram rechazó el mensaje: ${data?.description || `HTTP ${response.status}`}`,
      502,
      "telegram",
    );
  }

  return success("telegram", "telegram", "Alerta enviada por Telegram.", response.status);
}

async function sendDiscord(
  payload: AlertPayload,
  body: string,
  fetchImpl: typeof fetch,
): Promise<AlertResult> {
  const rawUrl = text(payload.webhookUrl) || env("DISCORD_WEBHOOK_URL");

  if (!rawUrl) {
    return fail(
      "discord",
      "Falta el webhook de Discord. Configúralo en el nodo o en Ajustes.",
      503,
      "discord",
    );
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return fail("discord", "La URL del webhook de Discord no es válida.", 400, "discord");
  }

  if (
    url.protocol !== "https:" ||
    !DISCORD_HOSTS.has(url.hostname.toLowerCase()) ||
    !url.pathname.startsWith("/api/webhooks/")
  ) {
    return fail(
      "discord",
      "La URL debe ser un webhook oficial de Discord (https://discord.com/api/webhooks/…).",
      400,
      "discord",
    );
  }

  const response = await fetchImpl(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: body.slice(0, 2000),
      username: "Solana Workflow",
      allowed_mentions: { parse: [] },
    }),
  });

  if (!response.ok) {
    return fail(
      "discord",
      `Discord rechazó el mensaje: ${await providerError(response, "Error de Discord")}`,
      502,
      "discord",
    );
  }

  return success("discord", "discord", "Alerta enviada por Discord.", response.status);
}

async function sendEmail(
  payload: AlertPayload,
  title: string,
  body: string,
  fetchImpl: typeof fetch,
): Promise<AlertResult> {
  const apiKey = env("RESEND_API_KEY");
  const from = env("ALERT_FROM_EMAIL") || env("RESEND_FROM_EMAIL");
  const to = text(payload.email) || env("ALERT_EMAIL_TO");

  if (!apiKey) {
    return fail(
      "email",
      "Falta configurar RESEND_API_KEY en Supabase Secrets.",
      503,
      "resend",
    );
  }
  if (!from) {
    return fail(
      "email",
      "Falta configurar ALERT_FROM_EMAIL en Supabase Secrets.",
      503,
      "resend",
    );
  }
  if (!to) {
    return fail(
      "email",
      "Falta el email destinatario. Configúralo en el nodo o en Ajustes.",
      400,
      "resend",
    );
  }
  if (!EMAIL_RE.test(to)) {
    return fail("email", "El email destinatario no es válido.", 400, "resend");
  }

  const subject = (title || "Alerta de Solana Workflow").slice(0, MAX_TITLE_LENGTH);
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#0b0b12;color:#f5f5f5;font-family:system-ui,-apple-system,'Segoe UI',sans-serif"><div style="max-width:560px;margin:0 auto;background:#15151f;border:1px solid #2a2a3a;border-radius:16px;padding:24px"><h1 style="margin:0 0 16px;font-size:20px;color:#ffffff">${escapeHtml(subject)}</h1><p style="margin:0;white-space:pre-wrap;line-height:1.6;color:#d4d4e0">${escapeHtml(body)}</p><p style="margin:24px 0 0;font-size:12px;color:#8b8b9e">Enviado por Solana Workflow</p></div></body></html>`;

  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: body,
      html,
    }),
  });

  if (!response.ok) {
    return fail(
      "email",
      `El proveedor de email rechazó el mensaje: ${await providerError(response, "Error de Resend")}`,
      502,
      "resend",
    );
  }

  return success("email", "resend", `Alerta enviada por email a ${to}.`, response.status);
}

async function sendWhatsApp(
  payload: AlertPayload,
  body: string,
  fetchImpl: typeof fetch,
): Promise<AlertResult> {
  const rawPhone = text(payload.phone) || env("WHATSAPP_TO");
  if (!rawPhone) {
    return fail(
      "whatsapp",
      "Falta el número de WhatsApp. Configúralo en el nodo o en Ajustes.",
      400,
      "whatsapp",
    );
  }

  const phone = normalizePhone(rawPhone);
  if (!PHONE_RE.test(phone)) {
    return fail(
      "whatsapp",
      "El número de WhatsApp no es válido. Usa el formato internacional, por ejemplo +5215512345678.",
      400,
      "whatsapp",
    );
  }

  const metaToken = env("WHATSAPP_ACCESS_TOKEN");
  const metaPhoneId = env("WHATSAPP_PHONE_NUMBER_ID");

  if (metaToken && metaPhoneId) {
    const response = await fetchImpl(
      `https://graph.facebook.com/v20.0/${metaPhoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${metaToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone.replace(/^\+/, ""),
          type: "text",
          text: { preview_url: false, body: body.slice(0, 4096) },
        }),
      },
    );

    if (!response.ok) {
      return fail(
        "whatsapp",
        `WhatsApp rechazó el mensaje: ${await providerError(response, "Error de Meta")}`,
        502,
        "meta",
      );
    }

    return success(
      "whatsapp",
      "meta",
      `Alerta enviada por WhatsApp a ${phone}.`,
      response.status,
    );
  }

  const twilioSid = env("TWILIO_ACCOUNT_SID");
  const twilioToken = env("TWILIO_AUTH_TOKEN");
  const twilioFrom = env("TWILIO_WHATSAPP_FROM");

  if (twilioSid && twilioToken && twilioFrom) {
    const from = twilioFrom.startsWith("whatsapp:") ? twilioFrom : `whatsapp:${twilioFrom}`;
    const form = new URLSearchParams({
      From: from,
      To: `whatsapp:${phone}`,
      Body: body.slice(0, 1600),
    });

    const response = await fetchImpl(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      },
    );

    if (!response.ok) {
      return fail(
        "whatsapp",
        `WhatsApp rechazó el mensaje: ${await providerError(response, "Error de Twilio")}`,
        502,
        "twilio",
      );
    }

    return success(
      "whatsapp",
      "twilio",
      `Alerta enviada por WhatsApp a ${phone}.`,
      response.status,
    );
  }

  return fail(
    "whatsapp",
    "Falta configurar WhatsApp en Supabase Secrets: WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID (Meta) o TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_FROM (Twilio).",
    503,
    "whatsapp",
  );
}

export async function deliverAlert(
  payload: AlertPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<AlertResult> {
  const channel = normalizeAlertChannel(payload?.channel);
  if (!channel) {
    return fail("app", "Canal de alerta no válido.", 400);
  }

  const message = text(payload?.message).slice(0, MAX_MESSAGE_LENGTH);
  if (!message) {
    return fail(channel, "El mensaje de la alerta está vacío.", 400);
  }

  const title = text(payload?.title).slice(0, MAX_TITLE_LENGTH);
  const body = composeText(title, message);

  switch (channel) {
    case "app":
      return success("app", "in-app", "Notificación in-app creada.");
    case "telegram":
      return sendTelegram(payload, body, fetchImpl);
    case "discord":
      return sendDiscord(payload, body, fetchImpl);
    case "email":
      return sendEmail(payload, title, body, fetchImpl);
    case "whatsapp":
      return sendWhatsApp(payload, body, fetchImpl);
    default:
      return fail("app", "Canal de alerta no válido.", 400);
  }
}

export function alertChannelHealth() {
  const metaWhatsApp = Boolean(env("WHATSAPP_ACCESS_TOKEN") && env("WHATSAPP_PHONE_NUMBER_ID"));
  const twilioWhatsApp = Boolean(
    env("TWILIO_ACCOUNT_SID") && env("TWILIO_AUTH_TOKEN") && env("TWILIO_WHATSAPP_FROM"),
  );

  return {
    app: true,
    telegram: Boolean(env("TELEGRAM_BOT_TOKEN")),
    discord: Boolean(env("DISCORD_WEBHOOK_URL")),
    email: Boolean(env("RESEND_API_KEY") && (env("ALERT_FROM_EMAIL") || env("RESEND_FROM_EMAIL"))),
    whatsapp: metaWhatsApp || twilioWhatsApp,
    whatsappProvider: metaWhatsApp ? "meta" : twilioWhatsApp ? "twilio" : null,
  };
}
