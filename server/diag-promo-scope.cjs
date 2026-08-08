const mysql = require("mysql2/promise");
require("dotenv").config({ path: require("path").resolve(__dirname, ".env") });

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "hi5_portal",
  });
  const [promos] = await conn.query(
    `SELECT p.id, sec.name AS section, p.promoted_by, u.username, u.role,
            p.status, p.to_grade_level, sy.sy_label
     FROM promotions p
     JOIN sections sec ON p.section_id = sec.id
     JOIN users u ON p.promoted_by = u.id
     JOIN school_years sy ON p.school_year_id = sy.id
     ORDER BY p.id`
  );
  console.log("=== ALL PROMOTIONS ===");
  console.table(promos);
  const [teachers] = await conn.query(
    `SELECT id, username, name FROM users WHERE role = 'teacher' ORDER BY id`
  );
  console.log("=== TEACHERS ===");
  console.table(teachers);
  await conn.end();
})().catch(e => { console.error(e.message); process.exit(1); });
