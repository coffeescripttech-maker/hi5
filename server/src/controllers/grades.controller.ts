import { Request, Response } from 'express';
import { query } from '../config/database';
import { logActivity } from '../utils/activityLogger';
import { collapseSubjectGroups } from '../utils/subjectGroups';
import { subjectScopeSql } from '../utils/subjectScope';
import { createNotification } from '../services/notify';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
// hi
/* ── Grade security helpers (Module: Grade Security) ─────────────────── */

/**
 * Subjects a teacher is assigned to teach for a school year
 * (teacher_subject_assignments). Rows without a school_year_id apply to all years.
 */
async function getTeacherSubjectIds(
  teacherId: number,
  schoolYearId: number
): Promise<Set<number>> {
  const rows = await query<RowDataPacket[]>(
    `SELECT subject_id FROM teacher_subject_assignments
     WHERE teacher_id = ? AND (school_year_id = ? OR school_year_id IS NULL)`,
    [teacherId, schoolYearId]
  );
  return new Set(rows.map(r => r.subject_id as number));
}

/**
 * Section ids a teacher advises (sections.adviser_id) or is assigned to
 * (teacher_section_assignments) for a school year.
 */
async function getTeacherSectionIds(
  teacherId: number,
  schoolYearId: number
): Promise<Set<number>> {
  const rows = await query<RowDataPacket[]>(
    `SELECT DISTINCT sec.id
     FROM sections sec
     LEFT JOIN teacher_section_assignments tsa
       ON tsa.section_id = sec.id AND (tsa.school_year_id = ? OR tsa.school_year_id IS NULL)
     WHERE sec.adviser_id = ? OR tsa.teacher_id = ?`,
    [schoolYearId, teacherId, teacherId]
  );
  return new Set(rows.map(r => r.id as number));
}

/**
 * Grade-read privacy: a teacher may only read grades for learners they advise
 * or teach in an assigned section — exactly the roster /api/students and
 * /api/enrollments already expose to them (no pending "Awaiting Section"
 * queue). Returns a `student_id` predicate for filtering bulk reads.
 */
function teacherStudentScopeSql(
  studentIdExpr: string,
  teacherId: number,
  params: any[]
): string {
  params.push(teacherId, teacherId);
  return `${studentIdExpr} IN (
    SELECT en.student_id FROM enrollments en
    LEFT JOIN sections sec ON en.section_id = sec.id
    WHERE en.status = 'enrolled'
      AND (sec.adviser_id = ?
        OR en.section_id IN (SELECT tsa.section_id FROM teacher_section_assignments tsa WHERE tsa.teacher_id = ?))
  )`;
}

/** True when this teacher may read a single learner's grades. */
async function teacherMayReadGrades(
  teacherId: number,
  studentId: number | string
): Promise<boolean> {
  const rows = await query<RowDataPacket[]>(
    `SELECT 1 FROM students stu
     WHERE stu.id = ? AND stu.id IN (
       SELECT en.student_id FROM enrollments en
       LEFT JOIN sections sec ON en.section_id = sec.id
       WHERE en.status = 'enrolled'
         AND (sec.adviser_id = ?
           OR en.section_id IN (SELECT tsa.section_id FROM teacher_section_assignments tsa WHERE tsa.teacher_id = ?))
     )
     LIMIT 1`,
    [studentId, teacherId, teacherId]
  );
  return rows.length > 0;
}

/** Section id a student is enrolled in for a school year (or null). */
async function getStudentSectionId(
  studentId: number,
  schoolYearId: number
): Promise<number | null> {
  const rows = await query<RowDataPacket[]>(
    `SELECT e.section_id FROM enrollments e
     WHERE e.student_id = ? AND e.school_year_id = ? AND e.status = 'enrolled' LIMIT 1`,
    [studentId, schoolYearId]
  );
  return rows.length > 0 ? (rows[0].section_id as number) : null;
}

/**
 * Subject ids a learner's enrolment actually offers: their grade level's active
 * subjects filtered by program and (when assigned) strand/track. Empty when the
 * learner is not enrolled for that school year.
 */
async function getLearnerOfferingSubjectIds(
  studentId: number,
  schoolYearId: number
): Promise<Set<number>> {
  const enrollment = await query<RowDataPacket[]>(
    `SELECT e.program, e.strand_track_id, stu.grade_level
     FROM enrollments e
     JOIN students stu ON stu.id = e.student_id
     WHERE e.student_id = ? AND e.school_year_id = ? AND e.status = 'enrolled'
     ORDER BY e.id DESC LIMIT 1`,
    [studentId, schoolYearId]
  );
  if (enrollment.length === 0) return new Set();

  const params: any[] = [Number(enrollment[0].grade_level)];
  const scope = subjectScopeSql(
    's',
    {
      program: enrollment[0].program,
      strandTrackId: enrollment[0].strand_track_id,
      preserveStudentId: studentId,
      preserveSchoolYearId: schoolYearId
    },
    params
  );
  const rows = await query<RowDataPacket[]>(
    `SELECT s.id FROM subjects s
     WHERE s.is_active = 1 AND s.grade_level = ?${scope}`,
    params
  );
  return new Set(rows.map(r => Number(r.id)));
}

/**
 * Grade-entry offering rule: a teacher may only encode a subject the learner's
 * enrolment actually offers — the same program/strand scope the gradebook read
 * uses. Without this a teacher assigned to (say) Advanced Science could still
 * save it against a mainstream learner in her advisory section.
 */
async function isSubjectOfferedToLearner(
  studentId: number,
  schoolYearId: number,
  subjectId: number
): Promise<boolean> {
  const offered = await getLearnerOfferingSubjectIds(studentId, schoolYearId);
  return offered.has(Number(subjectId));
}

/** True when the configured grade-edit deadline has passed (teacher read-only). */
async function isPastGradeDeadline(): Promise<boolean> {
  const rows = await query<RowDataPacket[]>(
    `SELECT grade_deadline_enabled, grade_edit_deadline FROM school_settings WHERE id = 1 LIMIT 1`
  );
  const s = rows[0] as RowDataPacket | undefined;
  if (!s) return false;
  if (Number(s.grade_deadline_enabled) !== 1 || !s.grade_edit_deadline)
    return false;
  return new Date(String(s.grade_edit_deadline)).getTime() < Date.now();
}

/**
 * Enforce teacher grade-encoding scope: teachers may only encode grades for
 * subjects they are assigned to teach AND students in their advisory/assigned
 * sections. Returns an error message when blocked, otherwise null.
 */
async function teacherGradeBlockReason(
  teacherId: number,
  schoolYearId: number,
  subjectId: number,
  studentId: number
): Promise<string | null> {
  if (await isPastGradeDeadline()) {
    return 'The grade editing deadline has passed. Grades are now read-only — contact the Registrar for corrections.';
  }
  const [allowedSubjects, teacherSections] = await Promise.all([
    getTeacherSubjectIds(teacherId, schoolYearId),
    getTeacherSectionIds(teacherId, schoolYearId)
  ]);
  if (!allowedSubjects.has(subjectId)) {
    return 'Access denied: you may only encode grades for subjects assigned to you.';
  }
  const studentSection = await getStudentSectionId(studentId, schoolYearId);
  if (!studentSection || !teacherSections.has(studentSection)) {
    return 'Access denied: you may only encode grades for students in your advisory section.';
  }
  if (!(await isSubjectOfferedToLearner(studentId, schoolYearId, subjectId))) {
    return 'Access denied: this subject is not offered to the learner.';
  }
  return null;
}

/**
 * GET /api/grades — Get grades with filters
 * Query: ?student_id=1&school_year_id=1&subject_id=1&section_id=1
 *
 * If no student_id, returns gradebook for a section (all students + subjects pivoted)
 */
export async function getGrades(req: Request, res: Response): Promise<void> {
  try {
    const { student_id, school_year_id, subject_id, section_id, quarter } =
      req.query;

    // Single student grades (pivoted by quarter)
    if (student_id) {
      // Privacy: a teacher may only read grades for learners in their own
      // sections — IDs of other students must not be usable as an oracle.
      if (
        req.user!.role === 'teacher' &&
        !(await teacherMayReadGrades(req.user!.userId, String(student_id)))
      ) {
        res.status(403).json({
          error: 'Access denied. This learner is not in your section.'
        });
        return;
      }

      const params: any[] = [student_id];
      let syFilter = '';
      if (school_year_id) {
        syFilter = ' AND g.school_year_id = ?';
        params.push(school_year_id);
      }

      // Get student's strand track and program from their current enrollment
      const enrollmentInfo = await query<RowDataPacket[]>(
        `SELECT e.strand_track_id, e.program, e.school_year_id FROM enrollments e
         WHERE e.student_id = ?${school_year_id ? ' AND e.school_year_id = ?' : " AND e.status = 'enrolled'"}
         ORDER BY e.school_year_id DESC LIMIT 1`,
        school_year_id ? [student_id, school_year_id] : [student_id]
      );
      const strandTrackId = (enrollmentInfo[0] as any)?.strand_track_id || null;
      const enrollmentProgram = (enrollmentInfo[0] as any)?.program || null;
      const effSchoolYearId =
        Number(school_year_id) ||
        Number((enrollmentInfo[0] as any)?.school_year_id) ||
        null;

      // Build grade params — first two are for student_id in JOIN and ON clause
      const gradeParams: any[] = [student_id, student_id];
      if (school_year_id) {
        gradeParams.push(school_year_id);
      }

      // Scope subjects to the learner's program and (when assigned) strand/track.
      const scopeWhere = subjectScopeSql(
        's',
        {
          program: enrollmentProgram,
          strandTrackId,
          preserveStudentId: Number(student_id),
          preserveSchoolYearId: effSchoolYearId
        },
        gradeParams
      );

      // A subject that already has a saved grade row for this learner is always
      // returned, even when it falls outside the current scope (inactive subject,
      // different program/strand, or the learner's grade_level has since drifted).
      // Rows that only qualify this way are flagged `in_offering = 0` so the UI can
      // show why they are there instead of silently hiding a saved grade.
      const savedGradeExists = school_year_id
        ? 'EXISTS (SELECT 1 FROM grades g2 WHERE g2.subject_id = s.id AND g2.student_id = ? AND g2.school_year_id = ?)'
        : 'EXISTS (SELECT 1 FROM grades g2 WHERE g2.subject_id = s.id AND g2.student_id = ?)';
      if (school_year_id) {
        gradeParams.push(student_id, school_year_id);
      } else {
        gradeParams.push(student_id);
      }

      const inOffering = `(s.grade_level = stu.grade_level AND s.is_active = 1${scopeWhere})`;
      const whereClause = `${inOffering} OR ${savedGradeExists}`;

      const grades = await query<RowDataPacket[]>(
        `SELECT s.id AS subject_id, s.name AS subject_name, s.subject_type,
                s.program AS subject_program,
                MAX(CASE WHEN g.quarter = 1 THEN g.grade END) AS q1,
                MAX(CASE WHEN g.quarter = 2 THEN g.grade END) AS q2,
                MAX(CASE WHEN g.quarter = 3 THEN g.grade END) AS q3,
                ROUND(AVG(g.grade), 2) AS final_average,
                MAX(g.is_locked) AS is_locked,
                MAX(CASE WHEN g.quarter = 1 THEN g.is_locked ELSE 0 END) AS q1_locked,
                MAX(CASE WHEN g.quarter = 2 THEN g.is_locked ELSE 0 END) AS q2_locked,
                MAX(CASE WHEN g.quarter = 3 THEN g.is_locked ELSE 0 END) AS q3_locked,
                MAX(CASE WHEN g.quarter = 1 THEN 1 ELSE 0 END) AS q1_exists,
                MAX(CASE WHEN g.quarter = 2 THEN 1 ELSE 0 END) AS q2_exists,
                MAX(CASE WHEN g.quarter = 3 THEN 1 ELSE 0 END) AS q3_exists
         FROM subjects s
         JOIN students stu ON stu.id = ?
         LEFT JOIN grades g ON g.subject_id = s.id AND g.student_id = ?${syFilter}
         WHERE ${whereClause}
         GROUP BY s.id, s.name, s.subject_type, s.program
         ORDER BY s.name ASC`,
        gradeParams
      );

      // Get enrollment info
      const enrollments = await query<RowDataPacket[]>(
        `SELECT e.id AS enrollment_id, e.school_year_id, e.section_id, sec.name AS section_name, sy.sy_label
         FROM enrollments e
         JOIN sections sec ON e.section_id = sec.id
         JOIN school_years sy ON e.school_year_id = sy.id
         WHERE e.student_id = ?${school_year_id ? ' AND e.school_year_id = ?' : ''}
         ORDER BY sy.is_current DESC
         LIMIT 1`,
        school_year_id ? [student_id, school_year_id] : [student_id]
      );

      // Flag rows that are only present because a grade is already saved against
      // them (not part of the learner's offering), so the client can tag them.
      const offeredIds = effSchoolYearId
        ? await getLearnerOfferingSubjectIds(Number(student_id), effSchoolYearId)
        : new Set<number>();
      const subjects = grades.map(g => ({
        ...g,
        in_offering: offeredIds.has(Number(g.subject_id)) ? 1 : 0
      }));

      res.json({
        student_id,
        enrollment: enrollments[0] || null,
        subjects
      });
      return;
    }

    // Gradebook for a section (all students × subjects)
    if (section_id && school_year_id) {
      if (req.user!.role === 'teacher') {
        const ownSections = await getTeacherSectionIds(
          req.user!.userId,
          parseInt(school_year_id as string)
        );
        if (!ownSections.has(parseInt(section_id as string))) {
          res
            .status(403)
            .json({ error: 'Access denied. This section is not yours.' });
          return;
        }
      }
      const grades = await query<RowDataPacket[]>(
        `SELECT st.id AS student_id, st.name AS student_name, st.student_id,
                s.id AS subject_id, s.name AS subject_name,
                g.quarter, g.grade, g.is_locked
         FROM enrollments e
         JOIN students st ON e.student_id = st.id
         JOIN sections sec ON e.section_id = sec.id
         CROSS JOIN subjects s
         LEFT JOIN grades g ON g.student_id = st.id AND g.subject_id = s.id AND g.school_year_id = e.school_year_id
         WHERE e.section_id = ? AND e.school_year_id = ? AND e.status = 'enrolled'
           AND s.grade_level = sec.grade_level
         ORDER BY st.name ASC, s.name ASC, g.quarter ASC`,
        [section_id, school_year_id]
      );

      res.json(grades);
      return;
    }

    // Raw grades list with filters.
    // Note: g.* already carries the numeric student_id FK — alias the student's
    // display id so it doesn't shadow it.
    let sql = `
      SELECT g.*, s.name AS student_name, s.student_id AS student_display_id, sub.name AS subject_name
      FROM grades g
      JOIN students s ON g.student_id = s.id
      JOIN subjects sub ON g.subject_id = sub.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (school_year_id) {
      conditions.push('g.school_year_id = ?');
      params.push(school_year_id);
    }
    if (subject_id) {
      conditions.push('g.subject_id = ?');
      params.push(subject_id);
    }
    if (quarter) {
      conditions.push('g.quarter = ?');
      params.push(quarter);
    }
    // Privacy: bulk grade reads are filtered to a teacher's own roster.
    if (req.user!.role === 'teacher') {
      conditions.push(
        teacherStudentScopeSql('g.student_id', req.user!.userId, params)
      );
    }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql +=
      ' ORDER BY g.school_year_id DESC, g.student_id ASC, g.subject_id ASC, g.quarter ASC';

    const result = await query<RowDataPacket[]>(sql, params);
    res.json(result);
    return;
  } catch (error) {
    console.error('Get grades error:', error);
    res.status(500).json({ error: 'Failed to fetch grades.' });
  }
}

/**
 * POST /api/grades — Create or update (upsert) a single grade
 * Body: { student_id, subject_id, school_year_id, quarter, grade }
 */
export async function upsertGrade(req: Request, res: Response): Promise<void> {
  try {
    const { student_id, subject_id, school_year_id, quarter, grade } = req.body;

    if (!student_id || !subject_id || !school_year_id || !quarter) {
      res.status(400).json({
        error:
          'Missing required fields: student_id, subject_id, school_year_id, quarter.'
      });
      return;
    }

    if (quarter < 1 || quarter > 3) {
      res.status(400).json({ error: 'Quarter must be between 1 and 3.' });
      return;
    }

    // Get enrollment_id for this student + school year
    const enrollments = await query<RowDataPacket[]>(
      "SELECT id FROM enrollments WHERE student_id = ? AND school_year_id = ? AND status = 'enrolled' LIMIT 1",
      [student_id, school_year_id]
    );
    if (enrollments.length === 0) {
      res.status(400).json({
        error:
          'Student is not enrolled in this school year. Please enroll first.'
      });
      return;
    }
    const enrollment_id = enrollments[0].id;

    // Grade security: teachers encode only their assigned subject + advisory section.
    if (req.user!.role === 'teacher') {
      const blockReason = await teacherGradeBlockReason(
        req.user!.userId,
        school_year_id,
        subject_id,
        student_id
      );
      if (blockReason) {
        res.status(403).json({ error: blockReason });
        return;
      }
    }

    // Check if grade is locked
    const lockedCheck = await query<RowDataPacket[]>(
      'SELECT id FROM grades WHERE student_id = ? AND subject_id = ? AND school_year_id = ? AND quarter = ? AND is_locked = 1',
      [student_id, subject_id, school_year_id, quarter]
    );
    if (lockedCheck.length > 0) {
      res
        .status(403)
        .json({ error: 'Grade is locked and cannot be modified.' });
      return;
    }

    // Sheet-level guard: "Lock & Finalize" freezes the learner's whole sheet,
    // but lockGrades can only flag rows that already exist. A cell that was
    // empty at lock time has no row, so without this guard a brand-new INSERT
    // would silently bypass the lock. If any other cell in this sheet is
    // locked, the sheet is finalized — only registrar-approved corrections
    // (which operate on rows that exist) may reopen it.
    const existingCell = await query<RowDataPacket[]>(
      'SELECT id FROM grades WHERE student_id = ? AND subject_id = ? AND school_year_id = ? AND quarter = ?',
      [student_id, subject_id, school_year_id, quarter]
    );
    if (existingCell.length === 0) {
      const sheetLocked = await query<RowDataPacket[]>(
        'SELECT id FROM grades WHERE student_id = ? AND school_year_id = ? AND is_locked = 1 LIMIT 1',
        [student_id, school_year_id]
      );
      if (sheetLocked.length > 0) {
        res.status(403).json({
          error:
            'Grade sheet is locked. Submit a correction request to unlock it.'
        });
        return;
      }
    }

    // Upsert
    await query<ResultSetHeader>(
      `INSERT INTO grades (student_id, subject_id, enrollment_id, school_year_id, quarter, grade)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE grade = VALUES(grade), updated_at = NOW()`,
      [
        student_id,
        subject_id,
        enrollment_id,
        school_year_id,
        quarter,
        grade ?? null
      ]
    );

    await logActivity(
      req.user!.userId,
      `Updated grade for student ID ${student_id}, subject ID ${subject_id}, Q${quarter}`,
      'grades',
      null
    );

    res.json({ message: 'Grade saved successfully.' });
  } catch (error) {
    console.error('Upsert grade error:', error);
    res.status(500).json({ error: 'Failed to save grade.' });
  }
}

/**
 * POST /api/grades/batch — Upsert multiple grades at once
 * Body: { grades: [{ student_id, subject_id, school_year_id, quarter, grade }] }
 *
 * Set-based (one round-trip per sheet): scope checks, lock checks, and the
 * upsert itself are batched so saving a 12-subject × 3-quarter sheet takes a
 * single request instead of dozens of sequential ones.
 */
export async function batchUpsertGrades(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { grades } = req.body;

    if (!grades || !Array.isArray(grades) || grades.length === 0) {
      res.status(400).json({ error: 'Grades array is required.' });
      return;
    }

    // Normalize: keep valid rows, dedupe by (student, subject, sy, quarter) —
    // last value wins.
    const rows = new Map<
      string,
      { student_id: number; subject_id: number; school_year_id: number; quarter: number; grade: number | null }
    >();
    for (const g of grades) {
      const { student_id, subject_id, school_year_id, quarter } = g;
      if (!student_id || !subject_id || !school_year_id) continue;
      if (!quarter || quarter < 1 || quarter > 3) continue;
      rows.set(`${student_id}|${subject_id}|${school_year_id}|${quarter}`, {
        student_id: Number(student_id),
        subject_id: Number(subject_id),
        school_year_id: Number(school_year_id),
        quarter: Number(quarter),
        grade: g.grade ?? null
      });
    }
    const rowList = [...rows.values()];
    if (rowList.length === 0) {
      res.status(400).json({ error: 'No valid grade rows.' });
      return;
    }

    const studentIds = [...new Set(rowList.map(r => r.student_id))];
    const schoolYearIds = [...new Set(rowList.map(r => r.school_year_id))];

    let enrollmentMap = new Map<string, number>();
    const enrollQ = `SELECT id, student_id, school_year_id, section_id FROM enrollments WHERE student_id IN (${studentIds
      .map(() => '?')
      .join(',')}) AND school_year_id IN (${schoolYearIds
      .map(() => '?')
      .join(',')}) AND status = 'enrolled'`;
    const enrollRows = await query<RowDataPacket[]>(enrollQ, [
      ...studentIds,
      ...schoolYearIds
    ]);
    for (const e of enrollRows) {
      enrollmentMap.set(`${e.student_id}|${e.school_year_id}`, Number(e.id));
    }

    if (req.user!.role === 'teacher') {
      if (await isPastGradeDeadline()) {
        res
          .status(403)
          .json({
            error:
              'The grade editing deadline has passed. Grades are now read-only — contact the Registrar for corrections.'
          });
        return;
      }
      // Scope checks once per request, not once per row: allowed subjects,
      // own sections, per-learner offered subjects.
      const [allowedSubjects, teacherSections] = await Promise.all([
        getTeacherSubjectIds(req.user!.userId, rowList[0].school_year_id),
        getTeacherSectionIds(req.user!.userId, rowList[0].school_year_id)
      ]);
      for (const studentId of studentIds) {
        const enrollment = enrollRows.find(
          e => Number(e.student_id) === studentId &&
            Number(e.school_year_id) === rowList[0].school_year_id
        );
        if (!enrollment || !enrollment.section_id || !teacherSections.has(Number(enrollment.section_id))) {
          res
            .status(403)
            .json({
              error:
                'Access denied: you may only encode grades for students in your advisory section.'
            });
          return;
        }
        const offered = await getLearnerOfferingSubjectIds(
          studentId,
          rowList[0].school_year_id
        );
        for (const r of rowList.filter(x => x.student_id === studentId)) {
          if (!allowedSubjects.has(r.subject_id)) {
            res
              .status(403)
              .json({
                error:
                  'Access denied: you may only encode grades for subjects assigned to you.'
              });
            return;
          }
          if (!offered.has(r.subject_id)) {
            res
              .status(403)
              .json({
                error: 'Access denied: this subject is not offered to the learner.'
              });
            return;
          }
        }
      }
    }

    // Existing lock state fetched once for every involved (student, sy).
    const existing = await query<RowDataPacket[]>(
      `SELECT student_id, subject_id, school_year_id, quarter, is_locked
       FROM grades
       WHERE student_id IN (${studentIds.map(() => '?').join(',')})
         AND school_year_id IN (${schoolYearIds.map(() => '?').join(',')})`,
      [...studentIds, ...schoolYearIds]
    );
    const cellLocked = new Set<string>();
    const cellExists = new Set<string>();
    const sheetLocked = new Set<number>();
    for (const g of existing) {
      const key = `${g.student_id}|${g.subject_id}|${g.school_year_id}|${g.quarter}`;
      cellExists.add(key);
      if (Number(g.is_locked) === 1) {
        cellLocked.add(key);
        sheetLocked.add(Number(g.student_id));
      }
    }

    // One batched upsert; skip locked cells and frozen cells on locked sheets.
    const inserts: (number | string | null)[][] = [];
    for (const r of rowList) {
      const key = `${r.student_id}|${r.subject_id}|${r.school_year_id}|${r.quarter}`;
      if (cellLocked.has(key)) continue;
      if (sheetLocked.has(r.student_id) && !cellExists.has(key)) continue;
      const enrollmentId = enrollmentMap.get(
        `${r.student_id}|${r.school_year_id}`
      );
      if (!enrollmentId) continue;
      inserts.push([
        r.student_id,
        r.subject_id,
        enrollmentId,
        r.school_year_id,
        r.quarter,
        r.grade
      ]);
    }

    if (inserts.length > 0) {
      for (let i = 0; i < inserts.length; i += 500) {
        const chunk = inserts.slice(i, i + 500);
        const valuesSql = chunk
          .map(() => '(?, ?, ?, ?, ?, ?)')
          .join(', ');
        const flat = chunk.flat();
        await query<ResultSetHeader>(
          `INSERT INTO grades (student_id, subject_id, enrollment_id, school_year_id, quarter, grade)
           VALUES ${valuesSql}
           ON DUPLICATE KEY UPDATE grade = VALUES(grade), updated_at = NOW()`,
          flat
        );
      }
    }

    await logActivity(
      req.user!.userId,
      `Batch imported ${inserts.length} grades`,
      'grades',
      null
    );
    res.json({ message: `${inserts.length} grades saved successfully.` });
  } catch (error) {
    console.error('Batch upsert error:', error);
    res.status(500).json({ error: 'Failed to save grades.' });
  }
}

/**
 * POST /api/grades/lock — Lock grades for a student/subject or whole section
 * Body: { student_id?, subject_id?, school_year_id, section_id?, quarter? }
 */
export async function lockGrades(req: Request, res: Response): Promise<void> {
  try {
    const { student_id, subject_id, school_year_id, section_id, quarter } =
      req.body;

    if (!school_year_id) {
      res.status(400).json({ error: 'school_year_id is required.' });
      return;
    }

    let sql =
      'UPDATE grades SET is_locked = 1, locked_at = NOW(), locked_by = ? WHERE school_year_id = ?';
    const params: any[] = [req.user!.userId, school_year_id];

    if (student_id) {
      sql += ' AND student_id = ?';
      params.push(student_id);
    }
    if (subject_id) {
      sql += ' AND subject_id = ?';
      params.push(subject_id);
    }
    if (section_id) {
      sql +=
        ' AND student_id IN (SELECT student_id FROM enrollments WHERE section_id = ? AND school_year_id = ?)';
      params.push(section_id, school_year_id);
    }
    if (quarter) {
      sql += ' AND quarter = ?';
      params.push(quarter);
    }

    const result = await query<ResultSetHeader>(sql, params);

    await logActivity(
      req.user!.userId,
      `Locked ${result.affectedRows} grade(s)`,
      'grades',
      null
    );

    if (result.affectedRows > 0) {
      // Real-time notification: grades submitted/locked (SSE push, no refresh).
      createNotification({
        title: 'Grades Submitted',
        message: `${result.affectedRows} grade(s) were submitted and locked for review.`,
        type: 'info'
      });
    }

    res.json({ message: `${result.affectedRows} grade(s) locked.` });
  } catch (error) {
    console.error('Lock grades error:', error);
    res.status(500).json({ error: 'Failed to lock grades.' });
  }
}

/**
 * POST /api/grades/unlock — Unlock grades
 * Body: { student_id?, subject_id?, school_year_id, section_id?, quarter? }
 */
export async function unlockGrades(req: Request, res: Response): Promise<void> {
  try {
    const { student_id, subject_id, school_year_id, section_id, quarter } =
      req.body;

    if (!school_year_id) {
      res.status(400).json({ error: 'school_year_id is required.' });
      return;
    }

    let sql =
      'UPDATE grades SET is_locked = 0, locked_at = NULL, locked_by = NULL WHERE school_year_id = ?';
    const params: any[] = [school_year_id];

    if (student_id) {
      sql += ' AND student_id = ?';
      params.push(student_id);
    }
    if (subject_id) {
      sql += ' AND subject_id = ?';
      params.push(subject_id);
    }
    if (section_id) {
      sql +=
        ' AND student_id IN (SELECT student_id FROM enrollments WHERE section_id = ? AND school_year_id = ?)';
      params.push(section_id, school_year_id);
    }
    if (quarter) {
      sql += ' AND quarter = ?';
      params.push(quarter);
    }

    const result = await query<ResultSetHeader>(sql, params);

    await logActivity(
      req.user!.userId,
      `Unlocked ${result.affectedRows} grade(s)`,
      'grades',
      null
    );
    res.json({ message: `${result.affectedRows} grade(s) unlocked.` });
  } catch (error) {
    console.error('Unlock grades error:', error);
    res.status(500).json({ error: 'Failed to unlock grades.' });
  }
}

/**
 * GET /api/grades/compute/averages — Compute general average for a student
 * Query: ?student_id=1&school_year_id=1
 */
interface SubjectAverageRow extends RowDataPacket {
  subject_id: number;
  subject_name: string;
  subject_type: string;
  subject_average: number;
}

/** Aggregate rows may include the synthetic MAPEH entry (plain object, no RowDataPacket brand). */
type SubjectAverageEntry = {
  subject_id: number;
  subject_name: string;
  subject_type: string;
  subject_average: number;
};

export async function computeAverages(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { student_id, school_year_id } = req.query;

    if (!student_id || !school_year_id) {
      res
        .status(400)
        .json({ error: 'student_id and school_year_id are required.' });
      return;
    }

    const averages = await query<SubjectAverageRow[]>(
      `SELECT s.id AS subject_id, s.name AS subject_name, s.subject_type, s.subject_group,
              ROUND(AVG(g.grade), 2) AS subject_average
       FROM subjects s
       JOIN grades g ON g.subject_id = s.id
       WHERE g.student_id = ? AND g.school_year_id = ?
       GROUP BY s.id, s.name, s.subject_type, s.subject_group
       ORDER BY s.name ASC`,
      [student_id, school_year_id]
    );

    // Grouped learning areas (MAPEH components, TLE specializations) report — and
    // count toward the general average — as a single subject.
    const subjectsForAverage = collapseSubjectGroups(
      averages as any[]
    ) as SubjectAverageEntry[];

    const generalAverage =
      subjectsForAverage.length > 0
        ? Math.round(
            (subjectsForAverage.reduce(
              (sum: number, a: any) => sum + parseFloat(a.subject_average || 0),
              0
            ) /
              subjectsForAverage.length) *
              100
          ) / 100
        : null;

    res.json({
      student_id: parseInt(student_id as string),
      school_year_id: parseInt(school_year_id as string),
      general_average: generalAverage,
      subject_averages: subjectsForAverage
    });
  } catch (error) {
    console.error('Compute averages error:', error);
    res.status(500).json({ error: 'Failed to compute averages.' });
  }
}

/**
 * GET /api/grades/history — Full grade history for a student, grouped by school year
 * Query: ?student_id=1
 *
 * Unlike the standard pivot (which only lists subjects for the student's CURRENT
 * grade level), history is driven by the student's enrollments so past school
 * years (e.g. Grade 7 after promotion to Grade 8) still appear. MAPEH components
 * are collapsed into a single subject row, matching the report card.
 */
export async function getGradeHistory(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const student_id = parseInt(req.query.student_id as string);
    if (!student_id || isNaN(student_id)) {
      res.status(400).json({ error: 'student_id is required.' });
      return;
    }

    // Privacy: teachers may only read history for their own learners.
    if (
      req.user!.role === 'teacher' &&
      !(await teacherMayReadGrades(req.user!.userId, student_id))
    ) {
      res
        .status(403)
        .json({ error: 'Access denied. This learner is not in your section.' });
      return;
    }

    // Every school year the student was enrolled in, with that year's section grade level
    const enrollments = await query<RowDataPacket[]>(
      `SELECT e.school_year_id, sec.grade_level, sec.name AS section_name, sy.sy_label
       FROM enrollments e
       LEFT JOIN sections sec ON e.section_id = sec.id
       JOIN school_years sy ON e.school_year_id = sy.id
       WHERE e.student_id = ?
       ORDER BY e.school_year_id ASC`,
      [student_id]
    );

    const schoolYears: any[] = [];
    for (const enroll of enrollments as any[]) {
      const subjects = await query<RowDataPacket[]>(
        `SELECT s.id AS subject_id, s.name AS subject_name, s.subject_type, s.subject_group,
                MAX(CASE WHEN g.quarter = 1 THEN g.grade END) AS q1,
                MAX(CASE WHEN g.quarter = 2 THEN g.grade END) AS q2,
                MAX(CASE WHEN g.quarter = 3 THEN g.grade END) AS q3,
                ROUND(AVG(g.grade), 2) AS final_average
         FROM grades g
         JOIN subjects s ON g.subject_id = s.id
         WHERE g.student_id = ? AND g.school_year_id = ?
         GROUP BY s.id, s.name, s.subject_type, s.subject_group
         ORDER BY s.name ASC`,
        [student_id, enroll.school_year_id]
      );

      // Collapse MAPEH components and grouped learning areas (TLE specializations)
      // into one subject row, matching the report card.
      const collapsed = collapseSubjectGroups(subjects as any[], [
        'q1',
        'q2',
        'q3',
        'final_average'
      ]);

      const graded = collapsed.filter((s: any) => s.final_average !== null);
      const general_average =
        graded.length > 0
          ? Math.round(
              (graded.reduce(
                (sum: number, s: any) => sum + parseFloat(s.final_average),
                0
              ) /
                graded.length) *
                100
            ) / 100
          : null;

      schoolYears.push({
        school_year_id: enroll.school_year_id,
        sy_label: enroll.sy_label,
        grade_level: enroll.grade_level ?? null,
        section_name: enroll.section_name ?? null,
        general_average,
        subjects: collapsed
      });
    }

    res.json({ student_id, school_years: schoolYears });
  } catch (error) {
    console.error('Grade history error:', error);
    res.status(500).json({ error: 'Failed to fetch grade history.' });
  }
}

/**
 * GET /api/grades/distribution — Grade distribution per subject
 * Query: ?school_year_id=1&grade_level=7&section_id=1
 *
 * Returns per-subject bucket counts: 90-100, 85-89, 80-84, 75-79, <75
 */
export async function getGradeDistribution(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { school_year_id, grade_level, section_id } = req.query;

    // Get current school year if none specified
    let syId: number;
    if (school_year_id) {
      syId = parseInt(school_year_id as string);
    } else {
      const currentSY = await query<RowDataPacket[]>(
        'SELECT id FROM school_years WHERE is_current = 1 LIMIT 1'
      );
      syId = currentSY.length > 0 ? currentSY[0].id : 0;
    }

    if (!syId) {
      res.status(400).json({
        error:
          'No school year found. Specify school_year_id or set one as current.'
      });
      return;
    }

    // Build filter conditions
    const conditions: string[] = [
      'e.school_year_id = ?',
      "e.status = 'enrolled'"
    ];
    const params: any[] = [syId];

    if (grade_level) {
      conditions.push('s.grade_level = ?');
      params.push(parseInt(grade_level as string));
    }
    if (section_id) {
      conditions.push('e.section_id = ?');
      params.push(parseInt(section_id as string));
    }

    const where = conditions.join(' AND ');

    // Get grade distribution per subject
    // Uses the MAPEH grouping pattern: CASE WHEN name IN ('Music','Arts','Physical Education','Health') THEN 'MAPEH' ELSE s.name END
    // Grouped learning areas (subjects.subject_group, e.g. TLE specializations)
    // are reported under their group's main subject heading.
    const REPORT_LABEL = `CASE
              WHEN sub.name IN ('Music','Arts','Physical Education','Health') THEN 'MAPEH'
              WHEN sub.subject_group IS NOT NULL AND sub.name <> COALESCE(sub.subject_group,'') THEN
                COALESCE((SELECT g2.name FROM subjects g2
                           WHERE g2.grade_level = sub.grade_level
                             AND (g2.name = sub.subject_group OR g2.name = 'TLE/EPP' AND sub.subject_group = 'tle')
                           ORDER BY (g2.name = sub.subject_group) DESC LIMIT 1), sub.name)
              ELSE sub.name END`;
    const distribution = await query<RowDataPacket[]>(
      `SELECT
         subject_group,
         subject_id,
         COUNT(DISTINCT student_id) AS total_students,
         SUM(CASE WHEN avg_grade >= 90 THEN 1 ELSE 0 END) AS bucket_90_100,
         SUM(CASE WHEN avg_grade >= 85 AND avg_grade < 90 THEN 1 ELSE 0 END) AS bucket_85_89,
         SUM(CASE WHEN avg_grade >= 80 AND avg_grade < 85 THEN 1 ELSE 0 END) AS bucket_80_84,
         SUM(CASE WHEN avg_grade >= 75 AND avg_grade < 80 THEN 1 ELSE 0 END) AS bucket_75_79,
         SUM(CASE WHEN avg_grade < 75 AND avg_grade IS NOT NULL THEN 1 ELSE 0 END) AS bucket_below_75,
         SUM(CASE WHEN avg_grade IS NULL THEN 1 ELSE 0 END) AS bucket_no_grade,
         ROUND(AVG(avg_grade), 2) AS mean_grade
       FROM (
         SELECT
           sub.id AS subject_id,
           ${REPORT_LABEL} AS subject_group,
           e.student_id,
           ROUND(AVG(g.grade), 2) AS avg_grade
         FROM enrollments e
         JOIN students s ON e.student_id = s.id
         JOIN grades g ON g.student_id = e.student_id AND g.school_year_id = e.school_year_id
         JOIN subjects sub ON g.subject_id = sub.id
         WHERE ${where}
         GROUP BY
           ${REPORT_LABEL},
           sub.id,
           e.student_id
       ) student_subject_avgs
       GROUP BY subject_group, subject_id
       ORDER BY subject_group ASC`,
      params
    );

    // Aggregate any subject_group that spans several rows (MAPEH components,
    // TLE specializations) into a single reported learning area.
    const byGroup = new Map<string, any[]>();
    for (const r of distribution as any[]) {
      const key = String(r.subject_group);
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push(r);
    }

    const AVG_BUCKET_FIELDS = [
      'bucket_90_100',
      'bucket_85_89',
      'bucket_80_84',
      'bucket_75_79',
      'bucket_below_75',
      'bucket_no_grade'
    ];

    const subjects: any[] = [];
    for (const [key, rowsOfGroup] of byGroup) {
      const serialized = rowsOfGroup.map(serializeSubject);
      if (serialized.length === 1) {
        subjects.push(serialized[0]);
        continue;
      }
      const agg: any = {
        subject_id: -1,
        subject_name: key,
        total: serialized[0].total, // same students across the group
        mean_grade: null
      };
      for (const f of AVG_BUCKET_FIELDS) {
        agg[f] = Math.round(
          serialized.reduce((s: number, r: any) => s + Number(r[f] || 0), 0) /
            serialized.length
        );
      }
      const means = serialized
        .map((r: any) => (r.mean_grade === null ? null : Number(r.mean_grade)))
        .filter((v: number | null): v is number => v !== null && !isNaN(v));
      agg.mean_grade =
        means.length > 0
          ? Math.round(
              (means.reduce((a, b) => a + b, 0) / means.length) * 100
            ) / 100
          : null;
      subjects.push(agg);
    }
    subjects.sort((a, b) =>
      String(a.subject_name).localeCompare(String(b.subject_name))
    );

    // Build bucket distribution for each subject
    const reportedSubjects = subjects.map((s: any) => {
      const buckets = [
        { range: '90-100', count: s.bucket_90_100, color: '#22c55e' },
        { range: '85-89', count: s.bucket_85_89, color: '#3b82f6' },
        { range: '80-84', count: s.bucket_80_84, color: '#f59e0b' },
        { range: '75-79', count: s.bucket_75_79, color: '#f97316' },
        { range: '<75', count: s.bucket_below_75, color: '#ef4444' }
      ];
      const graded = buckets.reduce((sum: number, b: any) => sum + b.count, 0);
      const passCount =
        s.bucket_90_100 + s.bucket_85_89 + s.bucket_80_84 + s.bucket_75_79;
      return {
        subject_name: s.subject_name,
        total_students: s.total,
        mean_grade: s.mean_grade,
        pass_rate: s.total > 0 ? Math.round((passCount / s.total) * 100) : 0,
        buckets
      };
    });

    // Overall stats
    const totalStudents = reportedSubjects.reduce(
      (sum: number, s: any) => Math.max(sum, s.total_students),
      0
    );
    const overallPassRate =
      reportedSubjects.length > 0
        ? Math.round(
            reportedSubjects.reduce(
              (sum: number, s: any) => sum + s.pass_rate,
              0
            ) / reportedSubjects.length
          )
        : 0;

    res.json({
      school_year_id: syId,
      total_students: totalStudents,
      overall_pass_rate: overallPassRate,
      subjects: reportedSubjects
    });
  } catch (error) {
    console.error('Grade distribution error:', error);
    res.status(500).json({ error: 'Failed to fetch grade distribution.' });
  }
}

/**
 * GET /api/grades/submission-status — Per-section grade submission status
 * Query: ?school_year_id=1 (defaults to the current school year)
 *
 * Returns, for every active section: how many students are enrolled, how many
 * already have grades entered, and how many grade rows are locked.
 * A section is considered "submitted" when every enrolled student has grades.
 */
export async function getGradeSubmissionStatus(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Resolve school year
    let syId: number;
    if (req.query.school_year_id) {
      syId = parseInt(req.query.school_year_id as string);
    } else {
      const currentSY = await query<RowDataPacket[]>(
        'SELECT id FROM school_years WHERE is_current = 1 LIMIT 1'
      );
      syId = currentSY.length > 0 ? currentSY[0].id : 0;
    }

    if (!syId) {
      res.status(400).json({
        error:
          'No school year found. Specify school_year_id or set one as current.'
      });
      return;
    }

    const sections = await query<RowDataPacket[]>(
      `SELECT
         sec.id AS section_id,
         sec.name AS section_name,
         sec.grade_level,
         u.name AS adviser_name,
         COUNT(DISTINCT e.student_id) AS total_students,
         COUNT(DISTINCT CASE WHEN g.id IS NOT NULL THEN e.student_id END) AS graded_students,
         COUNT(g.id) AS grade_rows,
         COUNT(CASE WHEN g.is_locked = 1 THEN g.id END) AS locked_rows
       FROM sections sec
       LEFT JOIN users u ON sec.adviser_id = u.id
       LEFT JOIN enrollments e ON e.section_id = sec.id AND e.school_year_id = ? AND e.status = 'enrolled'
       LEFT JOIN grades g ON g.student_id = e.student_id AND g.school_year_id = e.school_year_id
       WHERE sec.is_active = 1
       GROUP BY sec.id, sec.name, sec.grade_level, u.name
       ORDER BY sec.grade_level ASC, sec.name ASC`,
      [syId]
    );

    const byGrade = [7, 8, 9, 10, 11, 12]
      .map(g => {
        const rows = sections.filter((s: any) => s.grade_level === g);
        const submitted = rows.filter(
          (s: any) =>
            s.total_students > 0 && s.graded_students === s.total_students
        ).length;
        return {
          grade_level: g,
          sections: rows,
          submitted,
          total: rows.length,
          pct: rows.length > 0 ? Math.round((submitted / rows.length) * 100) : 0
        };
      })
      .filter((g: any) => g.sections.length > 0);

    const totalSections = sections.length;
    const submittedSections = byGrade.reduce(
      (a: number, g: any) => a + g.submitted,
      0
    );

    res.json({
      school_year_id: syId,
      total_sections: totalSections,
      submitted_sections: submittedSections,
      overall_pct:
        totalSections > 0
          ? Math.round((submittedSections / totalSections) * 100)
          : 0,
      by_grade: byGrade
    });
  } catch (error) {
    console.error('Grade submission status error:', error);
    res.status(500).json({ error: 'Failed to fetch grade submission status.' });
  }
}

function serializeSubject(r: any) {
  // mysql2 returns COUNT() as a number but SUM()/AVG() (DECIMAL) as strings
  // ("110", "86.50"). Coerce to numbers here so downstream sums are numeric
  // instead of string concatenation (0 + "110" === "0110").
  const n = (v: any): number => (v === null || v === undefined ? 0 : Number(v));
  return {
    subject_id: r.subject_id,
    subject_name: r.subject_group,
    total: n(r.total_students),
    bucket_90_100: n(r.bucket_90_100),
    bucket_85_89: n(r.bucket_85_89),
    bucket_80_84: n(r.bucket_80_84),
    bucket_75_79: n(r.bucket_75_79),
    bucket_below_75: n(r.bucket_below_75),
    bucket_no_grade: n(r.bucket_no_grade),
    mean_grade:
      r.mean_grade === null || r.mean_grade === undefined
        ? null
        : Number(r.mean_grade)
  };
}
