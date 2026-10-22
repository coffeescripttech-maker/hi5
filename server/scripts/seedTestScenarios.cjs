/**
 * Safe, idempotent test-data seeder for the six curriculum scenarios:
 *   A JHS Regular | B JHS STE | C JHS SPFL | D SHS Regular | E SHS TVL | F ALS
 *
 * - Targets the DB configured in server/.env (printed before any write).
 * - Never touches existing records: only creates students/enrollments with a
 *   "TEST_" name prefix, unique TEST- student codes, and TEST- LRNs.
 * - Grades are created THROUGH the running API (admin auth) and only for
 *   subjects the grades API marks `in_offering` — so subject eligibility uses
 *   the app's real scoping rules, never a hardcoded subject list.
 * - Idempotent: rerunning skips students/enrollments that already exist and
 *   upserts (does not duplicate) grade rows. Existing non-test grades on the
 *   same test students are left untouched.
 *
 * Usage (from server/):
 *   node scripts/seedTestScenarios.cjs           # dry-run, prints the plan
 *   node scripts/seedTestScenarios.cjs --apply   # actually create the rows
 */
const path = require("path");
const fs = require("fs");
const mysql = require(path.join(__dirname, "../node_modules/mysql2/promise"));

// .env values (no dotenv dependency needed)
const env = {};
for (const line of fs.readFileSync(path.join(__dirname, "../.env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const APPLY = process.argv.includes("--apply");
const API = process.env.SEED_API_URL || "http://localhost:3001/api";

const jwt = require(path.join(__dirname, "../node_modules/jsonwebtoken"));
const adminTok = jwt.sign(
  { userId: 1, username: "admin", role: "admin" },
  env.JWT_SECRET || "hi5_portal_dev_secret_key_2026",
  { expiresIn: "1h" }
);

const SY_ID = 2; // 2026-2027 (is_current = 1) — verified below before any write

/** Scenarios reuse existing curriculum records/sections; subject sets come from the API. */
const SCENARIOS = [
  { key: "A", label: "TEST_A JHS Regular Learner", grade: 7, sectionId: 13, program: "regular", track: null },
  { key: "B", label: "TEST_B JHS STE Learner", grade: 7, sectionId: 2, program: "ste", track: null },
  { key: "C", label: "TEST_C JHS SPFL Learner", grade: 7, sectionId: 16, program: "spfl", track: null },
  { key: "D", label: "TEST_D SHS Regular Learner", grade: 11, sectionId: 26, program: "regular", track: null },
  { key: "E", label: "TEST_E SHS TVL Learner", grade: 11, sectionId: 26, program: "regular", track: 10 }, // TVL track id 10
  { key: "F", label: "TEST_F ALS Learner", grade: 7, sectionId: 13, program: "als_jhs", track: null },
];

async function apiGet(urlPart) {
  const r = await fetch(API + urlPart, { headers: { Authorization: `Bearer ${adminTok}` } });
  const t = await r.text();
  let p; try { p = JSON.parse(t); } catch { p = t; }
  return { status: r.status, payload: p };
}

async function apiPost(urlPart, body) {
  const r = await fetch(API + urlPart, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminTok}` },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  let p; try { p = JSON.parse(t); } catch { p = t; }
  return { status: r.status, payload: p };
}

(async () => {
  const conn = await mysql.createConnection({
    host: env.DB_HOST, port: Number(env.DB_PORT || 3306), user: env.DB_USER,
    password: env.DB_PASSWORD, database: env.DB_NAME,
    ssl: { rejectUnauthorized: false },
  });

  const [target] = await conn.query(
    "SELECT DATABASE() d, @@hostname h, id, is_current, sy_label FROM school_years WHERE id = ?",
    [SY_ID]
  );
  const t = target[0];
  console.log("=== TARGET DB:", t.d, "@", t.h, "| SY", SY_ID, `(${t.sy_label})`, "is_current:", t.is_current);
  if (t.is_current !== 1) { console.error("SY id is not current — aborting."); await conn.end(); process.exit(1); }
  console.log("=== MODE:", APPLY ? "APPLY -- writing test data" : "DRY-RUN (pass --apply to write)");

  const results = [];
  for (const sc of SCENARIOS) {
    // idempotency: student already seeded?
    const [existingStudent] = await conn.query(
      "SELECT id FROM students WHERE name = ? LIMIT 1", [sc.label]
    );
    let studentId = existingStudent.length ? existingStudent[0].id : null;
    let createdStudent = false, createdEnrollment = false;

    const [section] = await conn.query(
      "SELECT id, name, grade_level, section_type FROM sections WHERE id = ? AND is_active = 1", [sc.sectionId]
    );
    if (section.length === 0) { console.error(`SECTION ${sc.sectionId} missing — cannot seed ${sc.key}`); results.push({ sc, ok: false, error: "section missing" }); continue; }

    if (!APPLY) {
      results.push({ sc, ok: true, studentId, grades: "(dry-run)" });
      continue;
    }

    const tx = await conn.beginTransaction();
    try {
      if (studentId == null) {
        const [nextId] = await conn.query(
          "SELECT IFNULL(MAX(CAST(SUBSTRING(student_id, 6) AS UNSIGNED)), 0) + 1 AS n FROM students WHERE student_id LIKE 'TEST-A-%' OR student_id LIKE 'TEST-%'"
        );
        const seq = String(nextId[0].n).padStart(4, "0");
        const lrn = "9500000000" + sc.key;
        const displayName = sc.label;
        const [ins] = await conn.query(
          `INSERT INTO students (student_id, lrn, name, grade_level, sex, birthdate, guardian, status)
           VALUES (?, ?, ?, ?, 'male', '2011-06-15', 'TEST Guardian', 'enrolled')`,
          [`TEST-${sc.key}-${seq}`, lrn, displayName, sc.grade]
        );
        studentId = ins.insertId;
        createdStudent = true;
      }
      // enrollment (idempotent per student + SY)
      const [ent] = await conn.query(
        "SELECT id FROM enrollments WHERE student_id = ? AND school_year_id = ? LIMIT 1",
        [studentId, SY_ID]
      );
      if (ent.length === 0) {
        await conn.query(
          `INSERT INTO enrollments (student_id, section_id, school_year_id, program, strand_track_id, enrollment_date, enrolled_by, status)
           VALUES (?, ?, ?, ?, ?, CURDATE(), 1, 'enrolled')`,
          [studentId, sc.sectionId, SY_ID, sc.program, sc.track]
        );
        createdEnrollment = true;
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      console.error(`SEED FAIL ${sc.key}:`, e.message);
      results.push({ sc, ok: false, error: e.message });
      continue;
    }

    // Grade rows via the API, only for subjects the API marks in_offering
    const g = await apiGet(`/grades?student_id=${studentId}&school_year_id=${SY_ID}`);
    if (g.status !== 200) { console.error(`GRADES LIST FAIL ${sc.key}:`, JSON.stringify(g.payload).slice(0, 200)); results.push({ sc, ok: false, error: "grades list failed" }); continue; }
    const offering = (g.payload.subjects || []).filter(s => s.in_offering === 1);
    let saved = 0, failed = 0;
    for (let i = 0; i < offering.length; i++) {
      const base = 85 + (i % 5);
      for (const q of [1, 2, 3]) {
        const grade = Math.min(97, base + q);
        const up = await apiPost("/grades", { student_id: studentId, subject_id: offering[i].subject_id, school_year_id: SY_ID, quarter: q, grade });
        if (up.status === 200) saved++; else { failed++; console.error(`  grade fail ${sc.key} sub=${offering[i].subject_id} q${q}:`, JSON.stringify(up.payload).slice(0, 120)); }
      }
    }
    console.log(`[${sc.key}] ${sc.label} student=${studentId} (student:${createdStudent ? "created" : "exists"}, enrollment:${createdEnrollment ? "created" : "exists"}) — subjects=${offering.length}, gradeRows=${saved}${failed ? `, FAILED=${failed}` : ""}`);
    console.log(`   subjects: ${offering.map(s => s.subject_name).join(" | ")}`);
    results.push({ sc, ok: failed === 0, studentId, subjects: offering.map(s => s.subject_name), saved, failed });
  }

  if (!APPLY) {
    console.log("=== DRY-RUN PLAN:");
    for (const r of results) console.log(`  ${r.sc.key} -> ${r.sc.label} | GL${r.sc.grade} | section ${r.sc.sectionId} | program ${r.sc.program} | track ${r.sc.track ?? "-"} | ${r.ok ? "ok" : "MISSING SECTION"}`);
    console.log("No data written.");
  } else {
    console.log("=== SUMMARY:");
    for (const r of results) console.log(`  ${r.sc.key}: ${r.ok ? "OK" : "FAILED"} ${r.studentId ? `(student ${r.studentId})` : ""} ${r.error || ""}`);
    console.log(`TEST student ids: ${results.filter(r => r.studentId).map(r => `${r.sc.key}=${r.studentId}`).join(", ")}`);
  }
  await conn.end();
})().catch(e => { console.error("FATAL", e); process.exit(1); });
