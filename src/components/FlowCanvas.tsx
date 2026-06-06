import React, { useState } from 'react';
import { Plus, Search, Sparkles, Webhook, Globe, Database, Braces, Wrench, Settings, Table, Zap } from 'lucide-react';

interface AppOption {
  name: string;
  description?: string;
  color: string;
  icon: React.ElementType;
}

const APPS: AppOption[] = [
  { name: 'Webhooks', description: 'Custom mailhook', color: '#D85A6A', icon: Webhook },
  { name: 'HTTP', color: '#2196F3', icon: Globe },
  { name: 'Airtable', color: '#18BFFF', icon: Database },
  { name: 'OpenAI (ChatGPT, Sora, Whisper)', color: '#10A37F', icon: Sparkles },
  { name: 'JSON', color: '#8673FF', icon: Braces },
  { name: 'Google Sheets', color: '#0F9D58', icon: Table },
  { name: 'Tools', color: '#9C89F7', icon: Wrench },
  { name: 'Flow Control', color: '#8BC34A', icon: Settings },
];

interface FlowNode {
  id: string;
  app: AppOption;
}

const NODE_SPACING = 180;
const START_X = 120;
const CENTER_Y_OFFSET = 80;

const FlowCanvas: React.FC = () => {
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [aiMode, setAiMode] = useState(false);

  const openPicker = (index: number, ai = false) => {
    setInsertIndex(index);
    setAiMode(ai);
    setSearch('');
    setPickerOpen(true);
  };

  const addApp = (app: AppOption) => {
    if (insertIndex === null) return;
    const id = `node-${Date.now()}`;
    const next = [...nodes];
    next.splice(insertIndex, 0, { id, app });
    setNodes(next);
    setPickerOpen(false);
    setInsertIndex(null);
  };

  const filtered = APPS.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 h-full overflow-auto grid-pattern relative">
      {nodes.length === 0 ? (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          <button
            onClick={() => openPicker(0)}
            className="w-28 h-28 rounded-full bg-muted/60 border-2 border-dashed border-muted-foreground/40 flex items-center justify-center hover:border-primary hover:bg-muted transition-all animate-glow"
          >
            <Plus className="h-10 w-10 text-muted-foreground" />
          </button>
          <div className="mt-4 text-center text-muted-foreground text-sm">
            Click to add your first module
          </div>
        </div>
      ) : (
        <div
          className="relative"
          style={{
            minWidth: START_X * 2 + nodes.length * NODE_SPACING,
            minHeight: '100%',
            paddingTop: CENTER_Y_OFFSET,
          }}
        >
          <div className="flex items-center" style={{ paddingLeft: START_X, marginTop: 120 }}>
            {nodes.map((node, i) => {
              const Icon = node.app.icon;
              return (
                <React.Fragment key={node.id}>
                  <NodeBubble node={node} isFirst={i === 0} />
                  <Connector onAdd={() => openPicker(i + 1)} onAddAi={() => openPicker(i + 1, true)} />
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {pickerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex overflow-hidden border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-48 bg-muted/40 p-3 border-r flex flex-col gap-1">
              <button className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/10 text-primary text-sm font-medium">
                <span className="grid place-items-center w-5 h-5">▦</span>
                All apps
              </button>
              <button className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-muted">
                <Sparkles className="h-4 w-4" /> AI modules
              </button>
              <button className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-muted">
                <Zap className="h-4 w-4" /> Most popular
              </button>
              <button className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-muted">
                <Wrench className="h-4 w-4" /> Built-in tools
              </button>
            </div>
            <div className="flex-1 flex flex-col">
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={aiMode ? 'Search AI modules' : 'Search all apps or modules'}
                    className="w-full pl-9 pr-3 py-2 rounded-md bg-muted/50 border focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>
              </div>
              <div className="overflow-y-auto flex-1 p-2">
                <div className="text-xs font-medium text-muted-foreground px-2 py-1">
                  {aiMode ? 'AI apps' : 'All apps'}
                </div>
                {filtered.map((app) => {
                  const Icon = app.icon;
                  return (
                    <button
                      key={app.name}
                      onClick={() => addApp(app)}
                      className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors text-left"
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: app.color }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-sm">{app.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NodeBubble: React.FC<{ node: FlowNode; isFirst: boolean }> = ({ node, isFirst }) => {
  const Icon = node.app.icon;
  return (
    <div className="relative flex flex-col items-center shrink-0" style={{ width: 120 }}>
      <div className="relative">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center text-white shadow-lg"
          style={{ backgroundColor: node.app.color }}
        >
          <Icon className="h-10 w-10" />
        </div>
        {isFirst && (
          <div className="absolute -bottom-1 -left-1 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center">
            <Zap className="h-4 w-4 text-yellow-500 fill-yellow-500" />
          </div>
        )}
      </div>
      <div className="mt-3 text-center">
        <div className="text-sm font-semibold">{node.app.name}</div>
        {node.app.description && (
          <div className="text-xs text-muted-foreground">{node.app.description}</div>
        )}
      </div>
    </div>
  );
};

const Connector: React.FC<{ onAdd: () => void; onAddAi: () => void }> = ({ onAdd, onAddAi }) => {
  const [hover, setHover] = useState(false);
  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ width: 60, height: 96 }}
    >
      <div className="w-full border-t-2 border-dashed border-muted-foreground/40" />
      <button
        onClick={onAdd}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground border-2 border-background shadow flex items-center justify-center transition-colors"
        title="Add module"
      >
        <Plus className="h-5 w-5" />
      </button>
      {hover && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 flex flex-col gap-2 bg-card border rounded-lg shadow-xl p-2 z-10 w-44">
          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm whitespace-nowrap"
          >
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
              <Plus className="h-4 w-4" />
            </div>
            Add module
          </button>
          <button
            onClick={onAddAi}
            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm whitespace-nowrap"
          >
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </div>
            Add AI module
          </button>
        </div>
      )}
    </div>
  );
};

export default FlowCanvas;
