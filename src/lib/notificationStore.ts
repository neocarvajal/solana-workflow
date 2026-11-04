export type NotificationStatus = "success" | "error" | "info";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  channel: string;
  status: NotificationStatus;
  read: boolean;
  createdAt: number;
}

const STORAGE_KEY = "solflows_notifications_v1";
const MAX_NOTIFICATIONS = 100;

type Listener = (notifications: AppNotification[]) => void;

let notifications: AppNotification[] = [];
let loaded = false;
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
  };

  notifications = [item, ...notifications].slice(0, MAX_NOTIFICATIONS);
  emit();
  return item;
}

export function markNotificationRead(id: string) {
  ensureLoaded();
  let changed = false;
  notifications = notifications.map((item) => {
    if (item.id === id && !item.read) {
      changed = true;
      return { ...item, read: true };
    }
    return item;
  });
  if (changed) emit();
}

export function markAllNotificationsRead() {
  ensureLoaded();
  if (!notifications.some((item) => !item.read)) return;
  notifications = notifications.map((item) => ({ ...item, read: true }));
  emit();
}

export function removeNotification(id: string) {
  ensureLoaded();
  const next = notifications.filter((item) => item.id !== id);
  if (next.length === notifications.length) return;
  notifications = next;
  emit();
}

export function clearNotifications() {
  ensureLoaded();
  if (notifications.length === 0) return;
  notifications = [];
  emit();
}
