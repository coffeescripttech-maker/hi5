import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";

/**
 * Reading assessments.
 *
 * These are the admissible basis for the Non-Reader classification: a teacher
 * administers an assessment, records the outcome here, and only then may the
 * learner be tagged Non-Reader. Nothing in this module derives a result from
 * grades, general averages or section thresholds.
 */

const SELECT_BASE = `
  SELECT ra.*, s.name AS student_name, s.student_id AS student_code, s.lrn,
         sy.sy_label, u.name AS assessed_by_name
  FROM reading_assessments ra
  JOIN students s ON ra.student_id = s.id
  JOIN school_years sy ON ra.school_year_id = sy.id
  JOIN users u ON ra.assessed_by = u.id
`;

/**
 * A teacher may only assess learners on their own roster: students in a section
 * they advise, or a pending-queue student they enrolled themselves. Mirrors the
 * scoping of GET /api/students/my-students so the assessment pages cannot be
 * used to reach other advisers' learners.
 */
async function teacherOwnsStudent(userId: number, studentId: number, schoolYearId: number): Promise<boolean> {
  const rows = await query<RowDataPacket[]>(
    `SELECT e.id
     FROM enrollments e
     LEFT JOIN sections sec ON e.section_id = sec.id
     WHERE e.student_id = ? AND e.school_year_id = ? AND e.status = 'enrolled'
       AND ((sec.adviser_id IS NOT NULL AND sec.adviser_id = ?)
            OR (e.section_id IS NULL AND e.enrolled_by = ?))
     LIMIT 1`,
    [studentId, schoolYearId, userId, userId]
  );
  return rows.length > 0;
}

/**
 * GET /api/reading-assessments — List assessments
 * Query: ?student_id=1&school_year_id=1&result=non_reader
 */
export async function listReadingAssessments(req: Request, res: Response): Promise<void> {
  try {
    const { student_id, school_year_id, result } = req.query;
    const conditions: string[] = [];
    const params: any[] = [];

    if (student_id) { conditions.push("ra.student_id = ?"); params.push(parseInt(student_id as string)); }
    if (school_year_id) { conditions.push("ra.school_year_id = ?"); params.push(parseInt(school_year_id as string)); }
    if (result) { conditions.push("ra.result = ?"); params.push(result); }

    // Teachers only see assessments they administered.
    if (req.user!.role === "teacher") {
      conditions.push("ra.assessed_by = ?");
      params.push(req.user!.userId);
    }

    let sql = SELECT_BASE;
    if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY ra.assessment_date DESC, ra.id DESC";

    const rows = await query<RowDataPacket[]>(sql, params);
    res.json(rows);
  } catch (error) {
    console.error("List reading assessments error:", error);
    res.status(500).json({ error: "Failed to fetch reading assessments." });
  }
}

/**
 * GET /api/reading-assessments/student/:id — Assessment history for a learner
 */
export async function getStudentReadingAssessments(req: Request, res: Response): Promise<void> {
  try {
    const rows = await query<RowDataPacket[]>(
      SELECT_BASE + " WHERE ra.student_id = ? ORDER BY ra.assessment_date DESC, ra.id DESC",
      [req.params.id]
    );
    res.json(rows);
  } catch (error) {
    console.error("Get student reading assessments error:", error);
    res.status(500).json({ error: "Failed to fetch reading assessments." });
  }
}

/**
 * POST /api/reading-assessments — Record an assessment
 * Body: { student_id, school_year_id, assessment_date?, result, score?, instrument?, remarks? }
 */
export async function createReadingAssessment(req: Request, res: Response): Promise<void> {
  try {
    const { student_id, school_year_id, assessment_date, result, score, instrument, remarks } = req.body;

    if (!student_id || !school_year_id || !result) {
      res.status(400).json({ error: "Missing required fields: student_id, school_year_id, result." });
      return;
    }
    if (!["non_reader", "reader"].includes(result)) {
      res.status(400).json({ error: "Invalid result. Must be non_reader or reader." });
      return;
    }
    if (score != null && (isNaN(Number(score)) || Number(score) < 0 || Number(score) > 100)) {
      res.status(400).json({ error: "Score must be between 0 and 100." });
      return;
    }

    const student = await query<RowDataPacket[]>("SELECT id FROM students WHERE id = ?", [student_id]);
    if (student.length === 0) {
      res.status(404).json({ error: "Student not found." });
      return;
    }

    if (
      req.user!.role === "teacher" &&
      !(await teacherOwnsStudent(req.user!.userId, parseInt(String(student_id)), parseInt(String(school_year_id))))
    ) {
      res.status(403).json({
        error: "You can only record a reading assessment for a learner on your own roster.",
      });
      return;
    }

    const result2 = await query<ResultSetHeader>(
      `INSERT INTO reading_assessments
         (student_id, school_year_id, assessment_date, result, score, instrument, remarks, assessed_by)
       VALUES (?, ?, COALESCE(?, CURDATE()), ?, ?, ?, ?, ?)`,
      [
        student_id,
        school_year_id,
        assessment_date || null,
        result,
        score != null ? Number(score) : null,
        instrument || null,
        remarks || null,
        req.user!.userId,
      ]
    );

    await logActivity(
      req.user!.userId,
      `Recorded reading assessment (${result}) for student ID ${student_id}`,
      "reading_assessments",
      result2.insertId
    );

    const rows = await query<RowDataPacket[]>(SELECT_BASE + " WHERE ra.id = ?", [
      result2.insertId,
    ]);
    res.status(201).json(rows[0]);
  } catch (error: any) {
    console.error("Create reading assessment error:", error);
    if (error?.code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "An assessment for that learner, school year and date already exists." });
      return;
    }
    res.status(500).json({ error: "Failed to record reading assessment." });
  }
}

/**
 * DELETE /api/reading-assessments/:id — Remove an assessment
 *
 * The Non-Reader tag cannot outlive its evidence: if the learner is still
 * classified Non-Reader for that school year, the tag is cleared in the same
 * operation so the two can never disagree.
 */
export async function deleteReadingAssessment(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;

    const existing = await query<RowDataPacket[]>(
      "SELECT id, student_id, school_year_id, assessed_by, result FROM reading_assessments WHERE id = ?",
      [id]
    );
    if (existing.length === 0) {
      res.status(404).json({ error: "Reading assessment not found." });
      return;
    }

    // Teachers may only remove their own assessment; other roles manage all.
    if (req.user!.role === "teacher" && existing[0].assessed_by !== req.user!.userId) {
      res.status(403).json({ error: "You can only remove an assessment you administered." });
      return;
    }

    await query<ResultSetHeader>("DELETE FROM reading_assessments WHERE id = ?", [id]);

    // Keep the tag consistent with the remaining evidence.
    const remaining = await query<RowDataPacket[]>(
      `SELECT id FROM reading_assessments
       WHERE student_id = ? AND school_year_id = ? AND result = 'non_reader'`,
      [existing[0].student_id, existing[0].school_year_id]
    );
    if (remaining.length === 0) {
      await query<ResultSetHeader>(
        "DELETE FROM student_classifications WHERE student_id = ? AND school_year_id = ? AND classification = 'non_reader'",
        [existing[0].student_id, existing[0].school_year_id]
      );
    }

    await logActivity(
      req.user!.userId,
      `Removed reading assessment for student ID ${existing[0].student_id}`,
      "reading_assessments",
      id
    );

    res.json({ message: "Reading assessment removed.", non_reader_tag_cleared: remaining.length === 0 });
  } catch (error) {
    console.error("Delete reading assessment error:", error);
    res.status(500).json({ error: "Failed to remove reading assessment." });
  }
}