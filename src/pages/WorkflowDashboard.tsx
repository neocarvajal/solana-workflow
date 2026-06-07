import React, { useState, useEffect } from "react";
import { getSavedWorkflows, deleteWorkflow, SavedWorkflow, setScenarioName, setFlowNodes } from "@/lib/workflowStore";
import { workflowToNodes } from "@/lib/workflow";
import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react"; // Importamos el hook oficial
import { Folder, Search, Trash2, Edit, Play, Calendar, Link as LinkIcon } from "lucide-react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";

const WorkflowDashboard: React.FC = () => {
  const [workflows, setWorkflows] = useState<SavedWorkflow[]>([]);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  // Obtenemos la clave pública y el estado de conexión de la wallet activa
  const { publicKey, connected } = useWallet();

  // Obtenemos la dirección en formato string si está conectado
  const walletAddress = connected && publicKey ? publicKey.toBase58() : null;

  // Reaccionamos automáticamente cada vez que cambie el estado o la dirección de la wallet
  useEffect(() => {
    if (walletAddress) {
      setWorkflows(getSavedWorkflows(walletAddress));
    } else {
      setWorkflows([]);
    }
  }, [walletAddress]);

  const handleEdit = (wf: SavedWorkflow) => {
    setScenarioName(wf.name);
    const nodes = workflowToNodes(wf.workflow);
    setFlowNodes(nodes);
    navigate("/dashboard");
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (walletAddress && confirm("Are you sure you want to delete this workflow?")) {
      deleteWorkflow(id);
      setWorkflows(getSavedWorkflows(walletAddress));
    }
  };

  const filtered = workflows.filter(
    (w) => w.name.toLowerCase().includes(search.toLowerCase()) || w.id.includes(search)
  );

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-8 relative">
          <div className="max-w-5xl mx-auto">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div>
                <h1 className="text-3xl font-bold gradient-text mb-2">My Workflows</h1>
                <p className="text-muted-foreground text-sm">
                  Manage, edit, and run your automated Solana flows.
                </p>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search workflows..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-muted/50 border border-border/40 rounded-lg text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>
            </div>

            {/* Content List */}
            {!walletAddress ? (
              <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border/40 rounded-2xl bg-muted/20">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Folder className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Please connect your Solana wallet to view and manage your saved workflows.
                </p>
                <p className="text-sm text-primary font-medium">Use the "Connect Wallet" button above.</p>
              </div>
            ) : workflows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border/40 rounded-2xl bg-muted/20">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Folder className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No workflows found</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  You haven't saved any workflows yet for wallet {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}. Create a new flow from the editor and save it to see it here.
                </p>
                <Link
                  to="/dashboard"
                  className="px-6 py-2.5 bg-gradient-purple-cyan text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                >
                  Create your first Workflow
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((wf) => (
                  <div
                    key={wf.id}
                    className="group bg-card border border-border/50 rounded-2xl p-5 hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5 cursor-pointer flex flex-col h-full"
                    onClick={() => handleEdit(wf)}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-lg bg-gradient-purple-cyan flex items-center justify-center text-white shrink-0">
                        <Folder className="h-5 w-5" />
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleDelete(wf.id, e)}
                          className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-lg font-bold mb-1 truncate">{wf.name}</h3>

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
                        className="text-xs font-medium text-primary flex items-center gap-1 hover:underline"
                        onClick={(e) => { e.stopPropagation(); handleEdit(wf); }}
                      >
                        Edit <Edit className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}

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
    </div>
  );
};

export default WorkflowDashboard;