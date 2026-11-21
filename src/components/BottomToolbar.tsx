import React, { useState, useEffect, useCallback } from 'react';
import { Save, Play, ZoomIn, ZoomOut, Clock, Upload, RefreshCw, Loader2, ShieldCheck, Landmark } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Buffer } from 'buffer';
import bs58 from 'bs58';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import { connection, confirmTransactionOverHttp, publishWorkflowMemo,solexplorerUrl } from '@/lib/solana';
import { getCluster, isMainnet, type SolanaCluster } from '@/lib/network';
import {
  isAssetSupportedOnCluster,
  normalizeVaultAsset,
  supportedAssetLabel,
} from '@/lib/vaultTokens';
import { notifyTxSuccess } from '@/lib/tx-toast';
import { useVaultReady } from '@/lib/useVaultReady';
import MainnetPublishWarning from './MainnetPublishWarning';
import { Switch } from '@/components/ui/switch';
import {
  fetchAutomationRows,
  findAutomation,
  indexAutomation,
  setAutomationActive,
  type WorkflowAutomationRow,
} from '@/lib/automation';
import { workflowToNodes, nodesToWorkflow } from "@/lib/workflow";
import {
  getWorkflow, getOnchainMeta, setOnchainMeta, setScenarioName, setFlowNodes, updateWorkflow,
  getFlowNodes, getCanvasScale, setCanvasScale, subscribeScale, getScenarioName,
  setRunningNodeId, setAnimatingLineIndex, setErrorNodeId, saveWorkflow, saveLocalOnly,
  rememberSavedWorkflow, getSavedWorkflows,
  getExecutionFrequency, setExecutionFrequency as persistExecutionFrequency, subscribeExecutionFrequency,
  getExecutionMode, setExecutionMode as persistExecutionMode, subscribeExecutionMode,
  getWorkflowId, setWorkflowId, subscribeWorkflowId, subscribeOnchainMeta, type OnchainMeta,
  getScheduledRunState, subscribeScheduledRun, type ScheduledRunState,
} from '@/lib/workflowStore';
import {
  EXECUTION_MODE_OPTIONS,
  scheduleToSeconds,
  type ExecutionMode,
} from '@/lib/schedule';

import { FlowNode } from "@/lib/workflow";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import TransactionSuccessModal from './TransactionSuccessModal';
import { TriggerEngine } from "@/lib/triggerEngine";
import { sendAlert } from "@/lib/alerts";
import { useRouter } from 'next/router';

const MAINNET_ACK_KEY = "solflows_mainnet_publish_warning_ack";
const UNSUPPORTED_ASSET_ACK_KEY = "solflows_unsupported_asset_publish_ack_v1";

function mainnetWarningAcknowledged(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MAINNET_ACK_KEY) === "true";
  } catch {
    return false;
  }
}

function unsupportedAssetAckKey(cluster: SolanaCluster, assets: string[]): string {
  return `${cluster}:${[...assets].sort().join(",")}`;
}

function unsupportedAssetsAcknowledged(cluster: SolanaCluster, assets: string[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.localStorage.getItem(UNSUPPORTED_ASSET_ACK_KEY) ===
      unsupportedAssetAckKey(cluster, assets)
    );
  } catch {
    return false;
  }
}

/** Assets in the flow that the vault/dapp cannot transfer on the current network. */
function findUnsupportedAssets(cluster: SolanaCluster): string[] {
  const unsupported = new Set<string>();
  for (const node of getFlowNodes()) {
    const params = node.params || {};
    const candidates =
      node.module?.type === "swap"
        ? [params.from, params.to]
        : [params.asset];
    for (const raw of candidates) {
      if (typeof raw !== "string" || !raw.trim()) continue;
      const symbol = normalizeVaultAsset(raw);
      if (!symbol || !isAssetSupportedOnCluster(symbol, cluster)) {
        unsupported.add(raw.trim().toUpperCase());
      }
    }
  }
  return [...unsupported];
}

const BottomToolbar: React.FC = () => {
  const [publishing, setPublishing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [scale, setScale] = useState(getCanvasScale());
  const [executionFrequency, setExecutionFrequency] = useState(getExecutionFrequency());
  const [executionMode, setExecutionMode] = useState<ExecutionMode>(getExecutionMode());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastTxData, setLastTxData] = useState<{ signature: string; actionType: string; blockhash?: string } | null>(null);
  const [scheduledRun, setScheduledRun] = useState<ScheduledRunState>(getScheduledRunState());
  const [activationRow, setActivationRow] = useState<WorkflowAutomationRow | null>(null);
  const [togglingActivation, setTogglingActivation] = useState(false);
  const [mainnetWarningOpen, setMainnetWarningOpen] = useState(false);
  const [unsupportedAssetOpen, setUnsupportedAssetOpen] = useState(false);
  const [unsupportedAssets, setUnsupportedAssets] = useState<string[]>([]);
  const { publicKey, connected, sendTransaction } = useWallet();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const router = useRouter();
  const wallet = useWallet();

  const signSavePayload = async (owner: string, workflowId: string) => {
    if (!wallet.signMessage) {
      throw new Error("Tu wallet no permite firmar mensajes; no se puede guardar en la nube.");
    }
    const message = new TextEncoder().encode(
      `Autorizo guardar este workflow\nWallet: ${owner}\nWorkflow: ${workflowId}`,
    );
    const signature = await wallet.signMessage(message);
    return bs58.encode(signature);
  };

  useEffect(() => {
    const unsub = subscribeScale((s) => setScale(s));
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    const unsub = subscribeExecutionFrequency((value) => setExecutionFrequency(value));
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    const unsub = subscribeExecutionMode((value) => setExecutionMode(value));
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    const unsub = subscribeScheduledRun((value) => setScheduledRun(value));
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    if (publicKey) {
      setWalletAddress(publicKey.toBase58());
    } else {
      setWalletAddress(null);
    }
  }, [publicKey]);

  const [onchainMeta, setOnchainMetaState] = useState<OnchainMeta>(() => getOnchainMeta());

  useEffect(() => {
    const unsubMeta = subscribeOnchainMeta(setOnchainMetaState);
    const unsubId = subscribeWorkflowId(() => setOnchainMetaState(getOnchainMeta()));
    return () => { unsubMeta(); unsubId(); };
  }, []);

  // A confirmed memo signature means this workflow already has an on-chain
  // reference; the action then becomes an update of that reference.
  const hasPublishedReference = Boolean(
    onchainMeta && String(onchainMeta.signature || "").trim(),
  );
  const publishMode: "publish" | "update" = hasPublishedReference ? "update" : "publish";
  const vaultReady = useVaultReady();
  const vaultDisabledTitle = vaultReady
    ? "Configurar bóveda y límites"
    : "Publica el workflow on-chain para configurar la bóveda";

  const loadActivation = useCallback(async () => {
    if (!walletAddress) {
      setActivationRow(null);
      return;
    }
    try {
      const rows = await fetchAutomationRows(walletAddress, { includeUnpublished: true });
      const row = findAutomation(
        indexAutomation(rows),
        getWorkflowId(),
        getOnchainMeta().cid,
      );
      setActivationRow(row);
    } catch (error) {
      console.error("No se pudo cargar el estado de activación", error);
      setActivationRow(null);
    }
  }, [walletAddress]);

  useEffect(() => {
    void loadActivation();
  }, [loadActivation]);

  const handleToggleActivation = async (nextActive: boolean) => {
    if (!activationRow || !walletAddress || togglingActivation) return;
    setTogglingActivation(true);
    try {
      const updated = await setAutomationActive({
        row: activationRow,
        ownerWallet: walletAddress,
        nextActive,
        schedule: executionFrequency,
      });
      setActivationRow(updated);
      toast.success(nextActive ? "Workflow activado" : "Workflow desactivado", {
        description: nextActive
          ? "El cron volverá a ejecutarlo según su frecuencia."
          : "El cron dejará de ejecutarlo hasta que lo actives de nuevo.",
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo cambiar el estado del workflow",
      );
    } finally {
      setTogglingActivation(false);
    }
  };

  useEffect(() => {
    if (!router.isReady || !walletAddress || !router.query.id) {
      return;
    }

    const { id } = router.query;
    const saved = getSavedWorkflows(walletAddress);
    const found = saved.find(w => w.id === id || w.pinataId === id);

    if (found) {
      setEditingId(found.pinataId || found.id);
      setWorkflowId(found.workflow.workflowId || found.workflowId || found.id);
      setScenarioName(found.name);
      setFlowNodes(workflowToNodes(found.workflow));
      void loadActivation();
    } else {
      console.warn("Workflow not found for the provided ID");
    }
  }, [router.isReady, router.query.id, walletAddress]);


  const handleSave = async () => {
    if (!connected || !publicKey) {
      toast.error("Wallet required", { description: "Please connect your wallet." });
      return;
    }

    const wf = getWorkflow();
    if (!wf) {
      toast.error("Build or generate a workflow first");
      return;
    }

    const walletAddress = publicKey.toBase58();
    const currentWorkflow = nodesToWorkflow(getScenarioName(), getFlowNodes());

    if (currentWorkflow) {
      wf.trigger = currentWorkflow.trigger;
      wf.steps = currentWorkflow.steps;
      wf.name = getScenarioName();
    }
    wf.schedule = getExecutionFrequency();
    wf.scheduleSeconds = scheduleToSeconds(wf.schedule);
    wf.executionMode = getExecutionMode();
    wf.workflowId = getWorkflowId();

    let saveSignature: string;
    try {
      saveSignature = await signSavePayload(walletAddress, wf.workflowId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo firmar el guardado");
      return;
    }

    const saved = getSavedWorkflows(walletAddress);
    // FIX: Search using actual storage record properties
    // const existing = saved.find(s => s.id === editingId || (s as any).pinata_file_id === editingId);

    // CRITICAL FIX: Pinata requires the actual "pinata_file_id" from cloud to update the JSON
    // const cloudTargetId = (existing as any)?.pinata_file_id || existing?.id || editingId;
    // const oldCid = existing?.cid;

    toast.promise(
      async () => {
        if (editingId) {
          const result = await updateWorkflow(
            editingId,
            wf.name,
            wf,
            walletAddress,
            saveSignature,
          );
          return result;
        } else {
          const result = await saveWorkflow(
            wf.name,
            wf,
            walletAddress,
            saveSignature,
            editingId
          );
          if (result.id) setEditingId(result.id);
          return result;
        }
      },
      {
        loading: editingId ? "Syncing updates with IPFS network..." : "Uploading workflow to IPFS...",
        success: () => editingId ? "Workflow updated successfully" : "Workflow saved to cloud",
        error: (e) => {
          console.error("Cloud operational sync failed:", e);

          try {
            if (editingId) {
              updateWorkflow(editingId, wf.name, wf, walletAddress, saveSignature);
            } else {
              saveLocalOnly(wf.name, wf, walletAddress);
            }
            return "Saved locally (Cloud sync failed)";
          } catch (localError) {
            return "Critical save failure: storage unavailable";
          }
        }
      }
    );
  };

  const runSimulation = async () => {
    const nodes = getFlowNodes();
    if (nodes.length === 0) {
      toast.error("Add at least one node to simulate the workflow");
      return;
    }

    setIsRunning(true);
    setErrorNodeId(null);
    const triggerEngine = new TriggerEngine();
    toast.info("Starting workflow simulation...");

    let simulatedTxSnapshot = null;
    let activeNodeId: string | null = null;
    let triggerVariables: Record<string, unknown> = {};

    try {
      setLastTxData(null);
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i] as FlowNode;
        activeNodeId = node.id;
        setRunningNodeId(node.id);
        setAnimatingLineIndex(-1);

        const params = node.params || {};

        if (node.module.kind === "trigger") {
          toast.info(`Validating trigger: ${node.module.name}...`);
          const evaluation = await triggerEngine.evaluateTrigger(node);

          if (!evaluation.triggered) {
            setErrorNodeId(node.id);
            setRunningNodeId(null);
            setAnimatingLineIndex(-1);
            toast.error(`Condition not met: ${node.module.name}`);
            return;
          }

          triggerVariables = evaluation.data;
          toast.success("Trigger condition met!");

        } else {
          toast.info(`Executing step ${i}: ${node.module.name}...`);
          await new Promise((r) => setTimeout(r, 1000));

          let desc = "Action executed successfully.";
          let stepSignature: string | null = null;

          try {
            if (node.module.type === "send_transaction") {
              // Extract parameters with defaults
              const toParam = node.params?.to ?? "";
              const amountParam = node.params?.amount;
              const assetParam = node.params?.asset;

              // Validate required parameters
              if (!amountParam) {
                toast.error("Missing amount for transaction", {
                  description: "Please configure the amount parameter in the node settings.",
                });
                throw new Error("Missing amount parameter");
              }
              if (!assetParam) {
                toast.error("Missing asset for transaction", {
                  description: "Please configure the asset parameter in the node settings.",
                });
                throw new Error("Missing asset parameter");
              }

              if (!toParam || toParam.trim() === "") {
                toast.error("Missing recipient for transaction", {
                  description: "Please configure the recipient wallet in the node settings.",
                });
                throw new Error("Missing recipient parameter");
              }

              const targetAmount = amountParam;
              const targetAsset = assetParam;
              const targetTo = toParam;

              toast.info(`Preparing transfer of ${targetAmount} ${targetAsset}...`, {
                description: "Please sign the transaction in your wallet",
              });

              const payload = {
                actionType: "send_transaction",
                owner: publicKey?.toBase58(),
                params: {
                  to: targetTo,
                  amount: parseFloat(targetAmount),
                  asset: targetAsset,
                },
              };

              console.log("Send Transaction Payload", JSON.stringify(payload, null, 2));

              const { data, error } = await supabase.functions.invoke("simulate-transfer", {
                body: {
                  actionType: "send_transaction",
                  owner: publicKey?.toBase58(),
                  params: {
                    to: targetTo,
                    amount: parseFloat(targetAmount),
                    asset: targetAsset,
                  },
                },
              });

              if (error) {
                throw new Error(error.message);
              }

              if (!data?.serializedTx) {
                throw new Error("Failed to simulate transaction");
              }

              const transaction = Transaction.from(Buffer.from(data.serializedTx, "base64"));

              const signature = await sendTransaction(transaction, connection).catch((err) => {
                if (err.name === "WalletSendTransactionError" || err.message?.includes("User rejected")) {
                  throw new Error("Canceled By User");
                }
                throw err;
              });

              toast.info("Transaction broadcasted! Waiting for confirmation...");
              await confirmTransactionOverHttp(connection, signature);

              desc = `Successfully sent ${targetAmount} ${targetAsset} to ${targetTo.slice(0, 6)}...`;
              stepSignature = signature;
              simulatedTxSnapshot = { signature, actionType: "send_transaction" };
              setLastTxData(simulatedTxSnapshot);
            } else if (node.module.type === "send_alert") {
              const alertResult = await sendAlert({
                channel: node.params.channel || "app",
                title: node.params.title,
                message: node.params.message || "Trigger fired!",
                email: node.params.email,
                chatId: node.params.chatId,
                webhookUrl: node.params.webhookUrl,
                phone: node.params.phone,
                ownerWallet: publicKey?.toBase58(),
                variables: {
                  ...triggerVariables,
                  trigger: triggerVariables,
                  workflow: getScenarioName(),
                },
              });

              if (!alertResult.ok) {
                throw new Error(alertResult.message);
              }

              desc = alertResult.message;
            } else if (node.module.type === "swap") {

              const { amount, from, to } = node.params;
  
              if (!amount || !from || !to) {
                throw new Error("Missing swap parameters (amount, from, or to)");
              }

              toast.info("Preparing swap...");

              // 1. Llamar a tu Edge Function para obtener el "Order" (Jupiter v2)
              const { transaction, requestId } = await supabase.functions.invoke("simulate-swap", {
                body: {
                  owner: publicKey?.toBase58(),
                  params: { fromMint: from, toMint: to, amount: amount }
                }
              }).then(res => res.data);

              if (!transaction || !requestId) throw new Error("Failed to initialize swap order");

              // 2. Deserializar la VersionedTransaction (v0)
              const swapTxBuffer = Buffer.from(transaction, "base64");
              const tx = VersionedTransaction.deserialize(swapTxBuffer);
              // 3. FIRMA (Importante: NO enviar a la red todavía)
              // Asegúrate de que tu objeto 'wallet' tenga el método signTransaction
              // Si usas el hook 'useWallet' de @solana/wallet-adapter-react:
              const signedTx = await wallet.signTransaction(tx); 

              // 4. Ejecución gestionada por Jupiter (Managed Landing)
              toast.info("Executing swap via Jupiter...");
              
              const executeResult = await fetch("https://api.jup.ag/swap/v2/execute", {
                method: "POST",
                headers: { 
                  "Content-Type": "application/json",
                  "x-api-key": process.env.NEXT_PUBLIC_JUPITER_API
                },
                body: JSON.stringify({
                  signedTransaction: Buffer.from(signedTx.serialize()).toString("base64"),
                  requestId: requestId,
                }),
              }).then(r => r.json());

              if (executeResult.error) {
                console.error("Jupiter Execute Error:", executeResult);
                throw new Error(`Execution failed: ${executeResult.error}`);
              }

              // 5. Éxito
              desc = `Swapped ${amount} ${from.slice(0, 4)}... to ${to.slice(0, 4)}...`;
              if (executeResult.signature) {
                stepSignature = executeResult.signature;
                notifyTxSuccess("Swap completado correctamente", executeResult.signature, {
                  description: desc,
                });
              } else {
                toast.success("Swap completed successfully!", { description: desc });
              }
              simulatedTxSnapshot = { signature: executeResult.signature, actionType: "swap" };
              setLastTxData(simulatedTxSnapshot);
            }
              // desc = `Swapped ${node.params.amount || 1} ${node.params.from || 'SOL'} for ${node.params.to || 'USDC'} via Jupiter`;
            if (stepSignature) {
              notifyTxSuccess(`Paso ${i} completado: ${node.module.name}`, stepSignature, {
                description: desc,
              });
            } else {
              toast.success(`Step ${i} completed: ${node.module.name}`, { description: desc });
            }
          } catch (err: any) {
            if (err.message === "Canceled By User") {
              throw err;
            }
            setErrorNodeId(node.id);
            console.error("Step execution error:", err);
            throw new Error(`Step ${i} failed: ${err.message}`);
          }
        }

        if (i < nodes.length - 1) {
          setRunningNodeId(null);
          setAnimatingLineIndex(i);
          await new Promise((r) => setTimeout(r, 1200));
        }
      }

      setRunningNodeId(null);
      setAnimatingLineIndex(-1);
      if (simulatedTxSnapshot?.signature) {
        notifyTxSuccess("Simulación completada correctamente", simulatedTxSnapshot.signature, {
          description: "La simulación del canvas firma desde tu wallet y no mueve fondos de la bóveda.",
        });
      } else {
        toast.success("Workflow simulation completed successfully! 🎉");
      }
      if (simulatedTxSnapshot) setIsModalOpen(true);

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Simulation failed");
      if (activeNodeId && err?.message !== "Canceled By User") {
        setErrorNodeId(activeNodeId);
      }
      setRunningNodeId(null);
      setAnimatingLineIndex(-1);
    } finally {
      setIsRunning(false);
    }
  };

  const continuePublish = (mode: "publish" | "update" = publishMode) => {
    const cluster = getCluster();
    const unsupported = findUnsupportedAssets(cluster);
    if (unsupported.length > 0 && !unsupportedAssetsAcknowledged(cluster, unsupported)) {
      setUnsupportedAssets(unsupported);
      setUnsupportedAssetOpen(true);
      return;
    }
    void performPublish(mode);
  };

  const publishOnchain = () => {
    if (isMainnet() && !mainnetWarningAcknowledged()) {
      setMainnetWarningOpen(true);
      return;
    }
    continuePublish(publishMode);
  };

  // The vault panel asks for a published workflow before creating a vault so
  // the PDA can always be recovered from the on-chain reference.
  useEffect(() => {
    const publish = () => publishOnchain();
    window.addEventListener("publish-workflow", publish);
    return () => window.removeEventListener("publish-workflow", publish);
  });

  const performPublish = async (mode: "publish" | "update" = "publish") => {
    // Rebuild from the canvas so the IPFS JSON always matches what the user
    // sees, including the latest node parameters and positions.
    const currentWorkflow = nodesToWorkflow(getScenarioName(), getFlowNodes());
    const wf = currentWorkflow || getWorkflow();
    if (!wf) {
      toast.error("Build or generate a workflow first");
      return;
    }

    if (!connected || !publicKey) {
      toast.error("Wallet not connected", {
        description: "Please connect any Solana wallet using the top button."
      });
      return;
    }

    setPublishing(true);
    try {
    // 1. Preparación de datos segura
    const schedule = getExecutionFrequency();
    const executionMode = getExecutionMode();
    const scheduleSeconds = scheduleToSeconds(schedule);
    const workflowId = getWorkflowId();
    const owner = publicKey.toBase58();

    // An update only swaps the on-chain reference (new CID, signature and
    // version). The existing automation state must survive the new pin.
    const isUpdate = mode === "update";
    let preservedExecution: {
      enabled: boolean;
      automation_status: string;
      next_run_at: string | null;
    } | null = null;

    if (isUpdate) {
      if (activationRow) {
        preservedExecution = {
          enabled: activationRow.enabled,
          automation_status: activationRow.automation_status,
          next_run_at: activationRow.next_run_at ?? null,
        };
      } else {
        const { data: existing } = await supabase
          .from("workflows")
          .select("enabled,automation_status,next_run_at")
          .eq("owner_wallet", owner)
          .eq("workflow_id", workflowId)
          .maybeSingle();
        if (existing) {
          preservedExecution = {
            enabled: Boolean(existing.enabled),
            automation_status: String(existing.automation_status || "inactive"),
            next_run_at: existing.next_run_at ?? null,
          };
        }
      }
    }

    const saveSignature = await signSavePayload(owner, workflowId);
    const workflowName = (wf.name && wf.name.trim() !== "") ? wf.name : "Untitled Workflow";
    const automationStatus = schedule !== "manual" ? "active" : "inactive";
    const nextRunAt = automationStatus === "active"
      ? new Date(Date.now() + scheduleSeconds * 1000).toISOString()
      : null;
    const publishableWorkflow = {
      ...wf,
      name: workflowName,
      schedule,
      scheduleSeconds,
      executionMode,
      workflowId,
    };
    const body = {
      json: publishableWorkflow,
      name: workflowName,
      owner_wallet: owner,
      signature: saveSignature,
      schedule,
      workflow_id: workflowId,
      execution_mode: executionMode,
      schedule_seconds: scheduleSeconds,
    };

    // 2. Llamada a Supabase (IPFS)
    const { data: pin, error: pinErr, response } = await supabase.functions.invoke("pin-to-ipfs", { body });
    if (pinErr) {
      const errorBody = response ? await response.json().catch(() => ({})) : {};
      throw new Error(errorBody.error?.message || pinErr.message || "IPFS Pinning failed");
    }
    const cid = pin?.cid;
    if (!cid) throw new Error("IPFS did not return a CID");

    // 3. Publicación On-Chain
    const prev = getOnchainMeta();
    const version = (prev.version ?? 0) + 1;
    const { signature } = await publishWorkflowMemo({ sendTransaction, publicKey }, { name: workflowName, cid, version });
    setOnchainMeta({ cid, signature, version });

    // 4. Persistencia: pin-to-ipfs ya crea/actualiza la fila por (owner_wallet, workflow_id).
    // Usamos su id para evitar duplicados y aplicamos la firma real de la publicación.
    const safeJson = JSON.parse(JSON.stringify(publishableWorkflow));
    const automationRow = {
      json: safeJson,
      cid,
      schedule,
      schedule_seconds: scheduleSeconds,
      execution_mode: executionMode,
      workflow_id: workflowId,
      onchain_signature: signature,
      updated_at: new Date().toISOString(),
      ...(isUpdate && preservedExecution
        ? {
            enabled: preservedExecution.enabled,
            automation_status: preservedExecution.automation_status,
            next_run_at: preservedExecution.next_run_at,
          }
        : {
            // Keep the UI switch and the cron in sync: the scheduler claims
            // rows where `enabled` AND `automation_status` are both active.
            enabled: automationStatus === "active",
            automation_status: automationStatus,
            next_run_at: nextRunAt,
          }),
    };

    let rowId = typeof pin?.id === "string" ? pin.id : undefined;

    if (!rowId) {
      const { data: byWorkflow } = await supabase
        .from("workflows")
        .select("id")
        .eq("owner_wallet", owner)
        .eq("workflow_id", workflowId)
        .maybeSingle();
      rowId = byWorkflow?.id;
    }

    if (!rowId) {
      const { data: byName } = await supabase
        .from("workflows")
        .select("id")
        .eq("owner_wallet", owner)
        .eq("name", workflowName)
        .maybeSingle();
      rowId = byName?.id;
    }

    let dbError;
    if (rowId) {
      const { error } = await supabase
        .from("workflows")
        .update(automationRow)
        .eq("id", rowId);
      dbError = error;
    } else {
      const { error } = await supabase.from("workflows").insert({
        ...automationRow,
        name: workflowName,
        owner_wallet: owner,
      });
      dbError = error;
    }

    if (dbError) throw new Error(`DB Error: ${dbError.message}`);

    void loadActivation();

    // Keep the local "My Workflows" list in sync with the IPFS/on-chain
    // publish so the flow can be reopened without loading it from the chain.
    const savedRecord = rememberSavedWorkflow({
      id: editingId || undefined,
      pinataId: typeof pin?.id === "string" ? pin.id : undefined,
      name: workflowName,
      workflow: publishableWorkflow,
      ownerWallet: owner,
      cid,
      workflowId,
      executionMode,
    });
    if (!editingId) setEditingId(savedRecord.id);

    if (executionMode === "vault_transfer" || executionMode === "vault_dca" || executionMode === "subscription") {
      toast.info("Modo de fondos guardado", {
        description: "Configura la bóveda y autoriza sus límites para que el cron pueda transferir dentro de ellos.",
      });
    }

    notifyTxSuccess(
      isUpdate ? "Workflow actualizado on-chain" : "Guardado en IPFS y publicado on-chain",
      signature,
      {
        description: isUpdate
          ? `Nueva referencia v${version} · CID ${cid.slice(0, 8)}... · automatización sin cambios`
          : `CID: ${cid.slice(0, 8)}... · v${version} · ${automationStatus === "active" ? "cron activo" : "sin cron"}`,
      },
    );
  } catch (e: any) {
    console.error("--- PUBLISH ERROR ---", e);
    toast.error(e.message || "Publish failed");
  } finally {
    setPublishing(false);
  }
  };

  const isWorkflowActive = Boolean(
    activationRow?.enabled && activationRow?.automation_status === "active",
  );
  const activationTitle = !activationRow
    ? "Publica el workflow on-chain para poder activarlo"
    : executionFrequency === "manual" && !isWorkflowActive
      ? "Workflow manual: cambia la frecuencia para activarlo"
      : isWorkflowActive
        ? "Desactivar workflow"
        : "Activar workflow";

  return (
    <>
      <div className="z-30 w-full shrink-0 border-t border-border bg-background px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 sm:h-12 sm:px-4 sm:py-0">
        <div className="flex flex-wrap items-center gap-2 sm:h-full sm:flex-nowrap">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:contents">
            <button
              onClick={handleSave}
              className="flex min-h-10 shrink-0 items-center gap-1 rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Save className="h-4 w-4" />
              <span>Guardar</span>
            </button>
            <button
              onClick={runSimulation}
              disabled={isRunning || scheduledRun.status === "running"}
              className="flex min-h-10 shrink-0 items-center gap-1 rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              title={
                scheduledRun.status === "running"
                  ? "El cron está ejecutando este workflow"
                  : "Ejecutar el workflow manualmente"
              }
            >
              {isRunning || scheduledRun.status === "running" ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Play className="h-4 w-4 text-emerald-400 fill-emerald-400/20" />
              )}
              <span className="whitespace-nowrap">
                {isRunning || scheduledRun.status === "running" ? "Ejecutando..." : "Ejecutar"}
              </span>
            </button>
            {(scheduledRun.status === "queued" || scheduledRun.status === "running") && (
              <span
                className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 text-[11px] font-medium text-primary"
                title={
                  scheduledRun.workflowName
                    ? `${scheduledRun.workflowName} · ${scheduledRun.status === "queued" ? "esperando al cron" : "ejecución programada en curso"}`
                    : undefined
                }
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="whitespace-nowrap">
                  {scheduledRun.status === "queued" ? "Programado" : "On-chain"}
                </span>
              </span>
            )}
            <button
              onClick={publishOnchain}
              disabled={publishing}
              className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-md bg-gradient-purple-cyan px-2.5 py-1.5 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-60"
              title={
                publishMode === "update"
                  ? "Actualizar la referencia on-chain de este workflow a la nueva versión"
                  : "Pin JSON to IPFS and record CID on Solana"
              }
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : publishMode === "update" ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span className="whitespace-nowrap">
                <span className="sm:hidden">
                  {publishMode === "update" ? "Actualizar" : "Publicar"}
                </span>
                <span className="hidden sm:inline">
                  {publishMode === "update" ? "Actualizar workflow on-chain" : "Publicar on-chain"}
                </span>
              </span>
            </button>

            <div
              className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-muted/50 px-2"
              onClick={(event) => event.stopPropagation()}
            >
              <Switch
                checked={isWorkflowActive}
                onCheckedChange={(checked) => void handleToggleActivation(checked)}
                disabled={
                  !activationRow ||
                  togglingActivation ||
                  (executionFrequency === "manual" && !isWorkflowActive)
                }
                title={activationTitle}
                aria-label={isWorkflowActive ? "Desactivar workflow" : "Activar workflow"}
              />
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {togglingActivation ? "…" : isWorkflowActive ? "Activo" : "Inactivo"}
              </span>
            </div>

            <button
              onClick={() => window.dispatchEvent(new Event("open-vault"))}
              disabled={!vaultReady}
              className="hidden min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent sm:flex"
              title={vaultDisabledTitle}
              aria-label="Abrir bóveda y límites"
            >
              <Landmark className="h-4 w-4" />
              <span className="whitespace-nowrap">Bóveda y límites</span>
            </button>
          </div>

          {/* On mobile the vault gets its own full-width row so no horizontal
              dragging is needed to reach it. */}
          <div className="flex w-full sm:hidden">
            <button
              onClick={() => window.dispatchEvent(new Event("open-vault"))}
              disabled={!vaultReady}
              className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-muted/30"
              title={vaultDisabledTitle}
              aria-label="Abrir bóveda y límites"
            >
              <Landmark className="h-4 w-4" />
              <span>Bóveda y límites</span>
            </button>
          </div>

          <div className="flex w-full min-w-0 items-stretch gap-2 sm:contents">
          <div className="flex min-w-0 flex-1 items-center gap-1 rounded-full bg-muted/50 sm:flex-none">
            <div className="flex min-w-0 items-center gap-1 px-2 py-0 text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <select
                value={executionFrequency}
                onChange={(event) => persistExecutionFrequency(event.target.value)}
                className="h-10 w-full min-w-0 border-none bg-transparent text-base focus:outline-none sm:w-auto sm:text-sm"
                aria-label="Frecuencia de ejecución"
                title="Frecuencia con la que se ejecutará el workflow publicado on-chain"
              >
                <option value="30s">30 segundos</option>
                <option value="1m">1 minuto</option>
                <option value="2m">2 minutos</option>
                <option value="5m">5 minutos</option>
                <option value="15m">15 minutos</option>
                <option value="30m">30 minutos</option>
                <option value="1h">1 hora</option>
                <option value="6h">6 horas</option>
                <option value="24h">1 día</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-1 rounded-full bg-muted/50 sm:flex-none">
            <div className="flex min-w-0 items-center gap-1 px-2 py-0 text-muted-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <select
                value={executionMode}
                onChange={(event) => persistExecutionMode(event.target.value)}
                className="h-10 w-full min-w-0 border-none bg-transparent text-base focus:outline-none sm:w-auto sm:text-sm"
                aria-label="Modo de ejecución"
                title="Define si el cron solo avisa o si puede mover fondos desde una bóveda autorizada"
              >
                {EXECUTION_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          </div>

          <div className="flex w-full items-center justify-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
            <button
              onClick={() => setCanvasScale(scale - 0.1)}
              className="flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted"
              title="Zoom Out"
              aria-label="Alejar"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="w-10 text-center font-mono text-xs">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setCanvasScale(scale + 0.1)}
              className="flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted"
              title="Zoom In"
              aria-label="Acercar"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <TransactionSuccessModal
        isOpen={isModalOpen}
        onClose={setIsModalOpen}
        txData={lastTxData}
      />
      <MainnetPublishWarning
        open={mainnetWarningOpen}
        isUpdate={publishMode === "update"}
        onCancel={() => setMainnetWarningOpen(false)}
        onConfirm={(dontShowAgain) => {
          if (dontShowAgain && typeof window !== "undefined") {
            try {
              window.localStorage.setItem(MAINNET_ACK_KEY, "true");
            } catch {
              // Ignore storage failures; the warning still applies this time.
            }
          }
          setMainnetWarningOpen(false);
          continuePublish(publishMode);
        }}
      />
      <MainnetPublishWarning
        kind="unsupported_asset"
        open={unsupportedAssetOpen}
        isUpdate={publishMode === "update"}
        assets={unsupportedAssets}
        cluster={getCluster()}
        supportedAssets={supportedAssetLabel(getCluster())}
        onCancel={() => setUnsupportedAssetOpen(false)}
        onConfirm={(dontShowAgain) => {
          if (dontShowAgain && typeof window !== "undefined") {
            try {
              window.localStorage.setItem(
                UNSUPPORTED_ASSET_ACK_KEY,
                unsupportedAssetAckKey(getCluster(), unsupportedAssets),
              );
            } catch {
              // Ignore storage failures; the warning still applies this time.
            }
          }
          setUnsupportedAssetOpen(false);
          void performPublish(publishMode);
        }}
      />
    </>
  );
};

export default BottomToolbar;