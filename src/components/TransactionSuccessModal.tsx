import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { CheckCircle2, ExternalLink, Copy, Terminal } from "lucide-react";
import { toast } from "sonner";

interface TransactionSuccessModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  txData: {
    signature?: string;
    actionType?: string;
    blockhash?: string;
  } | null;
}

const TransactionSuccessModal: React.FC<TransactionSuccessModalProps> = ({ isOpen, onClose, txData }) => {
  if (!txData) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado al portapapeles");
  };

  const txSignature = txData.signature || "";
  const explorerUrl = `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[460px] border-emerald-500/20 bg-background text-foreground">
        
        {/* Encabezado semántico con tus componentes de ui/dialog */}
        <DialogHeader className="flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mb-3 text-emerald-500 animate-pulse">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          
          <DialogTitle className="text-xl font-bold tracking-tight text-emerald-400">
            ¡Simulación Exitosa!
          </DialogTitle>
          
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            El workflow se procesó correctamente en <span className="font-semibold text-foreground">la capa de simulación.</span>
          </DialogDescription>
        </DialogHeader>

        {/* Datos técnicos de la transacción */}
        <div className="space-y-3 my-2">
          <div className="bg-muted/50 p-3 rounded-lg border border-border/60 text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Acción simulada:</span>
              <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
                {txData.actionType || "send_transaction"}
              </span>
            </div>
            {txData.blockhash && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-medium">Recent Blockhash:</span>
                <span className="font-mono text-muted-foreground/90">
                  {txData.blockhash.slice(0, 8)}...{txData.blockhash.slice(-8)}
                </span>
              </div>
            )}
          </div>

          {/* Payload Base64 devuelto por la API modular de Next.js */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Terminal className="h-3 w-3" /> Transacción Serializada (Base64)
            </label>
            <div className="relative group bg-black/40 p-3 rounded-lg border border-border font-mono text-[11px] text-zinc-300 break-all max-h-24 overflow-y-auto">
              {txData.signature || "Sin datos de payload"}
              
              <button 
                onClick={() => copyToClipboard(txData.signature || "")}
                className="absolute top-2 right-2 p-1 rounded bg-background border border-border opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
                title="Copiar Transacción"
              >
                <Copy className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>

        {/* Botones inferiores usando DialogFooter */}
        <DialogFooter className="sm:space-x-3 gap-2 sm:gap-0 mt-2">
          <DialogClose asChild>
            <button className="flex-1 sm:flex-none px-4 py-2 text-sm bg-muted hover:bg-muted/80 text-foreground font-medium rounded-lg transition-colors border border-border">
              Cerrar
            </button>
          </DialogClose>
          
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 flex-1 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors shadow-md shadow-emerald-900/10 text-center"
          >
            <span>Ver transacción</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
};

export default TransactionSuccessModal;