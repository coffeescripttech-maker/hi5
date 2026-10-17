import { query } from "../config/database";
import { RowDataPacket } from "mysql2";

// ============================================================
// AUTO-SECTIONING RULES ENGINE
// ============================================================
// Pure generation engine — produces section-assignment *proposals*
// without writing to the database. Finalization happens through
// POST /api/sectioning/confirm-assignments.
//
// Rules (per client specification):
//  - Regular & Streamline: no minimum grades / entrance exams, and general
//    average / academic performance is NEVER used to sort or group students.
//    Students are distributed STRICTLY AT RANDOM (a seeded Fisher–Yates
//    shuffle; the seed is reported so a run can be reproduced), while keeping
//    each section's male-to-female ratio balanced (as close to 50/50 as the
//    cohort and capacities allow, counting students already in the section).
//  - STE applicants: GWA >= 85; Science & Mathematics >= 85; passed the
//    entrance examination and the interview.
//  - SPFL applicants: English & Filipino >= 85; passed the entrance
//    examination and the interview (no GWA requirement).
//  - Continuing (maintenance) eligibility for students already in STE/SPFL:
//    STE must keep GWA >= 85 and Science/Mathematics >= 85; SPFL must keep
//    English/Filipino >= 85. Students who fail are flagged for transfer to a
//    Regular section.
//  - Only the program's own subjects are floored at 85 — no other subjects
//    (e.g. MAPEH/TLE) and no per-grade config band influence eligibility.
//  - Grade 11 -> 12 (and in general returning students): carry over the
//    student's previous section where applicable; STE/SPFL students must
//    still satisfy the applicable continuing eligibility requirements.
// ============================================================

export type RuleScope = "regular" | "special" | "carryover" | "all";

export interface RuleOptions {
  schoolYearId: number;
  scope?: RuleScope;
  gradeLevel?: number;
  program?: string;
  /** Optional RNG seed. Omit for a fresh random run; the seed used is returned. */
  seed?: number;
}

export interface SectionInfo {
  id: number;
  name: string;
  grade_level: number;
  section_type: string;
  capacity: number;
  current_count: number;
  min_average: number;
  adviser_name: string | null;
  is_active: number;
}

export interface CohortStudent {
  enrollment_id: number;
  student_id: number;
  student_display_id: string;
  lrn: string;
  name: string;
  grade_level: number;
  sex: string;
  program: string;
  classifications: string[];
  general_average: number | null;
  subject_finals: Record<string, number>;
  has_grades: boolean;
  science: number | null;
  math: number | null;
  english: number | null;
  filipino: number | null;
  entrance_exam_grade: number | null;
  entrance_exam_passed: boolean | null;
  interview_passed: boolean | null;
  current_section_id: number | null;
  current_section_name: string | null;
  current_section_type: string | null;
  prev_section_name: string | null;
  prev_section_type: string | null;
  prev_section_id: number | null;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

export interface Proposal {
  enrollment_id: number;
  student_id: number;
  student_display_id: string;
  lrn: string;
  name: string;
  grade_level: number;
  sex: string;
  program: string;
  classification_tags: string[];
  target_program: "ste" | "spfl" | "regular";
  kind: "new" | "transfer" | "carryover";
  flagged: boolean;
  reason: string;
  eligibility: EligibilityResult;
  general_average: number | null;
  proposed_section_id: number | null;
  proposed_section_name: string | null;
}

export interface GeneratedPlan {
  school_year: { id: number; sy_label: string };
  scope: string;
  /** RNG seed used for this run — re-run with the same seed to reproduce it. */
  seed: number;
  proposals: Proposal[];
  sections: SectionInfo[];
  summary: {
    total: number;
    assigned: number;
    unassigned: number;
    flagged: number;
    by_program: Record<string, number>;
    balance: BalanceSummary;
  };
}

export interface BalanceSummary {
  sections: Array<{
    section_id: number;
    section_name: string;
    grade_level: number;
    section_type: string;
    male: number;
    female: number;
    total: number;
    capacity: number;
  }>;
}

const PASS_MARK = 85;

const SPECIAL_TYPES = ["ste", "spfl"];

const SUBJECT_MATCHERS: Record<"science" | "math" | "english" | "filipino", RegExp> = {
  science: /science|earth|biology|chemistry|physics/i,
  math: /math/i,
  english: /english/i,
  filipino: /filipino/i,
};

function isSpecialSectionType(type: string | null | undefined): boolean {
  if (!type) return false;
  return SPECIAL_TYPES.includes(type.toLowerCase());
}

// ------------------------------------------------------------------
// Randomization — seeded Fisher–Yates so distribution is strictly random yet
// reproducible from the reported seed (mulberry32 PRNG).
// ------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ------------------------------------------------------------------
// Data loading
// ------------------------------------------------------------------

/** Canonical General Averages — same methodology as the report card. */
async function fetchGeneralAverageMap(
  studentIds: number[],
  schoolYearId: number
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (studentIds.length === 0) return map;

  const avgQuery = async (ids: number[], sy: number) => {
    const placeholders = ids.map(() => "?").join(",");
    return query<RowDataPacket[]>(
      `SELECT t.student_id, ROUND(AVG(t.subject_avg), 2) AS general_average
       FROM (
         SELECT g.student_id,
                CASE WHEN s.name IN ('Music','Arts','Physical Education','Health')
                     THEN 'MAPEH' ELSE s.name END AS subject_key,
                ROUND(AVG(g.grade), 2) AS subject_avg
         FROM grades g
         JOIN subjects s ON g.subject_id = s.id
         WHERE g.student_id IN (${placeholders}) AND g.school_year_id = ?
         GROUP BY g.student_id, subject_key
       ) t
       GROUP BY t.student_id`,
      [...ids, sy]
    );
  };

  const current = await avgQuery(studentIds, schoolYearId);
  current.forEach((r: any) => map.set(r.student_id, parseFloat(r.general_average)));

  const missing = studentIds.filter(id => !map.has(id));
  if (missing.length > 0) {
    const placeholders = missing.map(() => "?").join(",");
    const lastSyRows = await query<RowDataPacket[]>(
      `SELECT student_id, MAX(school_year_id) AS last_sy
       FROM grades
       WHERE student_id IN (${placeholders}) AND school_year_id < ?
       GROUP BY student_id`,
      [...missing, schoolYearId]
    );
    const bySy = new Map<number, number[]>();
    lastSyRows.forEach((r: any) => {
      const ids = bySy.get(r.last_sy) || [];
      ids.push(r.student_id);
      bySy.set(r.last_sy, ids);
    });
    for (const [sy, ids] of bySy) {
      const rows = await avgQuery(ids, sy);
      rows.forEach((r: any) => map.set(r.student_id, parseFloat(r.general_average)));
    }
  }
  return map;
}

/** Final (per-subject averaged over quarters) grades for the student set. */
async function fetchSubjectFinalsMap(
  studentIds: number[],
  schoolYearId: number
): Promise<Map<number, Record<string, number>>> {
  const map = new Map<number, Record<string, number>>();
  if (studentIds.length === 0) return map;
  const placeholders = studentIds.map(() => "?").join(",");
  const rows = await query<RowDataPacket[]>(
    `SELECT g.student_id,
            CASE WHEN s.name IN ('Music','Arts','Physical Education','Health')
                 THEN 'MAPEH' ELSE s.name END AS subject_key,
            ROUND(AVG(g.grade), 2) AS final_grade
     FROM grades g
     JOIN subjects s ON g.subject_id = s.id
     WHERE g.student_id IN (${placeholders}) AND g.school_year_id = ?
     GROUP BY g.student_id, subject_key`,
    [...studentIds, schoolYearId]
  );
  rows.forEach((r: any) => {
    const finals = map.get(r.student_id) || {};
    finals[r.subject_key] = parseFloat(r.final_grade);
    map.set(r.student_id, finals);
  });
  return map;
}

/** Load the current-SY cohort with grades, admission flags and previous-year section. */
async function loadCohort(schoolYearId: number): Promise<CohortStudent[]> {
  const [sy] = await query<RowDataPacket[]>(
    "SELECT id, sy_label FROM school_years WHERE id = ?",
    [schoolYearId]
  );
  if (!sy) return [];

  const rows = await query<RowDataPacket[]>(
    `SELECT e.id AS enrollment_id, e.student_id, e.program, e.entrance_exam_grade,
            e.entrance_exam_passed, e.interview_passed,
            e.section_id AS current_section_id,
            s.student_id AS student_display_id, s.lrn, s.name, s.grade_level, s.sex,
            sec.name AS current_section_name, sec.section_type AS current_section_type
     FROM enrollments e
     JOIN students s ON e.student_id = s.id
     LEFT JOIN sections sec ON e.section_id = sec.id
     WHERE e.school_year_id = ? AND e.status IN ('enrolled')
     ORDER BY s.grade_level ASC, s.name ASC`,
    [schoolYearId]
  );

  if (rows.length === 0) return [];

  const studentIds = rows.map((r: any) => r.student_id);
  const placeholders = studentIds.map(() => "?").join(",");

  const [avgMap, subjectFinalsMap, classifications, prevEnrollments] = await Promise.all([
    fetchGeneralAverageMap(studentIds, schoolYearId),
    fetchSubjectFinalsMap(studentIds, schoolYearId),
    query<RowDataPacket[]>(
      `SELECT sc.student_id, sc.classification
       FROM student_classifications sc
       WHERE sc.student_id IN (${placeholders}) AND sc.school_year_id = ?`,
      [...studentIds, schoolYearId]
    ),
    query<RowDataPacket[]>(
      `SELECT e.student_id, sec.name AS prev_section_name,
              sec.section_type AS prev_section_type, sec.id AS prev_section_id
       FROM enrollments e
       JOIN sections sec ON e.section_id = sec.id
       WHERE e.student_id IN (${placeholders}) AND e.school_year_id < ?
         AND e.status IN ('enrolled', 'transferred')
       GROUP BY e.student_id, sec.name, sec.section_type, sec.id`,
      [...studentIds, schoolYearId]
    ),
  ]);

  const classMap = new Map<number, string[]>();
  classifications.forEach((c: any) => {
    const existing = classMap.get(c.student_id) || [];
    existing.push(c.classification);
    classMap.set(c.student_id, existing);
  });

  const prevMap = new Map<number, any>();
  prevEnrollments.forEach((e: any) => prevMap.set(e.student_id, e));

  return rows.map((r: any) => {
    const finals = subjectFinalsMap.get(r.student_id) || {};
    const prev = prevMap.get(r.student_id);
    return {
      ...r,
      general_average: avgMap.get(r.student_id) ?? null,
      subject_finals: finals,
      has_grades: Object.keys(finals).length > 0,
      science: pickGrade(finals, SUBJECT_MATCHERS.science),
      math: pickGrade(finals, SUBJECT_MATCHERS.math),
      english: pickGrade(finals, SUBJECT_MATCHERS.english),
      filipino: pickGrade(finals, SUBJECT_MATCHERS.filipino),
      classifications: classMap.get(r.student_id) || [],
      entrance_exam_passed:
        r.entrance_exam_passed === null || r.entrance_exam_passed === undefined
          ? null
          : r.entrance_exam_passed === 1,
      interview_passed:
        r.interview_passed === null || r.interview_passed === undefined
          ? null
          : r.interview_passed === 1,
      prev_section_name: prev?.prev_section_name ?? null,
      prev_section_type: prev?.prev_section_type ?? null,
      prev_section_id: prev?.prev_section_id ?? null,
    };
  });
}

export async function loadActiveSections(): Promise<SectionInfo[]> {
  const rows = await query<RowDataPacket[]>(
    `SELECT s.id, s.name, s.grade_level, s.section_type, s.capacity, s.current_count,
            s.min_average, u.name AS adviser_name, s.is_active
     FROM sections s
     LEFT JOIN users u ON s.adviser_id = u.id
     WHERE s.is_active = 1
     ORDER BY s.grade_level ASC, s.section_type ASC, s.min_average DESC`
  );
  return rows as unknown as SectionInfo[];
}

/**
 * Male/female head-count already seated in each section for the school year.
 * Used so gender balancing accounts for students who are already in a section
 * (not just the students being placed by this run).
 */
async function loadSectionGenderCounts(
  schoolYearId: number
): Promise<Map<number, { male: number; female: number }>> {
  const map = new Map<number, { male: number; female: number }>();
  const rows = await query<RowDataPacket[]>(
    `SELECT e.section_id, s.sex, COUNT(*) AS n
     FROM enrollments e
     JOIN students s ON e.student_id = s.id
     WHERE e.school_year_id = ? AND e.section_id IS NOT NULL AND e.status = 'enrolled'
     GROUP BY e.section_id, s.sex`,
    [schoolYearId]
  );
  for (const r of rows as any[]) {
    const cur = map.get(r.section_id) || { male: 0, female: 0 };
    if (r.sex === "male") cur.male += Number(r.n);
    else if (r.sex === "female") cur.female += Number(r.n);
    map.set(r.section_id, cur);
  }
  return map;
}

function pickGrade(finals: Record<string, number>, matcher: RegExp): number | null {
  for (const [key, value] of Object.entries(finals)) {
    if (matcher.test(key)) return value;
  }
  return null;
}

// ------------------------------------------------------------------
// Eligibility
// ------------------------------------------------------------------

function pushReason(reasons: string[], cond: boolean, message: string) {
  if (!cond) reasons.push(message);
}

export type ProgramType = "ste" | "spfl";

/** Subjects floored at 85 per special program — only these, no other subjects. */
const SPECIAL_REQUIRED_SUBJECTS: Record<
  ProgramType,
  Array<{ key: "science" | "math" | "english" | "filipino"; label: string }>
> = {
  ste: [
    { key: "science", label: "Science" },
    { key: "math", label: "Mathematics" },
  ],
  spfl: [
    { key: "english", label: "English" },
    { key: "filipino", label: "Filipino" },
  ],
};

/**
 * STE/SPFL eligibility.
 *  - mode "entrance": new applicant. Exam + interview always required; academic
 *    checks apply once grade records exist (GWA >= 85 for STE, program subjects
 *    >= 85 for both). Applicants with no grades yet are judged on exam +
 *    interview alone so fresh enrollees aren't prematurely sent to Regular.
 *  - mode "continuing": current/returning member. Must keep the program's own
 *    subjects at >= 85 (STE also GWA >= 85) or they are flagged for transfer to
 *    Regular. A missing subject grade is tolerated; only a recorded grade below
 *    the passing mark breaks continuity.
 * Only the program's own subjects are floored at 85 — no other subjects
 * (e.g. MAPEH/TLE) and no per-grade config band influence eligibility.
 */
export function evalProgramEligibility(
  student: CohortStudent,
  sectionType: ProgramType,
  mode: "entrance" | "continuing"
): EligibilityResult {
  const reasons: string[] = [];
  const ga = student.general_average;
  const subjects = SPECIAL_REQUIRED_SUBJECTS[sectionType];

  const checkAcademics = mode === "continuing" || student.has_grades;

  if (checkAcademics) {
    if (sectionType === "ste") {
      pushReason(reasons, ga !== null, ga === null ? "No general average on record" : "");
      if (ga !== null) {
        pushReason(reasons, ga >= PASS_MARK, `GWA ${ga.toFixed(2)} below ${PASS_MARK}`);
      }
    }

    for (const { key, label } of subjects) {
      const grade = student[key];
      if (mode === "continuing") {
        if (grade !== null && grade < PASS_MARK) {
          reasons.push(`${label} grade (${grade}) below ${PASS_MARK}`);
        }
      } else {
        pushReason(reasons, grade !== null, `${label} grade not on record`);
        if (grade !== null) {
          pushReason(reasons, grade >= PASS_MARK, `${label} grade (${grade}) below ${PASS_MARK}`);
        }
      }
    }
  }

  if (mode === "entrance") {
    // Admission gates: NULL counts as not recorded -> not eligible.
    pushReason(
      reasons,
      student.entrance_exam_passed === true,
      student.entrance_exam_passed === null
        ? "Entrance examination result not recorded"
        : "Entrance examination not passed"
    );
    pushReason(
      reasons,
      student.interview_passed === true,
      student.interview_passed === null
        ? "Interview result not recorded"
        : "Interview not passed"
    );
  }

  return { eligible: reasons.length === 0, reasons };
}

// ------------------------------------------------------------------
// Placement helpers
// ------------------------------------------------------------------

interface BalanceContext {
  /** Male/female already seated per section for the school year. */
  existing: Map<number, { male: number; female: number }>;
  /** Seats consumed by this run, per section (all genders). */
  extraCount: Map<number, number>;
  /** Gender split of this run's placements, per section. */
  planGender: Map<number, { male: number; female: number }>;
}

function freeCapacity(section: SectionInfo, ctx: BalanceContext): number {
  return (
    (section.capacity || 0) -
    (section.current_count || 0) -
    (ctx.extraCount.get(section.id) || 0)
  );
}

function totalGender(
  sectionId: number,
  ctx: BalanceContext
): { male: number; female: number } {
  const e = ctx.existing.get(sectionId) || { male: 0, female: 0 };
  const p = ctx.planGender.get(sectionId) || { male: 0, female: 0 };
  return { male: e.male + p.male, female: e.female + p.female };
}

/**
 * Distribute `students` across `sections`, respecting capacity.
 *
 * Two competing goals are honoured together:
 *  1. **Even section sizes** — each section is pre-assigned a seat quota
 *     (largest-remainder, proportional to its free seats).
 *  2. **Gender balance** — among sections that still owe seats, the one whose
 *     resulting male/female split is closest to even is chosen, factoring in
 *     the students already seated and this run's earlier placements.
 *
 * Students arrive pre-shuffled, so placement order is random and no grade-based
 * ordering is applied.
 */
function assignBalanced(
  students: CohortStudent[],
  sections: SectionInfo[],
  ctx: BalanceContext
): Map<number, CohortStudent[]> {
  const result = new Map<number, CohortStudent[]>();
  for (const s of sections) if (!result.has(s.id)) result.set(s.id, []);

  const open = sections.filter((s) => freeCapacity(s, ctx) > 0);
  if (open.length === 0) return result;

  const freeOf = (s: SectionInfo) => freeCapacity(s, ctx);
  const totalFree = open.reduce((sum, s) => sum + freeOf(s), 0);
  const seats = Math.min(students.length, totalFree);

  // 1) Largest-remainder seat quotas, capped at each section's free seats.
  const quota = new Map<number, number>(open.map((s) => [s.id, 0]));
  const exact = open.map((s) => {
    const v = (seats * freeOf(s)) / totalFree;
    return { id: s.id, base: Math.floor(v), frac: v - Math.floor(v), free: freeOf(s) };
  });
  let assigned = 0;
  for (const e of exact) {
    quota.set(e.id, e.base);
    assigned += e.base;
  }
  const order = exact.slice().sort((a, b) => b.frac - a.frac || b.free - a.free);
  let idx = 0;
  let guard = 0;
  const maxSteps = order.length * order.length + order.length;
  while (assigned < seats && guard < maxSteps) {
    const e = order[idx % order.length];
    if (quota.get(e.id)! < e.free) {
      quota.set(e.id, quota.get(e.id)! + 1);
      assigned++;
    }
    idx++;
    guard++;
  }

  // 2) Place students, favouring sections that still owe quota.
  const owed = new Map(quota);
  for (const student of students) {
    let best: SectionInfo | null = null;
    let bestOwed = -1;
    let bestImbalance = Infinity;
    let bestFree = -1;

    for (const s of open) {
      const free = freeOf(s);
      if (free <= 0) continue;
      const owe = owed.get(s.id)!;
      const g = totalGender(s.id, ctx);
      const m = g.male + (student.sex === "male" ? 1 : 0);
      const f = g.female + (student.sex === "female" ? 1 : 0);
      const imbalance = Math.abs(m - f);
      if (
        owe > bestOwed ||
        (owe === bestOwed && imbalance < bestImbalance) ||
        (owe === bestOwed && imbalance === bestImbalance && free > bestFree)
      ) {
        best = s;
        bestOwed = owe;
        bestImbalance = imbalance;
        bestFree = free;
      }
    }

    if (!best) break; // every section is full

    result.get(best.id)!.push(student);
    ctx.extraCount.set(best.id, (ctx.extraCount.get(best.id) || 0) + 1);
    const pg = ctx.planGender.get(best.id) || { male: 0, female: 0 };
    if (student.sex === "male") pg.male += 1;
    else pg.female += 1;
    ctx.planGender.set(best.id, pg);
    owed.set(best.id, owed.get(best.id)! - 1);
  }

  return result;
}

// ------------------------------------------------------------------
// Main generation entry point
// ------------------------------------------------------------------

export async function generateRulesPlan(options: RuleOptions): Promise<GeneratedPlan> {
  const { schoolYearId, scope = "all" } = options;

  // Strictly-random placement: a fresh seed each run unless one is supplied.
  const seed =
    options.seed !== undefined
      ? options.seed >>> 0
      : Math.floor(Math.random() * 0xffffffff) >>> 0;
  const rng = mulberry32(seed);

  const [syRows, sections, existingGender] = await Promise.all([
    query<RowDataPacket[]>("SELECT id, sy_label FROM school_years WHERE id = ?", [schoolYearId]),
    loadActiveSections(),
    loadSectionGenderCounts(schoolYearId),
  ]);
  if (syRows.length === 0) {
    throw new Error("School year not found.");
  }

  const cohort = await loadCohort(schoolYearId);

  const proposals: Proposal[] = [];
  const ctx: BalanceContext = {
    existing: existingGender,
    extraCount: new Map<number, number>(),
    planGender: new Map<number, { male: number; female: number }>(),
  };

  // Only consider non-special (regular/streamline-like) students that are
  // not yet sectioned OR every pending student for the chosen scope.
  const inScope = (s: CohortStudent): boolean => {
    if (options.gradeLevel && s.grade_level !== options.gradeLevel) return false;
    if (options.program && s.program !== options.program) return false;
    switch (scope) {
      case "regular":
        return s.program === "regular" || s.program === "streamline";
      case "special":
        return s.program === "ste" || s.program === "spfl";
      case "carryover":
        return s.current_section_id === null || s.prev_section_id !== null;
      default:
        return true;
    }
  };

  // Shuffle the in-scope cohort before any assignment so distribution is
  // strictly random — no name / grade / average ordering survives.
  const considered = shuffle(cohort.filter(inScope), rng);
  const consideredById = new Map<number, CohortStudent>();
  for (const c of considered) consideredById.set(c.student_id, c);

  // ── Phase 1: decide placement intent per student ──────────────────
  for (const student of considered) {
    let target: "ste" | "spfl" | "regular";
    let kind: Proposal["kind"] = "new";
    let flagged = false;
    let eligibility: EligibilityResult = { eligible: true, reasons: [] };
    let reason = "";

    const applicantSpecial =
      student.program === "ste" || student.program === "spfl";

    if (student.current_section_id === null) {
      // RETURNING student — carry over the previous section first (per client
      // rules), judged by continuing-eligibility when it was STE/SPFL. Only
      // students with no prior section are treated as new applicants.
      if (student.prev_section_id !== null && student.prev_section_type) {
        const prevType = student.prev_section_type;
        kind = "carryover";
        if (isSpecialSectionType(prevType)) {
          const cont = evalProgramEligibility(student, prevType as ProgramType, "continuing");
          if (cont.eligible) {
            target = prevType === "ste" ? "ste" : "spfl";
            eligibility = { eligible: true, reasons: [] };
            reason = `Carried over from ${student.prev_section_name} (${prevType.toUpperCase()})`;
          } else {
            target = "regular";
            flagged = true;
            eligibility = cont;
            reason = `Continuing ${prevType.toUpperCase()} eligibility not maintained — regular: ${cont.reasons.join("; ")}`;
          }
        } else {
          target = "regular";
          reason = `Carried over from ${student.prev_section_name}`;
        }
      } else if (applicantSpecial) {
        // NEW STE/SPFL applicant — entrance eligibility (exam + interview).
        const myType = student.program as ProgramType;
        eligibility = evalProgramEligibility(student, myType, "entrance");
        if (eligibility.eligible) {
          target = myType;
          reason = `${myType.toUpperCase()} applicant met eligibility requirements`;
        } else {
          target = "regular";
          flagged = true;
          reason = `${myType.toUpperCase()} eligibility not met — regular section: ${eligibility.reasons.join("; ")}`;
        }
      } else {
        // NEW enrollee into Regular/Streamline.
        target = "regular";
        reason = "New enrollee — regular placement";
      }
    } else if (isSpecialSectionType(student.current_section_type)) {
      // ── Phase 1b: maintenance check for ALREADY-SECTIONED students ──
      // STE/SPFL members who no longer meet the program's minimum academic
      // requirements are flagged for transfer to a Regular section.
      const cont = evalProgramEligibility(
        student,
        student.current_section_type as ProgramType,
        "continuing"
      );
      if (cont.eligible) {
        continue; // stays in place.
      }
      target = "regular";
      kind = "transfer";
      flagged = true;
      eligibility = cont;
      reason = `${student.current_section_type!.toUpperCase()} continuity not maintained — regular: ${cont.reasons.join("; ")}`;
    } else {
      continue; // already in a regular section — nothing to do.
    }

    proposals.push({
      enrollment_id: student.enrollment_id,
      student_id: student.student_id,
      student_display_id: student.student_display_id,
      lrn: student.lrn,
      name: student.name,
      grade_level: student.grade_level,
      sex: student.sex,
      program: student.program,
      classification_tags: student.classifications,
      target_program: target,
      kind,
      flagged,
      reason,
      eligibility,
      general_average: student.general_average,
      proposed_section_id: null,
      proposed_section_name: null,
    });
  }

  // ── Phase 2: match proposals to sections ──────────────────────────
  const byGrade = new Map<number, Proposal[]>();
  for (const p of proposals) {
    const list = byGrade.get(p.grade_level) || [];
    list.push(p);
    byGrade.set(p.grade_level, list);
  }

  const sectionsByGrade = new Map<number, SectionInfo[]>();
  for (const s of sections) {
    const list = sectionsByGrade.get(s.grade_level) || [];
    list.push(s);
    sectionsByGrade.set(s.grade_level, list);
  }

  // Assign a batch of proposals across a set of sections using the random,
  // gender-balanced placer. When `fallbackFrom` is set, each placed student is
  // flagged with the reason they could not stay in their preferred section.
  const applyAssignments = (
    batch: Proposal[],
    targetSections: SectionInfo[],
    fallbackFrom: string | null = null
  ): void => {
    if (batch.length === 0 || targetSections.length === 0) return;

    const propByStudent = new Map<number, Proposal>();
    const pool: CohortStudent[] = [];
    for (const p of batch) {
      propByStudent.set(p.student_id, p);
      const c = consideredById.get(p.student_id);
      if (c) pool.push(c);
    }

    const bySection = assignBalanced(pool, targetSections, ctx);

    for (const [sectionId, members] of bySection) {
      if (members.length === 0) continue;
      const section = targetSections.find(s => s.id === sectionId);
      for (const m of members) {
        const p = propByStudent.get(m.student_id);
        if (!p) continue;
        p.proposed_section_id = sectionId;
        p.proposed_section_name = section?.name ?? null;
        if (fallbackFrom) {
          p.flagged = true;
          p.reason = `${p.reason}; ${fallbackFrom} — placed in ${section?.name ?? sectionId}`;
        }
      }
    }
  };

  const specialSection = (gradeLevel: number, type: "ste" | "spfl") => {
    const gradeSections = sectionsByGrade.get(gradeLevel) || [];
    return gradeSections.filter(
      s =>
        !isNonReaderSection(s) &&
        (s.section_type.toLowerCase() === type || s.name.toLowerCase().includes(type))
    );
  };

  // Non-Reader sections are never auto-assigned from grades: they are only
  // ever reached through the learner's manual, reading assessment-backed tag.
  const NON_READER_TYPE = "non_reader";
  const isNonReaderSection = (s: SectionInfo): boolean =>
    s.section_type.toLowerCase() === NON_READER_TYPE;

  const regularSection = (gradeLevel: number) => {
    const gradeSections = sectionsByGrade.get(gradeLevel) || [];
    const regularOnly = gradeSections.filter(
      s => s.section_type.toLowerCase() === "regular" || s.section_type.toLowerCase() === "streamline"
    );
    if (regularOnly.length > 0) return regularOnly;
    // No Regular/Streamline section at this grade — fall back to any open
    // section of the grade so no student is left unassigned, but still
    // excluding Non-Reader so a low average can never land there.
    const others = gradeSections.filter(s => !isNonReaderSection(s));
    return others.length > 0 ? others : [];
  };

  for (const [grade, list] of byGrade) {
    const steProposals = list.filter(p => p.target_program === "ste");
    const spflProposals = list.filter(p => p.target_program === "spfl");
    const regularProposals = list.filter(
      p => p.target_program === "regular" && p.kind !== "transfer"
    );
    const transferProposals = list.filter(
      p => p.target_program === "regular" && p.kind === "transfer"
    );

    const regularSections = regularSection(grade);

    // STE applicants first (smallest cohorts, most restrictive) — fill the
    // STE sections using the random, gender-balanced placer.
    applyAssignments(steProposals, specialSection(grade, "ste"));
    const steOverflow = steProposals.filter(p => p.proposed_section_id === null);

    // SPFL applicants — fill the SPFL sections the same way.
    applyAssignments(spflProposals, specialSection(grade, "spfl"));
    const spflOverflow = spflProposals.filter(p => p.proposed_section_id === null);

    // Any special-program overflow lands in regular sections, flagged.
    applyAssignments(steOverflow, regularSections, "no STE section capacity");
    applyAssignments(spflOverflow, regularSections, "no SPFL section capacity");

    // Regular/Streamline + transfers — random, gender-balanced across regular.
    applyAssignments(regularProposals, regularSections);
    applyAssignments(transferProposals, regularSections);
  }

  // ── Phase 3: balance + summary ────────────────────────────────────
  // Report each section's full male/female split (students already seated plus
  // this run's placements) so the balance reflects the section as a whole.
  const balanceSections: BalanceSummary["sections"] = sections.map(s => {
    const g = totalGender(s.id, ctx);
    return {
      section_id: s.id,
      section_name: s.name,
      grade_level: s.grade_level,
      section_type: s.section_type,
      male: g.male,
      female: g.female,
      total: g.male + g.female,
      capacity: s.capacity,
    };
  });

  const assigned = proposals.filter(p => p.proposed_section_id !== null);

  const byProgram: Record<string, number> = {};
  for (const p of proposals) {
    byProgram[p.target_program] = (byProgram[p.target_program] || 0) + 1;
  }

  const plan: GeneratedPlan = {
    school_year: { id: syRows[0].id, sy_label: syRows[0].sy_label },
    scope,
    seed,
    proposals,
    sections,
    summary: {
      total: proposals.length,
      assigned: assigned.length,
      unassigned: proposals.length - assigned.length,
      flagged: proposals.filter(p => p.flagged).length,
      by_program: byProgram,
      balance: {
        sections: balanceSections.filter(b => b.total > 0 || b.capacity > 0),
      },
    },
  };
  return plan;
}