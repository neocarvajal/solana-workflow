import React, { useState, useEffect } from "react";
import {
  X, Trash2, Loader2, Send, AlertTriangle, Landmark,
  ChevronDown, ExternalLink, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@solana/wallet-adapter-react";
import type { FlowNode } from "@/lib/workflow";
import {
  ALERT_PROVIDERS,
  getAlertProvider,
  isAlertProvider,
  isValidAlertFrom,
} from "@/lib/alertProviders";
import {
  alertChannelLabel,
  fetchAlertChannelHealth,
  isValidAlertEmail,
  sendAlert,
} from "@/lib/alerts";
import { useVaultReady } from "@/lib/useVaultReady";

/* ── Per-module field definitions ────────────────────────────── */
interface FieldDef {
  key: string;
  label: string;
  type: "text" | "email" | "number" | "select" | "textarea" | "toggle";
  placeholder?: string;
  description?: string;
  options?: { value: string; label: string }[];
  /** Only show this field when another param matches. */
  showWhen?: { key: string; equals: string | string[] };
  /** Parse the textarea value as JSON instead of plain text. */
  json?: boolean;
}

type ProviderStatus = {
  provider: string;
  fromEmail: string;
  configured: boolean;
  updatedAt: string | null;
};

const MODULE_FIELDS: Record<string, FieldDef[]> = {
  /* ── Triggers ──────────────────────────── */
  price_monitor: [
    {
      key: "asset", label: "Asset", type: "select", description: "Token to monitor",
      options: [
        { value: "SOL", label: "SOL" },
        { value: "BONK", label: "BONK" },
        { value: "JUP", label: "JUP" },
        { value: "MF", label: "MF" },
      ]
    },
    {
      key: "condition", label: "Price condition", type: "select", description: "Choose the rule that fires the alert",
      options: [
        { value: "price", label: "Price check (always report)" },
        { value: "above", label: "Price is above target" },
        { value: "below", label: "Price is below target" },
        { value: "change_pct", label: "24h change ≥ threshold (%)" },
      ]
    },
    {
      key: "value", label: "Target price (USD)", type: "number",
      showWhen: { key: "condition", equals: ["above", "below"] },
      placeholder: "e.g. 150",
      description: "The alert fires when the current price is above or below this USD value",
    },
    {
      key: "value", label: "24h change threshold (%)", type: "number",
      showWhen: { key: "condition", equals: "change_pct" },
      placeholder: "e.g. 5",
      description: "Fires when the absolute 24h price change is at least this percentage, up or down",
    },
    {
      key: "interval", label: "Check interval", type: "select", description: "How often to check the price. Match the global execution frequency when publishing on-chain.",
      options: [
        { value: "30s", label: "Every 30 seconds" },
        { value: "1m", label: "Every minute" },
        { value: "2m", label: "Every 2 minutes" },
        { value: "5m", label: "Every 5 minutes" },
        { value: "15m", label: "Every 15 minutes" },
      ]
    },
  ],

  dexscreener_pair: [
    { key: "pairAddress", label: "Pair Address", type: "text", placeholder: "Enter DexScreener pair address", description: "The address of the pair to watch" },
    {
      key: "apiType", label: "API Type", type: "select", description: "DexScreener endpoint to use",
      options: [
        { value: "pairs", label: "Pairs — /dex/pairs/:chainId/:pairAddresses" },
        { value: "tokens", label: "Tokens — /dex/tokens/:tokenAddresses" },
        { value: "search", label: "Search — /dex/search/?q=:query" },
      ]
    },
    {
      key: "metric", label: "Metric", type: "select", description: "What to watch",
      options: [
        { value: "price", label: "Price (USD)" },
        { value: "volume", label: "Volume (24h)" },
        { value: "liquidity", label: "Liquidity" },
        { value: "priceChange", label: "Price Change %" },
      ]
    },
    {
      key: "condition", label: "Condition", type: "select",
      options: [
        { value: "above", label: "Goes above" },
        { value: "below", label: "Goes below" },
      ]
    },
    { key: "value", label: "Threshold", type: "number", placeholder: "0" },
  ],

  schedule: [
    {
      key: "every", label: "Run Every", type: "select", description: "How often the workflow runs. Match the global execution frequency when publishing on-chain.",
      options: [
        { value: "30s", label: "Every 30 seconds" },
        { value: "1m", label: "Every minute" },
        { value: "2m", label: "Every 2 minutes" },
        { value: "5m", label: "Every 5 minutes" },
        { value: "15m", label: "Every 15 minutes" },
        { value: "30m", label: "Every 30 minutes" },
        { value: "1h", label: "Every hour" },
        { value: "6h", label: "Every 6 hours" },
        { value: "24h", label: "Every day" },
      ]
    },
  ],

  webhook: [
    { key: "path", label: "Webhook Path", type: "text", placeholder: "/solana-event" },
    {
      key: "eventType", label: "Event Type", type: "select", description: "Filter specific blockchain events",
      options: [
        { value: "all", label: "All Activity" },
        { value: "transfer", label: "Only Transfers" },
        { value: "swap", label: "Only Swaps" },
        { value: "nft_mint", label: "NFT Mints" },
      ]
    },
    { key: "account", label: "Monitored Account", type: "text", placeholder: "Wallet address to watch" }
  ],

  /* ── Steps ──────────────────────────── */
  send_transaction: [
    { key: "to", label: "Recipient Wallet", type: "text", placeholder: "Enter wallet address…", description: "Solana address to send to" },
    { key: "amount", label: "Amount", type: "number", placeholder: "0.1", description: "How much to send" },
    {
      key: "asset", label: "Token", type: "select", description: "Which token to transfer",
      options: [
        { value: "SOL", label: "SOL" },
        { value: "USDC", label: "USDC" },
        { value: "BONK", label: "BONK" },
        { value: "JUP", label: "JUP" },
        { value: "MF", label: "MF" },
      ]
    },
  ],

  send_alert: [
    {
      key: "channel", label: "Alert Channel", type: "select", description: "Where to send the alert",
      options: [
        { value: "app", label: "In-App Notification" },
        { value: "telegram", label: "Telegram" },
        { value: "discord", label: "Discord Webhook" },
        { value: "email", label: "Email" },
        { value: "whatsapp", label: "WhatsApp" },
      ]
    },
    {
      key: "title", label: "Título", type: "text",
      placeholder: "Alerta de precio",
      description: "Asunto del email o título de la notificación (opcional)",
    },
    { key: "message", label: "Mensaje", type: "textarea", placeholder: "Current {{asset}} price: {{price}}", description: "Contenido de la alerta. Variables: {{price}}, {{asset}}, {{condition}}, {{value}}, {{timestamp}}. Si no usas {{price}}, se añade el precio del trigger al final." },
    {
      key: "email", label: "Email destinatario", type: "email",
      showWhen: { key: "channel", equals: "email" },
      placeholder: "tu@email.com",
      description: "Debe ser válido. Configura el destinatario en este nodo.",
    },
    {
      key: "chatId", label: "Telegram Chat ID", type: "text",
      showWhen: { key: "channel", equals: "telegram" },
      placeholder: "123456789",
      description: "Configura el Chat ID en este nodo.",
    },
    {
      key: "webhookUrl", label: "Discord Webhook URL", type: "text",
      showWhen: { key: "channel", equals: "discord" },
      placeholder: "https://discord.com/api/webhooks/…",
      description: "Pégalo en este nodo; no se guarda en ajustes globales.",
    },
    {
      key: "phone", label: "WhatsApp", type: "text",
      showWhen: { key: "channel", equals: "whatsapp" },
      placeholder: "+5215512345678",
      description: "Número con código de país configurado en este nodo.",
    },
  ],

  swap: [
    {
      key: "from", label: "From Token", type: "select", description: "Token to swap from",
      options: [
        { value: "SOL", label: "SOL" },
        { value: "USDC", label: "USDC" },
        { value: "BONK", label: "BONK" },
        { value: "JUP", label: "JUP" },
        { value: "RAY", label: "RAY" },
      ]
    },
    {
      key: "to", label: "To Token", type: "select", description: "Token to swap into",
      options: [
        { value: "USDC", label: "USDC" },
        { value: "SOL", label: "SOL" },
        { value: "BONK", label: "BONK" },
        { value: "JUP", label: "JUP" },
      ]
    },
    { key: "amount", label: "Amount", type: "number", placeholder: "1", description: "Amount of the source token to swap" },
    { key: "slippage", label: "Max Slippage %", type: "number", placeholder: "1", description: "Maximum slippage tolerance" },
  ],

  http_request: [
    {
      key: "method", label: "Method", type: "select",
      options: [
        { value: "GET", label: "GET" },
        { value: "POST", label: "POST" },
        { value: "PUT", label: "PUT" },
        { value: "DELETE", label: "DELETE" },
      ]
    },
    { key: "url", label: "URL", type: "text", placeholder: "https://api.example.com/data" },
    { key: "body", label: "Body (JSON)", type: "textarea", placeholder: '{ "key": "value" }', description: "Request body for POST/PUT", json: true },
  ],

  ai_decision: [
    { key: "prompt", label: "AI Prompt", type: "textarea", placeholder: "Analyze the data and decide next action.", description: "Instruction for the AI agent" },
  ],

  dexscreener_lookup: [
    { key: "pairAddress", label: "Pair Address", type: "text", placeholder: "Enter pair address…", description: "DexScreener pair to look up" },
    {
      key: "apiType", label: "API Endpoint", type: "select", description: "Which DexScreener API endpoint to call",
      options: [
        { value: "pairs", label: "Pairs — /dex/pairs/:chainId/:pairAddresses" },
        { value: "tokens", label: "Tokens — /dex/tokens/:tokenAddresses" },
        { value: "search", label: "Search — /dex/search/?q=:query" },
      ]
    },
  ],
};

/* ── Component ───────────────────────────────────────────────── */
const NodeSettingsModal: React.FC<{
  node: FlowNode;
  onSave: (updatedNode: FlowNode) => void;
  onClose: () => void;
  onDelete?: (id: string) => void;
  vaultRequired?: boolean;
}> = ({ node, onSave, onClose, onDelete, vaultRequired = false }) => {
  const vaultReady = useVaultReady();
  const { publicKey } = useWallet();
  const ownerWallet = publicKey?.toBase58() || "";

  const mergeParams = (nodeParams: any) => {
    const defaults = node.module.defaultParams || {};
    const incoming = nodeParams || {};

    let merged = { ...defaults, ...incoming };

    if (merged.fromAsset) {
      merged.asset = merged.fromAsset;
      delete merged.fromAsset;
    }

    if (merged.to === undefined || merged.to === null) {
      merged.to = "";
    }
    return merged;
  };

  const [params, setParams] = useState<Record<string, any>>(() =>
    mergeParams(node.params)
  );
  const [testingAlert, setTestingAlert] = useState(false);
  const [channelHealth, setChannelHealth] = useState<Record<string, unknown> | null>(null);
  const [emailProvider, setEmailProvider] = useState("resend");
  const [emailApiKey, setEmailApiKey] = useState("");
  const [emailFrom, setEmailFrom] = useState("");
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [savingProvider, setSavingProvider] = useState(false);

  const nodeId = String(params.nodeKey || "").trim();
  const providerDef = getAlertProvider(emailProvider);
  const isAlertNode = node.module.type === "send_alert";

  useEffect(() => {
    const cleanParams = mergeParams(node.params);
    setParams(cleanParams);
  }, [node.id, JSON.stringify(node.params)]);

  useEffect(() => {
    if (!isAlertNode || nodeId) return;
    const key =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `alert-${Date.now()}`;
    setParams((prev) => ({ ...prev, nodeKey: key }));
  }, [isAlertNode, nodeId]);

  useEffect(() => {
    if (!isAlertNode) return;
    setEmailProvider(isAlertProvider(params.provider) ? params.provider : "resend");
    setEmailFrom(String(params.fromEmail || ""));
  }, [isAlertNode, node.id, params.provider, params.fromEmail]);

  useEffect(() => {
    if (!isAlertNode || !ownerWallet || !nodeId) return;
    let active = true;
    setProviderStatus(null);
    fetch(`/api/alert-provider?ownerWallet=${encodeURIComponent(ownerWallet)}&nodeId=${encodeURIComponent(nodeId)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: ProviderStatus | null) => {
        if (!active || !data) return;
        setProviderStatus(data);
        if (data.configured) {
          setEmailProvider(isAlertProvider(data.provider) ? data.provider : "resend");
          setEmailFrom(data.fromEmail || "");
        }
      })
      .catch(() => { });
    return () => {
      active = false;
    };
  }, [isAlertNode, ownerWallet, nodeId]);

  useEffect(() => {
    if (!ownerWallet || !nodeId) {
      setChannelHealth(null);
      return;
    }
    let active = true;
    fetchAlertChannelHealth(ownerWallet, nodeId).then((health) => {
      if (active) setChannelHealth(health);
    });
    return () => {
      active = false;
    };
  }, [ownerWallet, nodeId]);

  const fields = MODULE_FIELDS[node.module.type] ?? [];
  const visibleFields = fields.filter((field) => {
    if (!field.showWhen) return true;
    const current = params[field.showWhen.key];
    return Array.isArray(field.showWhen.equals)
      ? field.showWhen.equals.includes(current)
      : current === field.showWhen.equals;
  });

  const handleChange = (key: string, value: any) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveProvider = async () => {
    if (!ownerWallet) {
      toast.error("Conecta tu wallet para guardar el proveedor de email.");
      return;
    }
    if (!nodeId) {
      toast.error("Guarda el nodo antes de configurar el proveedor de email.");
      return;
    }
    if (!isAlertProvider(emailProvider)) {
      toast.error("Selecciona un proveedor de email.");
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
          nodeId,
          provider: emailProvider,
          apiKey: key,
          fromEmail: emailFrom.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar");
      setProviderStatus(data);
      setEmailApiKey("");
      setParams((prev) => ({
        ...prev,
        nodeKey: nodeId,
        provider: data.provider,
        fromEmail: data.fromEmail,
      }));
      setChannelHealth(await fetchAlertChannelHealth(ownerWallet, nodeId));
      toast.success(`${providerDef.label} guardado en este nodo. La alerta ya puede usar Email.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el proveedor.");
    } finally {
      setSavingProvider(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalParams = mergeParams(params);
    if (isAlertNode) {
      finalParams.nodeKey = nodeId || finalParams.nodeKey;
      finalParams.provider = isAlertProvider(emailProvider) ? emailProvider : "resend";
      finalParams.fromEmail = emailFrom.trim();
    }
    onSave({ ...node, params: finalParams });
  };

  const handleTestAlert = async () => {
    if (params.channel === "email" && !isValidAlertEmail(params.email)) {
      toast.error("Introduce un email válido en el nodo.");
      return;
    }
    setTestingAlert(true);
    try {
      const result = await sendAlert({
        channel: params.channel,
        title: params.title || "Prueba de alerta",
        message:
          params.message ||
          "Esta es una alerta de prueba enviada desde Solana Workflow.",
        email: params.email,
        chatId: params.chatId,
        webhookUrl: params.webhookUrl,
        phone: params.phone,
        ownerWallet,
        nodeId,
      });
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } finally {
      setTestingAlert(false);
    }
  };

  const Icon = node.module.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl sm:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "fadeIn 0.2s ease-out" }}
        role="dialog"
        aria-modal="true"
        aria-label={`Configurar ${node.module.name}`}
      >
        <div className="flex items-center gap-3 border-b border-border/40 p-4 sm:p-5">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 shadow-md"
            style={{ backgroundColor: node.module.color }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">
              {node.module.name}
            </h2>
            {node.module.description && (
              <p className="text-xs text-muted-foreground">{node.module.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-muted"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {vaultRequired && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-900 shadow-sm dark:border-amber-500/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-amber-900 dark:text-amber-100">
                {vaultReady
                  ? "Configura la bóveda para este workflow"
                  : "Publica el workflow antes de configurar la bóveda"}
              </p>
              <p className="mt-0.5">
                {vaultReady
                  ? "Este workflow mueve fondos en la ejecución on-chain. Crea la bóveda y ajusta el destino y los límites en el panel. La simulación del canvas no usa esos fondos."
                  : "Publica el workflow on-chain para fijar su identificador; así la bóveda no quedará inaccesible. Después ajusta el destino y los límites en el panel."}
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  window.setTimeout(
                    () => window.dispatchEvent(new Event(vaultReady ? "open-vault" : "publish-workflow")),
                    80,
                  );
                }}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-600/50 px-3 py-1.5 font-medium text-amber-900 transition-colors hover:bg-amber-500/15 dark:border-amber-400/50 dark:text-amber-100 dark:hover:bg-amber-400/10"
              >
                <Landmark className="h-3.5 w-3.5" />
                {vaultReady ? "Abrir bóveda y límites" : "Publicar on-chain"}
              </button>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5"
        >
          {visibleFields.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              This module has no configurable parameters.
            </div>
          ) : (
            <div className="space-y-5">
              {visibleFields.map((field) => (
                <div key={field.key}>
                  <label
                    htmlFor={`field-${field.key}`}
                    className="block text-sm font-medium text-foreground mb-1.5"
                  >
                    {field.label}
                  </label>
                  {field.description && (
                    <p className="text-xs text-muted-foreground mb-2">{field.description}</p>
                  )}

                  {field.type === "select" ? (
                    <select
                      id={`field-${field.key}`}
                      value={params[field.key] ?? ""}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      className="w-full rounded-lg border border-border/40 bg-muted/50 px-3 py-3 text-base text-foreground transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 sm:py-2.5 sm:text-sm"
                    >
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      id={`field-${field.key}`}
                      value={
                        field.json && typeof params[field.key] === "object"
                          ? JSON.stringify(params[field.key], null, 2)
                          : params[field.key] ?? ""
                      }
                      onChange={(e) => {
                        if (!field.json) {
                          handleChange(field.key, e.target.value);
                          return;
                        }
                        try {
                          const parsed = JSON.parse(e.target.value);
                          handleChange(field.key, parsed);
                        } catch {
                          handleChange(field.key, e.target.value);
                        }
                      }}
                      placeholder={field.placeholder}
                      rows={3}
                      className="w-full resize-none rounded-lg border border-border/40 bg-muted/50 px-3 py-3 font-mono text-base text-foreground transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 sm:py-2.5 sm:text-sm"
                    />
                  ) : field.type === "toggle" ? (
                    <button
                      type="button"
                      id={`field-${field.key}`}
                      onClick={() => handleChange(field.key, !params[field.key])}
                      className={`relative h-6 w-11 rounded-full transition-colors after:absolute after:-inset-2 after:content-[''] ${params[field.key] ? "bg-primary" : "bg-muted"
                        }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${params[field.key] ? "translate-x-5" : "translate-x-0"
                          }`}
                      />
                    </button>
                  ) : (
                    <input
                      id={`field-${field.key}`}
                      type={field.type}
                      value={params[field.key] ?? ""}
                      onChange={(e) =>
                        handleChange(
                          field.key,
                          field.type === "number" ? Number(e.target.value) : e.target.value
                        )
                      }
                      placeholder={field.placeholder}
                      step={field.type === "number" ? "any" : undefined}
                      className="w-full rounded-lg border border-border/40 bg-muted/50 px-3 py-3 text-base text-foreground transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 sm:py-2.5 sm:text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {node.module.type === "price_monitor" && (
            <p className="mt-3 rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {params.condition === "change_pct"
                ? `Se activa si ${params.asset || "el token"} cambia ${params.value ?? 0}% o más en 24h, en cualquier dirección.`
                : params.condition === "price"
                  ? `Se activa en cada comprobación y reporta el precio actual de ${params.asset || "el token"}.`
                  : `Se activa si ${params.asset || "el token"} está ${params.condition === "above" ? "por encima" : "por debajo"} de $${params.value ?? 0}.`}
            </p>
          )}

          {node.module.type === "send_alert" && params.channel === "email" && (
            <section className="mt-5 space-y-3 rounded-xl border border-border/40 bg-muted/20 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Proveedor de email de este nodo
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    La API key se guarda cifrada y solo pertenece a esta alerta.
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
                {savingProvider ? "Guardando…" : "Guardar proveedor de email en este nodo"}
              </button>
            </section>
          )}

          {node.module.type === "send_alert" && (
            <>
              {params.channel && params.channel !== "app" && channelHealth && (
                <div
                  className={`mt-4 rounded-lg border px-3 py-2 text-xs ${
                    Boolean(channelHealth[String(params.channel)])
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                  }`}
                >
                  <p>
                    {Boolean(channelHealth[String(params.channel)])
                      ? `${alertChannelLabel(params.channel)} listo para enviar.`
                      : params.channel === "email"
                        ? "Configura el proveedor de email en este nodo antes de enviar alertas."
                        : `Configura ${alertChannelLabel(params.channel)} en este nodo antes de enviar alertas.`}
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={handleTestAlert}
                disabled={testingAlert}
                className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/15 disabled:opacity-60"
              >
                {testingAlert ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {testingAlert ? "Enviando prueba…" : "Enviar alerta de prueba"}
              </button>
              <p className="mt-2 text-xs text-muted-foreground">
                La alerta de prueba no ejecuta el trigger. Las variables como {"{{price}}"} se
                resuelven cuando ejecutas el workflow.
              </p>
            </>
          )}

          <div className="mt-6 grid grid-cols-2 gap-2 border-t border-border/30 pt-4 sm:flex sm:justify-end sm:gap-3">
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(node.id)}
                className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-lg bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20 sm:col-auto sm:mr-auto"
                title="Eliminar nodo"
              >
                <Trash2 className="h-4 w-4" />
                <span>Eliminar</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-lg bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-gradient-purple-cyan px-5 py-2 text-sm font-medium text-white shadow-md transition-opacity hover:opacity-90"
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NodeSettingsModal;
