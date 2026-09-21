import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();
const c = await mysql.createConnection({
  host: process.env.DB_HOST, port: +process.env.DB_PORT,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
});
const [sy] = await c.query("SELECT id, sy_label, is_current FROM school_years ORDER BY id");
console.log("SCHOOL_YEARS:", JSON.stringify(sy));
const [en] = await c.query("SELECT school_year_id, status, section_id IS NULL AS unassigned, COUNT(*) n FROM enrollments GROUP BY school_year_id, status, unassigned");
console.log("ENROLLMENTS:", JSON.stringify(en));
const [cur] = await c.query("SELECT id, sy_label FROM school_years WHERE is_current = 1 LIMIT 1");
console.log("CURRENT SY:", JSON.stringify(cur));
if (cur.length) {
  const [q] = await c.query(
    `SELECT e.id enrollment_id, e.student_id, e.program, e.status, s.name, s.grade_level, s.sex
     FROM enrollments e JOIN students s ON e.student_id = s.id
     WHERE e.school_year_id = ? AND e.section_id IS NULL AND e.status = 'enrolled'`,
    [cur[0].id]
  );
  console.log("QUEUE ROWS:", q.length, JSON.stringify(q.slice(0, 10)));
}
const [sec] = await c.query("SELECT id, name, grade_level, section_type, capacity, current_count, is_active FROM sections ORDER BY grade_level, id LIMIT 30");
console.log("SECTIONS:", JSON.stringify(sec));
await c.end();
