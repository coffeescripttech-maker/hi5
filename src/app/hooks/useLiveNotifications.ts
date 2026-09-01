/**
 * Real-time notification hook for the HI5 Portal.
 *
 * Opens one Server-Sent Events (SSE) connection to
 * GET /api/notifications/stream?token=… (EventSource can't set headers, so we
 * reuse the ?token= query transport the API already supports for downloads).
 *
 * - Initial snapshot: GET /api/notifications (also re-fetched automatically
 *   whenever the stream (re)connects, so nothing is missed after a drop).
 * - Live push: `notification` events prepend to the list and bump the badge.
 * - Auto-reconnect: EventSource retries on its own; `onopen` fires again on
 *   every successful (re)connect, which is exactly when we refresh the
 *   snapshot. Minimal server load: one idle connection per user + heartbeats.
 *
 * Signing out (token cleared) closes the stream; the drop is silent.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getToken } from "../services/api";
import {
  notificationsApi,
  NotificationRow
} from "../services/notifications";

const STREAM_PATH = "/api/notifications/stream";
const MAX_LISTED = 50;

/** Resolve the SSE endpoint using the same env var the fetch client uses. */
function streamUrl(): string | null {
  const token = getToken();
  if (!token) return null;
  const base = (import.meta.env.VITE_API_URL || "http://localhost:3001/api")
    .trim()
    .replace(/\/+$/, "");
  const origin = base.replace(/\/api$/, "");
  return `${origin}${STREAM_PATH}?token=${encodeURIComponent(token)}`;
}

export function formatLiveTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit"
  });
  return sameDay
    ? `Today ${time}`
    : `${d.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric"
      })} ${time}`;
}

export function useLiveNotifications(
  onNew?: (n: NotificationRow) => void
): {
  notifications: NotificationRow[];
  unreadCount: number;
  loading: boolean;
  markOneRead: (id: number) => void;
  markAllRead: () => void;
} {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const esRef = useRef<EventSource | null>(null);
  const onNewRef = useRef(onNew);
  onNewRef.current = onNew;

  /** Full snapshot so the list & badge are true even after a disconnect. */
  const loadSnapshot = useCallback(async () => {
    try {
      const res = await notificationsApi.list();
      setNotifications(res.notifications.slice(0, MAX_LISTED));
      setUnreadCount(res.unread_count);
    } catch {
      // Auth expired / server down — keep current state; stream reconnects.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshot();

    const url = streamUrl();
    if (!url) return;

    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("notification", ev => {
      try {
        const n = JSON.parse((ev as MessageEvent).data) as NotificationRow;
        setNotifications(prev => [n, ...prev].slice(0, MAX_LISTED));
        setUnreadCount(c => c + 1);
        onNewRef.current?.(n);
      } catch {
        /* ignore malformed frames */
      }
    });

    // Fires on initial connect AND every successful auto-reconnect => the
    // snapshot refresh is the natural "catch-up" for anything missed.
    es.onopen = () => {
      loadSnapshot();
    };
    es.onerror = () => {
      // EventSource reconnects automatically; onopen handles the catch-up.
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [loadSnapshot]);

  const markOneRead = useCallback(
    (id: number) => {
      setUnreadCount(c => Math.max(0, c - 1));
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: 1 } : n))
      );
      notificationsApi.markRead(id).catch(() => loadSnapshot());
    },
    [loadSnapshot]
  );

  const markAllRead = useCallback(() => {
    setUnreadCount(0);
    setNotifications(prev =>
      prev.map(n => (n.is_read ? n : { ...n, is_read: 1 }))
    );
    notificationsApi.markAllRead().catch(() => loadSnapshot());
  }, [loadSnapshot]);

  return { notifications, unreadCount, loading, markOneRead, markAllRead };
}