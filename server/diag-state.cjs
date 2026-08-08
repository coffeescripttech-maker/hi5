const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const path = require("path");
dotenv.config({ path: path.join(process.cwd(), ".env") });
async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost", port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "root", password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "hi5_portal",
  });
  const [stu] = await pool.query("SELECT id, name, status, grade_level FROM students ORDER BY id");
  console.log("=== STUDENTS ==="); console.table(stu);
  const [enr] = await pool.query(`SELECT e.id, e.student_id, e.section_id, e.school_year_id, e.status, sy.sy_label
    FROM enrollments e JOIN school_years sy ON sy.id=e.school_year_id WHERE sy.is_current=1 ORDER BY e.id`);
  console.log("=== ENROLLMENTS (current SY) ==="); console.table(enr);
  const [pro] = await pool.query("SELECT id, section_id, school_year_id, to_grade_level, status FROM promotions ORDER BY id DESC LIMIT 5");
  console.log("=== RECENT PROMOTIONS ==="); console.table(pro);
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
