import { useEffect, useState } from "react";
import { isVaultReady, subscribeVaultReady } from "@/lib/workflowStore";

/** Reactive flag for every entry point that opens the vault panel. */
export function useVaultReady(): boolean {
  const [ready, setReady] = useState(isVaultReady);

  useEffect(() => subscribeVaultReady(setReady), []);

  return ready;
}
