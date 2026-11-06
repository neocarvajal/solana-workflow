import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/router";
import {
  ChevronDown,
  Database,
  LayoutDashboard,
  Plus,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import {
  getScenarioName,
  setFlowNodes,
  setScenarioName,
  setWorkflowId,
  subscribeWorkflow,
} from "@/lib/workflowStore";

const MobileWorkflowMenu: React.FC = () => {
  const router = useRouter();
  const [name, setName] = useState(getScenarioName());
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return subscribeWorkflow((wf) => {
      if (wf) setName(wf.name);
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const updateName = (value: string) => {
    setName(value);
    setScenarioName(value);
  };

  const handleNew = () => {
    setOpen(false);
    setWorkflowId(null);
    setFlowNodes([]);
    setScenarioName("New Scenario");
    setName("New Scenario");
    router.push("/dashboard");
  };

  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  const openDialog = (eventName: "open-settings" | "open-onchain") => {
    setOpen(false);
    window.setTimeout(() => window.dispatchEvent(new Event(eventName)), 60);
  };

  const actionClass =
    "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-10 min-w-0 flex-1 items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
        aria-label={`Workflow: ${name || "nuevo"}. Abrir acciones`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={name || "Nuevo workflow"}
      >
        <span className="min-w-0 flex-1 truncate">
          {name || "Nuevo workflow"}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Acciones del workflow"
          >
            <button
              type="button"
              className="absolute inset-0 bg-background/70 backdrop-blur-sm"
              aria-label="Cerrar acciones del workflow"
              onClick={() => setOpen(false)}
            />
            <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-border/60 bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">
                  Workflow
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <label
                htmlFor="mobile-workflow-name"
                className="mt-4 block text-xs font-medium text-muted-foreground"
              >
                Nombre del workflow
              </label>
              <input
                id="mobile-workflow-name"
                type="text"
                value={name}
                onChange={(event) => updateName(event.target.value)}
                placeholder="Mi workflow"
                className="mt-1.5 w-full rounded-xl border border-border/60 bg-background/80 px-3 py-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />

              <div className="mt-3 grid gap-0.5">
                <button type="button" onClick={handleNew} className={actionClass}>
                  <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>Nuevo workflow</span>
                </button>
                <button
                  type="button"
                  onClick={() => go("/dashboard")}
                  className={actionClass}
                >
                  <LayoutDashboard className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>Dashboard</span>
                </button>
                <button
                  type="button"
                  onClick={() => go("/")}
                  className={actionClass}
                >
                  <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>AI Builder</span>
                </button>
                <button
                  type="button"
                  onClick={() => openDialog("open-settings")}
                  className={actionClass}
                >
                  <Settings className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>Ajustes</span>
                </button>
                <button
                  type="button"
                  onClick={() => openDialog("open-onchain")}
                  className={actionClass}
                >
                  <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>On-chain workflows</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default MobileWorkflowMenu;
