import React, { useState, useEffect } from 'react';
import { Save, Play, Settings, ZoomIn, ZoomOut, Clock, Upload, Loader2 } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react'; // Hook oficial de Solana
import { Connection } from '@solana/web3.js'; // Necesario para inicializar el envío de transacciones
import { publishWorkflowMemo, solscanUrl } from '@/lib/solana';
import {
  getWorkflow, getOnchainMeta, setOnchainMeta,
  getFlowNodes, getCanvasScale, setCanvasScale, subscribeScale,
  setRunningNodeId, setAnimatingLineIndex
} from '@/lib/workflowStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import SettingsDialog from './SettingsDialog';

const BottomToolbar: React.FC = () => {
  const [publishing, setPublishing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [scale, setScale] = useState(getCanvasScale());

  // Extraemos las herramientas necesarias de la wallet global conectada
  const { publicKey, connected, sendTransaction } = useWallet();

  useEffect(() => {
    const unsub = subscribeScale((s) => setScale(s));
    return () => { unsub(); };
  }, []);

  const handleSave = async () => {
    // Verificamos si la wallet está lista y conectada globalmente
    if (!connected || !publicKey) {
      toast.error("Wallet required", {
        description: "Please connect your wallet to save workflows."
      });
      return;
    }
    const walletAddress = publicKey.toBase58();

    const wf = getWorkflow();
    if (!wf) {
      toast.error("Build or generate a workflow first");
      return;
    }
    try {
      toast.info("Saving workflow and pinning to IPFS...");
      const { pinJSONToIPFS } = await import("@/lib/pinataService");
      const cid = await pinJSONToIPFS(wf, wf.name);

      const { saveWorkflow } = await import("@/lib/workflowStore");
      saveWorkflow(wf.name, wf, walletAddress, cid);

      toast.success("Workflow saved and pinned", {
        description: `CID: ${cid.slice(0, 8)}...`
      });
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to pin to IPFS", { description: e.message });

      // Fallback local save
      const { saveWorkflow } = await import("@/lib/workflowStore");
      saveWorkflow(wf.name, wf, walletAddress);
      toast.success("Workflow saved locally (IPFS failed)");
    }
  };

  const runSimulation = async () => {
    const nodes = getFlowNodes();
    if (nodes.length === 0) {
      toast.error("Add at least one node to simulate the workflow");
      return;
    }
    setIsRunning(true);
    toast.info("Starting workflow simulation...");

    try {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        setRunningNodeId(node.id);
        setAnimatingLineIndex(-1);

        if (i === 0) {
          toast.info(`Checking trigger: ${node.module.name}...`, {
            description: `Params: ${JSON.stringify(node.params)}`
          });
          await new Promise((r) => setTimeout(r, 1500));
          toast.success(`Trigger fired: ${node.module.name} condition met!`);
        } else {
          toast.info(`Executing step ${i}: ${node.module.name}...`);
          await new Promise((r) => setTimeout(r, 1500));

          let desc = "Action executed successfully.";
          if (node.module.type === "send_transaction") {
            desc = `Sent ${node.params.amount || 0.1} ${node.params.asset || 'SOL'} to ${node.params.to || 'recipient'}`;
          } else if (node.module.type === "send_alert") {
            desc = `Alert "${node.params.message || 'Trigger fired!'}" sent via ${node.params.channel || 'app'}`;
          } else if (node.module.type === "swap") {
            desc = `Swapped ${node.params.amount || 1} ${node.params.from || 'SOL'} for ${node.params.to || 'USDC'} via Jupiter`;
          }
          toast.success(`Step ${i} completed: ${node.module.name}`, {
            description: desc
          });
        }

        if (i < nodes.length - 1) {
          setRunningNodeId(null);
          setAnimatingLineIndex(i);
          await new Promise((r) => setTimeout(r, 1200));
        }
      }
      setRunningNodeId(null);
      setAnimatingLineIndex(-1);
      await new Promise((r) => setTimeout(r, 400));
      toast.success("Workflow simulation completed successfully! 🎉");
    } catch (err) {
      toast.error("Simulation failed");
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

    // Comprobamos si la wallet está lista en el Adapter actual
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

      // Inyectamos las herramientas requeridas al helper en lugar de pasar el viejo objeto "Phantom"
      const { signature } = await publishWorkflowMemo(
        { sendTransaction, publicKey }, // Le pasas las herramientas de useWallet
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
        cid,
        onchain_signature: signature,
        owner_wallet: publicKey.toBase58(),
        device_id: localStorage.getItem("solflows_device_id") || "anon",
      }, { onConflict: "name" }).then(() => { }, () => { });

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
  );
};

export default BottomToolbar;