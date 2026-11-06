import React, { useState, useEffect } from 'react';
import { Save, Play, ZoomIn, ZoomOut, Clock, Upload, Loader2, ShieldCheck } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Buffer } from 'buffer';
import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import { connection, publishWorkflowMemo,solexplorerUrl } from '@/lib/solana';
import { workflowToNodes, nodesToWorkflow } from "@/lib/workflow";
import {
  getWorkflow, getOnchainMeta, setOnchainMeta, setScenarioName, setFlowNodes, updateWorkflow,
  getFlowNodes, getCanvasScale, setCanvasScale, subscribeScale, getScenarioName,
  setRunningNodeId, setAnimatingLineIndex, setErrorNodeId, saveWorkflow, saveLocalOnly, getSavedWorkflows,
  getExecutionFrequency, setExecutionFrequency as persistExecutionFrequency, subscribeExecutionFrequency,
  getExecutionMode, setExecutionMode as persistExecutionMode, subscribeExecutionMode,
  getWorkflowId, setWorkflowId,
} from '@/lib/workflowStore';
import {
  EXECUTION_MODE_OPTIONS,
  scheduleToSeconds,
  type ExecutionMode,
} from '@/lib/schedule';

import { FlowNode } from "@/lib/workflow";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import SettingsDialog from './SettingsDialog';
import TransactionSuccessModal from './TransactionSuccessModal';
import { TriggerEngine } from "@/lib/triggerEngine";
import { sendAlert } from "@/lib/alerts";
import { useRouter } from 'next/router';

const BottomToolbar: React.FC = () => {
  const [publishing, setPublishing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [scale, setScale] = useState(getCanvasScale());
  const [executionFrequency, setExecutionFrequency] = useState(getExecutionFrequency());
  const [executionMode, setExecutionMode] = useState<ExecutionMode>(getExecutionMode());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastTxData, setLastTxData] = useState<{ signature: string; actionType: string; blockhash?: string } | null>(null);
  const { publicKey, connected, sendTransaction } = useWallet();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const router = useRouter();
  const wallet = useWallet();

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
    if (publicKey) {
      setWalletAddress(publicKey.toBase58());
    } else {
      setWalletAddress(null);
    }
  }, [publicKey]);

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
            walletAddress
          );
          return result;
        } else {
          const result = await saveWorkflow(
            wf.name,
            wf,
            walletAddress,
            "skip",
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
              updateWorkflow(editingId, wf.name, wf, walletAddress);
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
              await connection.confirmTransaction(signature, "confirmed");

              desc = `Successfully sent ${targetAmount} ${targetAsset} to ${targetTo.slice(0, 6)}...`;
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
              toast.success("Swap completed successfully!");
              desc = `Swapped ${amount} ${from.slice(0, 4)}... to ${to.slice(0, 4)}...`;
              simulatedTxSnapshot = { signature: executeResult.signature, actionType: "swap" };
              setLastTxData(simulatedTxSnapshot);
            }
              // desc = `Swapped ${node.params.amount || 1} ${node.params.from || 'SOL'} for ${node.params.to || 'USDC'} via Jupiter`;
            toast.success(`Step ${i} completed: ${node.module.name}`, { description: desc });
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
      toast.success("Workflow simulation completed successfully! 🎉");
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

  const publishOnchain = async () => {
    const wf = getWorkflow();
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
    const skip = "skip";
    const schedule = getExecutionFrequency();
    const executionMode = getExecutionMode();
    const scheduleSeconds = scheduleToSeconds(schedule);
    const workflowId = getWorkflowId();
    const owner = publicKey.toBase58();
    const workflowName = (wf.name && wf.name.trim() !== "") ? wf.name : "Untitled Workflow";
    const automationStatus = executionMode === "notify" && schedule !== "manual" ? "active" : "inactive";
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
      signature: skip,
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
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
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
      automation_status: automationStatus,
      next_run_at: nextRunAt,
      onchain_signature: signature,
      updated_at: new Date().toISOString(),
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

    if (executionMode === "vault_transfer" || executionMode === "vault_dca" || executionMode === "subscription") {
      toast.info("Modo de fondos guardado", {
        description: "La ejecución automática queda inactiva hasta desplegar y configurar la bóveda on-chain.",
      });
    }

    toast.success("Published on-chain", {
      description: `CID: ${cid.slice(0, 8)}... · v${version} · ${automationStatus === "active" ? "cron activo" : "sin cron"}`,
      action: { label: "View", onClick: () => window.open(solexplorerUrl(signature), "_blank") },
    });
  } catch (e: any) {
    console.error("--- PUBLISH ERROR ---", e);
    toast.error(e.message || "Publish failed");
  } finally {
    setPublishing(false);
  }
  };

  return (
    <>
      <div className="z-30 w-full shrink-0 border-t border-border bg-background px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 sm:h-12 sm:px-4 sm:py-0">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:h-full sm:flex-nowrap">
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto no-scrollbar sm:gap-2">
            <button
              onClick={handleSave}
              className="flex min-h-10 shrink-0 items-center gap-1 rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Save className="h-4 w-4" />
              <span>Guardar</span>
            </button>
            <button
              onClick={runSimulation}
              disabled={isRunning}
              className="flex min-h-10 shrink-0 items-center gap-1 rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Play className="h-4 w-4 text-emerald-400 fill-emerald-400/20" />
              )}
              <span className="whitespace-nowrap">
                {isRunning ? "Ejecutando..." : "Ejecutar"}
              </span>
            </button>
            <button
              onClick={publishOnchain}
              disabled={publishing}
              className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-md bg-gradient-purple-cyan px-2.5 py-1.5 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-60"
              title="Pin JSON to IPFS and record CID on Solana"
            >
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span className="whitespace-nowrap">
                <span className="sm:hidden">Publicar</span>
                <span className="hidden sm:inline">Publicar on-chain</span>
              </span>
            </button>

            <SettingsDialog listenForOpenEvent />
          </div>

          <div className="flex shrink-0 items-center gap-1 rounded-full bg-muted/50">
            <div className="flex items-center gap-1 px-2 py-0 text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <select
                value={executionFrequency}
                onChange={(event) => persistExecutionFrequency(event.target.value)}
                className="h-10 w-[8.5rem] border-none bg-transparent text-base focus:outline-none sm:w-auto sm:text-sm"
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

          <div className="flex shrink-0 items-center gap-1 rounded-full bg-muted/50">
            <div className="flex items-center gap-1 px-2 py-0 text-muted-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <select
                value={executionMode}
                onChange={(event) => persistExecutionMode(event.target.value)}
                className="h-10 w-[9.5rem] border-none bg-transparent text-base focus:outline-none sm:w-auto sm:text-sm"
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

          <div className="flex shrink-0 items-center gap-1">
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
    </>
  );
};

export default BottomToolbar;