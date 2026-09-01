/**
 * Activity Log Cleanup Cron — Periodically deletes old activity_logs entries
 *
 * Retention: logs older than ACTIVITY_LOG_RETENTION_DAYS (default 90) are removed.
 * This runs daily via setInterval. Call startActivityLogCron() to kick off.
 *
 * Keeps the activity_logs table from growing unbounded while preserving
 * the most recent 90 days of audit history.
 */

import pool from "../config/database";
import { ResultSetHeader } from "mysql2";

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const ACTIVITY_LOG_RETENTION_DAYS = 90;

let intervalHandle: ReturnType<typeof setInterval> | null = null;

async function cleanupActivityLogs(): Promise<void> {
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM activity_logs
       WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [ACTIVITY_LOG_RETENTION_DAYS]
    );

    if (result?.affectedRows > 0) {
      console.log(
        `[ActivityLogCron] Deleted ${result.affectedRows} activity log(s) older than ${ACTIVITY_LOG_RETENTION_DAYS} days`
      );
    }
  } catch (err) {
    console.error("[ActivityLogCron] Error cleaning up activity logs:", err);
  }
}

/**
 * Start the activity log cleanup cron job. Safe to call multiple times —
 * only one interval runs at a time.
 */
export function startActivityLogCron(): void {
  if (intervalHandle) return; // already running

  console.log("[ActivityLogCron] Starting — cleanup runs every 24 hours");

  // Run shortly after startup (30s delay so server boot isn't blocked)
  setTimeout(() => {
    cleanupActivityLogs();
    intervalHandle = setInterval(cleanupActivityLogs, CLEANUP_INTERVAL_MS);
  }, 30 * 1000);
}

/**
 * Stop the cron job (for clean shutdown).
 */
export function stopActivityLogCron(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[ActivityLogCron] Stopped");
  }
}
