/**
 * Activity Log Cleanup Cron — Periodically deletes old activity_logs entries
 *
 * Retention: logs older than ACTIVITY_LOG_RETENTION_DAYS (default 90) are removed.
 * This runs hourly via setInterval but only performs cleanup if 24 hours have passed
 * since the last cleanup, making it restart-safe.
 *
 * Keeps the activity_logs table from growing unbounded while preserving
 * the most recent 90 days of audit history.
 */

import pool from "../config/database";
import { ResultSetHeader, RowDataPacket } from "mysql2";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Check every hour
const ACTIVITY_LOG_RETENTION_DAYS = 90;
const CLEANUP_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

let intervalHandle: ReturnType<typeof setInterval> | null = null;

async function getLastCleanupTime(): Promise<Date | null> {
  try {
    const rows = await pool.query<RowDataPacket[]>(
      `SELECT last_activity_log_cleanup FROM school_settings WHERE id = 1`
    );
    const row = (rows[0] as RowDataPacket[])[0];
    return row?.last_activity_log_cleanup
      ? new Date(row.last_activity_log_cleanup)
      : null;
  } catch (err) {
    console.error("[ActivityLogCron] Error reading last cleanup time:", err);
    return null;
  }
}

async function updateLastCleanupTime(): Promise<void> {
  try {
    await pool.query<ResultSetHeader>(
      `UPDATE school_settings SET last_activity_log_cleanup = NOW() WHERE id = 1`
    );
  } catch (err) {
    console.error("[ActivityLogCron] Error updating last cleanup time:", err);
  }
}

async function cleanupActivityLogs(): Promise<void> {
  try {
    // Check if enough time has passed since last cleanup
    const lastCleanup = await getLastCleanupTime();
    const now = new Date();

    if (lastCleanup && (now.getTime() - lastCleanup.getTime()) < CLEANUP_THRESHOLD_MS) {
      // Less than 24 hours since last cleanup, skip
      return;
    }

    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM activity_logs
       WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [ACTIVITY_LOG_RETENTION_DAYS]
    );

    if (result?.affectedRows > 0) {
      console.log(
        `[ActivityLogCron] Deleted ${result.affectedRows} activity log(s) older than ${ACTIVITY_LOG_RETENTION_DAYS} days`
      );

      // Update the last cleanup timestamp
      await updateLastCleanupTime();
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

  console.log("[ActivityLogCron] Starting — checks every hour, cleans up if 24h passed since last cleanup");

  // Run shortly after startup (30s delay so server boot isn't blocked)
  setTimeout(() => {
    cleanupActivityLogs(); // Initial run
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