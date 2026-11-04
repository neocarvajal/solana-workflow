import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { Settings, X, Save, Wallet, Bell, ChevronDown } from "lucide-react";
import { getSettings, saveSettings } from "@/lib/workflowStore";
import { toast } from "sonner";

const SettingsDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [alertChannel, setAlertChannel] = useState("app");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (open) {
      const s = getSettings();
      setRecipient(s.recipientWallet);
      setAlertChannel(s.alertChannel);
    }
  }, [open]);

  const handleSave = () => {
    saveSettings({ recipientWallet: recipient, alertChannel });
    toast.success("Settings saved");
    setOpen(false);
  };

  const modalContent = open && (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 p-2 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-border/60 bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/40 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-semibold">Settings</h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-4 sm:p-5">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2 mb-2">
              <Wallet className="h-3.5 w-3.5" />
              Default Recipient Wallet
            </label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full rounded-xl border border-border/40 bg-muted/50 px-4 py-3 font-mono text-base focus:outline-none focus:ring-2 focus:ring-primary/50 sm:py-2.5 sm:text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2 mb-2">
              <Bell className="h-3.5 w-3.5" />
              Alert Channel
            </label>

            <div className="relative w-full">
              <select
                value={alertChannel}
                onChange={(e) => setAlertChannel(e.target.value)}
                className="w-full cursor-pointer appearance-none rounded-xl border border-border/40 bg-muted/50 px-4 py-3 pr-10 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 sm:py-2.5 sm:text-sm"
              >
                <option value="app">In-App Notification</option>
                <option value="email">Email</option>
                <option value="telegram">Telegram</option>
                <option value="discord">Discord</option>
              </select>
              <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="border-t border-border/40 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5">
          <button
            onClick={handleSave}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Save className="h-4 w-4" />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border transition-colors hover:bg-muted"
        title="Settings"
        aria-label="Settings"
      >
        <Settings className="h-4 w-4" />
      </button>

      {mounted ? ReactDOM.createPortal(modalContent, document.body) : null}
    </>
  );
};

export default SettingsDialog;