import { query } from "../config/database";
import { ResultSetHeader } from "mysql2";

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
