import React, { useEffect, useState } from "react";
import { Check, ChevronDown, Wifi } from "lucide-react";
import { CLUSTER_OPTIONS, setCluster, useCluster } from "@/lib/network";

/**
 * Compact network strip shown under the navbar on small screens. It replaces
 * the full NetworkIndicator pill there so the nav row has one fewer item and
 * never overflows into the workflow menu.
 */
const MobileNetworkBar: React.FC = () => {
  const cluster = useCluster();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = CLUSTER_OPTIONS.find((option) => option.value === cluster) || CLUSTER_OPTIONS[0];

  return (
    <div className="relative border-t border-border/10 bg-background/90 px-3 pb-2 pt-1.5 md:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Red de Solana: ${mounted ? current.label : "cargando"}. Cambiar cluster`}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/40 px-2.5 py-1.5 text-xs transition-colors hover:bg-muted"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Wifi className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="shrink-0 text-muted-foreground">Red Solana</span>
          <span className={`h-2 w-2 shrink-0 rounded-full ${current.dot}`} />
          <span className="truncate font-medium text-foreground">
            {mounted ? current.label : "Red"}
          </span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && mounted && (
        <div className="absolute left-3 right-3 top-[calc(100%-0.25rem)] z-50 rounded-xl border border-border bg-background p-1.5 shadow-xl">
          <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Cambiar red
          </p>
          {CLUSTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setCluster(option.value);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${option.dot}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-foreground">{option.label}</span>
                <span className="block text-[11px] leading-snug text-muted-foreground">
                  {option.hint}
                </span>
              </span>
              {option.value === cluster && (
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MobileNetworkBar;
