/**
 * User Status Cron — Periodically checks last_login and updates user status
 *
 * active   → last_login within 30 days
 * idle     → last_login 30-60 days ago
 * inactive → last_login more than 60 days ago (or never logged in + old account)
 *
 * Runs every hour via setInterval. Call startUserStatusCron() to kick off.
 */

import pool from "../config/database";
import { RowDataPacket, ResultSetHeader } from "mysql2";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const ACTIVE_DAYS = 30;
const INACTIVE_DAYS = 60;

let intervalHandle: ReturnType<typeof setInterval> | null = null;

async function updateUserStatuses(): Promise<void> {
  try {
    // Mark users as inactive if last_login > 60 days ago (or never logged in + created > 60 days)
    const [inactiveResult] = await pool.query<ResultSetHeader>(
      `UPDATE users SET status = 'inactive'
       WHERE status != 'inactive'
         AND (
           (last_login IS NOT NULL AND last_login < DATE_SUB(NOW(), INTERVAL ? DAY))
           OR
           (last_login IS NULL AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY))
         )`,
      [INACTIVE_DAYS, INACTIVE_DAYS]
    );

    // Mark users as idle if last_login between 30-60 days ago
    const [idleResult] = await pool.query<ResultSetHeader>(
      `UPDATE users SET status = 'idle'
       WHERE status IN ('active')
         AND last_login IS NOT NULL
         AND last_login < DATE_SUB(NOW(), INTERVAL ? DAY)
         AND last_login >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [ACTIVE_DAYS, INACTIVE_DAYS]
    );

    // Mark users as active if last_login within 30 days
    const [activeResult] = await pool.query<ResultSetHeader>(
      `UPDATE users SET status = 'active'
       WHERE status IN ('idle', 'inactive')
         AND last_login IS NOT NULL
         AND last_login >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [ACTIVE_DAYS]
    );

    const totalUpdated =
      (inactiveResult?.affectedRows || 0) +
      (idleResult?.affectedRows || 0) +
      (activeResult?.affectedRows || 0);

    if (totalUpdated > 0) {
      console.log(
        `[UserStatusCron] Updated ${totalUpdated} user(s): ` +
          `${inactiveResult?.affectedRows || 0} → inactive, ` +
          `${idleResult?.affectedRows || 0} → idle, ` +
          `${activeResult?.affectedRows || 0} → active`
      );
    }
  } catch (err) {
    console.error("[UserStatusCron] Error updating user statuses:", err);
  }
}

/**
 * Start the user status cron job. Safe to call multiple times —
 * only one interval runs at a time.
 */
export function startUserStatusCron(): void {
  if (intervalHandle) return; // already running

  console.log("[UserStatusCron] Starting — checks every 60 minutes");

  // Run immediately on start
  updateUserStatuses();

  // Then every hour
  intervalHandle = setInterval(updateUserStatuses, CHECK_INTERVAL_MS);
}

/**
 * Stop the cron job (for clean shutdown).
 */
export function stopUserStatusCron(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[UserStatusCron] Stopped");
  }
}
