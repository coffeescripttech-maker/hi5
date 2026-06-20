import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function runSeed() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "hi5_portal",
    multipleStatements: true,
  });

  const seedFile = path.resolve(__dirname, "../../seeds/seed.sql");
  const sql = fs.readFileSync(seedFile, "utf8");

  console.log("🌱 Seeding database...");

  try {
    await conn.query(sql);
    console.log("✅ Seed data inserted successfully.");
  } catch (error: any) {
    console.error("❌ Seed failed:", error.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

runSeed();
