import React, { useEffect, useState } from "react";
import { Check, ChevronDown, Wifi } from "lucide-react";
import { CLUSTER_OPTIONS, setCluster, useCluster } from "@/lib/network";

/**
 * Shows which Solana cluster the dapp is talking to and lets the user switch
 * it. The wallet signs for the cluster selected here, so this badge is the
 * source of truth for "where am I connected".
 */
const NetworkIndicator: React.FC = () => {
  const cluster = useCluster();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = CLUSTER_OPTIONS.find((option) => option.value === cluster) || CLUSTER_OPTIONS[0];

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Red de Solana: cambiar cluster"
        title="Red de Solana conectada"
        className="flex min-h-10 items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted md:px-3"
      >
        <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
        <span className={`h-2 w-2 shrink-0 rounded-full ${current.dot}`} />
        <span>{mounted ? current.label : "Red"}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {open && mounted && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 rounded-xl border border-border bg-background p-1.5 shadow-xl">
          <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Red de Solana
          </p>
          {CLUSTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setCluster(option.value);
                setOpen(false);
              }}
              className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted"
            >
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${option.dot}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-foreground">{option.label}</span>
                <span className="block text-[11px] leading-snug text-muted-foreground">{option.hint}</span>
              </span>
              {option.value === cluster && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />}
            </button>
          ))}
          <p className="mt-1 border-t border-border/40 px-2 pb-1 pt-2 text-[10px] leading-snug text-muted-foreground">
            Las transacciones, enlaces y la bóveda usan esta red.
          </p>
        </div>
      )}
    </div>
  );
};

export default NetworkIndicator;
