/**
 * Database backup helpers.
 *
 * Managed MySQL 8 servers (e.g. Railway) authenticate with
 * caching_sha2_password, which the XAMPP/MariaDB mysqldump client cannot load.
 * The app's mysql2 driver implements that plugin in JS, so we fall back to a
 * "logical dump" generated through the app connection whenever the CLI
 * mysqldump is unavailable. The output is valid SQL and restorable via the
 * driver (or the mysql CLI).
 */
import fs from "fs";
import path from "path";
import { getConnection } from "../config/database";

/**
 * Where backup .sql files are written. Resolves to <project-root>/backups no
 * matter whether the server runs from src/ (tsx) or dist/ (compiled), and
 * independent of `__dirname`, so paths stay stable across deployments.
 */
export const BACKUP_DIR = path.resolve(process.cwd(), process.env.BACKUP_DIR || "backups");

// Ensure the backup directory exists.
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/** Escape a single value as a MySQL string/number literal for a dump file. */
function sqlLiteral(value: any): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `'${value.getFullYear()}-${p(value.getMonth() + 1)}-${p(value.getDate())} ${p(value.getHours())}:${p(value.getMinutes())}:${p(value.getSeconds())}'`;
  }
  if (Buffer.isBuffer(value)) return `X'${value.toString("hex")}'`;
  if (Array.isArray(value) || typeof value === "object") {
    return `'${JSON.stringify(value).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
  }
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

/**
 * Generate a full logical dump for the current database over the provided
 * pool connection (transparent TLS/plugin handling via mysql2).
 */
export async function generateLogicalDump(conn: any, dbName: string): Promise<string> {
  const lines: string[] = [];
  lines.push("-- Hi5 Portal logical backup");
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push(`-- Database: ${dbName}`);
  lines.push("");
  lines.push("/*!40101 SET NAMES utf8mb4 */;");
  lines.push("SET FOREIGN_KEY_CHECKS=0;");
  // Relax the session sql_mode so a stray value that does not exactly match an
  // ENUM (e.g. '' in student_classifications) degrades to a warning instead of
  // aborting the whole restore under strict sql_mode.
  lines.push("SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='';");
  lines.push(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  lines.push(`USE \`${dbName}\`;`);
  lines.push("");

  const [tables] = await conn.query("SHOW TABLES");
  const rows: any[] = tables as any[];
  const nameKey = rows.length > 0 ? Object.keys(rows[0])[0] : null;

  const tablesToDump: string[] = [];
  for (const row of rows) {
    const t = nameKey ? row[nameKey] : undefined;
    if (t === undefined) continue;
    const [create] = await conn.query(`SHOW CREATE TABLE \`${t}\``);
    const stmt = create[0]?.["Create Table"];
    if (typeof stmt === "string") {
      tablesToDump.push(t);
      lines.push(`DROP TABLE IF EXISTS \`${t}\`;`);
      lines.push(stmt + ";");
      lines.push("");
    } else {
      console.warn(`[dbBackup] Skipping non-table object (views are not dumped): ${t}`);
    }
  }

  for (const table of tablesToDump) {
    const [data] = await conn.query(`SELECT * FROM \`${table}\``);
    for (const r of data as any[]) {
      const cols = Object.keys(r);
      const values = cols.map(c => sqlLiteral(r[c])).join(", ");
      lines.push(`INSERT INTO \`${table}\` (\`${cols.join("\`,\`")}\`) VALUES (${values});`);
    }
  }

  lines.push("");
  lines.push("SET SQL_MODE=@OLD_SQL_MODE;");
  lines.push("SET FOREIGN_KEY_CHECKS=1;");
  return lines.join("\n");
}

/**
 * Write a logical dump file for the configured database using the app's own
 * connection. Used as a fallback when mysqldump is unavailable.
 */
export async function createLogicalBackupFile(filePath: string, dbName: string): Promise<void> {
  const conn = await getConnection();
  try {
    const sql = await generateLogicalDump(conn, dbName);
    fs.writeFileSync(filePath, sql, "utf8");
  } finally {
    conn.release();
  }
}