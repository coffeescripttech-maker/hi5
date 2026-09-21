/**
 * Idempotent test-data seeder for the Registrar Auto-Sectioning workflows.
 *
 * Adds, for the CURRENT school year:
 *   - SPFL + extra Regular sections for G7-G10 (and Regular for G11/G12)
 *   - ~23 test students with UNASSIGNED (section_id NULL) enrollments so they
 *     appear in the Pending Section Queue at /registrar/section-assignment
 *   - Grades (mixed pass/fail) so STE/SPFL eligibility is meaningful
 *   - Entrance-exam / interview evidence (mix of passed / not-recorded)
 *   - Prior-year G11 enrollments so the Carry-Over (G11->G12) flow works
 *   - A few student classifications (4Ps / PWD)
 *
 * Safe to run repeatedly: every insert is guarded by an existence check.
 * Test records use student_id / LRN prefixed distinctly so they are easy to
 * spot (and delete) later.
 *
 * Run:  npx tsx seeds/seed.sectioning-test.ts
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const conn = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 3,
    waitForConnections: true,
    connectTimeout: 20_000,
  });

  /** Re-run a query up to 4 times on transient connection resets. */
  async function q(sql: string, params?: any[]) {
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        return await conn.query(sql, params);
      } catch (err: any) {
        if (err && (err.code === "ECONNRESET" || err.code === "PROTOCOL_CONNECTION_LOST") && attempt < 4) {
          await new Promise(r => setTimeout(r, 750 * attempt));
          continue;
        }
        throw err;
      }
    }
    throw new Error("unreachable");
  }

  // ------------------------------------------------------------------
  // Reference lookups
  // ------------------------------------------------------------------
  async function getCurrentSY(): Promise<number> {
    const [rows] = await q("SELECT id FROM school_years WHERE is_current = 1 LIMIT 1");
    if ((rows as any[]).length === 0) throw new Error("No current SY set.");
    return (rows as any[])[0].id;
  }

  async function getRegistrarId(): Promise<number> {
    const [rows] = await q("SELECT id FROM users WHERE role = 'registrar' AND status = 'active' LIMIT 1");
    if ((rows as any[]).length === 0) throw new Error("No active registrar user.");
    return (rows as any[])[0].id;
  }

  async function sectionExists(name: string): Promise<boolean> {
    const [r] = await q("SELECT id FROM sections WHERE name = ? LIMIT 1", [name]);
    return (r as any[]).length > 0;
  }

  async function studentExists(lrn: string): Promise<boolean> {
    const [r] = await q("SELECT id FROM students WHERE lrn = ? LIMIT 1", [lrn]);
    return (r as any[]).length > 0;
  }

  async function enrollmentExists(studentId: number, sy: number): Promise<boolean> {
    const [r] = await q(
      "SELECT id FROM enrollments WHERE student_id = ? AND school_year_id = ? LIMIT 1",
      [studentId, sy]
    );
    return (r as any[]).length > 0;
  }

  async function addSection(name: string, grade: number, type: string, current = 0): Promise<number> {
    if (await sectionExists(name)) {
      const [r] = await q("SELECT id FROM sections WHERE name = ? LIMIT 1", [name]);
      return (r as any[])[0].id;
    }
    const [r] = await q(
      "INSERT INTO sections (name, grade_level, section_type, capacity, current_count, min_average) VALUES (?, ?, ?, 45, ?, 75)",
      [name, grade, type, current]
    );
    return (r as any).insertId;
  }

  async function addStudent(
    displayId: string,
    lrn: string,
    name: string,
    grade: number,
    sex: "male" | "female"
  ): Promise<number> {
    if (await studentExists(lrn)) {
      const [r] = await q("SELECT id FROM students WHERE lrn = ? LIMIT 1", [lrn]);
      return (r as any[])[0].id;
    }
    const birthYear = 2026 - grade - 6;
    const birth = `${birthYear}-06-15`;
    const [r] = await q(
      `INSERT INTO students (student_id, lrn, name, grade_level, sex, birthdate, address, guardian, contact, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Test St., Manila', 'Test Guardian', '09171234567', 'enrolled')`,
      [displayId, lrn, name, grade, sex, birth]
    );
    return (r as any).insertId;
  }

  async function addEnrollment(
    studentId: number,
    sy: number,
    program: string,
    opts: {
      enrolledBy: number;
      sectionId?: number | null;
      examGrade?: number | null;
      examPassed?: boolean | null;
      interviewPassed?: boolean | null;
      status?: string;
      date?: string;
    }
  ): Promise<number> {
    if (await enrollmentExists(studentId, sy)) {
      const [r] = await q(
        "SELECT id FROM enrollments WHERE student_id = ? AND school_year_id = ? LIMIT 1",
        [studentId, sy]
      );
      return (r as any[])[0].id;
    }
    const [r] = await q(
      `INSERT INTO enrollments
         (student_id, school_year_id, program, section_id, status, enrollment_date, enrolled_by, entrance_exam_grade, entrance_exam_passed, interview_passed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        studentId,
        sy,
        program,
        opts.sectionId ?? null,
        opts.status ?? "enrolled",
        opts.date ?? "2026-06-15",
        opts.enrolledBy,
        opts.examGrade ?? null,
        opts.examPassed === null ? null : opts.examPassed ? 1 : 0,
        opts.interviewPassed === null ? null : opts.interviewPassed ? 1 : 0,
      ]
    );
    return (r as any).insertId;
  }

  async function addGrades(
    enrollmentId: number,
    studentId: number,
    gradeLevel: number,
    sy: number,
    defGrade: number,
    overrides: Record<string, number> = {}
  ): Promise<void> {
    const [existing] = (await q("SELECT COUNT(*) AS n FROM grades WHERE enrollment_id = ?", [enrollmentId])) as any[];
    if (existing[0].n > 0) return; // already seeded for this enrollment
    const [subs] = await q("SELECT id, name FROM subjects WHERE grade_level = ? AND is_active = 1", [gradeLevel]);
    const values: any[] = [];
    for (const s of subs as any[]) {
      const value = overrides[s.name] ?? defGrade;
      for (let qtr = 1; qtr <= 4; qtr++) {
        values.push([studentId, s.id, enrollmentId, sy, qtr, value, 1]);
      }
    }
    if (values.length > 0) {
      const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ");
      await q(
        `INSERT INTO grades (student_id, subject_id, enrollment_id, school_year_id, quarter, grade, is_locked) VALUES ${placeholders}`,
        values.flat()
      );
    }
  }

  async function addClassification(studentId: number, sy: number, classification: string): Promise<void> {
    const [r] = await q(
      "SELECT id FROM student_classifications WHERE student_id = ? AND school_year_id = ? AND classification = ? LIMIT 1",
      [studentId, sy, classification]
    );
    if ((r as any[]).length === 0) {
      await q(
        "INSERT INTO student_classifications (student_id, classification, school_year_id) VALUES (?, ?, ?)",
        [studentId, classification, sy]
      );
    }
  }

  // ------------------------------------------------------------------
  // Seeding
  // ------------------------------------------------------------------
  const SY = await getCurrentSY();
  const registrarId = await getRegistrarId();
  console.log(`Current SY id=${SY}, enrolled_by=user#${registrarId}`);

  // 1) Sections
  console.log("\nâ€” Adding sections â€”");
  await addSection("7-Diligence", 7, "regular");
  await addSection("7-Hero", 7, "regular");
  await addSection("7-Ilang-Ilang", 7, "spfl");
  await addSection("8-Masipag", 8, "regular");
  await addSection("8-Matibay", 8, "regular");
  await addSection("8-Rosal", 8, "spfl");
  await addSection("9-Masigasig", 9, "regular");
  await addSection("9-Maithin", 9, "regular");
  await addSection("9-Ilang-Ilang", 9, "spfl");
  await addSection("10-Masaya", 10, "regular");
  await addSection("10-Masipag", 10, "regular");
  await addSection("10-Rosal", 10, "spfl");
  await addSection("11-Matatag", 11, "regular");
  await addSection("12-Masipag", 12, "regular");
  console.log("  13 sections added / ensured.");

  // 2) Students + current-SY enrollments + grades
  console.log("\nâ€” Adding JHS Regular students (Random Distribution) â€”");
  type S = { display: string; lrn: string; name: string; grade: number; sex: "male" | "female"; avg: number };
  const regularJHS: S[] = [
    { display: "TST-7-01", lrn: "900000000001", name: "Jenna Ramos",       grade: 7,  sex: "female", avg: 95 },
    { display: "TST-7-02", lrn: "900000000002", name: "Nino Villanueva",   grade: 7,  sex: "male",   avg: 78 },
    { display: "TST-7-03", lrn: "900000000003", name: "Sofia Macaraeg",    grade: 7,  sex: "female", avg: 90 },
    { display: "TST-8-01", lrn: "900000000004", name: "Andrei Cruz",       grade: 8,  sex: "male",   avg: 88 },
    { display: "TST-8-02", lrn: "900000000005", name: "Bea Sta. Ana",      grade: 8,  sex: "female", avg: 85 },
    { display: "TST-8-03", lrn: "900000000006", name: "Marco Reyes",       grade: 8,  sex: "male",   avg: 76 },
    { display: "TST-9-01", lrn: "900000000007", name: "Camille Ortiz",     grade: 9,  sex: "female", avg: 92 },
    { display: "TST-9-02", lrn: "900000000008", name: "Jules Aquino",      grade: 9,  sex: "male",   avg: 83 },
    { display: "TST-9-03", lrn: "900000000009", name: "Lea Domingo",       grade: 9,  sex: "female", avg: 89 },
    { display: "TST-10-01", lrn: "900000000010", name: "Paolo Reyes",      grade: 10, sex: "male",   avg: 87 },
    { display: "TST-10-02", lrn: "900000000011", name: "Rhea Bautista",    grade: 10, sex: "female", avg: 90 },
    { display: "TST-10-03", lrn: "900000000012", name: "Ivan Torres",      grade: 10, sex: "male",   avg: 80 },
  ];
  for (const s of regularJHS) {
    const id = await addStudent(s.display, s.lrn, s.name, s.grade, s.sex);
    const en = await addEnrollment(id, SY, "regular", { enrolledBy: registrarId, examPassed: null, interviewPassed: null });
    await addGrades(en, id, s.grade, SY, s.avg);
    if (s.lrn === "900000000002") await addClassification(id, SY, "4ps");
    if (s.lrn === "900000000011") await addClassification(id, SY, "pwd");
    console.log(`  G${s.grade} ${s.name.padEnd(18)} ${s.display} (GA ~${s.avg})`);
  }

  console.log("\nâ€” Adding STE applicants (Placement) â€”");
  const steApplicants: Array<S & { exam: boolean | null; interview: boolean | null; over?: Record<string, number> }> = [
    { display: "TST-S-01", lrn: "900000000013", name: "Kyla Santos",   grade: 7,  sex: "female", avg: 93, exam: true, interview: true },
    { display: "TST-S-02", lrn: "900000000014", name: "Marco Diaz",    grade: 8,  sex: "male",   avg: 90, exam: true, interview: true,
      over: { Science: 80, "Advanced Science": 80 } },
    { display: "TST-S-03", lrn: "900000000015", name: "Angela Tan",    grade: 9,  sex: "female", avg: 95, exam: true, interview: true },
    { display: "TST-S-04", lrn: "900000000016", name: "Kevin Yu",      grade: 10, sex: "male",   avg: 92, exam: null, interview: true },
  ];
  for (const s of steApplicants) {
    const id = await addStudent(s.display, s.lrn, s.name, s.grade, s.sex);
    const en = await addEnrollment(id, SY, "ste", {
      enrolledBy: registrarId,
      examGrade: 92,
      examPassed: s.exam,
      interviewPassed: s.interview,
    });
    await addGrades(en, id, s.grade, SY, s.avg, s.over);
    console.log(`  G${s.grade} ${s.name.padEnd(18)} ${s.display} exam=${s.exam} interview=${s.interview} ${s.over ? "(deliberate low grade)" : ""}`);
  }

  console.log("\nâ€” Adding SPFL applicants (Placement) â€”");
  const spflApplicants: Array<S & { exam: boolean | null; interview: boolean | null; over?: Record<string, number> }> = [
    { display: "TST-F-01", lrn: "900000000017", name: "Bea Lim",      grade: 7,  sex: "female", avg: 90, exam: true, interview: true },
    { display: "TST-F-02", lrn: "900000000018", name: "Diego Manalo", grade: 8,  sex: "male",   avg: 90, exam: true, interview: true,
      over: { Filipino: 80 } },
    { display: "TST-F-03", lrn: "900000000019", name: "Elisa Flores", grade: 9,  sex: "female", avg: 90, exam: true, interview: true },
    { display: "TST-F-04", lrn: "900000000020", name: "Nathan Gomez", grade: 10, sex: "male",   avg: 90, exam: true, interview: null },
  ];
  for (const s of spflApplicants) {
    const id = await addStudent(s.display, s.lrn, s.name, s.grade, s.sex);
    const en = await addEnrollment(id, SY, "spfl", {
      enrolledBy: registrarId,
      examGrade: 90,
      examPassed: s.exam,
      interviewPassed: s.interview,
    });
    await addGrades(en, id, s.grade, SY, s.avg, s.over);
    console.log(`  G${s.grade} ${s.name.padEnd(18)} ${s.display} exam=${s.exam} interview=${s.interview} ${s.over ? "(deliberate low grade)" : ""}`);
  }

  console.log("\nâ€” Adding returning G11->G12 students (Carry-Over) â€”");
  const g11Ste = (await q("SELECT id FROM sections WHERE name = '11-Maasahan' LIMIT 1"))[0] as any[];
  const g11Reg = (await q("SELECT id FROM sections WHERE name = '11-Matatag' LIMIT 1"))[0] as any[];
  const priorSY = SY - 1 > 0 ? SY - 1 : 1;

  const returning: Array<{ display: string; lrn: string; name: string; sex: "male" | "female"; program: string; avg?: number; prevSec: number | null }> = [
    { display: "TST-12-01", lrn: "900000000021", name: "Tricia Navarro",   sex: "female", program: "ste",     avg: 90, prevSec: g11Ste[0]?.id ?? null },
    { display: "TST-12-02", lrn: "900000000022", name: "Sienna Ocampo",   sex: "female", program: "ste",     avg: 84, prevSec: g11Ste[0]?.id ?? null },
    { display: "TST-12-03", lrn: "900000000023", name: "Jacob Delos Reyes", sex: "male", program: "regular", prevSec: g11Reg[0]?.id ?? null },
  ];
  for (const s of returning) {
    const id = await addStudent(s.display, s.lrn, s.name, 12, s.sex);
    if (s.prevSec) {
      await addEnrollment(id, priorSY, s.program, { enrolledBy: registrarId, sectionId: s.prevSec, status: "enrolled", date: "2025-06-10" });
    }
    const en = await addEnrollment(id, SY, s.program, { enrolledBy: registrarId, examPassed: null, interviewPassed: null });
    if (s.avg) await addGrades(en, id, 12, SY, s.avg);
    console.log(`  G12 ${s.name.padEnd(18)} ${s.display} ${s.program} ${s.avg ? `GA ~${s.avg}` : "(no grades)"}`);
  }

  console.log("\nDone.");
  await conn.end();
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  }
);