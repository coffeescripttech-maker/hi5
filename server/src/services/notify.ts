import { query } from "../config/database";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { notificationBus, NotificationBusRow } from "./notificationBus";

/**
 * Central notification helper.
 *
 * Persists a notification row and immediately pushes it to every connected
 * SSE client via the notificationBus, so the UI bell/badge updates live with
 * no refresh. Fire-and-forget by design: callers (enrollment, grades,
 * backups, promotions) must never fail because a notification could not be
 * created — all errors are contained here and logged.
 */
export type NotificationType =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "security";

export interface CreateNotificationInput {
  title: string;
  message: string;
  type?: NotificationType;
  /** Personal notification target. Omit/null for a broadcast row. */
  user_id?: number | null;
  /** Role tag for the row (informational; broadcasts reach all roles). */
  role?: string | null;
}

export async function createNotification(
  input: CreateNotificationInput
): Promise<NotificationBusRow | null> {
  try {
    const type = input.type || "info";
    const result = await query<ResultSetHeader>(
      `INSERT INTO notifications (user_id, role, type, title, message)
       VALUES (?, ?, ?, ?, ?)`,
      [input.user_id ?? null, input.role ?? null, type, input.title, input.message]
    );

    const rows = await query<RowDataPacket[]>(
      "SELECT * FROM notifications WHERE id = ?",
      [result.insertId]
    );
    const row = rows[0] as NotificationBusRow | undefined;

    if (row) {
      // Broadcast rows (user_id NULL) reach every connected client;
      // personal rows reach only that user (visibility enforced in the
      // SSE stream handler, mirroring GET /api/notifications).
      notificationBus.emit("notification", row);
    }
    return row ?? null;
  } catch (err) {
    console.error("[notify] Failed to create notification:", err);
    return null;
  }
}
