const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const mysql = require("mysql2/promise");

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "require" ? { rejectUnauthorized: false } : undefined,
  });
  const q = async (sql, p) => (await pool.execute(sql, p))[0];

  const sys = await q("SELECT id FROM school_years WHERE sy_label REGEXP '^T[0-9]{8}$'");
  const syIds = sys.map(r => r.id);
  const users = await q("SELECT id FROM users WHERE email LIKE '%@test.local'");
  const userIds = users.map(r => r.id);

  let studIds = [];
  if (syIds.length) {
    const ph = syIds.map(() => "?").join(",");
    const st = await q(`SELECT DISTINCT student_id FROM enrollments WHERE school_year_id IN (${ph})`, syIds);
    studIds = st.map(r => r.student_id);
    // Also catch display-id style students not yet enrolled.
    const st2 = await q("SELECT id FROM students WHERE student_id LIKE 'TS-%'");
    for (const r of st2) if (!studIds.includes(r.id)) studIds.push(r.id);

    await q(`DELETE FROM sectioning_history WHERE school_year_id IN (${ph})`, syIds);
    await q(`DELETE FROM grades WHERE school_year_id IN (${ph})`, syIds);
    await q(`DELETE FROM student_classifications WHERE school_year_id IN (${ph})`, syIds);
    await q(`DELETE FROM enrollments WHERE school_year_id IN (${ph})`, syIds);
  }
  if (studIds.length) {
    const ph = studIds.map(() => "?").join(",");
    await q(`DELETE FROM students WHERE id IN (${ph})`, studIds);
  }
  // Test sections: only those matching our naming pattern and now unreferenced.
  const secRows = await q("SELECT id FROM sections WHERE name REGEXP '^ST[0-9]{8}(A|B|STE|SPFL|G8)$'");
  for (const r of secRows) {
    const ref = await q("SELECT COUNT(*) c FROM enrollments WHERE section_id = ?", [r.id]);
    if (Number(ref[0].c) === 0) await q("DELETE FROM sections WHERE id = ?", [r.id]);
  }
  if (syIds.length) {
    const ph = syIds.map(() => "?").join(",");
    await q(`DELETE FROM school_years WHERE id IN (${ph})`, syIds);
  }
  if (userIds.length) {
    const ph = userIds.map(() => "?").join(",");
    await q(`DELETE FROM activity_logs WHERE user_id IN (${ph})`, userIds);
    await q(`DELETE FROM users WHERE id IN (${ph})`, userIds);
  }

  console.log(`Cleaned: ${syIds.length} SY, ${studIds.length} students, ${secRows.length} candidate sections, ${userIds.length} users.`);
  await pool.end();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
