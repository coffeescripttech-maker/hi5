import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

/**
 * Creates (or resets) ONE enrollment_committee user for manual browser testing.
 * Idempotent: safe to re-run. Does not touch any other user or data.
 */
async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "hi5_portal",
    connectTimeout: 30000,
  });

  const username = process.argv[2] || "committee01";
  const password = process.argv[3] || "password123";
  const fullName = process.argv[4] || "Committee Test Account";
  const email = process.argv[5] || "committee01@hi5.local";

  const hash = await bcrypt.hash(password, 10);

  const [existing] = await conn.query("SELECT id FROM users WHERE username = ?", [username]);
  if (existing.length > 0) {
    await conn.query(
      "UPDATE users SET password_hash = ?, name = ?, role = 'enrollment_committee', status = 'active' WHERE username = ?",
      [hash, fullName, username]
    );
    console.log(`reset existing committee user: ${username}`);
  } else {
    await conn.query(
      `INSERT INTO users (username, password_hash, name, email, role, status)
       VALUES (?, ?, ?, ?, 'enrollment_committee', 'active')`,
      [username, hash, fullName, email]
    );
    console.log(`created committee user: ${username}`);
  }

  const [final] = await conn.query(
    "SELECT id, username, name, role, status FROM users WHERE username = ?",
    [username]
  );
  console.log(JSON.stringify(final, null, 1));
  console.log(`\nlogin with: ${username} / ${password}`);

  await conn.end();
}

main();
