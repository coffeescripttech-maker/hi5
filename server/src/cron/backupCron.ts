/**
 * Backup Cron — Automatically creates database backups on a schedule.
 *
 * Reads config from school_settings singleton (row id=1):
 *   backup_frequency: daily | every_12h | weekly
 *   backup_time: HH:mm — time of day to run
 *   backup_retention: last_7 | last_30 | all
 *   backup_enabled: 1 | 0
 *
 * Follows the existing pattern from userStatusCron.ts.
 */

import pool from "../config/database";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { exec } from "child_process";
import path from "path";
import fs from "fs";
import util from "util";

const execPromise = util.promisify(exec);
const BACKUP_DIR = path.resolve(__dirname, process.env.BACKUP_DIR || "../../backups");
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every hour

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Check if it's time to run a backup based on the configured schedule.
 */
function isTimeToRun(frequency: string, backupTime: string, lastAutoBackup: Date | null): boolean {
  const now = new Date();
  const [hours, minutes] = backupTime.split(":").map(Number);
  const scheduledToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);

  // Only run if current time is past or at the scheduled time today
  if (now < scheduledToday) return false;

  if (frequency === "daily") {
    // Run once per day — if last backup was before today's scheduled time
    if (!lastAutoBackup) return true;
    return lastAutoBackup < scheduledToday;
  }

  if (frequency === "every_12h") {
    if (!lastAutoBackup) return true;
    const msSinceLast = now.getTime() - lastAutoBackup.getTime();
    return msSinceLast >= 12 * 60 * 60 * 1000;
  }

  if (frequency === "weekly") {
    if (!lastAutoBackup) return true;
    const msSinceLast = now.getTime() - lastAutoBackup.getTime();
    return msSinceLast >= 7 * 24 * 60 * 60 * 1000;
  }

  return false;
}

/**
 * Delete old backups based on retention policy.
 */
async function applyRetention(retention: string): Promise<void> {
  if (retention === "all") return;

  try {
    const keepCount = retention === "last_7" ? 7 : 30;

    // Get IDs of backups to keep (most recent N success + all failed/in_progress)
    const toDelete = await pool.query<RowDataPacket[]>(
      `SELECT id FROM backups
       WHERE backup_type = 'auto' AND status = 'success'
       ORDER BY created_at DESC
       LIMIT 999999 OFFSET ?`,
      [keepCount]
    );

    if ((toDelete[0] as RowDataPacket[]).length > 0) {
      const ids = (toDelete[0] as RowDataPacket[]).map(r => r.id);
      await pool.query<ResultSetHeader>(
        `DELETE FROM backups WHERE id IN (${ids.map(() => "?").join(",")})`,
        ids
      );
    }
  } catch (err) {
    console.error("[BackupCron] Retention cleanup error:", err);
  }
}

/**
 * Perform a single backup: mysqldump → save file → record in DB.
 */
async function performBackup(): Promise<void> {
  try {
    const dbName = process.env.DB_NAME || "hi5_portal";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `auto-backup-${dbName}-${timestamp}.sql`;
    const filePath = path.join(BACKUP_DIR, filename);

    // Build mysqldump command
    const host = process.env.DB_HOST || "localhost";
    const port = process.env.DB_PORT || "3306";
    const user = process.env.DB_USER || "root";
    const pass = process.env.DB_PASSWORD || "";

    const cmd = `"${process.env.MYSQLDUMP_PATH || 'mysqldump'}" -h ${host} -P ${port} -u ${user} ${pass ? `-p"${pass}"` : ""} --routines --triggers --single-transaction ${dbName} > "${filePath}"`;

    await execPromise(cmd, { timeout: 60000 });

    const stats = fs.statSync(filePath);

    // Count records
    const recordCount = await pool.query<RowDataPacket[]>(
      `SELECT SUM(row_count) AS total FROM (
        SELECT COUNT(*) AS row_count FROM users UNION ALL
        SELECT COUNT(*) FROM students UNION ALL
        SELECT COUNT(*) FROM sections
      ) AS counts`
    );

    // Insert backup record
    await pool.query<ResultSetHeader>(
      `INSERT INTO backups (backup_type, file_path, file_size, record_count, status, initiated_by)
       VALUES ('auto', ?, ?, ?, 'success', NULL)`,
      [filePath, stats.size, (recordCount[0] as any)?.total || 0]
    );

    console.log(`[BackupCron] Auto-backup completed: ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.error("[BackupCron] Backup failed:", err);
  }
}

/**
 * Main tick: read config → check if time → run → cleanup.
 */
async function tick(): Promise<void> {
  try {
    const rows = await pool.query<RowDataPacket[]>(
      `SELECT backup_frequency, backup_time, backup_retention, backup_enabled
       FROM school_settings WHERE id = 1`
    );

    const config = (rows[0] as RowDataPacket[])[0];
    if (!config || !config.backup_enabled) return;

    // Get last auto backup time
    const lastRows = await pool.query<RowDataPacket[]>(
      `SELECT created_at FROM backups
       WHERE backup_type = 'auto' AND status = 'success'
       ORDER BY created_at DESC LIMIT 1`
    );
    const lastRowsArr = lastRows[0] as RowDataPacket[];
    const lastAutoBackup = lastRowsArr.length > 0 ? new Date(lastRowsArr[0].created_at) : null;

    if (isTimeToRun(config.backup_frequency, config.backup_time, lastAutoBackup)) {
      await performBackup();
      await applyRetention(config.backup_retention);
    }
  } catch (err) {
    console.error("[BackupCron] Tick error:", err);
  }
}

/**
 * Start the backup cron. Safe to call multiple times.
 */
export function startBackupCron(): void {
  if (intervalHandle) return;
  console.log("[BackupCron] Starting — checks every 60 minutes");
  tick(); // Run immediately on start
  intervalHandle = setInterval(tick, CHECK_INTERVAL_MS);
}

/**
 * Stop the backup cron (for clean shutdown).
 */
export function stopBackupCron(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[BackupCron] Stopped");
  }
}
