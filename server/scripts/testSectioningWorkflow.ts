/**
 * Isolated end-to-end test for the sectioning workflow.
 *
 * Creates a HERMETIC test school year (is_current = 0, unique label) with its
 * own sections, students, enrollments and grades — it never touches the real
 * current SY — then exercises:
 *   L2  generateRulesPlan  (randomness, reproducibility, gender balance,
 *                           routing, capacity, grade containment)
 *   L3  confirmAssignments (writes, counts, history, capacity/grade guards)
 *   L4  undoAssignments    (rollback to the Pending Section Queue + LIFO guard)
 *
 * Everything is deleted in a `finally` block. Run:
 *   npx tsx scripts/testSectioningWorkflow.ts
 */
import { query } from "../src/config/database";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { generateRulesPlan, Proposal } from "../src/services/sectioningRules";
import {
  confirmAssignments,
  undoAssignments,
} from "../src/controllers/sectioning.controller";

import path from "path";
const LOGP = path.resolve(__dirname, "sectioning-test.log");
try { require("fs").writeFileSync(LOGP, ""); } catch {}
const _log = console.log.bind(console);
console.log = (...a: any[]) => {
  _log(...a);
  try { require("fs").appendFileSync(LOGP, a.map(String).join(" ") + "\n"); } catch {}
};

const RUN = String(Date.now()).slice(-8);
const SY_LABEL = `T${RUN}`;
// Isolated grade levels so the engine's GLOBAL section list (sections are NOT
// school-year scoped) cannot leak real sections into this test's grades.
const G = 21;
const G_OTHER = 22;

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${extra ? `  → ${extra}` : ""}`);
  }
}

async function q(sql: string, params?: any[]): Promise<any[]> {
  return (await query<RowDataPacket[]>(sql, params)) as any[];
}
async function exec(sql: string, params?: any[]): Promise<ResultSetHeader> {
  return (await query<ResultSetHeader>(sql, params)) as any;
}

function mockRes() {
  const out: any = { statusCode: 200, body: null };
  const res: any = {
    status(code: number) {
      out.statusCode = code;
      return res;
    },
    json(payload: any) {
      out.body = payload;
      return res;
    },
  };
  return { out, res };
}

interface CreatedStudent {
  id: number;
  enrollmentId: number;
  studentId: number; // display id
  name: string;
  program: string;
  sex: "male" | "female";
}

async function main() {
  // Warm up the remote pool (first connect can ETIMEDOUT).
  for (let i = 0; i < 4; i++) {
    try {
      await q("SELECT 1");
      break;
    } catch (e) {
      if (i === 3) throw e;
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  const created = {
    syId: 0,
    userId: 0,
    sectionIds: [] as number[],
    studentIds: [] as number[],
    subjectIds: [] as number[],
  };

  try {
    console.log(`\n══ Sectioning workflow test — SY label ${SY_LABEL} ══\n`);

    // ── Setup ────────────────────────────────────────────────
    const u = await exec(
      `INSERT INTO users (username, password_hash, name, email, role) VALUES (?, 'x', 'Test Runner', ?, 'registrar')`,
      [`tu${RUN}`, `tu${RUN}@test.local`]
    );
    created.userId = u.insertId;

    const sy = await exec(
      `INSERT INTO school_years (sy_label, is_current, enrollment_open) VALUES (?, 0, 0)`,
      [SY_LABEL]
    );
    created.syId = sy.insertId;

    async function addSection(name: string, grade: number, type: string, cap: number): Promise<number> {
      const r = await exec(
        `INSERT INTO sections (name, grade_level, section_type, capacity, current_count, adviser_id, min_average, is_active)
         VALUES (?, ?, ?, ?, 0, NULL, 0, 1)`,
        [name, grade, type, cap]
      );
      created.sectionIds.push(r.insertId);
      return r.insertId;
    }
    const secA = await addSection(`ST${RUN}A`, G, "regular", 10);
    const secB = await addSection(`ST${RUN}B`, G, "regular", 10);
    const secSte = await addSection(`ST${RUN}STE`, G, "ste", 5);
    const secSpfl = await addSection(`ST${RUN}SPFL`, G, "spfl", 5);
    const secOther = await addSection(`ST${RUN}G8`, G_OTHER, "regular", 10);

    // Subjects for grades-driven eligibility.
    const needed = ["Science", "Mathematics", "English", "Filipino", "Araling Panlipunan"];
    const subjectMap = new Map<string, number>();
    for (const r of await q("SELECT id, name FROM subjects WHERE grade_level = 7")) {
      if (needed.includes(r.name)) subjectMap.set(r.name, r.id);
    }
    for (const name of needed) {
      if (!subjectMap.has(name)) {
        const ins = await exec(
          `INSERT INTO subjects (name, grade_level, hours_per_week, subject_type, is_active) VALUES (?, 7, 4.0, 'core', 1)`,
          [name]
        );
        subjectMap.set(name, ins.insertId);
        created.subjectIds.push(ins.insertId);
      }
    }

    let seq = 0;
    async function addStudent(opts: {
      grade: number;
      sex: "male" | "female";
      program: string;
      exam?: boolean;
      interview?: boolean;
      grades?: Record<string, number>;
    }): Promise<CreatedStudent> {
      seq++;
      const display = `TS-${RUN}-${String(seq).padStart(2, "0")}`;
      const lrn = `${RUN}${String(seq).padStart(4, "0")}`;
      const name = `Test ${opts.program} ${seq}`;
      const s = await exec(
        `INSERT INTO students (student_id, lrn, name, grade_level, sex, birthdate, status)
         VALUES (?, ?, ?, ?, ?, '2013-01-01', 'enrolled')`,
        [display, lrn, name, opts.grade, opts.sex]
      );
      created.studentIds.push(s.insertId);

      const e = await exec(
        `INSERT INTO enrollments (student_id, section_id, school_year_id, program, enrollment_date, enrolled_by, status, entrance_exam_passed, interview_passed)
         VALUES (?, NULL, ?, ?, CURDATE(), ?, 'enrolled', ?, ?)`,
        [
          s.insertId,
          created.syId,
          opts.program,
          created.userId,
          opts.exam === undefined ? null : opts.exam ? 1 : 0,
          opts.interview === undefined ? null : opts.interview ? 1 : 0,
        ]
      );

      if (opts.grades) {
        for (const [subj, grade] of Object.entries(opts.grades)) {
          await exec(
            `INSERT INTO grades (student_id, subject_id, enrollment_id, school_year_id, quarter, grade)
             VALUES (?, ?, ?, ?, 1, ?)`,
            [s.insertId, subjectMap.get(subj)!, e.insertId, created.syId, grade]
          );
        }
      }

      return {
        id: s.insertId,
        enrollmentId: e.insertId,
        studentId: display,
        name,
        program: opts.program,
        sex: opts.sex,
      };
    }

    // 6 male + 6 female regular; 2 STE (1 ok / 1 fail-GWA); 2 SPFL (1 ok / 1 fail-Eng)
    const regular: CreatedStudent[] = [];
    for (let i = 0; i < 6; i++) regular.push(await addStudent({ grade: G, sex: "male", program: "regular" }));
    for (let i = 0; i < 6; i++) regular.push(await addStudent({ grade: G, sex: "female", program: "regular" }));
    const steOK = await addStudent({
      grade: G, sex: "male", program: "ste", exam: true, interview: true,
      grades: { Science: 90, Mathematics: 90, English: 88, Filipino: 88 },
    });
    const steBAD = await addStudent({
      grade: G, sex: "male", program: "ste", exam: true, interview: true,
      grades: { Science: 90, Mathematics: 90, "Araling Panlipunan": 60 }, // GA 80
    });
    const spflOK = await addStudent({
      grade: G, sex: "female", program: "spfl", exam: true, interview: true,
      grades: { English: 90, Filipino: 90, "Araling Panlipunan": 60 }, // GA 80, no GWA gate
    });
    const spflBAD = await addStudent({
      grade: G, sex: "female", program: "spfl", exam: true, interview: true,
      grades: { English: 80, Filipino: 90 },
    });

    const TOTAL = 16;
    const pendingBefore = (await q(
      "SELECT COUNT(*) c FROM enrollments WHERE school_year_id = ? AND section_id IS NULL AND status='enrolled'",
      [created.syId]
    ))[0].c;
    check("setup: 16 pending (NULL-section) test enrollments", Number(pendingBefore) === TOTAL, `got ${pendingBefore}`);

    // ── L2: engine plan ──────────────────────────────────────
    console.log("\nL2  Engine (generateRulesPlan)");
    const plan = await generateRulesPlan({ schoolYearId: created.syId, scope: "all", seed: 111111 });
    check("L2 proposals = 16", plan.proposals.length === TOTAL, `got ${plan.proposals.length}`);

    const byTarget = (t: string) => plan.proposals.filter(p => p.target_program === t).length;
    check("L2 target ste = 1 (eligible applicant held)", byTarget("ste") === 1, `got ${byTarget("ste")}`);
    check("L2 target spfl = 1", byTarget("spfl") === 1, `got ${byTarget("spfl")}`);
    check("L2 target regular = 14 (incl. 2 ineligible)", byTarget("regular") === 14, `got ${byTarget("regular")}`);
    check("L2 flagged = 2 (ineligible STE + SPFL)", plan.proposals.filter(p => p.flagged).length === 2);
    check("L2 all assigned (capacity ample)", plan.proposals.every(p => p.proposed_section_id !== null));

    const pByStudent = new Map<number, Proposal>(plan.proposals.map(p => [p.student_id, p]));
    check("L2 eligible STE → ste section", pByStudent.get(steOK.id)?.target_program === "ste");
    check("L2 GWA<85 STE → regular + flagged", pByStudent.get(steBAD.id)?.target_program === "regular" && pByStudent.get(steBAD.id)!.flagged);
    check("L2 eligible SPFL → spfl section (no GWA gate)", pByStudent.get(spflOK.id)?.target_program === "spfl");
    check("L2 Eng<85 SPFL → regular + flagged", pByStudent.get(spflBAD.id)?.target_program === "regular" && pByStudent.get(spflBAD.id)!.flagged);
    check("L2 flagged proposals carry reasons", plan.proposals.filter(p => p.flagged).every(p => p.eligibility.reasons.length > 0));

    // Grade containment
    const secGrade = new Map(plan.sections.map(s => [s.id, s.grade_level]));
    check(
      "L2 no cross-grade placement",
      plan.proposals.every(p => p.proposed_section_id === null || secGrade.get(p.proposed_section_id) === p.grade_level)
    );

    // Gender balance of the 14 regular placements across secA/secB.
    const regA = plan.proposals.filter(p => p.proposed_section_id === secA);
    const regB = plan.proposals.filter(p => p.proposed_section_id === secB);
    const mf = (arr: Proposal[]) => ({
      m: arr.filter(p => p.sex === "male").length,
      f: arr.filter(p => p.sex === "female").length,
    });
    const A = mf(regA), B = mf(regB);
    check("L2 regular split A=7 B=7", regA.length === 7 && regB.length === 7, `A=${regA.length} B=${regB.length}`);
    check("L2 gender near-balanced per section", Math.abs(A.m - A.f) <= 1 && Math.abs(B.m - B.f) <= 1, `A m=${A.m} f=${A.f}; B m=${B.m} f=${B.f}`);
    check("L2 combined regular 7M / 7F", A.m + B.m === 7 && A.f + B.f === 7, `${A.m + B.m}M/${A.f + B.f}F`);
    check("L2 STE section has exactly the 1 eligible", plan.proposals.filter(p => p.proposed_section_id === secSte).length === 1);
    check("L2 SPFL section has exactly the 1 eligible", plan.proposals.filter(p => p.proposed_section_id === secSpfl).length === 1);

    // Reproducibility + randomness
    const sig = (pl: typeof plan) =>
      pl.proposals.filter(p => p.proposed_section_id !== null)
        .map(p => `${p.student_id}:${p.proposed_section_id}`).sort().join("|");
    const planRepro = await generateRulesPlan({ schoolYearId: created.syId, scope: "all", seed: 111111 });
    check("L2 same seed → identical plan", sig(plan) === sig(planRepro));
    const planOther = await generateRulesPlan({ schoolYearId: created.syId, scope: "all", seed: 222222 });
    check("L2 different seed → different assignment map", sig(plan) !== sig(planOther));

    // ── L3: confirm assignments ──────────────────────────────
    console.log("\nL3  Confirm assignments (write)");
    const assignments = plan.proposals
      .filter(p => p.proposed_section_id !== null)
      .map(p => ({ enrollment_id: p.enrollment_id, student_id: p.student_id, section_id: p.proposed_section_id! }));

    const { out: cOut, res: cRes } = mockRes();
    await confirmAssignments({ user: { userId: created.userId }, body: { school_year_id: created.syId, assignments } } as any, cRes);
    check("L3 confirm succeeded count = 16", cOut.body?.succeeded === TOTAL, JSON.stringify(cOut.body).slice(0, 200));
    const batchId = cOut.body?.batch_id;

    const stillPending = (await q(
      "SELECT COUNT(*) c FROM enrollments WHERE school_year_id = ? AND section_id IS NULL",
      [created.syId]
    ))[0].c;
    check("L3 pending queue drained (0 NULL-section)", Number(stillPending) === 0, `got ${stillPending}`);

    const histDone = (await q(
      "SELECT COUNT(*) c FROM sectioning_history WHERE school_year_id = ? AND status='done'",
      [created.syId]
    ))[0].c;
    check("L3 sectioning_history rows = 16", Number(histDone) === TOTAL, `got ${histDone}`);

    // current_count matches actual seated rows, per section
    const countRows = await q(
      `SELECT s.id, s.current_count, COUNT(e.id) seated
       FROM sections s LEFT JOIN enrollments e ON e.section_id = s.id
       WHERE s.id IN (?, ?, ?, ?, ?) GROUP BY s.id, s.current_count`,
      [secA, secB, secSte, secSpfl, secOther]
    );
    check(
      "L3 current_count == seated for every test section",
      countRows.every((r: any) => Number(r.current_count) === Number(r.seated)),
      JSON.stringify(countRows)
    );

    // Guards: grade mismatch + unknown section must fail cleanly.
    const { out: gOut, res: gRes } = mockRes();
    await confirmAssignments(
      {
        user: { userId: created.userId },
        body: {
          school_year_id: created.syId,
          assignments: [
            { enrollment_id: steOK.enrollmentId, student_id: steOK.id, section_id: secOther },
            { enrollment_id: spflOK.enrollmentId, student_id: spflOK.id, section_id: 999999999 },
          ],
        },
      } as any,
      gRes
    );
    const gRes2 = (gOut.body?.results || []) as any[];
    check("L3 grade-mismatch guard rejects", gRes2[0]?.ok === false && /grade/i.test(gRes2[0]?.error || ""));
    check("L3 unknown-section guard rejects", gRes2[1]?.ok === false);

    // ── L4: undo ─────────────────────────────────────────────
    console.log("\nL4  Undo assignments (rollback)");
    const { out: uOut, res: uRes } = mockRes();
    await undoAssignments({ user: { userId: created.userId }, body: { batch_id: batchId } } as any, uRes);
    check("L4 undo succeeded = 16", uOut.body?.succeeded === TOTAL, JSON.stringify(uOut.body).slice(0, 200));

    const backPending = (await q(
      "SELECT COUNT(*) c FROM enrollments WHERE school_year_id = ? AND section_id IS NULL",
      [created.syId]
    ))[0].c;
    check("L4 restored to pending (16 NULL-section)", Number(backPending) === TOTAL, `got ${backPending}`);

    const zeros = await q(
      "SELECT COUNT(*) c FROM sections WHERE id IN (?, ?, ?, ?, ?) AND current_count = 0",
      [secA, secB, secSte, secSpfl, secOther]
    );
    check("L4 section counts reset to 0", Number(zeros[0].c) === 5, `got ${zeros[0].c}`);

    const undone = (await q(
      "SELECT COUNT(*) c FROM sectioning_history WHERE batch_id = ? AND status='undone'",
      [batchId]
    ))[0].c;
    check("L4 history marked undone", Number(undone) === TOTAL, `got ${undone}`);

    // LIFO / double-undo guard
    const { out: u2Out, res: u2Res } = mockRes();
    await undoAssignments({ user: { userId: created.userId }, body: { batch_id: batchId } } as any, u2Res);
    check("L4 second undo rejected (404)", u2Out.statusCode === 404, `status ${u2Out.statusCode}`);
  } finally {
    console.log("\n── Cleanup ──");
    try {
      if (created.syId) {
        await exec("DELETE FROM sectioning_history WHERE school_year_id = ?", [created.syId]);
        await exec("DELETE FROM grades WHERE school_year_id = ?", [created.syId]);
        await exec("DELETE FROM student_classifications WHERE school_year_id = ?", [created.syId]);
        await exec("DELETE FROM enrollments WHERE school_year_id = ?", [created.syId]);
      }
      if (created.studentIds.length) {
        const ph = created.studentIds.map(() => "?").join(",");
        await exec(`DELETE FROM students WHERE id IN (${ph})`, created.studentIds);
      }
      if (created.sectionIds.length) {
        const ph = created.sectionIds.map(() => "?").join(",");
        await exec(`DELETE FROM sections WHERE id IN (${ph})`, created.sectionIds);
      }
      if (created.subjectIds.length) {
        const ph = created.subjectIds.map(() => "?").join(",");
        await exec(`DELETE FROM subjects WHERE id IN (${ph})`, created.subjectIds);
      }
      if (created.syId) await exec("DELETE FROM school_years WHERE id = ?", [created.syId]);
      if (created.userId) {
        await exec("DELETE FROM activity_logs WHERE user_id = ?", [created.userId]);
        await exec("DELETE FROM users WHERE id = ?", [created.userId]);
      }
      console.log("  test rows deleted.");
    } catch (e: any) {
      console.log(`  CLEANUP ERROR (manual cleanup may be needed): ${e.message}`);
    }
  }

  console.log(`\n══ ${pass} passed, ${fail} failed ══`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => {
  console.error("HARNESS FAILED:", e);
  process.exit(1);
});
