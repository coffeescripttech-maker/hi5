import { query } from "../config/database";
import { RowDataPacket } from "mysql2";

/**
 * Teacher grant helpers — docs/new_requirement.txt R1, R11-R14 (client review
 * 2026-11: "use ONLY section_teacher_assignments for permission checks").
 *
 * The grant model is:
 *   - Regular (non-elective) subjects: section_teacher_assignments — the exact
 *     (section, subject, teacher, school_year) row created in Section
 *     Creation > Subject Teachers. NO legacy fallback.
 *   - Elective subjects: subject-level only. An elective's teacher is granted
 *     via teacher_subject_assignments (Subject Management > elective grant) and
 *     the roster is the learners who picked it (student_electives). Electives
 *     are never stored per section (R5/R12).
 *
 * The legacy tables (teacher_subject_assignments for core subjects,
 * teacher_section_assignments) are NO LONGER honored anywhere in permission
 * checks — a stale subject-level row by itself no longer grants access.
 */

/** Current school year id (null when none is marked current). */
export async function currentSchoolYearId(): Promise<number | null> {
  const rows = await query<RowDataPacket[]>(
    "SELECT id FROM school_years WHERE is_current = 1 LIMIT 1"
  );
  return rows.length > 0 ? Number(rows[0].id) : null;
}

/**
 * Section ids where the teacher holds at least one (section, subject) grant in
 * the given school year. Falls back to the current year when omitted.
 */
export async function grantedSectionIds(
  teacherId: number,
  schoolYearId?: number
): Promise<number[]> {
  const sy = schoolYearId ?? (await currentSchoolYearId());
  if (!sy) return [];
  const rows = await query<RowDataPacket[]>(
    `SELECT DISTINCT section_id FROM section_teacher_assignments
      WHERE teacher_id = ? AND school_year_id = ?`,
    [teacherId, sy]
  );
  return rows.map((r) => Number(r.section_id));
}

/** True when the teacher holds the exact (section, subject) pair for the year. */
export async function hasGrantPair(
  teacherId: number,
  schoolYearId: number,
  sectionId: number | null,
  subjectId: number
): Promise<boolean> {
  if (!sectionId) return false;
  const rows = await query<RowDataPacket[]>(
    `SELECT 1 FROM section_teacher_assignments
      WHERE teacher_id = ? AND school_year_id = ? AND section_id = ? AND subject_id = ?
      LIMIT 1`,
    [teacherId, schoolYearId, sectionId, subjectId]
  );
  return rows.length > 0;
}

/**
 * Electives: true when the subject is an elective AND the teacher holds the
 * subject-level elective grant (teacher_subject_assignments) — the only
 * non-advisory way to reach an elective's roster.
 */
export async function hasElectiveGrant(
  teacherId: number,
  schoolYearId: number | null,
  subjectId: number
): Promise<boolean> {
  const rows = await query<RowDataPacket[]>(
    `SELECT 1
       FROM subjects s
      WHERE s.id = ? AND s.subject_type = 'elective'
        AND EXISTS (
          SELECT 1 FROM teacher_subject_assignments tsa
           WHERE tsa.teacher_id = ? AND tsa.subject_id = s.id
             AND (tsa.school_year_id = ? OR tsa.school_year_id IS NULL)
        )
      LIMIT 1`,
    [subjectId, teacherId, schoolYearId]
  );
  return rows.length > 0;
}

/** True only for an actual elective subject (subject_type = 'elective'). */
export async function isElectiveSubject(subjectId: number): Promise<boolean> {
  const rows = await query<RowDataPacket[]>(
    "SELECT subject_type FROM subjects WHERE id = ? LIMIT 1",
    [subjectId]
  );
  return rows.length > 0 && String(rows[0].subject_type) === "elective";
}

/** The learner's current enrolled section for the year (null when pending). */
export async function getStudentSectionId(
  studentId: number,
  schoolYearId: number
): Promise<number | null> {
  const rows = await query<RowDataPacket[]>(
    `SELECT section_id FROM enrollments
      WHERE student_id = ? AND school_year_id = ? AND status = 'enrolled'
      ORDER BY id DESC LIMIT 1`,
    [studentId, schoolYearId]
  );
  return rows.length > 0 && rows[0].section_id != null
    ? Number(rows[0].section_id)
    : null;
}

/**
 * True when the teacher may edit the given subject for the given learner in
 * the given school year. Grant model (strict):
 *   - elective subject  → subject-level elective grant + the learner's pick
 *   - every other subject → the exact section_teacher_assignments pair
 */
export async function teacherCanEditStudentSubject(
  teacherId: number,
  schoolYearId: number,
  studentId: number,
  subjectId: number | null
): Promise<boolean> {
  if (subjectId == null) return false;
  const rows = await query<RowDataPacket[]>(
    `SELECT 1
       FROM enrollments e
      WHERE e.student_id = ? AND e.school_year_id = ? AND e.status = 'enrolled'
      LIMIT 1`,
    [studentId, schoolYearId]
  );
  if (rows.length === 0) return false;
  if (await isElectiveSubject(subjectId)) {
    const pick = await query<RowDataPacket[]>(
      `SELECT 1 FROM student_electives
        WHERE student_id = ? AND school_year_id = ? AND subject_id = ? LIMIT 1`,
      [studentId, schoolYearId, subjectId]
    );
    return (
      pick.length > 0 &&
      (await hasElectiveGrant(teacherId, schoolYearId, subjectId))
    );
  }
  return hasGrantPair(
    teacherId,
    schoolYearId,
    await getStudentSectionId(studentId, schoolYearId),
    subjectId
  );
}

/**
 * Subject ids the teacher may lock/submit for one section in a school year:
 * the section's section_teacher_assignments pairs, plus any ELECTIVE subject
 * the teacher is granted at subject level (elective sheets list their pickers).
 */
export async function lockableSubjectIds(
  teacherId: number,
  schoolYearId: number,
  sectionId: number
): Promise<number[]> {
  const rows = await query<RowDataPacket[]>(
    `SELECT DISTINCT sta.subject_id
       FROM section_teacher_assignments sta
      WHERE sta.teacher_id = ? AND sta.school_year_id = ? AND sta.section_id = ?
      UNION
      SELECT DISTINCT tsa.subject_id
        FROM teacher_subject_assignments tsa
        JOIN subjects s ON s.id = tsa.subject_id AND s.subject_type = 'elective'
       WHERE tsa.teacher_id = ?
         AND (tsa.school_year_id = ? OR tsa.school_year_id IS NULL)`,
    [teacherId, schoolYearId, sectionId, teacherId, schoolYearId]
  );
  return rows.map((r) => Number(r.subject_id));
}

/**
 * SQL fragment for an EXISTS branch keyed to the teacher's per-section-subject
 * grants. `sectionExpr` must be the outer section expression (e.g. "s.section_id"
 * or "e.section_id"); supply schoolYearExpr to bind the year from the outer row
 * (e.g. "e.school_year_id"), or pass the year as an extra placeholder "?".
 * Adds NO parameters itself: the teacher id must be pushed by the caller at the
 * position marked T. When useYearPlaceholder is true the year "?" is the second
 * parameter directly after the teacher id.
 */
export function grantExistsSql(
  sectionExpr: string,
  useYearPlaceholder: boolean,
  schoolYearExpr?: string
): string {
  const year = useYearPlaceholder
    ? "?"
    : schoolYearExpr
      ? schoolYearExpr
      : "1=0";
  return `${sectionExpr} IN (
    SELECT sta.section_id FROM section_teacher_assignments sta
     WHERE sta.teacher_id = ? AND sta.school_year_id = ${year})`;
}
