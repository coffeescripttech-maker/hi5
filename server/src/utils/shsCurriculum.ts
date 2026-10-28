import { RowDataPacket } from "mysql2";
import { query } from "../config/database";

/**
 * Strengthened SHS Curriculum shared rules.
 *
 * - Grade 11/12 Mainstream and Open High School learners MUST have an active
 *   shs_track (Academic / TechPro). The old strand values are kept only for
 *   historical records and can no longer be newly selected.
 * - Electives belong to individual learners (student_electives) and apply only
 *   to non-ALS grades 11-12. ALS keeps its own learning strands.
 * - Electives may be switched off per school year (elective_year_exclusions);
 *   an off elective may not be NEWLY selected, while existing historical
 *   assignments and their grades are preserved untouched.
 */

export const SHS_TRACK_PROGRAMS = ["regular", "open_high"];

/** True when the elective feature applies to this program (never for ALS). */
export function electivesApplyToProgram(program: string | null | undefined): boolean {
  return (
    program != null &&
    !program.startsWith("als") &&
    SHS_TRACK_PROGRAMS.includes(program)
  );
}

/**
 * Create/update payload validation for elective picks. Returns error strings
 * accumulated per subject id (null on success).
 */
export async function validateElectivePick(
  subjectId: number,
  schoolYearId: number,
  gradeLevel: number
): Promise<string | null> {
  const rows = await query<RowDataPacket[]>(
    `SELECT s.name, s.is_active, s.subject_type, s.grade_level,
            (ex.subject_id IS NULL) AS is_offered
       FROM subjects s
       LEFT JOIN elective_year_exclusions ex
         ON ex.subject_id = s.id AND ex.school_year_id = ?
      WHERE s.id = ?`,
    [schoolYearId, subjectId]
  );
  if (rows.length === 0) return "Elective not found.";
  const s = rows[0];
  if (s.subject_type !== "elective") return `"${s.name}" is not an elective.`;
  if (Number(s.is_active) !== 1) return `"${s.name}" is not an active elective.`;
  if (Number(s.grade_level) !== Number(gradeLevel)) {
    return `"${s.name}" is not offered for this grade level.`;
  }
  if (Number(s.is_offered) !== 1) {
    return `"${s.name}" is switched off for this school year and can no longer be selected.`;
  }
  return null;
}

/**
 * Replace a learner's elective picks in one transaction, preserving rows that
 * survive the update (no duplicate / conflicting assignments).
 */
export async function saveStudentElectives(
  studentId: number,
  schoolYearId: number,
  subjectIds: number[],
  strandTrackId: number | null,
  assignedBy: number | null
): Promise<void> {
  const ids = [...new Set(subjectIds.filter((n) => Number.isFinite(n) && n > 0))];

  if (ids.length > 0) {
    await query(
      `INSERT INTO student_electives (student_id, school_year_id, subject_id, strand_track_id, assigned_by)
       VALUES ${ids.map(() => "(?, ?, ?, ?, ?)").join(", ")}
       ON DUPLICATE KEY UPDATE strand_track_id = VALUES(strand_track_id), assigned_by = VALUES(assigned_by)`,
      ids.flatMap((sid) => [studentId, schoolYearId, sid, strandTrackId, assignedBy])
    );
  }
  await query(
    `DELETE FROM student_electives
      WHERE student_id = ? AND school_year_id = ?
        AND subject_id NOT IN (${ids.map(() => "?").join(",") || "0"})`,
    [studentId, schoolYearId, ...ids]
  );
}

/**
 * Carry a learner's elective picks forward to the next school year as a
 * PROPOSED list (the Enrollment Committee reviews/edits before placement).
 * Matched by subject name + track; electives that were switched off or
 * retired for the new year are skipped and reported back.
 */
export async function carryOverElectives(
  studentId: number,
  fromSchoolYearId: number,
  toSchoolYearId: number,
  toGradeLevel: number,
  strandTrackId: number | null,
  assignedBy: number | null
): Promise<{ copied: string[]; skipped: string[] }> {
  const prev = await query<RowDataPacket[]>(
    `SELECT s.name FROM student_electives se
       JOIN subjects s ON s.id = se.subject_id
      WHERE se.student_id = ? AND se.school_year_id = ?
      ORDER BY s.name ASC`,
    [studentId, fromSchoolYearId]
  );
  if (prev.length === 0) return { copied: [], skipped: [] };

  const names = prev.map((r: RowDataPacket) => String(r.name));
  const ph = names.map(() => "?").join(",");
  const mapped = await query<RowDataPacket[]>(
    `SELECT s.id, s.name, (ex.subject_id IS NULL) AS is_offered
       FROM subjects s
       LEFT JOIN elective_year_exclusions ex
         ON ex.subject_id = s.id AND ex.school_year_id = ?
      WHERE s.name IN (${ph})
        AND s.subject_type = 'elective'
        AND s.grade_level = ? AND s.is_active = 1`,
    [toSchoolYearId, toGradeLevel, ...names]
  );

  const copied: string[] = [];
  const skipped: string[] = [];
  for (const name of names) {
    const row = mapped.find((m: RowDataPacket) => String(m.name) === name);
    if (!row) { skipped.push(`${name} (no matching offering)`); continue; }
    if (Number(row.is_offered) !== 1) { skipped.push(`${name} (switched off for the new school year)`); continue; }
    copied.push(name);
    await query(
      `INSERT INTO student_electives (student_id, school_year_id, subject_id, strand_track_id, assigned_by)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE assigned_by = VALUES(assigned_by)`,
      [studentId, toSchoolYearId, row.id, strandTrackId, assignedBy]
    );
  }
  return { copied, skipped };
}

/**
 * Validate an SHS track selection on enrollment create/update.
 * Returns an error message, or null when the track is valid.
 */
export async function validateEnrollmentTrack(
  program: string | null | undefined,
  gradeLevel: number,
  strandTrackId?: number | null
): Promise<string | null> {
  const numeric = strandTrackId == null || strandTrackId === undefined ? null : Number(strandTrackId);

  if (gradeLevel >= 11 && SHS_TRACK_PROGRAMS.includes(String(program || "regular"))) {
    if (!numeric) {
      return "A Track is required for Grade 11/12 enrollment (Academic or Technical-Professional).";
    }
  } else if (!numeric) {
    return null; // tracks are optional outside Mainstream/OHS SHS (JHS TLE etc.)
  }

  const tracks = await query<RowDataPacket[]>(
    "SELECT track_type, is_active FROM strand_tracks WHERE id = ?",
    [numeric]
  );
  if (tracks.length === 0) return "The selected track does not exist.";
  if (Number(tracks[0].is_active) !== 1) {
    return "The legacy strand is no longer offered — select the current Track (Academic or Technical-Professional).";
  }
  if (
    gradeLevel >= 11 &&
    SHS_TRACK_PROGRAMS.includes(String(program || "regular")) &&
    tracks[0].track_type !== "shs_track"
  ) {
    return "Grade 11/12 learners must use an Academic or Technical-Professional (TechPro) track.";
  }
  if (gradeLevel < 11 && tracks[0].track_type === "shs_track") {
    return "The Academic/TechPro track applies only to Grade 11 and Grade 12.";
  }
  return null;
}
