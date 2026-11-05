import { query } from "../config/database";
import { ResultSetHeader } from "mysql2";

/**
 * Log many actions in a single round-trip (used by grade saves where one
 * request can touch dozens of cells). Best-effort, same as logActivity.
 */
export async function logActivities(
  entries: { userId: number | null; action: string; entityType?: string | null; entityId?: string | number | null }[]
): Promise<void> {
  if (entries.length === 0) return;
  try {
    const valuesSql = entries.map(() => "(?, ?, ?, ?)").join(", ");
    const params = entries.flatMap((e) => [
      e.userId,
      e.action,
      e.entityType ?? null,
      e.entityId != null ? String(e.entityId) : null,
    ]);
    await query<ResultSetHeader>(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES ${valuesSql}`,
      params
    );
  } catch (error) {
    console.error("Failed to log activities:", error);
  }
}

/**
 * Log an action to the activity_logs table
 */
export async function logActivity(
  userId: number | null,
  action: string,
  entityType?: string | null,
  entityId?: string | number | null
): Promise<void> {
  try {
    await query<ResultSetHeader>(
      "INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)",
      [userId, action, entityType ?? null, entityId != null ? String(entityId) : null]
    );
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}
