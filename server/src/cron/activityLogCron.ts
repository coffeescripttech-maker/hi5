/**
 * Activity Log Cleanup Cron — Periodically deletes old activity_logs entries
 *
 * Reads its configuration from the school_settings singleton (row id=1),
 * so the admin UI can control cleanup without restarting the server:
 *   activity_log_cleanup_enabled — 1 = cleanup runs, 0 = paused
 *   activity_log_retention_days  — how many days of history to keep
 *   last_activity_log_cleanup    — when the last cleanup round ran
 *
 * Runs hourly via setInterval but only performs cleanup if 24 hours have
 * passed since the last cleanup, making it restart-safe.
 */

import pool from "../config/database";
import { ResultSetHeader, RowDataPacket } from "mysql2";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Check every hour
const DEFAULT_RETENTION_DAYS = 90;
const CLEANUP_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

let intervalHandle: ReturnType<typeof setInterval> | null = null;

async function getCleanupConfig(): Promise<{ enabled: boolean; retentionDays: number; lastCleanup: Date | null }> {
  try {
    const rows = await pool.query<RowDataPacket[]>(
      `SELECT last_activity_log_cleanup, activity_log_cleanup_enabled, activity_log_retention_days
       FROM school_settings WHERE id = 1`
    );
    const row = (rows[0] as RowDataPacket[])[0];
    if (!row) return { enabled: true, retentionDays: DEFAULT_RETENTION_DAYS, lastCleanup: null };
    return {
      enabled: row.activity_log_cleanup_enabled !== 0,
      retentionDays: Number.isFinite(parseInt(row.activity_log_retention_days, 10))
        ? parseInt(row.activity_log_retention_days, 10)
        : DEFAULT_RETENTION_DAYS,
      lastCleanup: row.last_activity_log_cleanup
        ? new Date(row.last_activity_log_cleanup)
        : null,
    };
  } catch (err) {
    console.error("[ActivityLogCron] Error reading cleanup config:", err);
    return { enabled: true, retentionDays: DEFAULT_RETENTION_DAYS, lastCleanup: null };
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
    const { enabled, retentionDays, lastCleanup } = await getCleanupConfig();

    if (!enabled) {
      console.log("[ActivityLogCron] Cleanup paused via settings — skipping run");
      return;
    }

    // Check if enough time has passed since the last cleanup
    const now = new Date();
    if (lastCleanup && (now.getTime() - lastCleanup.getTime()) < CLEANUP_THRESHOLD_MS) {
      // Less than 24 hours since last cleanup, skip
      return;
    }

    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM activity_logs
       WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [retentionDays]
    );

    if (result?.affectedRows > 0) {
      console.log(
        `[ActivityLogCron] Deleted ${result.affectedRows} activity log(s) older than ${retentionDays} days`
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