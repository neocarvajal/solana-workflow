import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { deliverAlert, resolveAlertMessage } from "../_shared/alerts.ts";
import {
  assetToBaseUnits,
  baseUnitsToAmount,
  isAssetSupportedOnCluster,
  normalizeVaultAsset,
  VAULT_ASSETS,
} from "../_shared/vaultTokens.ts";

const COIN_IDS: Record<string, string> = {
  SOL: "solana", BONK: "bonk", JUP: "jupiter-exchange-solana", WIF: "dogwifcoin", USDC: "usd-coin",
};

async function getPriceData(asset: string): Promise<{ price: number | null; change24h: number | null }> {
  const id = COIN_IDS[asset.toUpperCase()] || asset.toLowerCase();
  const r = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`,
  );
  if (!r.ok) return { price: null, change24h: null };
  const json = await r.json();
  return {
    price: typeof json[id]?.usd === "number" ? json[id].usd : null,
    change24h: typeof json[id]?.usd_24h_change === "number" ? json[id].usd_24h_change : null,
  };
}

async function getDexPair(addr: string) {
  const r = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${addr}`);
  if (!r.ok) return null;
  return await r.json();
}

/** Same explorer URL format used by the client (src/lib/solana.ts). */
function solanaExplorerTxUrl(signature: string, cluster?: string): string {
  const activeCluster = (cluster || "devnet").trim();
  const clusterQuery = activeCluster === "mainnet-beta" ? "" : `?cluster=${activeCluster}`;
  return `https://explorer.solana.com/tx/${signature}${clusterQuery}`;
}

type Step = { type: string; params: Record<string, any> };
type Workflow = {
  name: string;
  schedule?: string;
  executionMode?: string;
  workflowId?: string;
  trigger: { type: string; params: Record<string, any> };
  steps: Step[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const workflow: Workflow = body.workflow;
    const workflowId: string | undefined = body.workflowId || workflow?.workflowId;
    const stableWorkflowId: string | undefined =
      body.stableWorkflowId || workflow?.workflowId || body.workflowId;
    const ownerWallet: string | undefined = body.ownerWallet || body.owner_wallet;
    const executionMode: string = body.executionMode || workflow?.executionMode || "manual";
    const notifyOnly = Boolean(body.notifyOnly) || executionMode === "notify" || executionMode === "manual";
    const financialAutomation =
      executionMode === "vault_transfer" ||
      executionMode === "vault_dca" ||
      executionMode === "subscription";
    const scheduledFor: string | undefined = body.scheduledFor;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const vaultExecutionEnabled = Deno.env.get("VAULT_EXECUTION_ENABLED") === "true";
    const sb = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

    if (!workflow) {
      return new Response(JSON.stringify({ error: "workflow required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const logs: any[] = [];
    let triggered = false;
    let triggerData: any = {};
    let vaultTransferExecuted = false;
    const cluster = Deno.env.get("SOLANA_CLUSTER") || "devnet";
    /** Last successful wallet transfer, so the next Alert can link the tx. */
    let lastExecutedTx: { index: number; signature: string } | null = null;
    /** A failed step blocks every downstream step (no false success alerts). */
    let stopProcessing = false;
    let failedStepIndex: number | null = null;
    const blockStep = (index: number) => {
      failedStepIndex = index;
      stopProcessing = true;
    };

    const t = workflow.trigger;
    if (t.type === "price_monitor") {
      const asset = String(t.params.asset || "SOL").toUpperCase();
      const snapshot = await getPriceData(asset);
      const price = snapshot.price;
      const priceChange24h = snapshot.change24h;
      const threshold = Number(t.params.value);
      const thresholdValue = Number.isFinite(threshold) ? threshold : null;
      triggerData = {
        asset,
        price,
        priceChange24h,
        condition: t.params.condition,
        value: thresholdValue,
        threshold: thresholdValue,
      };
      logs.push({ step: "trigger", type: t.type, price, change24h: priceChange24h, condition: t.params.condition });
      if (price !== null) {
        const cond = t.params.condition;
        if (cond === "price") triggered = true;
        else if (cond === "above") triggered = price > threshold;
        else if (cond === "below") triggered = price < threshold;
        else if (cond === "change_pct") {
          triggered = priceChange24h !== null && Math.abs(priceChange24h) >= Math.abs(threshold);
        }
      }
    } else if (t.type === "dexscreener_pair") {
      const data = await getDexPair(t.params.pairAddress);
      triggerData = { pair: data?.pairs?.[0] };
      const pair = data?.pairs?.[0];
      const metric = t.params.metric || "price";
      const val = metric === "price" ? Number(pair?.priceUsd)
        : metric === "volume" ? Number(pair?.volume?.h24)
        : Number(pair?.liquidity?.usd);
      triggerData = {
        ...triggerData,
        metric,
        value: Number.isNaN(val) ? null : val,
        price: metric === "price" && !Number.isNaN(val) ? val : undefined,
        condition: t.params.condition,
        threshold: Number(t.params.value),
      };
      logs.push({ step: "trigger", type: t.type, metric, val });
      if (!isNaN(val)) {
        triggered = t.params.condition === "above" ? val > t.params.value : val < t.params.value;
      }
    } else {
      // schedule / webhook → assume triggered when invoked manually
      triggered = true;
      triggerData = { manual: true };
    }

    if (!triggered) {
      logs.push({ result: "condition_not_met" });
    } else {
      for (const [stepIndex, step] of workflow.steps.entries()) {
        if (stopProcessing) break;
        try {
          if (step.type === "send_transaction") {
            const requestedAsset = String(step.params.asset || "SOL").toUpperCase();
            const payload = { to: step.params.to, amount: step.params.amount, asset: requestedAsset };
            if (financialAutomation) {
              const asset = normalizeVaultAsset(requestedAsset);
              const requestedDestination = step.params.to
                ? String(step.params.to)
                : undefined;
              let amountBaseUnits: number | null = null;
              let assetError: string | null = null;
              if (!asset) {
                assetError = "Activo no soportado por la bóveda. Usa SOL, USDC, JUP o BONK.";
              } else if (!isAssetSupportedOnCluster(asset, cluster)) {
                assetError = `${asset} no tiene un mint SPL válido en ${cluster}.`;
              } else {
                try {
                  amountBaseUnits = assetToBaseUnits(asset, step.params.amount);
                } catch (e) {
                  assetError = e instanceof Error ? e.message : "Monto inválido";
                }
              }

              if (executionMode !== "vault_transfer") {
                logs.push({
                  step: "send_transaction",
                  skipped: true,
                  reason: "execution_mode_not_implemented",
                  executionMode,
                  payload,
                  note: "Este modo de fondos todavía no tiene una ruta de ejecución.",
                });
                blockStep(stepIndex);
              } else if (!vaultExecutionEnabled) {
                logs.push({
                  step: "send_transaction",
                  skipped: true,
                  reason: "vault_execution_disabled",
                  executionMode,
                  payload,
                  note: "El ejecutor de la bóveda está pausado en el servidor (kill switch).",
                });
                blockStep(stepIndex);
              } else if (!ownerWallet || !stableWorkflowId) {
                logs.push({
                  step: "send_transaction",
                  skipped: true,
                  reason: "owner_or_workflow_missing",
                  executionMode,
                  payload,
                  note: "No se puede derivar la bóveda sin owner y workflow_id.",
                });
                blockStep(stepIndex);
              } else if (vaultTransferExecuted) {
                logs.push({
                  step: "send_transaction",
                  skipped: true,
                  reason: "only_one_vault_transfer_per_run",
                  executionMode,
                  payload,
                  note: "Solo se permite una transferencia de bóveda por ejecución.",
                });
                blockStep(stepIndex);
              } else if (assetError) {
                logs.push({
                  step: "send_transaction",
                  skipped: true,
                  reason: asset && !isAssetSupportedOnCluster(asset, cluster)
                    ? "asset_not_available_on_network"
                    : "unsupported_asset",
                  executionMode,
                  payload,
                  note: assetError,
                });
                blockStep(stepIndex);
              } else if (
                amountBaseUnits === null ||
                !Number.isSafeInteger(amountBaseUnits) ||
                amountBaseUnits <= 0
              ) {
                logs.push({
                  step: "send_transaction",
                  skipped: true,
                  reason: "invalid_amount",
                  executionMode,
                  payload,
                  note: "El monto debe ser un número positivo en el activo indicado.",
                });
                blockStep(stepIndex);
              } else if (!supabaseUrl || !serviceKey) {
                logs.push({
                  step: "send_transaction",
                  skipped: true,
                  reason: "vault_server_not_configured",
                  executionMode,
                  payload,
                });
                blockStep(stepIndex);
              } else {
                const response = await fetch(`${supabaseUrl}/functions/v1/execute-vault`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${serviceKey}`,
                  },
                  body: JSON.stringify({
                    owner_wallet: ownerWallet,
                    workflow_id: stableWorkflowId,
                    asset,
                    amount_base_units: amountBaseUnits,
                    destination: requestedDestination,
                  }),
                });
                const result = await response.json().catch(() => ({}));
                const minIntervalPending =
                  response.status === 429 &&
                  /minimum interval/i.test(String(result.error || ""));

                if (minIntervalPending) {
                  // The on-chain vault guard only means the previous transfer is
                  // still inside its minimum interval. This is a normal timing
                  // skip, not a failed run: the next cron tick will try again as
                  // soon as that interval has elapsed.
                  logs.push({
                    step: "send_transaction",
                    skipped: true,
                    reason: "vault_min_interval",
                    status: response.status,
                    note: "La bóveda aún está dentro de su intervalo mínimo. No se movieron fondos; se reintentará en el próximo ciclo.",
                    executionMode,
                    payload,
                  });
                  blockStep(stepIndex);
                } else if (!response.ok || !result.ok) {
                  const vaultError = String(result.error || "");
                  const vaultNoteMap: Record<string, string> = {
                    "Operational kill switch: vault execution is paused on the server.":
                      "Kill switch operativo: la ejecución de la bóveda está en pausa en el servidor.",
                    "Supported assets: SOL, USDC, JUP, BONK.":
                      "Activos compatibles: SOL, USDC, JUP, BONK.",
                  };
                  const rawNote = typeof result.note === "string" ? result.note : "";
                  const mappedNote =
                    vaultError === "asset_mint_mismatch"
                      ? "La bóveda autoriza otro activo. Ábrela, selecciona el activo del workflow, guarda los límites y vuelve a activar el cron."
                      : vaultNoteMap[rawNote] || rawNote || undefined;
                  logs.push({
                    step: "send_transaction",
                    executed: false,
                    reason: "vault_execution_failed",
                    status: response.status,
                    error: vaultError || "execute-vault failed",
                    note: mappedNote,
                    executionMode,
                    payload,
                  });
                  blockStep(stepIndex);
                } else {
                  vaultTransferExecuted = true;
                  if (typeof result.signature === "string" && result.signature.trim()) {
                    lastExecutedTx = { index: stepIndex, signature: result.signature.trim() };
                  }
                  logs.push({
                    step: "send_transaction",
                    executed: true,
                    signature: result.signature,
                    policy: result.policy,
                    vault: result.vault,
                    destination: result.destination,
                    asset: result.asset || "SOL",
                    amount_base_units:
                      result.amount_base_units ?? result.amount_lamports,
                    amount_lamports: result.amount_lamports,
                    executionMode,
                    payload,
                  });
                }
              }
            } else if (notifyOnly) {
              logs.push({
                step: "send_transaction",
                skipped: true,
                reason: "requires_user_signature",
                executionMode,
                payload,
                note: "El cron no puede firmar por el usuario. Transferencia pendiente de aprobación.",
              });
            } else {
              logs.push({
                step: "send_transaction",
                simulated: true,
                payload,
                note: "Transacción simulada — la firma de la wallet aún no está integrada.",
              });
            }
          } else if (step.type === "swap") {
            const payload = { from: step.params.from, to: step.params.to, amount: step.params.amount };
            if (financialAutomation) {
              logs.push({
                step: "swap",
                skipped: true,
                reason: "vault_swap_not_implemented",
                executionMode,
                payload,
                note: "La ruta DCA/swap de la bóveda todavía no está implementada.",
              });
            } else if (notifyOnly) {
              logs.push({
                step: "swap",
                skipped: true,
                reason: "requires_user_signature",
                executionMode,
                payload,
                note: "El cron no puede firmar el swap. Pendiente de aprobación.",
              });
            } else {
              logs.push({
                step: "swap",
                simulated: true,
                payload,
                note: "Swap simulado — la firma de la wallet aún no está integrada.",
              });
            }
          } else if (step.type === "send_alert") {
            // Only an immediately preceding successful wallet transfer has a
            // real signature to link. Skipped/failed transfers expose nothing.
            const txContext: Record<string, unknown> = {};
            if (lastExecutedTx && stepIndex === lastExecutedTx.index + 1) {
              const txUrl = solanaExplorerTxUrl(lastExecutedTx.signature, cluster);
              txContext.txUrl = txUrl;
              txContext.explorerUrl = txUrl;
              txContext.txSignature = lastExecutedTx.signature;
            }
            const variables = {
              ...triggerData,
              ...txContext,
              trigger: triggerData,
              workflow: workflow.name,
            };
            const alert = await deliverAlert({
              channel: step.params.channel || "app",
              title: step.params.title,
              message: step.params.message || "¡Disparador activado!",
              email: step.params.email,
              chatId: step.params.chatId,
              webhookUrl: step.params.webhookUrl,
              phone: step.params.phone,
              ownerWallet,
              nodeId: step.params.nodeKey,
              variables,
              appendPriceContext: !financialAutomation,
            });
            if (!alert.ok) throw new Error(alert.message);

            if (alert.channel === "app") {
              if (!sb) {
                throw new Error(
                  "Falta la configuración de Supabase en el servidor; no se puede guardar la notificación in-app.",
                );
              }
              if (!ownerWallet) {
                throw new Error(
                  "Falta ownerWallet en la ejecución; no se puede guardar la notificación in-app.",
                );
              }

              const title = resolveAlertMessage(
                String(step.params.title || "").trim() || "Alerta de Solana Workflow",
                variables,
                { appendPriceContext: false, appendTransactionContext: false },
              ).slice(0, 200);
              const message = resolveAlertMessage(
                String(step.params.message || "¡Disparador activado!"),
                variables,
                { appendPriceContext: !financialAutomation },
              ).slice(0, 4000);

              const { error: notificationError } = await sb.from("user_notifications").insert({
                owner_wallet: ownerWallet,
                workflow_id: stableWorkflowId || workflowId || null,
                workflow_name: workflow.name,
                title,
                message,
                channel: "app",
                status: "success",
                metadata: {
                  scheduledFor: scheduledFor || null,
                  trigger: triggerData,
                },
              });

              if (notificationError) {
                throw new Error(
                  `No se pudo guardar la notificación in-app: ${notificationError.message}`,
                );
              }
            }

            logs.push({
              step: "send_alert",
              channel: alert.channel,
              provider: alert.provider,
              ok: true,
              persisted: alert.channel === "app",
              message: alert.message,
            });
          } else if (step.type === "http_request") {
            const r = await fetch(step.params.url, {
              method: step.params.method || "GET",
              body: step.params.body ? JSON.stringify(step.params.body) : undefined,
              headers: step.params.body ? { "Content-Type": "application/json" } : undefined,
            });
            logs.push({ step: "http_request", status: r.status });
          } else if (step.type === "dexscreener_lookup") {
            const data = await getDexPair(step.params.pairAddress);
            logs.push({ step: "dexscreener_lookup", pair: data?.pairs?.[0]?.baseToken });
          } else if (step.type === "ai_decision") {
            logs.push({ step: "ai_decision", prompt: step.params.prompt, note: "Pendiente: conectar con el gateway de IA." });
          } else {
            logs.push({ step: step.type, skipped: true });
          }
        } catch (e) {
          logs.push({ step: step.type, stepIndex, error: String(e) });
          blockStep(stepIndex);
        }
      }
    }

    const txSignature =
      logs.find(
        (entry) =>
          entry?.step === "send_transaction" &&
          entry?.executed === true &&
          typeof entry?.signature === "string",
      )?.signature || null;

    if (vaultTransferExecuted && txSignature && sb && ownerWallet) {
      const transferLog = logs.find(
        (entry) =>
          entry?.step === "send_transaction" &&
          entry?.executed === true,
      );
      const assetSymbol = normalizeVaultAsset(transferLog?.asset) || "SOL";
      const baseUnits =
        typeof transferLog?.amount_base_units === "number"
          ? transferLog.amount_base_units
          : typeof transferLog?.amount_lamports === "number"
            ? transferLog.amount_lamports
            : 0;
      const amountDisplay = baseUnitsToAmount(assetSymbol, baseUnits);
      const assetLabel = VAULT_ASSETS[assetSymbol].symbol;
      const destination = String(transferLog?.destination || "");
      const shortDestination = destination
        ? `${destination.slice(0, 4)}…${destination.slice(-4)}`
        : "la dirección configurada";
      const explorerUrl = solanaExplorerTxUrl(txSignature, cluster);

      const { error: transferNotificationError } = await sb
        .from("user_notifications")
        .insert({
          owner_wallet: ownerWallet,
          workflow_id: stableWorkflowId || workflowId || null,
          workflow_name: workflow.name,
          title: `Transferencia ejecutada · ${workflow.name}`,
          message: `${amountDisplay} ${assetLabel} enviados a ${shortDestination}\nVer en Explorer: ${explorerUrl}`,
          channel: "app",
          status: "success",
          metadata: {
            scheduledFor: scheduledFor || null,
            txSignature,
            explorerUrl,
            amountLamports: transferLog?.amount_lamports ?? null,
            amountBaseUnits: baseUnits,
            asset: assetLabel,
            destination: destination || null,
          },
        });

      if (transferNotificationError) {
        console.error("Could not persist the vault transfer notification", transferNotificationError);
      }
    }

    if (workflowId && sb) {
      await sb.from("workflow_runs").insert({
        workflow_id: workflowId,
        status: triggered ? "executed" : "skipped",
        trigger_data: triggerData,
        output: {
          logs,
          executionMode,
          notifyOnly,
          scheduledFor,
          vaultTransferExecuted,
          txSignature,
          failedStepIndex,
          stepFailed: failedStepIndex !== null,
        },
        execution_mode: executionMode,
        scheduled_for: scheduledFor || null,
        tx_signature: txSignature,
      });
    }

    return new Response(JSON.stringify({ triggered, triggerData, logs, txSignature, failedStepIndex }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
