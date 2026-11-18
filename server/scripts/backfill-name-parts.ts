/**
 * One-time backfill: populate students.last_name / first_name / middle_name /
 * name_ext from the stored full `name` using the shared name formatter.
 * Idempotent — only rows with a NULL last_name are touched.
 *
 * Run: npm run backfill:name-parts   (after migration 050)
 */
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
import { parseName } from "../src/utils/nameFormatter";

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "hi5_db",
  });
  const [rows] = await conn.query<any[]>(
    `SELECT id, name FROM students
      WHERE (last_name IS NULL OR first_name IS NULL) AND name IS NOT NULL`
  );
  let updated = 0;
  for (const row of rows) {
    const parts = parseName(String(row.name ?? ""));
    await conn.execute(
      `UPDATE students SET last_name = ?, first_name = ?, middle_name = ?, name_ext = ?
        WHERE id = ? AND last_name IS NULL`,
      [
        parts.last || null,
        parts.first || null,
        parts.middle || null,
        parts.ext || null,
        row.id,
      ]
    );
    updated++;
  }
  console.log(`✅ name parts backfilled for ${updated} student(s).`);
  await conn.end();
}

main().catch((e) => {
  console.error("Backfill failed:", e);
  process.exit(1);
});
