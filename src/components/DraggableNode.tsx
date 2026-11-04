import React, { useRef, useCallback } from "react";
import { Zap, Settings } from "lucide-react";
import type { FlowNode } from "@/lib/workflow";

interface Props {
  node: FlowNode;
  isFirst: boolean;
  index: number;
  scale: number;
  isActive: boolean;
  onDrag: (id: string, x: number, y: number) => void;
  onDoubleClick: (node: FlowNode) => void;
  onSettings: (node: FlowNode) => void;
}

const NODE_RADIUS = 48;

const DraggableNode: React.FC<Props> = ({
  node,
  isFirst,
  index,
  scale,
  isActive,
  onDrag,
  onDoubleClick,
  onSettings,
}) => {
  const isDragging = useRef(false);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;

      event.stopPropagation();

      const target = event.currentTarget;
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }

      const startX = event.clientX;
      const startY = event.clientY;
      const startNodeX = node.x;
      const startNodeY = node.y;
      let hasMoved = false;

      isDragging.current = true;
      target.style.cursor = "grabbing";

      const onMove = (ev: PointerEvent) => {
        if (!isDragging.current) return;

        const distance = Math.hypot(ev.clientX - startX, ev.clientY - startY);
        if (distance > 5) hasMoved = true;
        if (!hasMoved) return;

        onDrag(
          node.id,
          startNodeX + (ev.clientX - startX) / scale,
          startNodeY + (ev.clientY - startY) / scale
        );
      };

      const finish = () => {
        isDragging.current = false;
        target.style.cursor = "";
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);

        try {
          if (target.hasPointerCapture(event.pointerId)) {
            target.releasePointerCapture(event.pointerId);
          }
        } catch {
          /* ignore */
        }

        // Un toque sin desplazamiento abre los ajustes (funciona en móvil).
        if (!hasMoved) onDoubleClick(node);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    },
    [node, scale, onDrag, onDoubleClick]
  );

  const Icon = node.module.icon;

  return (
    <div
      data-node
      className="node-draggable"
      style={{
        position: "absolute",
        left: node.x - NODE_RADIUS,
        top: node.y - NODE_RADIUS,
        width: NODE_RADIUS * 2,
        zIndex: 10,
        userSelect: "none",
      }}
      onPointerDown={handlePointerDown}
      role="button"
      tabIndex={0}
      aria-label={`${node.module.name}. Toca para configurar o arrastra para mover.`}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSettings(node);
        }
      }}
    >
      <div className="flex flex-col items-center">
        <div className="relative">
          <div
            className={`node-circle ${isActive ? "node-active" : ""}`}
            style={{
              width: NODE_RADIUS * 2,
              height: NODE_RADIUS * 2,
              backgroundColor: node.module.color,
            }}
          >
            <Icon className="h-10 w-10 text-white" />
          </div>

          <button
            type="button"
            className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-black/25 text-white/80 shadow-sm backdrop-blur-sm transition-colors hover:bg-black/40 hover:text-white"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onSettings(node);
            }}
            aria-label={`Configurar ${node.module.name}`}
          >
            <Settings className="h-4 w-4" />
          </button>

          {isFirst && (
            <div className="absolute -bottom-1 -left-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-card shadow-lg">
              <Zap className="h-4 w-4 text-yellow-400 fill-yellow-400" />
            </div>
          )}

          {!isFirst && (
            <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card shadow">
              <span className="text-[10px] font-bold text-muted-foreground">{index}</span>
            </div>
          )}
        </div>

        <div className="mt-2 max-w-[130px] text-center pointer-events-none">
          <div className="truncate text-xs font-semibold text-foreground">
            {node.module.name}
          </div>
          {node.module.description && (
            <div className="truncate text-[10px] text-muted-foreground">
              {node.module.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(DraggableNode);
