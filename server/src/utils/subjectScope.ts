/**
 * Curriculum-program and strand/track scoping for per-learner subject lists.
 *
 * A learner's report card must only list the subjects that belong to their
 * program and chosen track:
 *   - `subjects.program` NULL  → shared by every program (all core subjects)
 *   - `subjects.program` = X   → only learners whose `enrollment.program` = X
 *     (e.g. STE additions, ALS learning strands)
 *   - a subject linked in `subject_strand_tracks` (e.g. a TLE specialization) is
 *     shown only when the learner's `strand_track_id` matches one of its links.
 *
 * Subjects linked to no track stay visible to everyone (TLE/EPP), so the grouped
 * TLE learning area always keeps its heading row.
 *
 * Track filtering is only applied when a track is actually assigned: a learner
 * without a track keeps the existing behaviour (all shared + all track subjects)
 * so grade encoding is never blocked for unassigned learners.
 */
export interface SubjectScope {
  /** `enrollment.program`; falsy = no program restriction. */
  program?: string | null;
  /** `enrollment.strand_track_id`; falsy = no track restriction. */
  strandTrackId?: number | null;
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
  const clauses: string[] = [];
  const a = subjectAlias;

  if (scope.program) {
    clauses.push(`(${a}.program IS NULL OR ${a}.program = ?)`);
    params.push(scope.program);
  }

  if (scope.strandTrackId) {
    clauses.push(`(
      NOT EXISTS (SELECT 1 FROM subject_strand_tracks sst WHERE sst.subject_id = ${a}.id)
      OR ${a}.id IN (SELECT sst2.subject_id FROM subject_strand_tracks sst2 WHERE sst2.strand_track_id = ?)
    )`);
    params.push(scope.strandTrackId);
  }

  return clauses.length > 0 ? " AND " + clauses.join(" AND ") : "";
}
