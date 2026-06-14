import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Plus, LayoutDashboard } from 'lucide-react';
import OnchainWorkflowsSheet from './OnchainWorkflowsSheet';
import SettingsDialog from './SettingsDialog';
import { getScenarioName, setScenarioName, subscribeWorkflow, setFlowNodes } from '@/lib/workflowStore';

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
    setFlowNodes([]);
    setScenarioName("New Scenario");
    router.push("/dashboard");
  };

  return (
    <div className="flex items-center justify-between w-full gap-6 px-1 z-20 min-w-max md:min-w-0">
      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        <input
          type="text"
          value={name}
          onChange={handleNameChange}
          placeholder="Scenario name..."
          className="text-base md:text-lg font-semibold bg-transparent border-0 border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-1 py-0.5 rounded transition-colors w-32 sm:w-48 md:w-64"
        />
      </div>

      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <button
          onClick={handleNew}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 text-foreground rounded-lg font-medium transition-colors border border-border/40 whitespace-nowrap"
          title="Create a new workflow"
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">New</span>
        </button>
        
        <button
          onClick={() => router.push("/dashboard")}
          className="px-3 py-2 rounded-full text-xs md:text-sm border border-border hover:bg-muted flex items-center gap-2 transition-colors whitespace-nowrap"
          title="Go to Dashboard"
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Dashboard</span>
        </button>
        
        <button
          onClick={() => router.push("/")}
          className="ai-button text-xs px-3.5 py-1.5 flex items-center gap-1 whitespace-nowrap"
        >
          <span>AI Builder</span>
        </button>
        <SettingsDialog />
        <OnchainWorkflowsSheet />
      </div>
    </div>
  );
};

export default Header;
