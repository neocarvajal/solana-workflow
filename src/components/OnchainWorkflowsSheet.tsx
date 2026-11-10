import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Database, ExternalLink, Loader2, Download, RefreshCw } from "lucide-react";
import { listOnchainWorkflows, solscanUrl, shortAddr, type OnchainEntry } from "@/lib/solana";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getWorkflow,
  getWorkflowId,
  rememberSavedWorkflow,
  setFlowNodes,
  setOnchainMeta,
  setScenarioName,
  setWorkflowId,
} from "@/lib/workflowStore";
import { workflowToNodes, type Workflow } from "@/lib/workflow";
import { toast } from "sonner";

const OnchainWorkflowsSheet: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<OnchainEntry[]>([]);
  const [loadingCid, setLoadingCid] = useState<string | null>(null);
  const { publicKey } = useWallet();
  const router = useRouter();

  const load = async () => {
    if (!publicKey) {
      toast.error("Connect your wallet first");
      return;
    }

    setLoading(true);
    try {
      const list = await listOnchainWorkflows(publicKey);
      setEntries(list);
    } catch (e: any) {
      toast.error(e?.message || "Failed to fetch from chain");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open]);

  useEffect(() => {
    const openSheet = () => setOpen(true);
    window.addEventListener("open-onchain", openSheet);
    return () => window.removeEventListener("open-onchain", openSheet);
  }, []);

  const loadOne = async (e: OnchainEntry) => {
    if (!publicKey) {
      toast.error("Connect your wallet first");
      return;
    }

    setLoadingCid(e.payload.cid);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-ipfs", {
        body: { cid: e.payload.cid },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const wf = data.json as Workflow;
      if (!wf || !wf.trigger || !Array.isArray(wf.steps)) {
        throw new Error("El JSON de IPFS no contiene un workflow válido");
      }

      wf.name = wf.name || e.payload.name || "On-chain workflow";

      // Pins created before the automation metadata was added may not include
      // the stable workflow ID. Recover it from the Supabase row by CID.
      const owner = publicKey.toBase58();
      const { data: row } = await supabase
        .from("workflows")
        .select("name,workflow_id,execution_mode,schedule")
        .eq("owner_wallet", owner)
        .eq("cid", e.payload.cid)
        .maybeSingle();

      if (row) {
        wf.name = wf.name || row.name;
        wf.workflowId = wf.workflowId || row.workflow_id || undefined;
        wf.executionMode = (wf.executionMode || row.execution_mode) as Workflow["executionMode"];
        wf.schedule = wf.schedule || row.schedule;
      }

      const nodes = workflowToNodes(wf);
      if (nodes.length === 0) {
        throw new Error("El workflow no tiene nodos compatibles para cargar");
      }

      setWorkflowId(wf.workflowId || null);
      setScenarioName(wf.name);
      setFlowNodes(nodes);
      setOnchainMeta({ cid: e.payload.cid, signature: e.signature, version: e.payload.version });

      const loaded = getWorkflow() || wf;
      const record = rememberSavedWorkflow({
        name: wf.name,
        workflow: loaded,
        ownerWallet: owner,
        cid: e.payload.cid,
        workflowId: getWorkflowId(),
        executionMode: (loaded.executionMode || wf.executionMode) as Workflow["executionMode"],
      });

      toast.success(`"${wf.name}" cargado en el canvas`);
      setOpen(false);
      router.push({ pathname: "/dashboard", query: { id: record.id } });
    } catch (err: any) {
      toast.error(err?.message || "Could not fetch from IPFS");
    } finally {
      setLoadingCid(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-border px-2.5 py-2 text-xs hover:bg-muted sm:px-3 sm:text-sm">
          <Database className="h-4 w-4" />
          On-chain
        </button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:w-[420px] sm:max-w-[420px] sm:p-6">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between gap-2">
            <span className="truncate">My on-chain workflows</span>
            <button
              onClick={load}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-muted"
              title="Refresh"
              aria-label="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading wallet history…
            </div>
          )}
          {!loading && entries.length === 0 && (
            <div className="text-sm text-muted-foreground p-4 border border-dashed rounded">
              No published workflows for this wallet yet. Build a flow and click <b>Publish on-chain</b>.
            </div>
          )}
          {entries.map((e) => (
            <div key={e.signature} className="border border-border rounded-lg p-3 bg-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{e.payload.name}</div>
                  <div className="text-xs text-muted-foreground">
                    cid {shortAddr(e.payload.cid, 6)} {e.payload.version ? `· v${e.payload.version}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {e.blockTime ? new Date(e.blockTime * 1000).toLocaleString() : ""}
                  </div>
                </div>
                <a
                  href={solscanUrl(e.signature)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="View on Solscan"
                  aria-label="View on Solscan"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <button
                onClick={() => loadOne(e)}
                disabled={loadingCid === e.payload.cid}
                className="mt-2 flex min-h-11 w-full items-center justify-center gap-1 rounded bg-primary py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {loadingCid === e.payload.cid ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                Load into canvas
              </button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default OnchainWorkflowsSheet;
