import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { createNotification } from "../services/notify";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { exec } from "child_process";
import path from "path";
import fs from "fs";
import util from "util";
import mysql from "mysql2/promise";
import { createLogicalBackupFile } from "../utils/dbBackup";

const execPromise = util.promisify(exec);
const BACKUP_DIR = path.resolve(__dirname, process.env.BACKUP_DIR || "../../backups");

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * GET /api/backups — List backups
 */
export async function listBackups(_req: Request, res: Response): Promise<void> {
  try {
    const backups = await query<RowDataPacket[]>(
      `SELECT b.*, u.name AS initiated_by_name
       FROM backups b
       LEFT JOIN users u ON b.initiated_by = u.id
       ORDER BY b.created_at DESC`
    );
    res.json(backups);
  } catch (error) {
    console.error("List backups error:", error);
    res.status(500).json({ error: "Failed to fetch backups." });
  }
}

/**
 * POST /api/backups — Create a manual backup
 */
export async function createBackup(req: Request, res: Response): Promise<void> {
  try {
    const dbName = process.env.DB_NAME || "hi5_portal";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `backup-${dbName}-${timestamp}.sql`;
    const filePath = path.join(BACKUP_DIR, filename);

    // Record in-progress backup
    const result = await query<ResultSetHeader>(
      `INSERT INTO backups (backup_type, file_path, status, initiated_by)
       VALUES ('manual', ?, 'in_progress', ?)`,
      [filePath, req.user!.userId]
    );
    const backupId = result.insertId;

    try {
      // Build mysqldump command
      const host = process.env.DB_HOST || "localhost";
      const port = process.env.DB_PORT || "3306";
      const user = process.env.DB_USER || "root";
      const pass = process.env.DB_PASSWORD || "";

      // Use mysqldump via pipe to avoid password prompt
      const cmd = `"${process.env.MYSQLDUMP_PATH || 'mysqldump'}" -h ${host} -P ${port} -u ${user} ${pass ? `-p"${pass}"` : ""} --routines --triggers --single-transaction --default-character-set=utf8mb4 ${dbName} > "${filePath}"`;

      try {
        await execPromise(cmd, { timeout: 60000 });
      } catch (cliErr: any) {
        // Managed MySQL (Railway) uses caching_sha2_password, which the local
        // XAMPP/MariaDB mysqldump cannot authenticate with. Fall back to a
        // logical dump through the app's own mysql2 connection.
        console.warn("mysqldump unavailable; falling back to logical dump:", cliErr.message);
        if (fs.existsSync(filePath)) fs.rmSync(filePath);
        await createLogicalBackupFile(filePath, dbName);
      }

      // Get file stats
      const stats = fs.statSync(filePath);

      // Count approximate records
      const recordCount = await query<RowDataPacket[]>(
        `SELECT SUM(row_count) AS total FROM (
          SELECT COUNT(*) AS row_count FROM users UNION ALL
          SELECT COUNT(*) FROM students UNION ALL
          SELECT COUNT(*) FROM sections
        ) AS counts`
      );

      // Update as success
      await query<ResultSetHeader>(
        `UPDATE backups SET status = 'success', file_size = ?, record_count = ? WHERE id = ?`,
        [stats.size, recordCount[0]?.total || 0, backupId]
      );

      await logActivity(req.user!.userId, `Database backup created: ${filename}`, "backups", backupId);

      // Real-time notification: manual backup completed (SSE push, no refresh).
      createNotification({
        title: "Database Backup",
        message: `Manual backup completed successfully: ${filename} (${(stats.size / 1024).toFixed(1)} KB).`,
        type: "success",
      });
    } catch (execError: any) {
      // Mark as failed
      await query<ResultSetHeader>(
        "UPDATE backups SET status = 'failed' WHERE id = ?",
        [backupId]
      );

      console.error("Backup execution error:", execError.message);
      res.status(500).json({ error: `Backup failed: ${execError.message}` });
      return;
    }

    const backup = await query<RowDataPacket[]>(
      `SELECT * FROM backups WHERE id = ?`,
      [backupId]
    );

    res.status(201).json(backup[0]);
  } catch (error) {
    console.error("Create backup error:", error);
    res.status(500).json({ error: "Failed to create backup." });
  }
}

/**
 * POST /api/backups/:id/restore — Restore database from a backup file
 */
export async function restoreBackup(req: Request, res: Response): Promise<void> {
  try {
    const backupId = parseInt(req.params.id as string);
    if (isNaN(backupId)) {
      res.status(400).json({ error: "Invalid backup ID." });
      return;
    }

    // Get backup record
    const backups = await query<RowDataPacket[]>(
      `SELECT * FROM backups WHERE id = ?`,
      [backupId]
    );

    if (backups.length === 0) {
      res.status(404).json({ error: "Backup not found." });
      return;
    }

    const backup = backups[0];

    if (backup.status !== "success") {
      res.status(400).json({ error: "Cannot restore from a backup that is not marked as 'success'." });
      return;
    }

    const filePath = backup.file_path as string;

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: `Backup file not found at: ${filePath}` });
      return;
    }

    // Build mysql restore command
    const host = process.env.DB_HOST || "localhost";
    const port = process.env.DB_PORT || "3306";
    const user = process.env.DB_USER || "root";
    const pass = process.env.DB_PASSWORD || "";
    const dbName = process.env.DB_NAME || "hi5_portal";

    const raw = fs.readFileSync(filePath, "utf8");

    // Logical dumps (our fallback backups) are plain multi-statement SQL and
    // restore fine through the driver — which also handles the
    // caching_sha2_password auth that the local mysql CLI cannot.
    if (!/DELIMITER/i.test(raw)) {
      const conn = await mysql.createConnection({
        host,
        port: parseInt(port, 10),
        user,
        password: pass,
        database: dbName,
        multipleStatements: true,
        ssl: process.env.DB_SSL === "require" ? { rejectUnauthorized: false } : undefined,
        connectTimeout: 10_000,
      });
      try {
        await conn.query(raw);
      } finally {
        await conn.end();
      }

      await logActivity(req.user!.userId, `Database restored from backup #${backupId}`, "backups", backupId);
      res.json({ message: "Database restored successfully.", backup_id: backupId });
      return;
    }

    const cmd = `"${process.env.MYSQL_PATH || 'mysql'}" -h ${host} -P ${port} -u ${user} ${pass ? `-p"${pass}"` : ""} --default-character-set=utf8mb4 ${dbName} < "${filePath}"`;

    await execPromise(cmd, { timeout: 300000 }); // 5 min timeout for large restores

    await logActivity(req.user!.userId, `Database restored from backup #${backupId}`, "backups", backupId);

    res.json({ message: "Database restored successfully.", backup_id: backupId });
  } catch (error: any) {
    console.error("Restore backup error:", error);
    res.status(500).json({ error: `Restore failed: ${error.message || "Unknown error"}` });
  }
}

/**
 * GET /api/backups/:id/download — Download a successful backup .sql file
 */
export async function downloadBackup(req: Request, res: Response): Promise<void> {
  try {
    const backupId = parseInt(req.params.id as string);
    if (isNaN(backupId)) {
      res.status(400).json({ error: "Invalid backup ID." });
      return;
    }

    const backups = await query<RowDataPacket[]>(
      "SELECT * FROM backups WHERE id = ?",
      [backupId]
    );
    if (backups.length === 0) {
      res.status(404).json({ error: "Backup not found." });
      return;
    }

    const backup = backups[0];
    if (backup.status !== "success") {
      res.status(400).json({ error: "Only successful backups can be downloaded." });
      return;
    }

    const filePath = path.resolve(backup.file_path as string);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: `Backup file not found at: ${filePath}` });
      return;
    }

    const fileName = path.basename(filePath);
    await logActivity(req.user!.userId, `Downloaded database backup: ${fileName}`, "backups", backupId);
    res.download(filePath, fileName);
  } catch (error) {
    console.error("Download backup error:", error);
    res.status(500).json({ error: "Failed to download backup." });
  }
}
