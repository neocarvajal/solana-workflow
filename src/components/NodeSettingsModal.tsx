import React, { useState, useEffect } from "react";
import { X, Trash2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import type { FlowNode } from "@/lib/workflow";
import { sendAlert } from "@/lib/alerts";

/* ── Per-module field definitions ────────────────────────────── */
interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "textarea" | "toggle";
  placeholder?: string;
  description?: string;
  options?: { value: string; label: string }[];
  /** Only show this field when another param matches. */
  showWhen?: { key: string; equals: string | string[] };
  /** Parse the textarea value as JSON instead of plain text. */
  json?: boolean;
}

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
      key: "condition", label: "Condition", type: "select", description: "When to fire",
      options: [
        { value: "above", label: "Price goes above" },
        { value: "below", label: "Price goes below" },
        { value: "change_pct", label: "% change exceeds" },
      ]
    },
    { key: "value", label: "Threshold Value", type: "number", placeholder: "e.g. 150", description: "USD value or percentage" },
    {
      key: "interval", label: "Check Interval", type: "select", description: "How often to poll",
      options: [
        { value: "30s", label: "Every 30 seconds" },
        { value: "1m", label: "Every minute" },
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
      key: "every", label: "Run Every", type: "select", description: "How often the workflow runs",
      options: [
        { value: "1m", label: "Every minute" },
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
      key: "email", label: "Email destinatario", type: "text",
      showWhen: { key: "channel", equals: "email" },
      placeholder: "tu@email.com",
      description: "Vacío = usar el email configurado en Ajustes",
    },
    {
      key: "chatId", label: "Telegram Chat ID", type: "text",
      showWhen: { key: "channel", equals: "telegram" },
      placeholder: "123456789",
      description: "Vacío = usar el Chat ID de Ajustes o el secreto TELEGRAM_CHAT_ID",
    },
    {
      key: "webhookUrl", label: "Discord Webhook URL", type: "text",
      showWhen: { key: "channel", equals: "discord" },
      placeholder: "https://discord.com/api/webhooks/…",
      description: "Recomendado configurarlo en Ajustes para no guardarlo dentro del workflow",
    },
    {
      key: "phone", label: "WhatsApp", type: "text",
      showWhen: { key: "channel", equals: "whatsapp" },
      placeholder: "+5215512345678",
      description: "Número con código de país. Vacío = usar Ajustes o el secreto WHATSAPP_TO",
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
}> = ({ node, onSave, onClose, onDelete }) => {

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

  useEffect(() => {
    const cleanParams = mergeParams(node.params);
    setParams(cleanParams);
  }, [node.id, JSON.stringify(node.params)]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalParams = mergeParams(params);
    console.log("Saving node with final params:", finalParams);
    onSave({ ...node, params: finalParams });
  };

  const handleTestAlert = async () => {
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

          {node.module.type === "send_alert" && (
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
