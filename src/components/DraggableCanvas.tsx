import React, { useState, useRef, useCallback, useEffect } from "react";
import NodeSettingsModal from "./NodeSettingsModal";
import { Plus, Sparkles, Search, Zap, Wrench, X } from "lucide-react";
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

  /* Canvas pan, wheel zoom & pinch zoom */
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(getCanvasScale());
  const containerRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const panStart = useRef({ x: 0, y: 0 });
  const pinchStart = useRef<{
    distance: number;
    scale: number;
    offset: { x: number; y: number };
    center: { x: number; y: number };
  } | null>(null);
  const offsetRef = useRef(offset);
  const scaleRef = useRef(scale);

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

  useEffect(() => { offsetRef.current = offset; }, [offset]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);

  const clampScale = (value: number) => Math.min(2, Math.max(0.3, value));

  const applyOffset = useCallback((next: { x: number; y: number }) => {
    offsetRef.current = next;
    setOffset(next);
  }, []);

  /* Zoom keeps the point under the finger/cursor fixed. */
  const zoomAtPoint = useCallback(
    (
      clientX: number,
      clientY: number,
      nextScaleRaw: number,
      baseScale: number,
      baseOffset: { x: number; y: number }
    ) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || baseScale <= 0) return;

      const nextScale = clampScale(nextScaleRaw);
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;
      const ratio = nextScale / baseScale;

      applyOffset({
        x: cx - (cx - baseOffset.x) * ratio,
        y: cy - (cy - baseOffset.y) * ratio,
      });
      setCanvasScale(nextScale);
    },
    [applyOffset]
  );

  /* Wheel needs a non-passive native listener to prevent page scroll. */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const baseScale = scaleRef.current;
      const factor = event.deltaY > 0 ? 0.9 : 1.1;
      zoomAtPoint(
        event.clientX,
        event.clientY,
        baseScale * factor,
        baseScale,
        offsetRef.current
      );
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [zoomAtPoint]);

  const onCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target.closest("[data-node]") || target.closest("button") || target.closest("input")) {
      return;
    }

    const el = event.currentTarget;
    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 1) {
      pinchStart.current = null;
      panStart.current = {
        x: event.clientX - offsetRef.current.x,
        y: event.clientY - offsetRef.current.y,
      };
    } else if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinchStart.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        scale: scaleRef.current,
        offset: { ...offsetRef.current },
        center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
    }
  };

  const onCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size >= 2 && pinchStart.current) {
      const [a, b] = Array.from(pointers.current.values());
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const pinch = pinchStart.current;

      if (pinch.distance > 0) {
        zoomAtPoint(
          pinch.center.x,
          pinch.center.y,
          pinch.scale * (distance / pinch.distance),
          pinch.scale,
          pinch.offset
        );
      }
      return;
    }

    if (pointers.current.size === 1) {
      applyOffset({
        x: event.clientX - panStart.current.x,
        y: event.clientY - panStart.current.y,
      });
    }
  };

  const endCanvasPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      /* ignore */
    }

    if (pointers.current.size < 2) pinchStart.current = null;

    if (pointers.current.size === 1) {
      const [remaining] = Array.from(pointers.current.values());
      panStart.current = {
        x: remaining.x - offsetRef.current.x,
        y: remaining.y - offsetRef.current.y,
      };
    }
  };

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

    const newNodeParams = { ...mod.defaultParams };
    if (mod.type === "send_transaction") {
      const { getSettings } = require("@/lib/workflowStore");
      const settings = getSettings();
      if (settings?.recipientWallet) {
        newNodeParams.to = settings.recipientWallet;
      }
    }

    const newNode: FlowNode = {
      id: `n-${Date.now()}`,
      module: mod,
      params: newNodeParams,
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
        style={{ zIndex: 0, overflow: "visible" }}
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
          type="button"
          className="add-between-btn"
          style={{
            position: "absolute",
            left: mx - 20,
            top: my - 20,
            zIndex: 5,
          }}
          onClick={() => openPicker(i + 1)}
          title="Insert step"
          aria-label="Insert step"
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
          type="button"
          className="add-end-btn"
          style={{
            position: "absolute",
            left: last.x + NODE_RADIUS + 10,
            top: last.y - 20,
            zIndex: 5,
          }}
          onClick={() => openPicker(nodes.length)}
          title="Add step"
          aria-label="Add step"
        >
          <Plus className="h-5 w-5" />
        </button>
      );
    }
    return btns;
  };

  return (
    <div className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden">
      <div
        ref={containerRef}
        className="w-full h-full grid-pattern cursor-grab active:cursor-grabbing touch-none select-none"
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={endCanvasPointer}
        onPointerCancel={endCanvasPointer}
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
                type="button"
                onClick={() => openPicker(0)}
                className="w-28 h-28 rounded-full bg-muted/60 border-2 border-dashed border-muted-foreground/40 flex items-center justify-center hover:border-primary hover:bg-muted transition-all animate-glow"
                aria-label="Añadir el primer módulo"
              >
                <Plus className="h-10 w-10 text-muted-foreground" />
              </button>
              <div className="mt-4 px-6 text-center text-muted-foreground text-sm">
                Toca para añadir tu primer módulo
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl sm:max-h-[80vh] sm:flex-row"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Añadir módulo"
          >
            <div className="hidden w-40 shrink-0 flex-col gap-1 border-r border-border/40 bg-muted/30 p-3 sm:flex md:w-48">
              <button className="flex min-h-10 items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                <span className="grid place-items-center w-5 h-5">▦</span>
                All modules
              </button>
              <button className="flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors">
                <Sparkles className="h-4 w-4" /> AI modules
              </button>
              <button className="flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors">
                <Zap className="h-4 w-4" /> Triggers
              </button>
              <button className="flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors">
                <Wrench className="h-4 w-4" /> Actions
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-2 border-b border-border/40 p-3">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar módulos..."
                    className="w-full rounded-lg border border-border/40 bg-muted/50 py-2.5 pl-9 pr-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 sm:text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted sm:hidden"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {nodes.length === 0 ? "All modules" : "Action modules"}
                </div>
                {filtered.map((mod) => {
                  const Icon = mod.icon;
                  return (
                    <button
                      key={mod.type}
                      onClick={() => addModule(mod)}
                      className="group flex w-full min-h-14 items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-muted/60"
                    >
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-md transition-shadow group-hover:shadow-lg"
                        style={{ backgroundColor: mod.color }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{mod.name}</div>
                        {mod.description && (
                          <div className="line-clamp-2 text-xs text-muted-foreground sm:truncate">
                            {mod.description}
                          </div>
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
