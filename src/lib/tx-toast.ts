import { toast } from "sonner";
import { solexplorerUrl } from "@/lib/solana";

/**
 * Success toast that stays visible until the user clicks the explorer link.
 * Used for every signed Solana operation so the result is always verifiable.
 */
export function notifyTxSuccess(
  message: string,
  signature: string,
  options?: { description?: string },
) {
  toast.success(message, {
    duration: Infinity,
    closeButton: true,
    description: options?.description,
    action: {
      label: "Ver en Explorer",
      onClick: () => {
        window.open(
          solexplorerUrl(signature),
          "_blank",
          "noopener,noreferrer",
        );
      },
    },
  });
}
