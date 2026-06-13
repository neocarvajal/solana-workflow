import React, { useState, useEffect } from 'react';
import { Save, Play, ZoomIn, ZoomOut, Clock, Upload, Loader2 } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Buffer } from 'buffer';
import { Connection, Transaction } from '@solana/web3.js';
import { connection, publishWorkflowMemo, solscanUrl } from '@/lib/solana';
import { workflowToNodes, nodesToWorkflow } from "@/lib/workflow";
import {
  getWorkflow, getOnchainMeta, setOnchainMeta, setScenarioName, setFlowNodes, updateWorkflow,
  getFlowNodes, getCanvasScale, setCanvasScale, subscribeScale, getScenarioName,getSettings,
  setRunningNodeId, setAnimatingLineIndex, saveWorkflow, saveLocalOnly, getSavedWorkflows,
} from '@/lib/workflowStore';

import { FlowNode } from "@/lib/workflow";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import SettingsDialog from './SettingsDialog';
import TransactionSuccessModal from './TransactionSuccessModal';
import { TriggerEngine } from "@/lib/triggerEngine";
import { useRouter } from 'next/router';

const BottomToolbar: React.FC = () => {
  const [publishing, setPublishing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [scale, setScale] = useState(getCanvasScale());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastTxData, setLastTxData] = useState<{ signature: string; actionType: string; blockhash?: string } | null>(null);
  const {publicKey, connected, sendTransaction } = useWallet();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = subscribeScale((s) => setScale(s));
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

    const saved = getSavedWorkflows(walletAddress);
    // FIX: Buscamos usando las propiedades reales del registro de almacenamiento
    const existing = saved.find(s => s.id === editingId || (s as any).pinata_file_id === editingId);
    
    // CRITICAL FIX: Pinata necesita el "pinata_file_id" real de la nube para poder actualizar el JSON
    const cloudTargetId = (existing as any)?.pinata_file_id || existing?.id || editingId;
    const oldCid = existing?.cid;

    toast.promise(
      async () => {
        if (editingId) {
          // Sincronizado exactamente con: (id, name, updatedData, walletAddress)
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
          saveLocalOnly(wf.name, wf, walletAddress);
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
    const triggerEngine = new TriggerEngine();
    toast.info("Starting workflow simulation...");

    let simulatedTxSnapshot = null;

    try {
      setLastTxData(null);
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i] as FlowNode;
        setRunningNodeId(node.id);
        setAnimatingLineIndex(-1);

        console.log(`Procesando nodo ${i}: ${node.module.name} (Kind: ${node.module.kind})`);
        const params = node.params || {};

        if (node.module.kind === "trigger") {
          toast.info(`Validating trigger: ${node.module.name}...`);
          const isTriggered = await triggerEngine.validateTrigger(node);

          console.log(`Resultado de la validación del trigger: ${isTriggered}`);
          
          if (!isTriggered) {
            toast.error(`Condition not met: ${node.module.name}`);
            return;
          }

          toast.success("Trigger condition met!");
      
        }else {
          toast.info(`Executing step ${i}: ${node.module.name}...`);
          await new Promise((r) => setTimeout(r, 1000));

          let desc = "Action executed successfully.";

          try {
            if (node.module.type === "send_transaction") {
              console.log("Nodo analizado:", node);
              console.log("Params del nodo:", node.params);
              const targetAmount = params.amount || "1";
              const targetAsset = params.asset || "USDC";
              const targetTo = params.to || "11111111111111111111111111111111";
              
              toast.info(`Preparing transfer of ${node.params.amount} ${node.params.asset}...`, {
                description: "Please sign the transaction in your wallet"
              });

              console.log("Nodo enviado a simular:", JSON.stringify(node, null, 2));

              const payload = {
                actionType: "send_transaction", 
                owner: publicKey?.toBase58(),
                params: {
                  to: node.params.to,          
                  amount: parseFloat(node.params.amount),
                  asset: node.params.asset,
                },
              };
              
              console.log("Payload enviado al servidor:", JSON.stringify(payload, null, 2));
              
              const response = await fetch("/api/workflow/simulate-tx", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  actionType: "send_transaction", 
                  owner: publicKey?.toBase58(),
                  params: {
                    to: node.params.to,          
                    amount: parseFloat(node.params.amount),
                    asset: node.params.asset,
                  },
                }),
              });

              const data = await response.json();
              if (!response.ok) throw new Error(data.error || "Failed to simulate transaction");

              const transaction = Transaction.from(Buffer.from(data.serializedTx, "base64"));
              
              // Manejo de la firma con captura de cancelación
              const signature = await sendTransaction(transaction, connection).catch((err) => {
                if (err.name === 'WalletSendTransactionError' || err.message?.includes('User rejected')) {
                  throw new Error("Canceled By User");
                }
                throw err;
              });
              
              toast.info("Transaction broadcasted! Waiting for confirmation...");
              await connection.confirmTransaction(signature, "confirmed");

              desc = `Successfully sent ${node.params.amount} ${node.params.asset} to ${node.params.to.slice(0, 6)}...`;
              simulatedTxSnapshot = { signature, actionType: "send_transaction" };
              setLastTxData(simulatedTxSnapshot);

            } else if (node.module.type === "send_alert") {
              desc = `Alert "${node.params.message || 'Trigger fired!'}" sent via ${node.params.channel || 'app'}`;
            } else if (node.module.type === "swap") {
              desc = `Swapped ${node.params.amount || 1} ${node.params.from || 'SOL'} for ${node.params.to || 'USDC'} via Jupiter`;
            }

            toast.success(`Step ${i} completed: ${node.module.name}`, { description: desc });

          } catch (err: any) {
            // Si el usuario canceló, relanzamos el error especial para manejarlo en el try/catch principal
            if (err.message === "Canceled By User") {
              throw err; 
            }
            // Si es un error de ejecución, lo notificamos
            console.error("Step execution error:", err);
            throw new Error(`Step ${i} failed: ${err.message}`);
          }
        }
        // Animación de conexión
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
      setRunningNodeId(null);
      setAnimatingLineIndex(-1);
    } finally {
      setIsRunning(false);
    }
  };

  // const runSimulation = async () => {
  //   const nodes = getFlowNodes();
  //   if (nodes.length === 0) {
  //     toast.error("Add at least one node to simulate the workflow");
  //     return;
  //   }
  
  //   setIsRunning(true);
  //   const triggerEngine = new TriggerEngine();
  //   toast.info("Starting workflow simulation...");

  //   let simulatedTxSnapshot = null;

  //   try {
  //     setLastTxData(null);
  //     for (let i = 0; i < nodes.length; i++) {
  //       const node = nodes[i] as FlowNode;
  //       setRunningNodeId(node.id);
  //       setAnimatingLineIndex(-1);

  //       console.log(`Procesando nodo ${i}: ${node.module?.name} (Kind: ${node.module?.kind})`);

  //       const params = node.params || {};

  //       if (node.module?.kind === "trigger") {
  //         toast.info(`Validating trigger: ${node.module.name}...`);
  //         const isTriggered = await triggerEngine.validateTrigger(node);

  //         console.log(`Resultado de la validación del trigger: ${isTriggered}`);
          
  //         if (!isTriggered) {
  //           toast.error(`Condition not met: ${node.module.name}`);
  //           return;
  //         }

  //         toast.success("Trigger condition met!");
      
  //       } else {
  //         toast.info(`Executing step ${i}: ${node.module?.name}...`);
  //         await new Promise((r) => setTimeout(r, 1000));

  //         let desc = "Action executed successfully.";

  //         console.log("PARAMS ", params.amount, params.asset, params.to);

  //         try {
  //           if (node.module?.type === "send_transaction") {
  //             const targetAmount = params.amount || "0.1";
  //             const targetAsset = params.asset || "SOL";
  //             const targetTo = params.to || "11111111111111111111111111111111";

  //             toast.info(`Preparing transfer of ${targetAmount} ${targetAsset}...`, {
  //               description: "Please sign the transaction in your wallet"
  //             });
              
  //             const response = await fetch("/api/workflow/simulate-tx", {
  //               method: "POST",
  //               headers: { "Content-Type": "application/json" },
  //               body: JSON.stringify({
  //                 actionType: "send_transaction", 
  //                 owner: publicKey?.toBase58(),
  //                 params: {
  //                   to: targetTo,          
  //                   amount: parseFloat(targetAmount),
  //                   asset: targetAsset,
  //                 },
  //               }),
  //             });

  //             const data = await response.json();
  //             if (!response.ok) throw new Error(data.error || "Failed to simulate transaction");

  //             const transaction = Transaction.from(Buffer.from(data.serializedTx, "base64"));
              
  //             // Manejo de la firma con captura de cancelación
  //             const signature = await sendTransaction(transaction, connection).catch((err) => {
  //               if (err.name === 'WalletSendTransactionError' || err.message?.includes('User rejected')) {
  //                 throw new Error("Canceled By User");
  //               }
  //               throw err;
  //             });
              
  //             toast.info("Transaction broadcasted! Waiting for confirmation...");
  //             await connection.confirmTransaction(signature, "confirmed");

  //             desc = `Successfully sent ${targetAmount} ${targetAsset} to ${targetTo.slice(0, 6)}...`;
  //             simulatedTxSnapshot = { signature, actionType: "send_transaction" };
  //             setLastTxData(simulatedTxSnapshot);

  //           } else if (node.module?.type === "send_alert") {
  //             desc = `Alert "${params.message || 'Trigger fired!'}" sent via ${params.channel || 'app'}`;
  //           } else if (node.module?.type === "swap") {
  //             desc = `Swapped ${params.amount || 1} ${params.from || 'SOL'} for ${params.to || 'USDC'} via Jupiter`;
  //           }

  //           toast.success(`Step ${i} completed: ${node.module?.name}`, { description: desc });

  //         } catch (err: any) {
  //           if (err.message === "Canceled By User") {
  //             throw err; 
  //           }
  //           console.error("Step execution error:", err);
  //           throw new Error(`Step ${i} failed: ${err.message}`);
  //         }
  //       }
        
  //       // Animación de conexión
  //       if (i < nodes.length - 1) {
  //         setRunningNodeId(null);
  //         setAnimatingLineIndex(i);
  //         await new Promise((r) => setTimeout(r, 1200));
  //       }
  //     }

  //     setRunningNodeId(null);
  //     setAnimatingLineIndex(-1);
  //     toast.success("Workflow simulation completed successfully! 🎉");
  //     if (simulatedTxSnapshot) setIsModalOpen(true);
      
  //   } catch (err: any) {
  //     console.error(err);
  //     toast.error(err.message || "Simulation failed");
  //     setRunningNodeId(null);
  //     setAnimatingLineIndex(-1);
  //   } finally {
  //     setIsRunning(false);
  //   }
  // };

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
      // 1. Pin to IPFS
      const { data: pin, error: pinErr } = await supabase.functions.invoke("pin-to-ipfs", {
        body: { json: wf, name: wf.name },
      });
      if (pinErr) throw pinErr;
      if (pin?.error) throw new Error(typeof pin.error === "string" ? pin.error : JSON.stringify(pin.error));
      const cid: string = pin.cid;

      // 2. Sign + send memo on Solana
      const prev = getOnchainMeta();
      const version = (prev.version ?? 0) + 1;

      // Creamos la instancia de conexión dinámica apuntando a Devnet
      const connection = new Connection("https://api.devnet.solana.com", "confirmed");

      // Inyectamos las herramientas requeridas al helper
      const { signature } = await publishWorkflowMemo(
        { sendTransaction, publicKey }, 
        {
          name: wf.name,
          cid,
          version,
        }
      );
      setOnchainMeta({ cid, signature, version });

      // 3. Persist link in Cloud
      await supabase.from("workflows").upsert({
        name: wf.name,
        json: wf as any,
        cid: cid,
        onchain_signature: signature,
        owner_wallet: publicKey.toBase58(),
        device_id: localStorage.getItem("solflows_device_id") || "anon",
      } as any, {
        onConflict: "name" 
      }).then(() => { }, () => { });

      toast.success("Published on-chain", {
        description: `cid ${cid.slice(0, 8)}… · v${version}`,
        action: {
          label: "View",
          onClick: () => window.open(solscanUrl(signature), "_blank"),
        },
      });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 h-12 bg-background border-t border-border flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="p-2 hover:bg-muted rounded-md flex items-center gap-1 text-sm text-foreground transition-colors"
          >
            <Save className="h-4 w-4" />
            <span>Save</span>
          </button>
          <button
            onClick={runSimulation}
            disabled={isRunning}
            className="p-2 hover:bg-muted rounded-md flex items-center gap-1 text-sm text-foreground transition-colors disabled:opacity-50"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <Play className="h-4 w-4 text-emerald-400 fill-emerald-400/20" />
            )}
            <span>{isRunning ? "Running..." : "Run once"}</span>
          </button>
          <button
            onClick={publishOnchain}
            disabled={publishing}
            className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-sm bg-gradient-purple-cyan text-white hover:opacity-90 disabled:opacity-60 font-medium transition-all"
            title="Pin JSON to IPFS and record CID on Solana"
          >
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span>Publish on-chain</span>
          </button>

          <SettingsDialog />
        </div>

        <div className="flex items-center gap-2 bg-muted/50 rounded-full">
          <div className="flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <select className="bg-transparent border-none focus:outline-none text-sm">
              <option>Every 15 minutes</option>
              <option>Every hour</option>
              <option>Every day</option>
              <option>Manual only</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCanvasScale(scale - 0.1)}
            className="p-1 hover:bg-muted rounded-md text-foreground transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-xs w-10 text-center font-mono">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setCanvasScale(scale + 0.1)}
            className="p-1 hover:bg-muted rounded-md text-foreground transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
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