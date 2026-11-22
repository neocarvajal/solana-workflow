import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { Settings, X, Save, Wallet, Bell, ChevronDown, Mail, Send, MessageSquare, Phone, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getSettings, saveSettings } from "@/lib/workflowStore";
import { ALERT_PROVIDERS, getAlertProvider, isValidAlertFrom } from "@/lib/alertProviders";
import { toast } from "sonner";

type ProviderStatus = {
  provider: string;
  fromEmail: string;
  configured: boolean;
  updatedAt: string | null;
};

const SettingsDialog: React.FC<{ listenForOpenEvent?: boolean }> = ({ listenForOpenEvent = false }) => {
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [alertChannel, setAlertChannel] = useState("app");
  const [alertEmail, setAlertEmail] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [mounted, setMounted] = useState(false);
  const { publicKey } = useWallet();
  const [emailProvider, setEmailProvider] = useState("resend");
  const [emailApiKey, setEmailApiKey] = useState("");
  const [emailFrom, setEmailFrom] = useState("");
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [savingProvider, setSavingProvider] = useState(false);

  const providerDef = getAlertProvider(emailProvider);
  const ownerWallet = publicKey?.toBase58() || "";

  useEffect(() => {
    setMounted(true);
    if (open) {
      const s = getSettings();
      setRecipient(s.recipientWallet);
      setAlertChannel(s.alertChannel);
      setAlertEmail(s.alertEmail);
      setTelegramChatId(s.telegramChatId);
      setDiscordWebhookUrl(s.discordWebhookUrl);
      setWhatsappPhone(s.whatsappPhone);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !ownerWallet) return;
    let active = true;
    fetch(`/api/alert-provider?ownerWallet=${encodeURIComponent(ownerWallet)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: ProviderStatus | null) => {
        if (!active || !data) return;
        setProviderStatus(data);
        setEmailProvider(data.provider || "resend");
        setEmailFrom(data.fromEmail || "");
      })
      .catch(() => { });
    return () => {
      active = false;
    };
  }, [open, ownerWallet]);

  const handleSaveProvider = async () => {
    if (!ownerWallet) {
      toast.error("Conecta tu wallet para guardar el proveedor de email.");
      return;
    }
    if (!isValidAlertFrom(emailFrom)) {
      toast.error("Introduce un remitente válido.");
      return;
    }
    const key = emailApiKey.trim();
    const keepsExistingKey =
      providerStatus?.configured && emailProvider === providerStatus.provider;
    if (key.length < 8 && !keepsExistingKey) {
      toast.error("Introduce una API key válida para este proveedor.");
      return;
    }
    setSavingProvider(true);
    try {
      const response = await fetch("/api/alert-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerWallet,
          provider: emailProvider,
          apiKey: key,
          fromEmail: emailFrom.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar");
      setProviderStatus(data);
      setEmailApiKey("");
      toast.success(`${providerDef.label} guardado. Los emails de alerta ya lo usarán.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el proveedor.");
    } finally {
      setSavingProvider(false);
    }
  };

  useEffect(() => {
    if (!listenForOpenEvent) return;
    const openSettings = () => setOpen(true);
    window.addEventListener("open-settings", openSettings);
    return () => window.removeEventListener("open-settings", openSettings);
  }, [listenForOpenEvent]);

  const handleSave = () => {
    saveSettings({
      recipientWallet: recipient,
      alertChannel,
      alertEmail,
      telegramChatId,
      discordWebhookUrl,
      whatsappPhone,
    });
    toast.success("Settings saved");
    setOpen(false);
  };

  const modalContent = open && (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 p-2 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-border/60 bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/40 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-semibold">Settings</h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-4 sm:p-5">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2 mb-2">
              <Wallet className="h-3.5 w-3.5" />
              Default Recipient Wallet
            </label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full rounded-xl border border-border/40 bg-muted/50 px-4 py-3 font-mono text-base focus:outline-none focus:ring-2 focus:ring-primary/50 sm:py-2.5 sm:text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2 mb-2">
              <Bell className="h-3.5 w-3.5" />
              Alert Channel
            </label>

            <div className="relative w-full">
              <select
                value={alertChannel}
                onChange={(e) => setAlertChannel(e.target.value)}
                className="w-full cursor-pointer appearance-none rounded-xl border border-border/40 bg-muted/50 px-4 py-3 pr-10 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 sm:py-2.5 sm:text-sm"
              >
                <option value="app">In-App Notification</option>
                <option value="email">Email</option>
                <option value="telegram">Telegram</option>
                <option value="discord">Discord</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
              <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <section className="space-y-3 rounded-xl border border-border/40 bg-muted/20 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Proveedor de email
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Se usa cuando el nodo Alert envía por Email. La API key se guarda cifrada en el servidor.
                </p>
              </div>
              {providerStatus?.configured && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="h-3 w-3" />
                  Guardado
                </span>
              )}
            </div>

            <div>
              <label htmlFor="alert-provider" className="mb-1.5 block text-xs font-medium text-foreground">
                Servicio
              </label>
              <div className="relative w-full">
                <select
                  id="alert-provider"
                  value={emailProvider}
                  onChange={(event) => setEmailProvider(event.target.value)}
                  className="w-full cursor-pointer appearance-none rounded-lg border border-border/40 bg-background/70 px-3 py-3 pr-10 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 sm:py-2.5 sm:text-sm"
                >
                  {ALERT_PROVIDERS.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              </div>
              <a
                href={providerDef.website}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                Visitar sitio oficial de {providerDef.label}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div>
              <label htmlFor="alert-api-key" className="mb-1.5 block text-xs font-medium text-foreground">
                {providerDef.keyLabel}
              </label>
              <input
                id="alert-api-key"
                type="password"
                value={emailApiKey}
                onChange={(event) => setEmailApiKey(event.target.value)}
                placeholder={providerDef.keyPlaceholder}
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-lg border border-border/40 bg-background/70 px-3 py-3 font-mono text-base focus:outline-none focus:ring-2 focus:ring-primary/50 sm:py-2.5 sm:text-sm"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                {providerStatus?.configured
                  ? emailProvider === providerStatus.provider
                    ? "Ya hay una key guardada. Déjalo vacío para conservarla o introduce otra para reemplazarla."
                    : "Este proveedor necesita su propia key. Pégala antes de guardar."
                  : "Nunca se muestra ni se guarda en el navegador."}
              </p>
            </div>

            <div>
              <label htmlFor="alert-from-email" className="mb-1.5 block text-xs font-medium text-foreground">
                Remitente
              </label>
              <input
                id="alert-from-email"
                type="text"
                value={emailFrom}
                onChange={(event) => setEmailFrom(event.target.value)}
                placeholder="Solana Workflow <alerts@tu-dominio.com>"
                className="w-full rounded-lg border border-border/40 bg-background/70 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 sm:py-2.5 sm:text-sm"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">{providerDef.fromHint}</p>
            </div>

            <button
              type="button"
              onClick={handleSaveProvider}
              disabled={savingProvider}
              className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/15 disabled:opacity-60"
            >
              {savingProvider && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {savingProvider ? "Guardando…" : "Guardar proveedor de email"}
            </button>
          </section>

          <div className="space-y-3 rounded-xl border border-border/40 bg-muted/20 p-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Destinos de alertas
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Se usan cuando el nodo de alerta no define un destino propio.
              </p>
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-foreground">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                Email destinatario
              </label>
              <input
                type="email"
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
                className="w-full rounded-lg border border-border/40 bg-background/70 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 sm:py-2.5 sm:text-sm"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-foreground">
                <Send className="h-3.5 w-3.5 text-muted-foreground" />
                Telegram Chat ID
              </label>
              <input
                type="text"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="123456789"
                autoComplete="off"
                className="w-full rounded-lg border border-border/40 bg-background/70 px-3 py-3 font-mono text-base focus:outline-none focus:ring-2 focus:ring-primary/50 sm:py-2.5 sm:text-sm"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-foreground">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                Discord Webhook URL
              </label>
              <input
                type="url"
                value={discordWebhookUrl}
                onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/…"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-lg border border-border/40 bg-background/70 px-3 py-3 font-mono text-base focus:outline-none focus:ring-2 focus:ring-primary/50 sm:py-2.5 sm:text-sm"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-foreground">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                WhatsApp
              </label>
              <input
                type="tel"
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
                placeholder="+5215512345678"
                autoComplete="tel"
                inputMode="tel"
                className="w-full rounded-lg border border-border/40 bg-background/70 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 sm:py-2.5 sm:text-sm"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Incluye el código de país. Ejemplo: +52 1 55 1234 5678.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-border/40 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5">
          <button
            onClick={handleSave}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Save className="h-4 w-4" />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border transition-colors hover:bg-muted"
        title="Settings"
        aria-label="Settings"
      >
        <Settings className="h-4 w-4" />
      </button>

      {mounted ? ReactDOM.createPortal(modalContent, document.body) : null}
    </>
  );
};

export default SettingsDialog;