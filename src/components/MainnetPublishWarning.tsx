import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

interface MainnetPublishWarningProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (dontShowAgain: boolean) => void;
}

/** One-time confirmation shown before publishing a workflow on mainnet. */
const MainnetPublishWarning: React.FC<MainnetPublishWarningProps> = ({
  open,
  onCancel,
  onConfirm,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent className="max-h-[90dvh] max-w-[calc(100%-1rem)] overflow-y-auto border-amber-500/30 bg-background text-foreground sm:max-w-[480px]">
        <DialogHeader className="flex flex-col items-center text-center">
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/15">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">Estás en Mainnet</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Publicar aquí usa SOL real y no se puede deshacer.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-100">
          <ul className="list-disc space-y-1.5 pl-4">
            <li>La publicación firma una transacción: pagarás la comisión de la red.</li>
            <li>El workflow y su contenido quedan en IPFS y en la cadena de forma permanente.</li>
            <li>Si configuraste una bóveda con una política activa, el cron podrá mover fondos dentro de los límites que autorizaste.</li>
          </ul>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(event) => setDontShowAgain(event.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          No volver a mostrar este aviso
        </label>

        <DialogFooter className="gap-2 sm:space-x-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-10 flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(dontShowAgain)}
            className="min-h-10 flex-1 rounded-lg bg-gradient-purple-cyan px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Entendido, publicar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MainnetPublishWarning;
