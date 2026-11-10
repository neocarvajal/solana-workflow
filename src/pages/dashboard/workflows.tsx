import React, { useState, useEffect } from "react";
import { getSavedWorkflows, deleteWorkflow, SavedWorkflow, setScenarioName, setFlowNodes } from "@/lib/workflowStore";
import { workflowToNodes } from "@/lib/workflow";
import Link from "next/link";
import { useRouter } from 'next/router';
import { useWallet } from "@solana/wallet-adapter-react";
import { Folder, Search, Trash2, Edit, Play, Calendar, Link as LinkIcon, ShieldCheck } from "lucide-react";
import { executionModeLabel } from "@/lib/schedule";
import Sidebar from "@/components/Sidebar";
import DeleteWorkflowModal from '@/components/DeleteConfirmationDialog';
import { Switch } from "@/components/ui/switch";
import {
  backfillSavedWorkflows,
  fetchAutomationRows,
  findAutomation,
  indexAutomation,
  setAutomationActive,
  updateAutomationIndex,
  type AutomationIndex,
  type WorkflowAutomationRow,
} from "@/lib/automation";
import { toast } from 'sonner';

function readSavedWorkflows(walletAddress: string): SavedWorkflow[] {
  const workflowsData = getSavedWorkflows(walletAddress);

  const uniqueWorkflows = workflowsData.reduce((acc: SavedWorkflow[], current) => {
    const existing = acc.find(item => item.id === current.id);

    if (!existing) {
      return acc.concat([current]);
    } else {
      if (current.cid && !existing.cid) {
        return acc.map(item => item.id === current.id ? current : item);
      }
      return acc;
    }
  }, []);

  return [...uniqueWorkflows].sort((a, b) => b.created - a.created);
}

const WorkflowDashboard: React.FC = () => {
  const [workflows, setWorkflows] = useState<SavedWorkflow[]>([]);
  const [search, setSearch] = useState("");
  const [automation, setAutomation] = useState<AutomationIndex>({});
  const [toggling, setToggling] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const router = useRouter();
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<{ id: string; name: string; pinata_file_id?: string; cid?: string } | null>(null);
  
  const { publicKey, connected } = useWallet();
  const walletAddress = connected && publicKey ? publicKey.toBase58() : null;

  useEffect(() => {
    if (walletAddress) {
      setWorkflows(readSavedWorkflows(walletAddress));
    } else {
      setWorkflows([]);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (!walletAddress) {
      setAutomation({});
      setRestoring(false);
      return;
    }

    let cancelled = false;
    setRestoring(true);
    const loadAutomation = async () => {
      try {
        const rows = await fetchAutomationRows(walletAddress, { includeUnpublished: true });
        if (cancelled) return;

        setAutomation(indexAutomation(rows));

        // Recover workflows published by earlier versions but missing from
        // localStorage, so they show up and can be loaded/toggled again.
        const restored = backfillSavedWorkflows(rows, walletAddress);
        if (!cancelled && restored.length > 0) {
          setWorkflows(readSavedWorkflows(walletAddress));
        }
      } catch (error) {
        console.error("Could not load workflow automation status", error);
      } finally {
        if (!cancelled) setRestoring(false);
      }
    };

    void loadAutomation();
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  const automationFor = (wf: SavedWorkflow): WorkflowAutomationRow | null => {
    const workflowId = wf.workflowId || wf.workflow?.workflowId;
    const cid = wf.cid || (wf.workflow as { cid?: string } | undefined)?.cid;
    return findAutomation(automation, workflowId, cid);
  };

  const handleToggleWorkflow = async (
    wf: SavedWorkflow,
    row: WorkflowAutomationRow,
    nextActive: boolean,
  ) => {
    if (!walletAddress || toggling) return;

    setToggling(row.id);
    try {
      const updated = await setAutomationActive({
        row,
        ownerWallet: walletAddress,
        nextActive,
        schedule: wf.workflow?.schedule || row.schedule,
      });
      setAutomation((previous) => updateAutomationIndex(previous, updated));

      toast.success(nextActive ? `"${wf.name}" activado` : `"${wf.name}" desactivado`, {
        description: nextActive
          ? "El cron volverá a ejecutarlo según su frecuencia."
          : "El cron dejará de ejecutarlo hasta que lo actives de nuevo.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cambiar el estado del workflow");
    } finally {
      setToggling(null);
    }
  };

  const handleEdit = (wf: SavedWorkflow) => {
    setScenarioName(wf.name);
    const nodes = workflowToNodes(wf.workflow);
    setFlowNodes(nodes);
    router.push({
      pathname: "/dashboard",
      query: { id: wf.id }
    });
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!walletAddress) {
      toast.error("Please connect your wallet");
      return;
    }

    const targetWf = workflows.find((w) => w.id === id);
    
    if (targetWf) {
      setWorkflowToDelete({
        id: targetWf.id,
        name: targetWf.name,
        pinata_file_id: (targetWf as any).pinata_file_id || (targetWf.workflow as any)?.pinata_file_id,
        cid: targetWf.cid || (targetWf.workflow as any)?.cid
      });
      
      setIsDeleteModalOpen(true);
    }
  };

  const handleConfirmDelete = async () => {
    if (!workflowToDelete || !walletAddress) return;

    const { id, pinata_file_id, cid } = workflowToDelete as any;

    setIsDeleteModalOpen(false);
    setWorkflowToDelete(null);

    // We trigger a promise toast to handle loading, success, and error states elegantly
    toast.promise(
      deleteWorkflow(id, pinata_file_id, cid),
      {
        loading: 'Deleting workflow from IPFS network...',
        success: () => {
          // Sync state and UI only after successful execution
          setWorkflows(readSavedWorkflows(walletAddress));
          
          return 'Workflow deleted successfully';
        },
        error: (err) => {
          console.error("Error deleting workflow:", err);
          return 'Failed to delete workflow from IPFS network';
        }
      }
    );
  };

  const filtered = workflows.filter(
    (w) => w.name.toLowerCase().includes(search.toLowerCase()) || w.id.includes(search)
  );

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <main className="relative flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6 md:p-8">
          <div className="mx-auto max-w-5xl">
            
            <div className="mb-6 flex flex-col justify-between gap-3 sm:mb-8 md:flex-row md:items-end">
              <div>
                <h1 className="mb-2 text-2xl font-bold gradient-text sm:text-3xl">My Workflows</h1>
                <p className="text-sm text-muted-foreground">
                  Manage, edit, and run your automated Solana Workflows.
                </p>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search workflows..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-border/40 bg-muted/50 py-2.5 pl-9 pr-4 text-base transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 sm:text-sm md:w-64"
                />
              </div>
            </div>

            {!walletAddress ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/40 bg-muted/20 px-4 py-12 text-center sm:py-24">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Folder className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-semibold sm:text-xl">Connect Your Wallet</h3>
                <p className="mb-6 max-w-md text-sm text-muted-foreground">
                  Please connect your Solana wallet to view and manage your saved workflows.
                </p>
                <p className="text-sm font-medium text-primary">Use the "Connect Wallet" button above.</p>
              </div>
            ) : restoring && workflows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/40 bg-muted/20 px-4 py-16 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                <p className="text-sm text-muted-foreground">
                  Restaurando workflows publicados desde tu historial…
                </p>
              </div>
            ) : workflows.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/40 bg-muted/20 px-4 py-12 text-center sm:py-24">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Folder className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-semibold sm:text-xl">No workflows found</h3>
                <p className="mb-6 max-w-md text-sm text-muted-foreground">
                  You haven't saved any workflows yet for wallet {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}. Create a new flow from the editor and save it to see it here.
                </p>
                <Link
                  href="/dashboard"
                  className="flex min-h-11 items-center justify-center rounded-lg bg-gradient-purple-cyan px-5 py-3 font-medium text-white transition-opacity hover:opacity-90"
                >
                  Create your first Workflow
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
                {filtered.map((wf) => {
                  const row = automationFor(wf);
                  const schedule = wf.workflow?.schedule || row?.schedule || "manual";
                  const isActive = Boolean(row?.enabled && row?.automation_status === "active");

                  return (
                  <div
                    key={wf.id}
                    className="group flex h-full cursor-pointer flex-col rounded-2xl border border-border/50 bg-card p-4 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 sm:p-5"
                    onClick={() => handleEdit(wf)}
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-purple-cyan text-white">
                        <Folder className="h-5 w-5" />
                      </div>
                      <div className="flex items-center gap-2">
                        {row && (
                          <div
                            className="flex items-center gap-1.5"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Switch
                              checked={isActive}
                              onCheckedChange={(checked) => void handleToggleWorkflow(wf, row, checked)}
                              disabled={toggling === row.id || (schedule === "manual" && !isActive)}
                              title={
                                schedule === "manual"
                                  ? "Workflow manual: cambia la frecuencia para activarlo"
                                  : isActive
                                    ? "Desactivar workflow"
                                    : "Activar workflow"
                              }
                              aria-label={isActive ? `Desactivar ${wf.name}` : `Activar ${wf.name}`}
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                          <button
                            onClick={(e) => handleDelete(wf.id, e)}
                            className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-400/10 hover:text-red-400"
                            title="Delete"
                            aria-label={`Eliminar ${wf.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <h3 className="text-lg font-bold mb-1 truncate">{wf.name}</h3>

                    <div className="mb-3 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                        <ShieldCheck className="h-3 w-3" />
                        {executionModeLabel(wf.workflow?.executionMode || wf.executionMode)}
                      </span>
                      <span className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                        {wf.workflow?.schedule === "manual" ? "Manual" : wf.workflow?.schedule || "15m"}
                      </span>
                      {row && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${
                            isActive
                              ? "bg-emerald-400/10 text-emerald-400"
                              : "bg-amber-400/10 text-amber-300"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isActive ? "bg-emerald-400" : "bg-amber-300"
                            }`}
                          />
                          {isActive ? "Activo" : "Inactivo"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-6">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(wf.created).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <Play className="h-3.5 w-3.5" />
                        {wf.workflow?.steps?.length ?? 0} Steps
                      </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-border/30 flex items-center justify-between">
                      {wf.cid ? (
                        <a
                          href={`https://ipfs.io/ipfs/${wf.cid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-400/10 px-2 py-1 rounded-md"
                          title="View on IPFS"
                        >
                          <LinkIcon className="h-3 w-3" />
                          IPFS Pinned
                        </a>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
                          Local only
                        </span>
                      )}

                      <button
                        className="flex min-h-10 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary hover:bg-primary/10 hover:underline"
                        onClick={(e) => { e.stopPropagation(); handleEdit(wf); }}
                      >
                        Edit <Edit className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  );
                })}

                {filtered.length === 0 && (
                  <div className="col-span-full py-12 text-center text-muted-foreground">
                    No workflows match your search.
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      <DeleteWorkflowModal 
        isOpen={isDeleteModalOpen}
        onClose={setIsDeleteModalOpen}
        onConfirm={handleConfirmDelete}
        workflowName={workflowToDelete?.name || ""}
      />
    </div>
  );
};

export default WorkflowDashboard;