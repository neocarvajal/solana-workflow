import React, { useState, useRef, useCallback, useEffect } from "react";
import NodeSettingsModal from "./NodeSettingsModal";
import { Plus, Sparkles, Search, Zap, Wrench } from "lucide-react";
import DraggableNode from "./DraggableNode";
import type { FlowNode, ModuleDef } from "@/lib/workflow";
import { STEP_MODULES, ALL_MODULES } from "@/lib/workflow";
import {
  getFlowNodes, setFlowNodes, subscribeNodes,
  getCanvasScale, setCanvasScale, subscribeScale,
  subscribeRunningNode, subscribeAnimatingLine,
} from "@/lib/workflowStore";

const NODE_RADIUS = 48;

const DraggableCanvas: React.FC = () => {
  const [nodes, setNodes] = useState<FlowNode[]>(getFlowNodes());
  const [settingsNode, setSettingsNode] = useState<FlowNode | null>(null);

  const openSettings = (node: FlowNode) => {
    setSettingsNode(node);
  };

  const closeSettings = () => {
    setSettingsNode(null);
  };
  const [pickerOpen, setPickerOpen] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number>(0);
  const [search, setSearch] = useState("");
  const [runningNodeId, setRunningNodeId] = useState<string | null>(null);
  const [animatingLineIndex, setAnimatingLineIndex] = useState<number>(-1);

  /* Canvas pan & zoom */
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(getCanvasScale());
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  /* Sync with store */
  useEffect(() => {
    const unsubNodes = subscribeNodes((n) => setNodes([...n]));
    const unsubScale = subscribeScale((s) => setScale(s));
    const unsubRunning = subscribeRunningNode((id) => setRunningNodeId(id));
    const unsubAnimating = subscribeAnimatingLine((idx) => setAnimatingLineIndex(idx));
    return () => {
      unsubNodes();
      unsubScale();
      unsubRunning();
      unsubAnimating();
    };
  }, []);

  /* ── Pan handlers ──────────────────────────── */
  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const onCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning.current) {
      setOffset({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      });
    }
  };

  const onCanvasMouseUp = () => {
    isPanning.current = false;
  };

  /* ── Zoom handler ──────────────────────────── */
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setCanvasScale(getCanvasScale() + delta);
  }, []);

  /* ── Node drag ─────────────────────────────── */
  const onNodeDrag = useCallback(
    (id: string, x: number, y: number) => {
      const updated = getFlowNodes().map((n) =>
        n.id === id ? { ...n, x, y } : n
      );
      setFlowNodes(updated);
    },
    []
  );

  /* ── Node double-click → settings ────────────── */
  const onNodeDoubleClick = useCallback((node: FlowNode) => {
    openSettings(node);
  }, []);

  /* ── Delete node ───────────────────────────── */
  const onDeleteNode = useCallback((id: string) => {
    setFlowNodes(getFlowNodes().filter((n) => n.id !== id));
  }, []);

  /* ── Add node (from picker) ────────────────── */
  const openPicker = (index: number) => {
    setInsertIndex(index);
    setSearch("");
    setPickerOpen(true);
  };

  const addModule = (mod: ModuleDef) => {
    const current = getFlowNodes();
    let x = 200;
    let y = 300;
    if (current.length > 0) {
      if (insertIndex > 0 && insertIndex <= current.length) {
        const prev = current[insertIndex - 1];
        x = prev.x + 220;
        y = prev.y;
      } else if (current.length > 0) {
        const last = current[current.length - 1];
        x = last.x + 220;
        y = last.y;
      }
    }

    const newNode: FlowNode = {
      id: `n-${Date.now()}`,
      module: mod,
      params: { ...mod.defaultParams },
      x,
      y,
    };

    const next = [...current];
    next.splice(insertIndex, 0, newNode);

    for (let i = insertIndex + 1; i < next.length; i++) {
      if (next[i].x <= next[i - 1].x + 100) {
        next[i] = { ...next[i], x: next[i - 1].x + 220 };
      }
    }

    setFlowNodes(next);
    setPickerOpen(false);
  };

  const filtered = (nodes.length === 0 ? ALL_MODULES : STEP_MODULES).filter(
    (a) => a.name.toLowerCase().includes(search.toLowerCase())
  );

  /* ── SVG connections ───────────────────────── */
  const renderConnections = () => {
    if (nodes.length < 2) return null;
    return (
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 0 }}
      >
        {nodes.slice(0, -1).map((node, i) => {
          const next = nodes[i + 1];
          const x1 = node.x + NODE_RADIUS;
          const y1 = node.y;
          const x2 = next.x - NODE_RADIUS;
          const y2 = next.y;
          const isActive = animatingLineIndex === i;
          return (
            <React.Fragment key={`conn-frag-${node.id}-${next.id}`}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                className={`dotted-connection ${isActive ? "active-path" : ""}`}
              />
              {isActive && (
                <circle r="6" fill="#14F195" style={{ filter: "drop-shadow(0 0 6px #14F195)" }}>
                  <animate attributeName="cx" from={x1} to={x2} dur="1.2s" repeatCount="indefinite" />
                  <animate attributeName="cy" from={y1} to={y2} dur="1.2s" repeatCount="indefinite" />
                </circle>
              )}
            </React.Fragment>
          );
        })}
      </svg>
    );
  };

  /* ── "+" buttons between nodes ─────────────── */
  const renderAddButtons = () => {
    const btns: React.ReactNode[] = [];

    for (let i = 0; i < nodes.length - 1; i++) {
      const n1 = nodes[i];
      const n2 = nodes[i + 1];
      const mx = (n1.x + n2.x) / 2;
      const my = (n1.y + n2.y) / 2;
      btns.push(
        <button
          key={`add-${i}`}
          className="add-between-btn"
          style={{
            position: "absolute",
            left: mx - 14,
            top: my - 14,
            zIndex: 5,
          }}
          onClick={() => openPicker(i + 1)}
          title="Insert step"
        >
          <Plus className="h-4 w-4" />
        </button>
      );
    }

    if (nodes.length > 0) {
      const last = nodes[nodes.length - 1];
      btns.push(
        <button
          key="add-end"
          className="add-end-btn"
          style={{
            position: "absolute",
            left: last.x + NODE_RADIUS + 30,
            top: last.y - 14,
            zIndex: 5,
          }}
          onClick={() => openPicker(nodes.length)}
          title="Add step"
        >
          <Plus className="h-5 w-5" />
        </button>
      );
    }
    return btns;
  };

  return (
    <div className="flex-1 h-full overflow-hidden relative">
      <div
        ref={containerRef}
        className="w-full h-full grid-pattern cursor-grab active:cursor-grabbing"
        onMouseDown={onCanvasMouseDown}
        onMouseMove={onCanvasMouseMove}
        onMouseUp={onCanvasMouseUp}
        onMouseLeave={onCanvasMouseUp}
        onWheel={(e) => e.preventDefault()}
      >
        <div
          className="relative w-full h-full"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          {renderConnections()}
          {renderAddButtons()}

          {nodes.map((node, i) => (
            <DraggableNode
              key={node.id}
              node={node}
              isFirst={i === 0}
              index={i}
              scale={scale}
              isActive={runningNodeId === node.id}
              onDrag={onNodeDrag}
              onDoubleClick={onNodeDoubleClick}
              onSettings={openSettings}
            />
          ))}

          {nodes.length === 0 && (
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
          )}
        </div>
      </div>

      {settingsNode && (
        <NodeSettingsModal
          node={settingsNode}
          onSave={(updatedNode) => {
            const list = getFlowNodes().map((n) => (n.id === updatedNode.id ? updatedNode : n));
            setFlowNodes(list);
            closeSettings();
          }}
          onDelete={(id) => {
            onDeleteNode(id);
            closeSettings();
          }}
          onClose={closeSettings}
        />
      )}

      {pickerOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex overflow-hidden border border-border/60"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-48 bg-muted/30 p-3 border-r border-border/40 flex flex-col gap-1">
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium">
                <span className="grid place-items-center w-5 h-5">▦</span>
                All modules
              </button>
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors">
                <Sparkles className="h-4 w-4" /> AI modules
              </button>
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors">
                <Zap className="h-4 w-4" /> Triggers
              </button>
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors">
                <Wrench className="h-4 w-4" /> Actions
              </button>
            </div>
            <div className="flex-1 flex flex-col">
              <div className="p-3 border-b border-border/40">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search modules..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-muted/50 border border-border/40 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  />
                </div>
              </div>
              <div className="overflow-y-auto flex-1 p-2">
                <div className="text-xs font-semibold text-muted-foreground px-2 py-1.5 uppercase tracking-wide">
                  {nodes.length === 0 ? "All modules" : "Action modules"}
                </div>
                {filtered.map((mod) => {
                  const Icon = mod.icon;
                  return (
                    <button
                      key={mod.type}
                      onClick={() => addModule(mod)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left group"
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 shadow-md group-hover:shadow-lg transition-shadow"
                        style={{ backgroundColor: mod.color }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{mod.name}</div>
                        {mod.description && (
                          <div className="text-xs text-muted-foreground">{mod.description}</div>
                        )}
                      </div>
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

export default DraggableCanvas;
