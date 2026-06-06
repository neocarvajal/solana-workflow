import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';

import OnchainWorkflowsSheet from './OnchainWorkflowsSheet';
import SettingsDialog from './SettingsDialog';
import { getScenarioName, setScenarioName, subscribeWorkflow, setFlowNodes } from '@/lib/workflowStore';

const Header: React.FC = () => {
  const [name, setName] = useState(getScenarioName());
  const navigate = useNavigate();

  useEffect(() => {
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
    navigate("/");
  };

  return (
    <div className="h-16 bg-background border-b border-border flex items-center justify-between px-6 z-20">
      <div className="flex items-center gap-4">
        <input
          type="text"
          value={name}
          onChange={handleNameChange}
          placeholder="Scenario name..."
          className="text-lg font-semibold bg-transparent border-0 border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-1 py-0.5 rounded transition-colors w-48 md:w-64"
        />
        <button
          onClick={handleNew}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 text-foreground rounded-lg font-medium transition-colors border border-border/40"
          title="Create a new workflow"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New</span>
        </button>
      </div>
      
      <div className="flex items-center gap-3">
        <button 
          onClick={() => navigate("/")}
          className="ai-button text-xs px-3.5 py-1.5 flex items-center gap-1"
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
