import { EventEmitter } from "events";

/**
 * In-process event bus for real-time notification delivery (SSE).
 *
 * Whenever a notification row is inserted (admin broadcast or system
 * notification), the creating controller publishes it here and every
 * connected GET /api/notifications/stream subscriber pushes it to the
 * matching client instantly — no polling, no page refresh.
 *
 * Scope: single-process (matches the current deployment topology).
 */
export interface NotificationBusRow {
  id: number;
  user_id: number | null;
  role: string | null;
  type: string;
  title: string;
  message: string;
  created_at: string;
}

class NotificationBus extends EventEmitter {}
export const notificationBus = new NotificationBus();

// Many SSE clients may subscribe concurrently; raise the listener ceiling.
notificationBus.setMaxListeners(200);