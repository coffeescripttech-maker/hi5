import { query } from "../config/database";
import { RowDataPacket } from "mysql2";

/**
 * Teacher grant helpers — docs/new_requirement.txt R1, R11-R14.
 *
 * NEW model (Phase B "Subject Teachers"): section_teacher_assignments holds one
 * row per (section, subject, teacher, school year). The adviser designation
 * alone is NOT a grading grant (R1) — it remains only a READ scope (Phase E).
 *
 * Legacy grants stay honored as a fallback so subject/section-level rows made
 * before this rollout keep working:
 *   - teacher_subject_assignments  (subject-level, optional year)
 *   - teacher_section_assignments  (section-level, optional year)
 * Electives remain subject-level rosters (teacher_subject_assignments joined to
 * student_electives); they are never stored per section (R5/R12).
 *
 * Effective grant = NEW per-section pair OR legacy (subject-level x section-level).
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
