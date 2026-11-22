export type AlertProviderId = "resend" | "sendgrid" | "postmark";

export interface AlertProviderDef {
  id: AlertProviderId;
  label: string;
  website: string;
  keyLabel: string;
  keyPlaceholder: string;
  fromHint: string;
}

/** Public catalogue shown in the alert settings form. No credentials live here. */
export const ALERT_PROVIDERS: AlertProviderDef[] = [
  {
    id: "resend",
    label: "Resend",
    website: "https://resend.com",
    keyLabel: "API key de Resend",
    keyPlaceholder: "re_...",
    fromHint: "Remitente verificado en Resend, p. ej. Solana Workflow <alerts@tu-dominio.com>",
  },
  {
    id: "sendgrid",
    label: "SendGrid",
    website: "https://sendgrid.com",
    keyLabel: "API key de SendGrid",
    keyPlaceholder: "SG....",
    fromHint: "Remitente verificado en SendGrid",
  },
  {
    id: "postmark",
    label: "Postmark",
    website: "https://postmarkapp.com",
    keyLabel: "Server token de Postmark",
    keyPlaceholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    fromHint: "Firma de remitente verificada en Postmark",
  },
];

export function isAlertProvider(value: unknown): value is AlertProviderId {
  return ALERT_PROVIDERS.some((provider) => provider.id === value);
}

/** Accepts both `email@example.com` and `Name <email@example.com>`. */
export function isValidAlertFrom(value: unknown): boolean {
  const raw = String(value || "").trim();
  const email = raw.match(/<([^>]+)>/)?.[1] ?? raw;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function getAlertProvider(value: unknown): AlertProviderDef {
  return ALERT_PROVIDERS.find((provider) => provider.id === value) ?? ALERT_PROVIDERS[0];
}
