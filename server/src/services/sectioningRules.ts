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
//  - Regular & Streamline: no minimum grades / entrance exams; target a
//    50/50 male-to-female split per section (proportional when exact is
//    mathematically impossible).
//  - STE applicants: GWA >= 85 and within the school-defined STE band;
//    no grade below 85; Science & Mathematics >= 85; passed the entrance
//    examination and the interview.
//  - SPFL applicants: no grade below 85; English & Filipino >= 85; passed
//    the entrance examination and the interview.
//  - Continuing (maintenance) eligibility for students already in STE/SPFL:
//    they must keep the minimum academic requirements or they are flagged
//    for transfer to a Regular section.
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

export interface ThresholdConfig {
  id: number;
  section_type: string;
  grade_level: number;
  min_average: number;
  max_average: number;
}

interface CohortStudent {
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
  min_subject_grade: number | null;
  min_subject_name: string | null;
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
    let minGrade: number | null = null;
    let minSubject: string | null = null;
    for (const [k, v] of Object.entries(finals)) {
      if (minGrade === null || v < minGrade) {
        minGrade = v;
        minSubject = k;
      }
    }
    return {
      ...r,
      general_average: avgMap.get(r.student_id) ?? null,
      subject_finals: finals,
      min_subject_grade: minGrade,
      min_subject_name: minSubject,
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

async function loadThresholds(): Promise<ThresholdConfig[]> {
  const rows = await query<RowDataPacket[]>(
    `SELECT id, section_type, grade_level, min_average, max_average
     FROM section_type_config`
  );
  return rows as unknown as ThresholdConfig[];
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

function evalEntranceEligibility(
  student: CohortStudent,
  requiredSubjects: Array<{ key: "science" | "math" | "english" | "filipino"; label: string }>,
  bandMin: number | null
): EligibilityResult {
  const reasons: string[] = [];
  const ga = student.general_average;

  pushReason(reasons, ga !== null, ga === null ? "No general average on record" : "");
  if (ga !== null) {
    pushReason(reasons, ga >= PASS_MARK, `GWA ${ga.toFixed(2)} below ${PASS_MARK}`);
    if (bandMin !== null) {
      pushReason(reasons, ga >= bandMin, `GWA ${ga.toFixed(2)} below the ${bandMin} program band`);
    }
  }

  pushReason(
    reasons,
    student.min_subject_grade === null,
    student.min_subject_grade === null ? "No subject grades on record" : ""
  );
  if (student.min_subject_grade !== null) {
    pushReason(
      reasons,
      student.min_subject_grade >= PASS_MARK,
      `Grade in ${student.min_subject_name} (${student.min_subject_grade}) below ${PASS_MARK}`
    );
  }

  for (const { key, label } of requiredSubjects) {
    const grade = student[key];
    pushReason(reasons, grade !== null, `${label} grade not on record`);
    if (grade !== null) {
      pushReason(reasons, grade >= PASS_MARK, `${label} grade (${grade}) below ${PASS_MARK}`);
    }
  }

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

  return { eligible: reasons.length === 0, reasons };
}

function evalContinuingEligibility(
  student: CohortStudent,
  sectionType: string,
  bandMin: number | null
): EligibilityResult {
  const reasons: string[] = [];
  const ga = student.general_average;
  const required =
    sectionType === "ste"
      ? ([
          { key: "science" as const, label: "Science" },
          { key: "math" as const, label: "Mathematics" },
        ] as const)
      : ([
          { key: "english" as const, label: "English" },
          { key: "filipino" as const, label: "Filipino" },
        ] as const);

  pushReason(reasons, ga !== null, ga === null ? "No general average on record" : "");
  if (ga !== null) {
    pushReason(reasons, ga >= PASS_MARK, `GWA ${ga.toFixed(2)} below ${PASS_MARK}`);
    if (bandMin !== null) {
      pushReason(reasons, ga >= bandMin, `GWA ${ga.toFixed(2)} below the ${bandMin} program band`);
    }
  }
  if (student.min_subject_grade !== null) {
    pushReason(
      reasons,
      student.min_subject_grade >= PASS_MARK,
      `Grade in ${student.min_subject_name} (${student.min_subject_grade}) below ${PASS_MARK}`
    );
  }
  for (const { key, label } of required) {
    const grade = student[key];
    if (grade !== null && grade < PASS_MARK) {
      reasons.push(`${label} grade (${grade}) below ${PASS_MARK}`);
    }
  }
  return { eligible: reasons.length === 0, reasons };
}

// ------------------------------------------------------------------
// Placement helpers
// ------------------------------------------------------------------

function largestRemainder(count: number, weights: number[]): number[] {
  const quota = weights.map(w => count * w);
  const floors = quota.map(q => Math.floor(q));
  let remainderTotal = count - floors.reduce((a, b) => a + b, 0);
  const decimals = quota
    .map((q, i) => ({ i, d: q - floors[i] }))
    .sort((a, b) => b.d - a.d);
  for (let k = 0; k < remainderTotal; k++) {
    floors[decimals[k % decimals.length].i] += 1;
  }
  return floors;
}

/**
 * Target a 50/50 male–female split. When an exact split is mathematically
 * impossible (unequal totals / odd numbers / capacities), distribute both
 * genders as evenly and proportionally as possible across all sections.
 */
function assignBalanced(
  students: CohortStudent[],
  sections: SectionInfo[],
  runningCounts: Map<number, number>
): Map<number, CohortStudent[]> {
  const result = new Map<number, CohortStudent[]>();
  if (sections.length === 0) return result;

  const freeOf = (s: SectionInfo) =>
    s.capacity - (s.current_count || 0) - (runningCounts.get(s.id) || 0);

  const usable = sections
    .map(s => ({ s, free: freeOf(s) }))
    .filter(x => x.free > 0);

  if (usable.length === 0) return result;

  const totalFree = usable.reduce((a, x) => a + x.free, 0);
  const weights = usable.map(x => x.free / totalFree);
  const males = students.filter(s => s.sex === "male");
  const females = students.filter(s => s.sex === "female");

  for (const section of sections) result.set(section.id, []);

  const maleQuotas = largestRemainder(males.length, weights);
  const femaleQuotas = largestRemainder(females.length, weights);

  usable.forEach(({ s }, i) => {
    const maleCount = Math.min(Math.max(maleQuotas[i] ?? 0, 0), freeOf(s));
    const femaleCount = Math.min(Math.max(femaleQuotas[i] ?? 0, 0), freeOf(s) - maleCount);
    result.set(s.id, [
      ...males.splice(0, maleCount),
      ...females.splice(0, femaleCount),
    ]);
    for (const student of result.get(s.id)!) {
      runningCounts.set(s.id, (runningCounts.get(s.id) || 0) + 1);
    }
  });

  // Any remaining students (rounding overflow / odd counts) — spill to the
  // next section that still has room, alternating to preserve balance.
  const leftovers = [...males, ...females];
  for (const student of leftovers) {
    const candidates = sections
      .filter(s => freeOf(s) > 0)
      .sort((a, b) => freeOf(a) - freeOf(b));
    if (candidates.length === 0) break;
    const target = candidates[0];
    result.get(target.id)!.push(student);
    runningCounts.set(target.id, (runningCounts.get(target.id) || 0) + 1);
  }

  return result;
}

// ------------------------------------------------------------------
// Main generation entry point
// ------------------------------------------------------------------

export async function generateRulesPlan(options: RuleOptions): Promise<GeneratedPlan> {
  const { schoolYearId, scope = "all" } = options;

  const [syRows, thresholds, sections] = await Promise.all([
    query<RowDataPacket[]>("SELECT id, sy_label FROM school_years WHERE id = ?", [schoolYearId]),
    loadThresholds(),
    loadActiveSections(),
  ]);
  if (syRows.length === 0) {
    throw new Error("School year not found.");
  }

  const cohort = await loadCohort(schoolYearId);

  const bandFor = (type: string, gradeLevel: number): number | null =>
    thresholds.find(t => t.section_type === type && t.grade_level === gradeLevel)?.min_average ??
    null;

  const proposals: Proposal[] = [];
  const runningCounts = new Map<number, number>();

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

  const considered = cohort.filter(inScope);

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
      // NEW / unassigned student.
      if (applicantSpecial) {
        const myType = student.program as "ste" | "spfl";
        const band = bandFor(myType, student.grade_level);
        eligibility =
          myType === "ste"
            ? evalEntranceEligibility(student, [{ key: "science", label: "Science" }, { key: "math", label: "Mathematics" }], band)
            : evalEntranceEligibility(student, [{ key: "english", label: "English" }, { key: "filipino", label: "Filipino" }], band);
        if (eligibility.eligible) {
          target = myType;
          reason = `${myType.toUpperCase()} applicant met eligibility requirements`;
        } else {
          target = "regular";
          flagged = true;
          reason = `${myType.toUpperCase()} eligibility not met — regular section: ${eligibility.reasons.join("; ")}`;
        }
      } else if (student.prev_section_id !== null && student.prev_section_type) {
        // RETURNING student — carry over the previous section where applicable.
        const prevType = student.prev_section_type;
        kind = "carryover";
        if (isSpecialSectionType(prevType)) {
          const band = bandFor(prevType, student.grade_level);
          const cont = evalContinuingEligibility(student, prevType, band);
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
      } else {
        // NEW enrollee into Regular/Streamline.
        target = "regular";
        reason = "New enrollee — regular placement";
      }
    } else if (isSpecialSectionType(student.current_section_type)) {
      // ── Phase 1b: maintenance check for ALREADY-SECTIONED students ──
      // Only performed for the carryover scope so a normal daily run does not
      // churn finalized sections.
      const band = bandFor(student.current_section_type!, student.grade_level);
      const cont = evalContinuingEligibility(student, student.current_section_type!, band);
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

  const hasRoom = (s: SectionInfo): boolean => {
    return (s.current_count || 0) + (runningCounts.get(s.id) || 0) < s.capacity;
  };

  const assignTo = (p: Proposal, s: SectionInfo | undefined): void => {
    if (!s || !hasRoom(s)) {
      return;
    }
    p.proposed_section_id = s.id;
    p.proposed_section_name = s.name;
    runningCounts.set(s.id, (runningCounts.get(s.id) || 0) + 1);
  };

  const specialSection = (gradeLevel: number, type: "ste" | "spfl") => {
    const gradeSections = sectionsByGrade.get(gradeLevel) || [];
    return gradeSections.filter(
      s => s.section_type.toLowerCase() === type || s.name.toLowerCase().includes(type)
    );
  };

  const regularSection = (gradeLevel: number) => {
    const gradeSections = sectionsByGrade.get(gradeLevel) || [];
    const regularOnly = gradeSections.filter(
      s => s.section_type.toLowerCase() === "regular" || s.section_type.toLowerCase() === "streamline"
    );
    // If the school has no Regular/Streamline section at this grade, fall back
    // to any open section of the grade so no student is left unassigned.
    return regularOnly.length > 0 ? regularOnly : gradeSections;
  };

  for (const [grade, list] of byGrade) {
    const steProposals = list.filter(p => p.target_program === "ste");
    const spflProposals = list.filter(p => p.target_program === "spfl");
    const regularProposals = list.filter(
      p => p.target_program === "regular" && p.kind !== "transfer"
    );
    const transferProposals = list.filter(p => p.target_program === "regular" && p.kind === "transfer");

    // STE first (smallest cohorts, most restrictive).
    for (const p of steProposals) {
      const preferred = specialSection(grade, "ste").find(s => hasRoom(s));
      if (preferred) {
        assignTo(p, preferred);
        continue;
      }
      // No STE room -> fall back to a regular section, flagged.
      const fallback = regularSection(grade).find(s => hasRoom(s));
      assignTo(p, fallback);
      if (p.proposed_section_id !== null) {
        p.flagged = true;
        p.reason = `${p.reason}; no STE section capacity — placed in ${p.proposed_section_name}`;
      }
    }

    for (const p of spflProposals) {
      const preferred = specialSection(grade, "spfl").find(s => hasRoom(s));
      if (preferred) {
        assignTo(p, preferred);
        continue;
      }
      const fallback = regularSection(grade).find(s => hasRoom(s));
      assignTo(p, fallback);
      if (p.proposed_section_id !== null) {
        p.flagged = true;
        p.reason = `${p.reason}; no SPFL section capacity — placed in ${p.proposed_section_name}`;
      }
    }

    // Balanced 50/50 gender distribution for regular placements.
    const regularStudents = regularProposals
      .map(p => considered.find(c => c.student_id === p.student_id))
      .filter((s): s is CohortStudent => Boolean(s));
    const regularSections = regularSection(grade);
    const balance = assignBalanced(regularStudents, regularSections, runningCounts);

    for (const p of regularProposals) {
      const student = considered.find(c => c.student_id === p.student_id);
      if (!student || p.proposed_section_id === null) {
        for (const [secId, members] of balance) {
          if (student && members.includes(student)) {
            p.proposed_section_id = secId;
            p.proposed_section_name =
              sections.find(s => s.id === secId)?.name ?? null;
            break;
          }
        }
      }
    }

    // Transfers to Regular get straight assignment to the least-loaded section.
    for (const p of transferProposals) {
      const candidates = regularSection(grade)
        .filter(s => hasRoom(s))
        .sort(
          (a, b) =>
            (a.current_count || 0) + (runningCounts.get(a.id) || 0) -
            ((b.current_count || 0) + (runningCounts.get(b.id) || 0))
        );
      assignTo(p, candidates[0]);
    }
  }

  // ── Phase 3: balance + summary ────────────────────────────────────
  const balanceSections: BalanceSummary["sections"] = sections.map(s => {
    const memberCounts = runningCounts.get(s.id) || 0;
    return {
      section_id: s.id,
      section_name: s.name,
      grade_level: s.grade_level,
      section_type: s.section_type,
      male: 0,
      female: 0,
      total: memberCounts,
      capacity: s.capacity,
    };
  });

  const assigned = proposals.filter(p => p.proposed_section_id !== null);
  assigned.forEach(p => {
    const row = balanceSections.find(b => b.section_id === p.proposed_section_id);
    if (row) {
      if (p.sex === "male") row.male += 1;
      else row.female += 1;
    }
  });

  const byProgram: Record<string, number> = {};
  for (const p of proposals) {
    byProgram[p.target_program] = (byProgram[p.target_program] || 0) + 1;
  }

  const plan: GeneratedPlan = {
    school_year: { id: syRows[0].id, sy_label: syRows[0].sy_label },
    scope,
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