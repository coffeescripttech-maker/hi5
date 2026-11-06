import { query } from "../config/database";
import { RowDataPacket } from "mysql2";

/**
 * Adviser view (docs/new_requirement.txt R20–R22).
 *
 * Builds the advisory-section picture in one place:
 *   - every subject actually offered to each enrolled learner (program, track,
 *     elective pick, plus any subject that already holds a grade);
 *   - which quarters of that subject are still missing;
 *   - who owns the subject (per-section teacher assignment first, then the
 *     legacy subject-level roster used by electives).
 *
 * Used by GET /api/grades/section-status (the adviser's follow-up list) and by
 * the teacher bulk-promotion readiness gate ("once every subject has grades
 * for all three terms").
 */

export interface SectionGradeStatusLearner {
  student_id: number;
  name: string;
  lrn: string | null;
}

export interface SectionGradeStatusMissing {
  student_id: number;
  name: string;
  lrn: string | null;
  missing_quarters: number[];
}

export interface SectionGradeStatusSubject {
  subject_id: number;
  subject_name: string;
  subject_type: string | null;
  subject_group: string | null;
  teachers: { id: number; name: string }[];
  teacher_names: string | null;
  is_mine: boolean;
  expected_count: number;
  complete_count: number;
  missing_count: number;
  missing: SectionGradeStatusMissing[];
}

export interface SectionGradeStatus {
  section: RowDataPacket;
  learners: SectionGradeStatusLearner[];
  subjects: SectionGradeStatusSubject[];
  /** Learners missing at least one expected subject/quarter. */
  learners_with_missing: number;
  /** Subjects that have at least one missing learner/quarter. */
  subjects_with_missing: number;
  /** True when every learner has Q1–Q3 on every expected subject. */
  complete: boolean;
}

/**
 * Expected subjects per learner. Mirrors server/src/utils/subjectScope.ts:
 *   - ALS: the program's LS strands (shared fallback when none exist);
 *   - everyone else: shared + their program's additions, then track/elective
 *     narrowing, with any already-graded subject preserved.
 * Electives only appear when the learner actually picked them.
 */
const EXPECTED_SUBJECTS_SQL = `
  SELECT e.student_id,
         s.id AS subject_id,
         s.name AS subject_name,
         s.subject_type,
         s.subject_group
    FROM enrollments e
    JOIN students st ON st.id = e.student_id
    JOIN subjects s ON s.grade_level = st.grade_level AND s.is_active = 1
   WHERE e.section_id = ? AND e.school_year_id = ? AND e.status = 'enrolled'
     AND (
       CASE WHEN e.program IN ('als_jhs', 'als_shs') THEN
         (
           s.program = e.program
           OR (s.program IS NULL AND NOT EXISTS (
             SELECT 1 FROM subjects ar
              WHERE ar.is_active = 1 AND ar.program = e.program
                AND ar.grade_level = s.grade_level
           ))
           OR s.id IN (
             SELECT g.subject_id FROM grades g
              WHERE g.student_id = e.student_id
                AND g.school_year_id = e.school_year_id
           )
         )
       ELSE
         (
           (s.program IS NULL OR s.program = e.program)
           AND (s.subject_type <> 'elective' OR s.id IN (
             SELECT se.subject_id FROM student_electives se
              WHERE se.student_id = e.student_id
                AND se.school_year_id = e.school_year_id
           ))
           AND (
             NOT EXISTS (
               SELECT 1 FROM subject_strand_tracks x WHERE x.subject_id = s.id
             )
             OR s.id IN (
               SELECT x2.subject_id FROM subject_strand_tracks x2
                WHERE x2.strand_track_id <=> e.strand_track_id
             )
             OR s.id IN (
               SELECT se2.subject_id FROM student_electives se2
                WHERE se2.student_id = e.student_id
                  AND se2.school_year_id = e.school_year_id
             )
             OR s.id IN (
               SELECT g2.subject_id FROM grades g2
                WHERE g2.student_id = e.student_id
                  AND g2.school_year_id = e.school_year_id
             )
           )
         )
       END
     )
`;

export async function getSectionGradeStatus(
  sectionId: number,
  schoolYearId: number,
  teacherId?: number | null
): Promise<SectionGradeStatus | null> {
  const sections = await query<RowDataPacket[]>(
    "SELECT id, name, grade_level, section_type, adviser_id FROM sections WHERE id = ?",
    [sectionId]
  );
  if (sections.length === 0) return null;
  const section = sections[0];

  const learners = await query<RowDataPacket[]>(
    `SELECT e.student_id, st.name, st.lrn
       FROM enrollments e
       JOIN students st ON st.id = e.student_id
      WHERE e.section_id = ? AND e.school_year_id = ? AND e.status = 'enrolled'
      ORDER BY st.name ASC`,
    [sectionId, schoolYearId]
  );
  if (learners.length === 0) {
    return {
      section,
      learners: [],
      subjects: [],
      learners_with_missing: 0,
      subjects_with_missing: 0,
      complete: true,
    };
  }

  const learnerIds = learners.map((l) => Number(l.student_id));
  const expected = await query<RowDataPacket[]>(EXPECTED_SUBJECTS_SQL, [
    sectionId,
    schoolYearId,
  ]);
  if (expected.length === 0) {
    return {
      section,
      learners: learners.map((l) => ({
        student_id: Number(l.student_id),
        name: String(l.name),
        lrn: l.lrn ?? null,
      })),
      subjects: [],
      learners_with_missing: 0,
      subjects_with_missing: 0,
      complete: true,
    };
  }

  const subjectIds = [...new Set(expected.map((r) => Number(r.subject_id)))];
  const gradeRows = await query<RowDataPacket[]>(
    `SELECT g.student_id, g.subject_id, g.quarter, g.grade
       FROM grades g
      WHERE g.school_year_id = ?
        AND g.student_id IN (${learnerIds.map(() => "?").join(",")})
        AND g.subject_id IN (${subjectIds.map(() => "?").join(",")})
        AND g.grade IS NOT NULL`,
    [schoolYearId, ...learnerIds, ...subjectIds]
  );

  // Owner lookup: the per-section Subject Teachers assignment wins. The
  // subject-level roster is used ONLY for elective subjects (their teacher is
  // granted at subject level, not per section).
  const perSection = await query<RowDataPacket[]>(
    `SELECT sta.subject_id, u.id AS teacher_id, u.name AS teacher_name
       FROM section_teacher_assignments sta
       JOIN users u ON u.id = sta.teacher_id
      WHERE sta.section_id = ? AND sta.school_year_id = ?`,
    [sectionId, schoolYearId]
  );
  const legacy = await query<RowDataPacket[]>(
    `SELECT tsa.subject_id, s.subject_type, u.id AS teacher_id, u.name AS teacher_name
       FROM teacher_subject_assignments tsa
       JOIN subjects s ON s.id = tsa.subject_id AND s.subject_type = 'elective'
       JOIN users u ON u.id = tsa.teacher_id
      WHERE (tsa.school_year_id = ? OR tsa.school_year_id IS NULL)
        AND tsa.subject_id IN (${subjectIds.map(() => "?").join(",")})`,
    [schoolYearId, ...subjectIds]
  );

  const sectionOwners = new Map<number, Map<number, string>>();
  for (const r of perSection) {
    const sid = Number(r.subject_id);
    if (!sectionOwners.has(sid)) sectionOwners.set(sid, new Map());
    sectionOwners.get(sid)!.set(Number(r.teacher_id), String(r.teacher_name));
  }
  const legacyOwners = new Map<number, Map<number, string>>();
  for (const r of legacy) {
    const sid = Number(r.subject_id);
    if (!legacyOwners.has(sid)) legacyOwners.set(sid, new Map());
    legacyOwners.get(sid)!.set(Number(r.teacher_id), String(r.teacher_name));
  }

  const learnerMap = new Map(
    learners.map((l) => [
      Number(l.student_id),
      { student_id: Number(l.student_id), name: String(l.name), lrn: l.lrn ?? null },
    ])
  );

  // subject_id -> learner_id -> present quarters
  const expectedPairs = new Map<string, { learnerId: number; subjectId: number }>();
  const subjectMeta = new Map<
    number,
    { name: string; type: string | null; group: string | null; learners: Set<number> }
  >();
  for (const r of expected) {
    const subjectId = Number(r.subject_id);
    const learnerId = Number(r.student_id);
    expectedPairs.set(`${learnerId}|${subjectId}`, { learnerId, subjectId });
    if (!subjectMeta.has(subjectId)) {
      subjectMeta.set(subjectId, {
        name: String(r.subject_name),
        type: r.subject_type ?? null,
        group: r.subject_group ?? null,
        learners: new Set(),
      });
    }
    subjectMeta.get(subjectId)!.learners.add(learnerId);
  }

  const present = new Map<string, Set<number>>();
  for (const g of gradeRows) {
    const key = `${Number(g.student_id)}|${Number(g.subject_id)}`;
    if (!present.has(key)) present.set(key, new Set());
    present.get(key)!.add(Number(g.quarter));
  }

  const subjects: SectionGradeStatusSubject[] = [];
  let learnersWithMissing = new Set<number>();
  let subjectsWithMissing = 0;

  for (const subjectId of [...subjectMeta.keys()].sort((a, b) =>
    subjectMeta.get(a)!.name.localeCompare(subjectMeta.get(b)!.name)
  )) {
    const meta = subjectMeta.get(subjectId)!;
    const owners = sectionOwners.get(subjectId) ?? legacyOwners.get(subjectId) ?? new Map();
    const teachers = [...owners.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const missing: SectionGradeStatusMissing[] = [];
    for (const learnerId of meta.learners) {
      const quarters = present.get(`${learnerId}|${subjectId}`) ?? new Set<number>();
      const missingQuarters = [1, 2, 3].filter((q) => !quarters.has(q));
      if (missingQuarters.length === 0) continue;
      const learner = learnerMap.get(learnerId);
      if (!learner) continue;
      missing.push({ ...learner, missing_quarters: missingQuarters });
      learnersWithMissing.add(learnerId);
    }
    missing.sort((a, b) => a.name.localeCompare(b.name));
    if (missing.length > 0) subjectsWithMissing += 1;

    subjects.push({
      subject_id: subjectId,
      subject_name: meta.name,
      subject_type: meta.type,
      subject_group: meta.group,
      teachers,
      teacher_names: teachers.length > 0 ? teachers.map((t) => t.name).join(", ") : null,
      is_mine: teacherId != null && teachers.some((t) => t.id === Number(teacherId)),
      expected_count: meta.learners.size,
      complete_count: meta.learners.size - missing.length,
      missing_count: missing.length,
      missing,
    });
  }

  return {
    section,
    learners: [...learnerMap.values()],
    subjects,
    learners_with_missing: learnersWithMissing.size,
    subjects_with_missing: subjectsWithMissing,
    complete: learnersWithMissing.size === 0,
  };
}
