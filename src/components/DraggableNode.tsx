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
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      isDragging.current = true;

      const startX = e.clientX;
      const startY = e.clientY;
      let hasMoved = false;

      dragOffset.current = {
        x: e.clientX / scale - node.x,
        y: e.clientY / scale - node.y,
      };

      const onMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
        if (dist > 5) {
          hasMoved = true;
        }
        const newX = ev.clientX / scale - dragOffset.current.x;
        const newY = ev.clientY / scale - dragOffset.current.y;
        onDrag(node.id, newX, newY);
      };

      const onUp = () => {
        isDragging.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        if (!hasMoved) {
          onDoubleClick(node);
        }
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [node, scale, onDrag, onDoubleClick]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDoubleClick(node);
    },
    [node, onDoubleClick]
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
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <div className="flex flex-col items-center">
        <div className="relative">
          {/* Node circle */}
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

          {/* Settings gear */}
          <div
            className="absolute top-1 right-1"
            onClick={(e) => {
              e.stopPropagation();
              onSettings(node);
            }}
          >
            <Settings className="h-4 w-4 text-white/70 hover:text-white cursor-pointer" />
          </div>

          {/* Trigger badge */}
          {isFirst && (
            <div className="absolute -bottom-1 -left-1 w-8 h-8 rounded-full bg-card shadow-lg border-2 border-background flex items-center justify-center">
              <Zap className="h-4 w-4 text-yellow-400 fill-yellow-400" />
            </div>
          )}

          {/* Step number badge */}
          {!isFirst && (
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-card shadow border border-border flex items-center justify-center">
              <span className="text-[10px] font-bold text-muted-foreground">{index}</span>
            </div>
          )}
        </div>

        {/* Label */}
        <div className="mt-2 text-center pointer-events-none">
          <div className="text-xs font-semibold text-foreground whitespace-nowrap">
            {node.module.name}
          </div>
          {node.module.description && (
            <div className="text-[10px] text-muted-foreground whitespace-nowrap">
              {node.module.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(DraggableNode);
