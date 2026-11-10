import { supabase } from "@/integrations/supabase/client";

export type NotificationStatus = "success" | "error" | "info";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  channel: string;
  status: NotificationStatus;
  read: boolean;
  createdAt: number;
  workflowId?: string;
  workflowName?: string;
  /** Server notifications come from cron runs; the rest are browser-local. */
  source?: "local" | "server";
}

type ServerNotificationRow = {
  id: string;
  owner_wallet: string;
  workflow_id: string | null;
  workflow_name: string | null;
  title: string;
  message: string;
  channel: string;
  status: string;
  read: boolean;
  created_at: string;
};

const STORAGE_KEY = "solflows_notifications_v1";
const MAX_NOTIFICATIONS = 100;

type Listener = (notifications: AppNotification[]) => void;

let notifications: AppNotification[] = [];
let loaded = false;
let currentWallet: string | null = null;
let syncInFlight: Promise<void> | null = null;
const listeners = new Set<Listener>();

function safeParse(raw: string | null): AppNotification[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object" && typeof item.message === "string")
      .map((item) => ({
        id: String(item.id || `n-${Math.random().toString(36).slice(2)}`),
        title: String(item.title || "Notificación"),
        message: String(item.message),
        channel: String(item.channel || "app"),
        status: item.status === "error" || item.status === "success" ? item.status : "info",
        read: Boolean(item.read),
        createdAt: Number(item.createdAt) || Date.now(),
        workflowId: typeof item.workflowId === "string" ? item.workflowId : undefined,
        workflowName: typeof item.workflowName === "string" ? item.workflowName : undefined,
        source: item.source === "server" ? ("server" as const) : ("local" as const),
      }))
      .slice(0, MAX_NOTIFICATIONS);
  } catch {
    return [];
  }
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    notifications = safeParse(localStorage.getItem(STORAGE_KEY));
  } catch {
    notifications = [];
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch {
    /* storage may be unavailable */
  }
}

function emit() {
  persist();
  const snapshot = [...notifications];
  listeners.forEach((listener) => listener(snapshot));
}

export function getNotifications(): AppNotification[] {
  ensureLoaded();
  return [...notifications];
}

export function getUnreadNotificationCount(): number {
  ensureLoaded();
  return notifications.filter((item) => !item.read).length;
}

export function subscribeNotifications(listener: Listener) {
  ensureLoaded();
  listeners.add(listener);
  listener([...notifications]);
  return () => {
    listeners.delete(listener);
  };
}

function rowToNotification(row: ServerNotificationRow): AppNotification {
  const createdAt = new Date(row.created_at).getTime();
  return {
    id: row.id,
    title: row.title || "Notificación",
    message: row.message,
    channel: row.channel || "app",
    status: row.status === "error" || row.status === "success" ? row.status : "info",
    read: Boolean(row.read),
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    workflowId: row.workflow_id || undefined,
    workflowName: row.workflow_name || undefined,
    source: "server",
  };
}

/**
 * Binds the notification store to the connected wallet and loads the alerts
 * persisted by the cron. Server rows replace the previous wallet's rows while
 * local, browser-only notifications are kept.
 */
export function setNotificationWallet(wallet: string | null | undefined) {
  ensureLoaded();
  const next = wallet?.trim() || null;
  if (next === currentWallet) return;

  currentWallet = next;
  notifications = notifications.filter((item) => item.source !== "server");
  emit();

  if (next) void syncNotifications();
}

export async function syncNotifications(): Promise<void> {
  ensureLoaded();
  const wallet = currentWallet;
  if (!wallet || typeof window === "undefined") return;
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    try {
      const { data, error } = await supabase
        .from("user_notifications")
        .select("id,owner_wallet,workflow_id,workflow_name,title,message,channel,status,read,created_at")
        .eq("owner_wallet", wallet)
        .order("created_at", { ascending: false })
        .limit(MAX_NOTIFICATIONS);

      if (error) throw error;
      if (wallet !== currentWallet) return;

      const serverItems = ((data || []) as ServerNotificationRow[]).map(rowToNotification);
      const serverIds = new Set(serverItems.map((item) => item.id));
      const localItems = notifications.filter(
        (item) => item.source !== "server" && !serverIds.has(item.id),
      );

      notifications = [...serverItems, ...localItems]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, MAX_NOTIFICATIONS);
      emit();
    } catch (error) {
      // Keep the local cache when Supabase is unreachable or the table has not
      // been migrated yet. The next poll retries automatically.
      console.warn("No se pudieron sincronizar las notificaciones in-app", error);
    } finally {
      syncInFlight = null;
    }
  })();

  return syncInFlight;
}

/**
 * Forces a new server read even when a background poll is already in flight,
 * so a completed scheduled run can reveal its notification immediately.
 */
export async function refreshNotifications(): Promise<void> {
  if (syncInFlight) {
    await syncInFlight.catch(() => undefined);
  }
  await syncNotifications();
}

export function addNotification(input: {
  title?: string;
  message: string;
  channel?: string;
  status?: NotificationStatus;
  createdAt?: number;
}): AppNotification {
  ensureLoaded();

  const item: AppNotification = {
    id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: (input.title || "Notificación").trim() || "Notificación",
    message: (input.message || "").trim() || "Sin contenido",
    channel: input.channel || "app",
    status: input.status || "info",
    read: false,
    createdAt: input.createdAt || Date.now(),
    source: "local",
  };

  notifications = [item, ...notifications].slice(0, MAX_NOTIFICATIONS);
  emit();
  return item;
}

export function markNotificationRead(id: string) {
  ensureLoaded();
  const target = notifications.find((item) => item.id === id);
  if (!target || target.read) return;

  notifications = notifications.map((item) =>
    item.id === id ? { ...item, read: true } : item,
  );
  emit();

  if (target.source === "server" && currentWallet) {
    void supabase
      .from("user_notifications")
      .update({ read: true })
      .eq("id", id)
      .eq("owner_wallet", currentWallet)
      .then(({ error }) => {
        if (error) console.warn("No se pudo marcar la notificación como leída", error);
      });
  }
}

export function markAllNotificationsRead() {
  ensureLoaded();
  if (!notifications.some((item) => !item.read)) return;
  notifications = notifications.map((item) => ({ ...item, read: true }));
  emit();

  if (currentWallet) {
    void supabase
      .from("user_notifications")
      .update({ read: true })
      .eq("owner_wallet", currentWallet)
      .eq("read", false)
      .then(({ error }) => {
        if (error) console.warn("No se pudieron marcar las notificaciones como leídas", error);
      });
  }
}

export function removeNotification(id: string) {
  ensureLoaded();
  const target = notifications.find((item) => item.id === id);
  if (!target) return;

  notifications = notifications.filter((item) => item.id !== id);
  emit();

  if (target.source === "server" && currentWallet) {
    void supabase
      .from("user_notifications")
      .delete()
      .eq("id", id)
      .eq("owner_wallet", currentWallet)
      .then(({ error }) => {
        if (error) console.warn("No se pudo borrar la notificación", error);
      });
  }
}

export function clearNotifications() {
  ensureLoaded();
  if (notifications.length === 0) return;
  notifications = [];
  emit();

  if (currentWallet) {
    void supabase
      .from("user_notifications")
      .delete()
      .eq("owner_wallet", currentWallet)
      .then(({ error }) => {
        if (error) console.warn("No se pudieron limpiar las notificaciones", error);
      });
  }
}
