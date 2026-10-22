/**
 * Curriculum-program and strand/track scoping for per-learner subject lists.
 *
 * A learner's report card must only list the subjects that belong to their
 * program and chosen track:
 *   - `subjects.program` NULL  -> shared by every program (all core subjects)
 *   - `subjects.program` = X   -> only learners whose `enrollment.program` = X
 *     (e.g. STE additions, ALS learning strands)
 *   - a subject linked in `subject_strand_tracks` (e.g. a TLE specialization) is
 *     shown only when the learner's `strand_track_id` matches one of its links.
 *
 * Subjects linked to no track stay visible to everyone (TLE/EPP), so the grouped
 * TLE learning area always keeps its heading row.
 *
 * Track filtering applies to every non-ALS program: a learner WITH a track sees
 * only that track's specializations; a learner WITHOUT a track sees shared +
 * untracked subjects only (their program's additions still come through the
 * program clause). When grade-preservation context is provided, a subject that
 * already holds a saved grade for the learner in that term stays listed even if
 * it falls outside the track scope, so historical report cards/gradebook never
 * lose already-encoded rows.
 *
 * ALS learners (program `als_jhs` / `als_shs`) only ever see their six learning
 * strands (LS1-LS6, `subjects.program` = the ALS program). Shared JHS/SHS core
 * subjects are excluded for them - except when the school already invested
 * grades on shared subjects for that learner+term (always preserved) or when
 * the learner's grade level has no ALS subject rows at all (the shared offering
 * remains the safe fallback instead of a blank report card).
 *
 * When the program is unknown (no enrollment row for the school year), the
 * mainstream offering is assumed and every program-specific subject is filtered
 * out. Leaving the program clause off would let a learner who is not enrolled for
 * that year list the STE / SPFL / ALS additions on their report card.
 */
export interface SubjectScope {
  /** `enrollment.program`; falsy = no program restriction. */
  program?: string | null;
  /** `enrollment.strand_track_id`; falsy = no track restriction. */
  strandTrackId?: number | null;
  /**
   * Optional grade-preservation context (learner + school year). When set,
   * subjects with any saved grade for that learner/term stay listed even when
   * they fall outside this learner's program/track scope.
   */
  preserveStudentId?: number | null;
  preserveSchoolYearId?: number | null;
}

/** True for the Alternative Learning System programs whose offering is LS1-LS6. */
function isAlsProgram(program?: string | null): boolean {
  return program === "als_jhs" || program === "als_shs";
}

/**
 * Clause keeping subjects the learner already has grades on (history kept).
 * Pushes (student_id, school_year_id) onto params at call time - call it in the
 * exact position the fragment's placeholders appear.
 */
function gradePreserveClause(
  a: string,
  preserveStudentId: number,
  preserveSchoolYearId: number | null,
  params: any[]
): string {
  params.push(preserveStudentId, preserveSchoolYearId);
  return `${a}.id IN (
    SELECT k.subject_id FROM grades k
    WHERE k.student_id = ? AND k.school_year_id = ?
  )`;
}

/**
 * Build a SQL fragment that restricts `subjectAlias` rows to a learner's scope.
 * The fragment always begins with " AND " (or is empty) so it can be appended to
 * an existing WHERE clause. Placeholder values are pushed onto `params` in the
 * order they appear in the fragment.
 */
export function subjectScopeSql(
  subjectAlias: string,
  scope: SubjectScope,
  params: any[]
): string {
  const a = subjectAlias;
  const hasPreserve = scope.preserveStudentId != null;
  /** Pushes the preservation params when called; embed where the text sits. */
  const keepSql = () =>
    gradePreserveClause(a, scope.preserveStudentId as number, scope.preserveSchoolYearId ?? null, params);

  if (isAlsProgram(scope.program)) {
    // ALS: only the program's LS1-LS6 strands. Shared core subjects are hidden,
    // but always keep (a) already-graded subjects and (b) the shared fallback
    // when the learner's grade level has no ALS strands configured (prevents a
    // blank report card instead of showing random JHS/SHS cores).
    params.push(scope.program as string, scope.program as string);
    const keep = hasPreserve ? keepSql() : "";
    return ` AND (
      ${a}.program = ?
      OR (${a}.program IS NULL AND NOT EXISTS (
        SELECT 1 FROM subjects alsRef
        WHERE alsRef.is_active = 1 AND alsRef.program = ? AND alsRef.grade_level = ${a}.grade_level
      ))
      ${keep ? `OR ${keep}` : ""}
    )`;
  }

  const clauses: string[] = [];

  if (scope.program) {
    clauses.push(`(${a}.program IS NULL OR ${a}.program = ?)`);
    params.push(scope.program);
  } else {
    // Unknown program (usually "no enrollment for this school year"): assume the
    // mainstream offering so STE/SPFL/ALS subjects never surface for a learner
    // who is not enrolled in that program.
    clauses.push(`${a}.program IS NULL`);
  }

  if (scope.strandTrackId) {
    clauses.push(`(
      NOT EXISTS (SELECT 1 FROM subject_strand_tracks sst WHERE sst.subject_id = ${a}.id)
      OR ${a}.id IN (SELECT sst2.subject_id FROM subject_strand_tracks sst2 WHERE sst2.strand_track_id = ?)
    )`);
    params.push(scope.strandTrackId);
  } else if (hasPreserve) {
    // No track assigned: the learner follows the untracked offering (core +
    // untracked TLE/EPP + program additions). Tracked specializations only show
    // up when a grade already exists on them (record preservation).
    const keep = keepSql();
    clauses.push(`(
      NOT EXISTS (SELECT 1 FROM subject_strand_tracks sst WHERE sst.subject_id = ${a}.id)
      OR ${keep}
    )`);
  }

  return clauses.length > 0 ? " AND " + clauses.join(" AND ") : "";
}
