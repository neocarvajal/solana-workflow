import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  Info,
  Mail,
  MessageSquare,
  Phone,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  clearNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications,
  type AppNotification,
} from "@/lib/notificationStore";

const CHANNEL_META: Record<string, { label: string; icon: React.ElementType }> = {
  app: { label: "In-App", icon: Bell },
  telegram: { label: "Telegram", icon: Send },
  discord: { label: "Discord", icon: MessageSquare },
  email: { label: "Email", icon: Mail },
  whatsapp: { label: "WhatsApp", icon: Phone },
};

const STATUS_META = {
  success: {
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-500",
  },
  error: {
    icon: AlertTriangle,
    className: "bg-red-500/10 text-red-500",
  },
  info: {
    icon: Info,
    className: "bg-primary/10 text-primary",
  },
};

function relativeTime(timestamp: number) {
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: es });
  } catch {
    return "ahora";
  }
}

const NotificationCenter: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);

  useEffect(() => {
    setMounted(true);
    return subscribeNotifications((next) => setItems(next));
  }, []);

  useEffect(() => {
    const openCenter = () => setOpen(true);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("open-notifications", openCenter);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("open-notifications", openCenter);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const unread = items.filter((item) => !item.read).length;

  const panel = open && (
    <div
      className="fixed inset-0 z-[95]"
      role="dialog"
      aria-modal="true"
      aria-label="Notificaciones"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px] sm:bg-transparent"
        onClick={() => setOpen(false)}
        aria-label="Cerrar notificaciones"
      />

      <div className="absolute inset-x-2 top-[calc(4.3rem+env(safe-area-inset-top))] flex max-h-[72dvh] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl sm:inset-x-auto sm:right-4 sm:top-[calc(4.75rem+env(safe-area-inset-top))] sm:w-[380px]">
        <div className="flex items-center gap-2 border-b border-border/40 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Bell className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground">Notificaciones</h2>
            <p className="text-[11px] text-muted-foreground">
              {unread > 0 ? `${unread} sin leer` : "Todo al día"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2">
          <button
            type="button"
            onClick={markAllNotificationsRead}
            disabled={unread === 0}
            className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Marcar leídas
          </button>
          <button
            type="button"
            onClick={clearNotifications}
            disabled={items.length === 0}
            className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpiar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Sin notificaciones</p>
              <p className="text-xs text-muted-foreground">
                Las alertas de tus workflows aparecerán aquí.
              </p>
            </div>
          ) : (
            items.slice(0, 50).map((item) => {
              const channel = CHANNEL_META[item.channel] || CHANNEL_META.app;
              const status = STATUS_META[item.status] || STATUS_META.info;
              const ChannelIcon = channel.icon;
              const StatusIcon = status.icon;

              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => markNotificationRead(item.id)}
                  className={`flex w-full gap-3 border-b border-border/30 px-3 py-3 text-left transition-colors hover:bg-muted/40 ${
                    item.read ? "" : "bg-primary/5"
                  }`}
                >
                  <span className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-foreground">
                    <ChannelIcon className="h-4 w-4" />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-card ${status.className}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                    </span>
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-2">
                      <span className="line-clamp-2 flex-1 text-sm font-medium text-foreground">
                        {item.title}
                      </span>
                      {!item.read && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </span>
                    <span className="mt-1 block whitespace-pre-wrap break-words text-xs text-muted-foreground line-clamp-3">
                      {item.message}
                    </span>
                    <span className="mt-1.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {channel.label} · {relativeTime(item.createdAt)}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border transition-colors hover:bg-muted"
        title="Notificaciones"
        aria-label={unread > 0 ? `Notificaciones (${unread} sin leer)` : "Notificaciones"}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {mounted ? ReactDOM.createPortal(panel, document.body) : null}
    </>
  );
};

export default NotificationCenter;
