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
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-card w-full max-w-md rounded-2xl border border-border/60 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-semibold">Settings</h2>
          </div>
          <button onClick={() => setOpen(false)} className="p-1 hover:bg-muted rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2 mb-2">
              <Wallet className="h-3.5 w-3.5" />
              Default Recipient Wallet
            </label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border/40 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-mono"
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
                className="w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border/40 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm appearance-none cursor-pointer pr-10"
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

        <div className="p-5 border-t border-border/40">
          <button
            onClick={handleSave}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
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
        className="p-2 rounded-full border border-border hover:bg-muted transition-colors"
        title="Settings"
      >
        <Settings className="h-4 w-4" />
      </button>

      {mounted ? ReactDOM.createPortal(modalContent, document.body) : null}
    </>
  );
};

export default SettingsDialog;