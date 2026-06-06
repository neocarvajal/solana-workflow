import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Database, ExternalLink, Loader2, Download, RefreshCw } from "lucide-react";
import { getPhantom, listOnchainWorkflows, solscanUrl, shortAddr, type OnchainEntry } from "@/lib/solana";
import { supabase } from "@/integrations/supabase/client";
import { setWorkflow, setOnchainMeta } from "@/lib/workflowStore";
import type { Workflow } from "@/lib/workflow";
import { toast } from "sonner";

const OnchainWorkflowsSheet: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<OnchainEntry[]>([]);
  const [loadingCid, setLoadingCid] = useState<string | null>(null);

  const load = async () => {
    const p = getPhantom();
    if (!p?.publicKey) {
      toast.error("Connect your wallet first");
      return;
    }
    setLoading(true);
    try {
      const list = await listOnchainWorkflows(p.publicKey);
      setEntries(list);
    } catch (e: any) {
      toast.error(e?.message || "Failed to fetch from chain");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open]);

  const loadOne = async (e: OnchainEntry) => {
    setLoadingCid(e.payload.cid);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-ipfs", {
        body: { cid: e.payload.cid },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const wf = data.json as Workflow;
      setWorkflow(wf);
      setOnchainMeta({ cid: e.payload.cid, signature: e.signature, version: e.payload.version });
      toast.success(`Loaded "${wf.name}" from IPFS`);
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Could not fetch from IPFS");
    } finally {
      setLoadingCid(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="px-3 py-2 rounded-full text-sm border border-border hover:bg-muted flex items-center gap-2">
          <Database className="h-4 w-4" />
          On-chain
        </button>
      </SheetTrigger>
      <SheetContent className="w-[420px] sm:max-w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>My on-chain workflows</span>
            <button onClick={load} className="p-1 hover:bg-muted rounded" title="Refresh">
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
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  title="View on Solscan"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <button
                onClick={() => loadOne(e)}
                disabled={loadingCid === e.payload.cid}
                className="mt-2 w-full text-xs flex items-center justify-center gap-1 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
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
