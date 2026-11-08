import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Plus, LayoutDashboard } from 'lucide-react';
import OnchainWorkflowsSheet from './OnchainWorkflowsSheet';
import SettingsDialog from './SettingsDialog';
import VaultPanel from './VaultPanel';
import { getScenarioName, setScenarioName, subscribeWorkflow, setFlowNodes, setWorkflowId } from '@/lib/workflowStore';

const Header: React.FC = () => {
  const [name, setName] = useState(getScenarioName());
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    return subscribeWorkflow((wf) => {
      if (wf) {
        setName(wf.name);
      }
    });
  }, []);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    setScenarioName(val);
  };

  const handleNew = () => {
    setWorkflowId(null);
    setFlowNodes([]);
    setScenarioName("New Scenario");
    router.push("/dashboard");
  };

  return (
    <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 px-1 z-20 sm:flex-nowrap sm:gap-3 md:gap-6">
      <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto md:gap-4">
        <input
          type="text"
          value={name}
          onChange={handleNameChange}
          placeholder="Scenario name..."
          className="text-base sm:text-lg font-semibold bg-transparent border-0 border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-1 py-1 rounded transition-colors w-full min-w-0 sm:w-48 md:w-64"
        />
      </div>

      <div className="flex w-full min-w-0 items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 sm:w-auto sm:gap-2 md:gap-3">
        <button
          onClick={handleNew}
          className="flex min-h-10 shrink-0 items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 text-foreground rounded-lg font-medium transition-colors border border-border/40 whitespace-nowrap"
          title="Create a new workflow"
          aria-label="Create a new workflow"
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">New</span>
        </button>

        <button
          onClick={() => router.push("/dashboard")}
          className="min-h-10 shrink-0 px-2.5 sm:px-3 py-2 rounded-full text-xs md:text-sm border border-border hover:bg-muted flex items-center gap-2 transition-colors whitespace-nowrap"
          title="Go to Dashboard"
          aria-label="Go to Dashboard"
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Dashboard</span>
        </button>

        <button
          onClick={() => router.push("/")}
          className="ai-button min-h-10 shrink-0 text-xs px-3.5 py-1.5 flex items-center gap-1 whitespace-nowrap"
        >
          <span>AI Builder</span>
        </button>

        <SettingsDialog />
        <VaultPanel />
        <OnchainWorkflowsSheet />
      </div>
    </div>
  );
};

export default Header;
