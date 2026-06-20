import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");

async function runMigrations() {
  // Connect without database first to create it if needed
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    multipleStatements: true,
  });

  const dbName = process.env.DB_NAME || "hi5_portal";

  // Create database if not exists
  await conn.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  console.log(`✅ Database "${dbName}" ready`);

  await conn.changeUser({ database: dbName });

  // Track migrations
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at DATETIME DEFAULT NOW()
    )
  `);

  // Get all SQL migration files
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("⚠️  No migration files found.");
    await conn.end();
    return;
  }

  // Get already executed migrations
  const [executed] = await conn.execute<any[]>("SELECT filename FROM _migrations");
  const executedSet = new Set(executed.map((r: any) => r.filename));

  let count = 0;

  for (const file of files) {
    if (executedSet.has(file)) {
      console.log(`⏭️  Skipping ${file} (already executed)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    console.log(`▶️  Running ${file}...`);

    try {
      await conn.query(sql);
      await conn.execute("INSERT INTO _migrations (filename) VALUES (?)", [file]);
      console.log(`✅ ${file} completed`);
      count++;
    } catch (error: any) {
      console.error(`❌ ${file} failed:`, error.message);
      await conn.end();
      process.exit(1);
    }
  }

  console.log(`\n🎉 Migration complete. ${count} new migration(s) executed.`);
  await conn.end();
}

runMigrations();
