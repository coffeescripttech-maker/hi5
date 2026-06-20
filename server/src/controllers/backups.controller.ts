import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { exec } from "child_process";
import path from "path";
import fs from "fs";
import util from "util";

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
      const cmd = `"${process.env.MYSQLDUMP_PATH || 'mysqldump'}" -h ${host} -P ${port} -u ${user} ${pass ? `-p"${pass}"` : ""} --routines --triggers --single-transaction ${dbName} > "${filePath}"`;

      await execPromise(cmd, { timeout: 60000 });

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
