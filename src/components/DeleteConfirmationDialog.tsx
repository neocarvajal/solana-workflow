import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";

interface DeleteWorkflowModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  workflowName: string;
}

const DeleteWorkflowModal: React.FC<DeleteWorkflowModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  workflowName
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    try {
      setIsDeleting(true);
      await onConfirm();
    } catch (error) {
      console.error("Error during deletion:", error);
    } finally {
      setIsDeleting(false);
      onClose(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90dvh] max-w-[calc(100%-1rem)] overflow-y-auto border-destructive/20 bg-background text-foreground sm:max-w-[440px]">

        <DialogHeader className="flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-destructive/10 rounded-full flex items-center justify-center mb-3 text-destructive animate-pulse">
            <AlertTriangle className="h-8 w-8" />
          </div>

          <DialogTitle className="text-xl font-bold tracking-tight text-red-400">
            Delete this workflow?
          </DialogTitle>

          <DialogDescription className="text-sm text-muted-foreground mt-1">
            You are about to permanently delete <span className="font-semibold text-foreground">"{workflowName}"</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/40 p-4 rounded-lg border border-border/60 text-xs text-muted-foreground space-y-2 my-2">
          <p className="flex items-start gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
            <span>The deletion (unpin) of the file will be requested from the <strong>Pinata / IPFS</strong> nodes.</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
            <span>Local <strong>LocalStorage</strong> data will be cleared immediately from your browser.</span>
          </p>
        </div>

        <DialogFooter className="sm:space-x-3 gap-2 sm:gap-0 mt-2">
          <DialogClose asChild>
            <button
              disabled={isDeleting}
              className="min-h-11 flex-1 rounded-lg border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 disabled:opacity-50 sm:flex-none"
            >
              Cancel
            </button>
          </DialogClose>

          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-center text-sm font-medium text-white shadow-md shadow-red-900/10 transition-colors hover:bg-red-500 disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Deleting from IPFS...</span>
              </>
            ) : (
              <>
                <span>Confirm Deletion</span>
                <Trash2 className="h-4 w-4" />
              </>
            )}
          </button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
};

export default DeleteWorkflowModal;