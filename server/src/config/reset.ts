import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");
const BASE_SEED_FILE = path.resolve(__dirname, "../../seeds/seed.base.sql");

/**
 * `npm run db:reset`
 *
 * Wipes the database completely and rebuilds it from scratch:
 *   1. DROP + recreate the database (utf8mb4)
 *   2. Run every migration in server/migrations/
 *   3. Apply the base seed (seed.base.sql) — admin-only clean start
 *
 * Use this to start over with a clean, single-admin system.
 * NOTE: this permanently deletes ALL data in the configured database.
 */
async function dbReset() {
  const host = process.env.DB_HOST || "localhost";
  const port = parseInt(process.env.DB_PORT || "3306");
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const dbName = process.env.DB_NAME || "hi5_portal";

  console.log(`♻️  Resetting database "${dbName}" ...`);

  // Connect WITHOUT a database so the DB itself can be dropped/recreated
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true,
  });

  try {
    // 1. Drop + recreate
    await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    await conn.query(
      `CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`✅ Database dropped and recreated.`);

    await conn.changeUser({ database: dbName });

    // 2. Track migrations
    await conn.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at DATETIME DEFAULT NOW()
      )
    `);

    // 3. Run every migration from scratch
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let count = 0;
    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      try {
        await conn.query(sql);
        await conn.query("INSERT INTO _migrations (filename) VALUES (?)", [file]);
        console.log(`✅ ${file}`);
        count++;
      } catch (error: any) {
        console.error(`❌ ${file} failed:`, error.message);
        throw error;
      }
    }
    console.log(`✅ ${count} migration(s) applied.`);

    // 4. Base seed (admin-only clean start)
    if (!fs.existsSync(BASE_SEED_FILE)) {
      throw new Error(`Base seed file not found: ${BASE_SEED_FILE}`);
    }
    const baseSql = fs.readFileSync(BASE_SEED_FILE, "utf8");
    await conn.query(baseSql);
    console.log("✅ Base seed applied (admin-only clean start).");

    console.log("\n🎉 Database reset complete.");
    console.log(`   Login:      admin / password123`);
    console.log(`   School yr:  2025-2026 (current)`);
    console.log(`   All other data is empty — build it through the UI.`);
  } catch (error: any) {
    console.error("\n❌ Reset failed:", error.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

dbReset();
