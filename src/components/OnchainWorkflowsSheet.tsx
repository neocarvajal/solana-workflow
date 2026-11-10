import { useCallback, useEffect, useState } from "react";
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
import {
  fetchAutomationRows,
  findAutomation,
  indexAutomation,
  mergeOnchainEntries,
  setAutomationActive,
  updateAutomationIndex,
  type AutomationIndex,
} from "@/lib/automation";
import { Switch } from "@/components/ui/switch";
import { workflowToNodes, type Workflow } from "@/lib/workflow";
import { toast } from "sonner";

interface OnchainWorkflowsSheetProps {
  hideTrigger?: boolean;
}

const OnchainWorkflowsSheet: React.FC<OnchainWorkflowsSheetProps> = ({ hideTrigger = false }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<OnchainEntry[]>([]);
  const [loadingCid, setLoadingCid] = useState<string | null>(null);
  const [automation, setAutomation] = useState<AutomationIndex>({});
  const [toggling, setToggling] = useState<string | null>(null);
  const [chainWarning, setChainWarning] = useState(false);
  const { publicKey } = useWallet();
  const router = useRouter();

  const load = useCallback(async () => {
    if (!publicKey) {
      toast.error("Connect your wallet first");
      return;
    }

    setLoading(true);
    setChainWarning(false);
    try {
      const owner = publicKey.toBase58();
      const [chainResult, rowsResult] = await Promise.allSettled([
        listOnchainWorkflows(publicKey),
        fetchAutomationRows(owner),
      ]);

      const rows = rowsResult.status === "fulfilled" ? rowsResult.value : [];
      if (rowsResult.status === "rejected") {
        console.error("Could not load workflow automation status", rowsResult.reason);
      }

      let chainEntries: OnchainEntry[] = [];
      if (chainResult.status === "fulfilled") {
        chainEntries = chainResult.value;
      } else {
        console.warn("Could not read on-chain history, using saved rows", chainResult.reason);
        setChainWarning(rows.length > 0);
      }

      setEntries(mergeOnchainEntries(chainEntries, rows));
      setAutomation(indexAutomation(rows));

      if (
        chainResult.status === "rejected" &&
        chainEntries.length === 0 &&
        rows.length === 0
      ) {
        toast.error("No se pudo leer la cadena ni el historial guardado. Intenta de nuevo.");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to fetch from chain");
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    const openSheet = () => setOpen(true);
    window.addEventListener("open-onchain", openSheet);
    return () => window.removeEventListener("open-onchain", openSheet);
  }, []);

  const toggleEntry = async (
    entry: OnchainEntry,
    nextActive: boolean,
  ) => {
    if (!publicKey || toggling) return;

    const owner = publicKey.toBase58();
    const row = findAutomation(automation, null, entry.payload.cid);
    if (!row) return;

    setToggling(row.id);
    try {
      const updated = await setAutomationActive({
        row,
        ownerWallet: owner,
        nextActive,
        schedule: row.schedule,
      });
      setAutomation((previous) => updateAutomationIndex(previous, updated));
      toast.success(
        nextActive
          ? `"${entry.payload.name}" activado`
          : `"${entry.payload.name}" desactivado`,
        {
          description: nextActive
            ? "El cron volverá a ejecutarlo según su frecuencia."
            : "El cron dejará de ejecutarlo hasta que lo actives de nuevo.",
        },
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo cambiar el estado del workflow",
      );
    } finally {
      setToggling(null);
    }
  };

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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not fetch from IPFS");
    } finally {
      setLoadingCid(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <SheetTrigger asChild>
          <button className="flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-border px-2.5 py-2 text-xs hover:bg-muted sm:px-3 sm:text-sm">
            <Database className="h-4 w-4" />
            On-chain
          </button>
        </SheetTrigger>
      )}
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
          {!loading && chainWarning && entries.length > 0 && (
            <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200">
              El RPC público no respondió ahora mismo; mostrando el historial guardado. Pulsa
              actualizar para reintentar la lectura on-chain.
            </p>
          )}
          {!loading && entries.length === 0 && (
            <div className="text-sm text-muted-foreground p-4 border border-dashed rounded">
              No published workflows for this wallet yet. Build a flow and click <b>Publish on-chain</b>.
            </div>
          )}
          {entries.map((e) => {
            const row = findAutomation(automation, null, e.payload.cid);
            const isActive = Boolean(
              row?.enabled && row?.automation_status === "active",
            );

            return (
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

              {row && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-1.5">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                      isActive ? "text-emerald-400" : "text-amber-300"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isActive ? "bg-emerald-400" : "bg-amber-300"
                      }`}
                    />
                    {isActive ? "Activo · cron" : "Inactivo · cron"}
                  </span>
                  <Switch
                    checked={isActive}
                    onCheckedChange={(checked) => void toggleEntry(e, checked)}
                    disabled={
                      toggling === row.id ||
                      (row.schedule === "manual" && !isActive)
                    }
                    title={
                      row.schedule === "manual"
                        ? "Workflow manual: cambia la frecuencia para activarlo"
                        : isActive
                          ? "Desactivar workflow"
                          : "Activar workflow"
                    }
                    aria-label={
                      isActive
                        ? `Desactivar ${e.payload.name}`
                        : `Activar ${e.payload.name}`
                    }
                  />
                </div>
              )}

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
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default OnchainWorkflowsSheet;
