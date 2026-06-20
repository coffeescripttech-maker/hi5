import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";

/**
 * GET /api/grades — Get grades with filters
 * Query: ?student_id=1&school_year_id=1&subject_id=1&section_id=1
 *
 * If no student_id, returns gradebook for a section (all students + subjects pivoted)
 */
export async function getGrades(req: Request, res: Response): Promise<void> {
  try {
    const { student_id, school_year_id, subject_id, section_id, quarter } = req.query;

    // Single student grades (pivoted by quarter)
    if (student_id) {
      const params: any[] = [student_id];
      let syFilter = "";
      if (school_year_id) {
        syFilter = " AND g.school_year_id = ?";
        params.push(school_year_id);
      }

      const grades = await query<RowDataPacket[]>(
        `SELECT s.id AS subject_id, s.name AS subject_name, s.subject_type,
                MAX(CASE WHEN g.quarter = 1 THEN g.grade END) AS q1,
                MAX(CASE WHEN g.quarter = 2 THEN g.grade END) AS q2,
                MAX(CASE WHEN g.quarter = 3 THEN g.grade END) AS q3,
                MAX(CASE WHEN g.quarter = 4 THEN g.grade END) AS q4,
                ROUND(AVG(g.grade), 2) AS final_average,
                MAX(g.is_locked) AS is_locked
         FROM subjects s
         JOIN students stu ON stu.id = ?
         LEFT JOIN grades g ON g.subject_id = s.id AND g.student_id = ?${syFilter}
         WHERE s.grade_level = stu.grade_level AND s.is_active = 1
         GROUP BY s.id, s.name, s.subject_type
         ORDER BY s.name ASC`,
        [student_id, ...params]
      );

      // Get enrollment info
      const enrollments = await query<RowDataPacket[]>(
        `SELECT e.id AS enrollment_id, e.school_year_id, e.section_id, sec.name AS section_name, sy.sy_label
         FROM enrollments e
         JOIN sections sec ON e.section_id = sec.id
         JOIN school_years sy ON e.school_year_id = sy.id
         WHERE e.student_id = ?${school_year_id ? " AND e.school_year_id = ?" : ""}
         ORDER BY sy.is_current DESC
         LIMIT 1`,
        school_year_id ? [student_id, school_year_id] : [student_id]
      );

      res.json({
        student_id,
        enrollment: enrollments[0] || null,
        subjects: grades,
      });
      return;
    }

    // Gradebook for a section (all students × subjects)
    if (section_id && school_year_id) {
      const grades = await query<RowDataPacket[]>(
        `SELECT st.id AS student_id, st.name AS student_name, st.student_id,
                s.id AS subject_id, s.name AS subject_name,
                g.quarter, g.grade, g.is_locked
         FROM enrollments e
         JOIN students st ON e.student_id = st.id
         CROSS JOIN subjects s
         LEFT JOIN grades g ON g.student_id = st.id AND g.subject_id = s.id AND g.school_year_id = e.school_year_id
         WHERE e.section_id = ? AND e.school_year_id = ? AND e.status = 'enrolled'
           AND s.grade_level = st.grade_level
         ORDER BY st.name ASC, s.name ASC, g.quarter ASC`,
        [section_id, school_year_id]
      );

      res.json(grades);
      return;
    }

    // Raw grades list with filters
    let sql = `
      SELECT g.*, s.name AS student_name, s.student_id, sub.name AS subject_name
      FROM grades g
      JOIN students s ON g.student_id = s.id
      JOIN subjects sub ON g.subject_id = sub.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (school_year_id) { conditions.push("g.school_year_id = ?"); params.push(school_year_id); }
    if (subject_id) { conditions.push("g.subject_id = ?"); params.push(subject_id); }
    if (quarter) { conditions.push("g.quarter = ?"); params.push(quarter); }

    if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY g.school_year_id DESC, g.student_id ASC, g.subject_id ASC, g.quarter ASC";

    const result = await query<RowDataPacket[]>(sql, params);
    res.json(result);
    return;

  } catch (error) {
    console.error("Get grades error:", error);
    res.status(500).json({ error: "Failed to fetch grades." });
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
      res.status(400).json({ error: "Missing required fields: student_id, subject_id, school_year_id, quarter." });
      return;
    }

    if (quarter < 1 || quarter > 4) {
      res.status(400).json({ error: "Quarter must be between 1 and 4." });
      return;
    }

    // Get enrollment_id for this student + school year
    const enrollments = await query<RowDataPacket[]>(
      "SELECT id FROM enrollments WHERE student_id = ? AND school_year_id = ? AND status = 'enrolled' LIMIT 1",
      [student_id, school_year_id]
    );
    if (enrollments.length === 0) {
      res.status(400).json({ error: "Student is not enrolled in this school year. Please enroll first." });
      return;
    }
    const enrollment_id = enrollments[0].id;

    // Check if grade is locked
    const lockedCheck = await query<RowDataPacket[]>(
      "SELECT id FROM grades WHERE student_id = ? AND subject_id = ? AND school_year_id = ? AND quarter = ? AND is_locked = 1",
      [student_id, subject_id, school_year_id, quarter]
    );
    if (lockedCheck.length > 0) {
      res.status(403).json({ error: "Grade is locked and cannot be modified." });
      return;
    }

    // Upsert
    await query<ResultSetHeader>(
      `INSERT INTO grades (student_id, subject_id, enrollment_id, school_year_id, quarter, grade)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE grade = VALUES(grade), updated_at = NOW()`,
      [student_id, subject_id, enrollment_id, school_year_id, quarter, grade ?? null]
    );

    await logActivity(
      req.user!.userId,
      `Updated grade for student ID ${student_id}, subject ID ${subject_id}, Q${quarter}`,
      "grades",
      null
    );

    res.json({ message: "Grade saved successfully." });
  } catch (error) {
    console.error("Upsert grade error:", error);
    res.status(500).json({ error: "Failed to save grade." });
  }
}

/**
 * POST /api/grades/batch — Upsert multiple grades at once
 * Body: { grades: [{ student_id, subject_id, school_year_id, quarter, grade }] }
 */
export async function batchUpsertGrades(req: Request, res: Response): Promise<void> {
  try {
    const { grades } = req.body;

    if (!grades || !Array.isArray(grades) || grades.length === 0) {
      res.status(400).json({ error: "Grades array is required." });
      return;
    }

    let updated = 0;
    for (const g of grades) {
      const { student_id, subject_id, school_year_id, quarter, grade } = g;

      if (!student_id || !subject_id || !school_year_id || !quarter) continue;
      if (quarter < 1 || quarter > 4) continue;

      // Get enrollment_id
      const enrolls = await query<RowDataPacket[]>(
        "SELECT id FROM enrollments WHERE student_id = ? AND school_year_id = ? AND status = 'enrolled' LIMIT 1",
        [student_id, school_year_id]
      );
      if (enrolls.length === 0) continue;
      const enrollment_id = enrolls[0].id;

      // Skip locked grades
      const locked = await query<RowDataPacket[]>(
        "SELECT id FROM grades WHERE student_id = ? AND subject_id = ? AND school_year_id = ? AND quarter = ? AND is_locked = 1",
        [student_id, subject_id, school_year_id, quarter]
      );
      if (locked.length > 0) continue;

      await query<ResultSetHeader>(
        `INSERT INTO grades (student_id, subject_id, enrollment_id, school_year_id, quarter, grade)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE grade = VALUES(grade), updated_at = NOW()`,
        [student_id, subject_id, enrollment_id, school_year_id, quarter, grade ?? null]
      );
      updated++;
    }

    await logActivity(req.user!.userId, `Batch imported ${updated} grades`, "grades", null);
    res.json({ message: `${updated} grades saved successfully.` });
  } catch (error) {
    console.error("Batch upsert error:", error);
    res.status(500).json({ error: "Failed to save grades." });
  }
}

/**
 * POST /api/grades/lock — Lock grades for a student/subject or whole section
 * Body: { student_id?, subject_id?, school_year_id, section_id?, quarter? }
 */
export async function lockGrades(req: Request, res: Response): Promise<void> {
  try {
    const { student_id, subject_id, school_year_id, section_id, quarter } = req.body;

    if (!school_year_id) {
      res.status(400).json({ error: "school_year_id is required." });
      return;
    }

    let sql = "UPDATE grades SET is_locked = 1, locked_at = NOW(), locked_by = ? WHERE school_year_id = ?";
    const params: any[] = [req.user!.userId, school_year_id];

    if (student_id) { sql += " AND student_id = ?"; params.push(student_id); }
    if (subject_id) { sql += " AND subject_id = ?"; params.push(subject_id); }
    if (section_id) {
      sql += " AND student_id IN (SELECT student_id FROM enrollments WHERE section_id = ? AND school_year_id = ?)";
      params.push(section_id, school_year_id);
    }
    if (quarter) { sql += " AND quarter = ?"; params.push(quarter); }

    const result = await query<ResultSetHeader>(sql, params);

    await logActivity(req.user!.userId, `Locked ${result.affectedRows} grade(s)`, "grades", null);
    res.json({ message: `${result.affectedRows} grade(s) locked.` });
  } catch (error) {
    console.error("Lock grades error:", error);
    res.status(500).json({ error: "Failed to lock grades." });
  }
}

/**
 * POST /api/grades/unlock — Unlock grades
 * Body: { student_id?, subject_id?, school_year_id, section_id?, quarter? }
 */
export async function unlockGrades(req: Request, res: Response): Promise<void> {
  try {
    const { student_id, subject_id, school_year_id, section_id, quarter } = req.body;

    if (!school_year_id) {
      res.status(400).json({ error: "school_year_id is required." });
      return;
    }

    let sql = "UPDATE grades SET is_locked = 0, locked_at = NULL, locked_by = NULL WHERE school_year_id = ?";
    const params: any[] = [school_year_id];

    if (student_id) { sql += " AND student_id = ?"; params.push(student_id); }
    if (subject_id) { sql += " AND subject_id = ?"; params.push(subject_id); }
    if (section_id) {
      sql += " AND student_id IN (SELECT student_id FROM enrollments WHERE section_id = ? AND school_year_id = ?)";
      params.push(section_id, school_year_id);
    }
    if (quarter) { sql += " AND quarter = ?"; params.push(quarter); }

    const result = await query<ResultSetHeader>(sql, params);

    await logActivity(req.user!.userId, `Unlocked ${result.affectedRows} grade(s)`, "grades", null);
    res.json({ message: `${result.affectedRows} grade(s) unlocked.` });
  } catch (error) {
    console.error("Unlock grades error:", error);
    res.status(500).json({ error: "Failed to unlock grades." });
  }
}

/**
 * GET /api/grades/compute/averages — Compute general average for a student
 * Query: ?student_id=1&school_year_id=1
 */
export async function computeAverages(req: Request, res: Response): Promise<void> {
  try {
    const { student_id, school_year_id } = req.query;

    if (!student_id || !school_year_id) {
      res.status(400).json({ error: "student_id and school_year_id are required." });
      return;
    }

    const averages = await query<RowDataPacket[]>(
      `SELECT s.id AS subject_id, s.name AS subject_name, s.subject_type,
              ROUND(AVG(g.grade), 2) AS subject_average
       FROM subjects s
       JOIN grades g ON g.subject_id = s.id
       WHERE g.student_id = ? AND g.school_year_id = ?
       GROUP BY s.id, s.name, s.subject_type
       ORDER BY s.name ASC`,
      [student_id, school_year_id]
    );

    const generalAverage = averages.length > 0
      ? Math.round(averages.reduce((sum: number, a: any) => sum + parseFloat(a.subject_average || 0), 0) / averages.length * 100) / 100
      : null;

    res.json({
      student_id: parseInt(student_id as string),
      school_year_id: parseInt(school_year_id as string),
      general_average: generalAverage,
      subject_averages: averages,
    });
  } catch (error) {
    console.error("Compute averages error:", error);
    res.status(500).json({ error: "Failed to compute averages." });
  }
}
