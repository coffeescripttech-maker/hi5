import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";

/**
 * GET /api/sectioning/pending — Get pending students with GA, classifications, and available sections
 * (Students with status = 'pending' who have never been enrolled)
 */
export async function getPendingStudents(req: Request, res: Response): Promise<void> {
  try {
    // Get current school year
    const currentSY = await query<RowDataPacket[]>(
      "SELECT id, sy_label FROM school_years WHERE is_current = 1 LIMIT 1"
    );
    if (currentSY.length === 0) {
      res.status(400).json({ error: "No current school year set." });
      return;
    }
    const schoolYearId = currentSY[0].id;

    // Get all pending students
    const students = await query<RowDataPacket[]>(
      `SELECT s.id, s.student_id, s.lrn, s.name, s.grade_level, s.sex, s.birthdate
       FROM students s
       WHERE s.status = 'pending'
       ORDER BY s.grade_level ASC, s.name ASC`
    );

    if (students.length === 0) {
      res.json({ school_year: currentSY[0], students: [], sections: [] });
      return;
    }

    const studentIds = students.map((s: any) => s.id);
    const placeholders = studentIds.map(() => "?").join(",");

    // Bulk-fetch averages per student (across all subjects)
    const averages = await query<RowDataPacket[]>(
      `SELECT g.student_id,
              ROUND(AVG(g.grade), 2) AS general_average
       FROM grades g
       WHERE g.student_id IN (${placeholders}) AND g.school_year_id = ?
       GROUP BY g.student_id`,
      [...studentIds, schoolYearId]
    );
    const avgMap = new Map(averages.map((a: any) => [a.student_id, parseFloat(a.general_average)]));

    // Bulk-fetch classifications
    const classifications = await query<RowDataPacket[]>(
      `SELECT sc.student_id, sc.classification
       FROM student_classifications sc
       WHERE sc.student_id IN (${placeholders}) AND sc.school_year_id = ?`,
      [...studentIds, schoolYearId]
    );
    const classMap = new Map<number, string[]>();
    classifications.forEach((c: any) => {
      const existing = classMap.get(c.student_id) || [];
      existing.push(c.classification);
      classMap.set(c.student_id, existing);
    });

    // Get all active sections
    const sections = await query<RowDataPacket[]>(
      `SELECT s.*, u.name AS adviser_name
       FROM sections s
       LEFT JOIN users u ON s.adviser_id = u.id
       WHERE s.is_active = 1
       ORDER BY s.grade_level ASC, s.min_average DESC`
    );

    // Build response
    const studentsWithData = students.map((s: any) => ({
      id: s.id,
      student_id: s.student_id,
      lrn: s.lrn,
      name: s.name,
      grade_level: s.grade_level,
      sex: s.sex,
      birthdate: s.birthdate,
      general_average: avgMap.get(s.id) ?? null,
      classifications: classMap.get(s.id) || [],
    }));

    res.json({
      school_year: currentSY[0],
      students: studentsWithData,
      sections,
    });
  } catch (error) {
    console.error("Get pending students error:", error);
    res.status(500).json({ error: "Failed to fetch sectioning data." });
  }
}

/**
 * GET /api/sectioning/pending-queue — Get enrolled students awaiting section assignment
 * (enrollments where section_id IS NULL — the Pending Section Queue)
 * Query: ?grade_level=7&program=regular
 */
export async function getPendingQueue(req: Request, res: Response): Promise<void> {
  try {
    const { grade_level, program } = req.query;

    const currentSY = await query<RowDataPacket[]>(
      "SELECT id, sy_label FROM school_years WHERE is_current = 1 LIMIT 1"
    );
    if (currentSY.length === 0) {
      res.status(400).json({ error: "No current school year set." });
      return;
    }
    const schoolYearId = currentSY[0].id;

    let sql = `
      SELECT e.id AS enrollment_id, e.student_id, e.program, e.enrollment_date, e.created_at AS queued_at,
             s.id, s.student_id AS student_display_id, s.lrn, s.name, s.grade_level, s.sex,
             u.name AS enrolled_by_name
      FROM enrollments e
      JOIN students s ON e.student_id = s.id
      JOIN users u ON e.enrolled_by = u.id
      WHERE e.school_year_id = ?
        AND e.section_id IS NULL
        AND e.status = 'enrolled'
    `;
    const params: any[] = [schoolYearId];

    if (grade_level) {
      sql += " AND s.grade_level = ?";
      params.push(parseInt(grade_level as string));
    }
    if (program) {
      sql += " AND e.program = ?";
      params.push(program);
    }

    sql += " ORDER BY s.grade_level ASC, s.name ASC";

    const queue = await query<RowDataPacket[]>(sql, params);

    if (queue.length > 0) {
      const studentIds = queue.map((r: any) => r.student_id);
      const placeholders = studentIds.map(() => "?").join(",");

      // Bulk-fetch averages
      const averages = await query<RowDataPacket[]>(
        `SELECT g.student_id,
                ROUND(AVG(g.grade), 2) AS general_average
         FROM grades g
         WHERE g.student_id IN (${placeholders}) AND g.school_year_id = ?
         GROUP BY g.student_id`,
        [...studentIds, schoolYearId]
      );
      const avgMap = new Map(averages.map((a: any) => [a.student_id, parseFloat(a.general_average)]));

      // Bulk-fetch classifications
      const classifications = await query<RowDataPacket[]>(
        `SELECT sc.student_id, sc.classification
         FROM student_classifications sc
         WHERE sc.student_id IN (${placeholders}) AND sc.school_year_id = ?`,
        [...studentIds, schoolYearId]
      );
      const classMap = new Map<number, string[]>();
      classifications.forEach((c: any) => {
        const existing = classMap.get(c.student_id) || [];
        existing.push(c.classification);
        classMap.set(c.student_id, existing);
      });

      // Attach GA and classifications
      for (const row of queue) {
        (row as any).general_average = avgMap.get(row.student_id) ?? null;
        (row as any).classifications = classMap.get(row.student_id) || [];
      }
    }

    // Get all active sections (for assignment options)
    const sections = await query<RowDataPacket[]>(
      `SELECT s.*, u.name AS adviser_name
       FROM sections s
       LEFT JOIN users u ON s.adviser_id = u.id
       WHERE s.is_active = 1
       ORDER BY s.grade_level ASC, s.min_average DESC`
    );

    res.json({
      school_year: currentSY[0],
      queue,
      sections,
      total_pending: queue.length,
    });
  } catch (error) {
    console.error("Get pending queue error:", error);
    res.status(500).json({ error: "Failed to fetch pending queue." });
  }
}

/**
 * POST /api/sectioning/confirm-assignments — Confirm and commit section assignments
 * Body: { school_year_id: number, assignments: Array<{ enrollment_id?: number, student_id: number, section_id: number }> }
 *
 * Handles two cases:
 * 1. Student has an existing enrollment (enrollment_id provided) → UPDATE section_id
 * 2. Student has NO enrollment (enrollment_id omitted) → CREATE enrollment + assign section
 */
export async function confirmAssignments(req: Request, res: Response): Promise<void> {
  try {
    const { school_year_id, assignments } = req.body;

    if (!school_year_id || !assignments || !Array.isArray(assignments) || assignments.length === 0) {
      res.status(400).json({ error: "school_year_id and assignments array are required." });
      return;
    }

    const assignedBy = req.user!.userId;
    const results: Array<{
      student_id: number;
      enrollment_id?: number;
      name: string;
      section_id: number;
      section_name: string;
      ok: boolean;
      error?: string;
    }> = [];

    for (const a of assignments) {
      try {
        const { enrollment_id, student_id, section_id } = a;

        // Verify student exists
        const student = await query<RowDataPacket[]>(
          "SELECT id, name, grade_level FROM students WHERE id = ?",
          [student_id]
        );
        if (student.length === 0) {
          results.push({ student_id, name: "?", section_id, section_name: "?", ok: false, error: "Student not found" });
          continue;
        }

        // Verify section
        const section = await query<RowDataPacket[]>(
          "SELECT id, name, capacity, current_count, grade_level FROM sections WHERE id = ? AND is_active = 1",
          [section_id]
        );
        if (section.length === 0) {
          results.push({ student_id, name: student[0].name, section_id, section_name: "?", ok: false, error: "Section not found or inactive" });
          continue;
        }

        // Check capacity
        if (section[0].current_count >= section[0].capacity) {
          results.push({ student_id, name: student[0].name, section_id, section_name: section[0].name, ok: false, error: "Section at full capacity" });
          continue;
        }

        // Check grade level match
        if (student[0].grade_level !== section[0].grade_level) {
          results.push({ student_id, name: student[0].name, section_id, section_name: section[0].name, ok: false, error: "Grade level mismatch" });
          continue;
        }

        if (enrollment_id) {
          // Case 1: Existing enrollment — update section_id
          const enrollCheck = await query<RowDataPacket[]>(
            "SELECT id, section_id FROM enrollments WHERE id = ? AND student_id = ?",
            [enrollment_id, student_id]
          );
          if (enrollCheck.length === 0) {
            results.push({ student_id, enrollment_id, name: student[0].name, section_id, section_name: section[0].name, ok: false, error: "Enrollment not found" });
            continue;
          }

          await query<ResultSetHeader>(
            "UPDATE enrollments SET section_id = ?, assigned_at = NOW(), assigned_by = ? WHERE id = ?",
            [section_id, assignedBy, enrollment_id]
          );
        } else {
          // Case 2: No enrollment — create one
          const existingEnroll = await query<RowDataPacket[]>(
            "SELECT id FROM enrollments WHERE student_id = ? AND school_year_id = ?",
            [student_id, school_year_id]
          );
          if (existingEnroll.length > 0) {
            // Update existing
            await query<ResultSetHeader>(
              "UPDATE enrollments SET section_id = ?, assigned_at = NOW(), assigned_by = ?, status = 'enrolled' WHERE id = ?",
              [section_id, assignedBy, existingEnroll[0].id]
            );
          } else {
            // Create new
            await query<ResultSetHeader>(
              `INSERT INTO enrollments (student_id, section_id, school_year_id, program, enrollment_date, enrolled_by)
               VALUES (?, ?, ?, 'regular', CURDATE(), ?)`,
              [student_id, section_id, school_year_id, assignedBy]
            );
          }
        }

        // Increment section count
        await query<ResultSetHeader>(
          "UPDATE sections SET current_count = current_count + 1 WHERE id = ?",
          [section_id]
        );

        // Ensure student status is enrolled
        await query<ResultSetHeader>(
          "UPDATE students SET status = 'enrolled' WHERE id = ?",
          [student_id]
        );

        results.push({
          student_id,
          enrollment_id,
          name: student[0].name,
          section_id,
          section_name: section[0].name,
          ok: true,
        });
      } catch (err: any) {
        results.push({
          student_id: a.student_id,
          enrollment_id: a.enrollment_id,
          name: "?",
          section_id: a.section_id,
          section_name: "?",
          ok: false,
          error: err.message,
        });
      }
    }

    const succeeded = results.filter(r => r.ok).length;
    await logActivity(
      assignedBy,
      `Section assignment: ${succeeded}/${assignments.length} students assigned to sections`,
      "enrollments",
      null
    );

    res.json({
      message: `Assignments complete. ${succeeded}/${assignments.length} assigned successfully.`,
      succeeded,
      total: assignments.length,
      results,
    });
  } catch (error) {
    console.error("Confirm assignments error:", error);
    res.status(500).json({ error: "Failed to confirm assignments." });
  }
}

/**
 * GET /api/sectioning/carry-over-preview — Preview carry-over assignments for Grade 11→12
 * Query: ?grade_level=12
 *
 * For each pending/enrolled student in the target grade level, looks up their
 * previous year's section and proposes the matching section for the new year.
 */
export async function getCarryOverPreview(req: Request, res: Response): Promise<void> {
  try {
    const targetGrade = parseInt(req.query.grade_level as string) || 12;
    const previousGrade = targetGrade - 1;

    const currentSY = await query<RowDataPacket[]>(
      "SELECT id, sy_label FROM school_years WHERE is_current = 1 LIMIT 1"
    );
    if (currentSY.length === 0) {
      res.status(400).json({ error: "No current school year set." });
      return;
    }
    const schoolYearId = currentSY[0].id;

    // Get the previous school year
    const previousSY = await query<RowDataPacket[]>(
      "SELECT id, sy_label FROM school_years WHERE is_current = 0 ORDER BY id DESC LIMIT 1"
    );
    if (previousSY.length === 0) {
      res.json({ school_year: currentSY[0], proposals: [] });
      return;
    }

    // Find students in target grade who are enrolled but not sectioned, or pending
    const students = await query<RowDataPacket[]>(
      `SELECT DISTINCT s.id, s.student_id AS student_display_id, s.lrn, s.name, s.grade_level, s.sex
       FROM students s
       LEFT JOIN enrollments e ON e.student_id = s.id AND e.school_year_id = ?
       WHERE s.grade_level = ?
         AND (s.status = 'pending' OR (e.id IS NOT NULL AND e.section_id IS NULL))
       ORDER BY s.name ASC`,
      [schoolYearId, targetGrade]
    );

    if (students.length === 0) {
      res.json({ school_year: currentSY[0], proposals: [] });
      return;
    }

    const studentIds = students.map((s: any) => s.id);
    const placeholders = studentIds.map(() => "?").join(",");

    // Get their previous year enrollments (Grade 11)
    const prevEnrollments = await query<RowDataPacket[]>(
      `SELECT e.student_id, sec.name AS prev_section_name, sec.id AS prev_section_id,
              sec.section_type, sec.grade_level
       FROM enrollments e
       JOIN sections sec ON e.section_id = sec.id
       WHERE e.student_id IN (${placeholders})
         AND e.school_year_id = ?
         AND e.status IN ('enrolled', 'transferred')`,
      [...studentIds, previousSY[0].id]
    );
    const prevMap = new Map(prevEnrollments.map((e: any) => [e.student_id, e]));

    // Get current year sections for the target grade
    const currentSections = await query<RowDataPacket[]>(
      `SELECT s.*, u.name AS adviser_name
       FROM sections s
       LEFT JOIN users u ON s.adviser_id = u.id
       WHERE s.grade_level = ? AND s.is_active = 1
       ORDER BY s.min_average DESC`,
      [targetGrade]
    );

    // Build proposals: match previous section name/section_type to current sections
    const proposals = students.map((student: any) => {
      const prev = prevMap.get(student.id);
      let proposed_section_id: number | null = null;
      let proposed_section_name: string | null = null;

      if (prev) {
        // Try to find a section in the current year with the same name
        const match = currentSections.find(
          (s: any) => s.name === prev.prev_section_name || s.section_type === prev.section_type
        );
        if (match) {
          proposed_section_id = match.id;
          proposed_section_name = match.name;
        }
      }

      return {
        student_id: student.id,
        student_name: student.name,
        lrn: student.lrn,
        student_display_id: student.student_display_id,
        prev_section_name: prev?.prev_section_name || null,
        prev_section_type: prev?.section_type || null,
        proposed_section_id,
        proposed_section_name,
      };
    });

    res.json({
      school_year: currentSY[0],
      previous_sy: previousSY[0],
      proposals,
      current_sections: currentSections,
    });
  } catch (error) {
    console.error("Carry-over preview error:", error);
    res.status(500).json({ error: "Failed to generate carry-over preview." });
  }
}

/**
 * POST /api/sectioning/assign — Run auto-sectioning assignments (legacy)
 * Body: { school_year_id: number, assignments: Array<{ student_id: number, section_id: number }> }
 * Used by the teacher AutoSectioning component for pending students.
 */
export async function runAutoSectioning(req: Request, res: Response): Promise<void> {
  try {
    const { school_year_id, assignments } = req.body;

    if (!school_year_id || !assignments || !Array.isArray(assignments) || assignments.length === 0) {
      res.status(400).json({ error: "school_year_id and assignments array are required." });
      return;
    }

    const enrolledBy = req.user!.userId;
    const results: Array<{ student_id: number; name: string; section_id: number; section_name: string; ok: boolean; error?: string }> = [];

    for (const a of assignments) {
      try {
        const { student_id, section_id } = a;

        const student = await query<RowDataPacket[]>(
          "SELECT id, name FROM students WHERE id = ? AND status = 'pending'",
          [student_id]
        );
        if (student.length === 0) {
          results.push({ student_id, name: "?", section_id, section_name: "?", ok: false, error: "Student not found or not pending" });
          continue;
        }

        const section = await query<RowDataPacket[]>(
          "SELECT id, name, capacity, current_count, grade_level FROM sections WHERE id = ? AND is_active = 1",
          [section_id]
        );
        if (section.length === 0) {
          results.push({ student_id, name: student[0].name, section_id, section_name: "?", ok: false, error: "Section not found" });
          continue;
        }

        if (section[0].current_count >= section[0].capacity) {
          results.push({ student_id, name: student[0].name, section_id, section_name: section[0].name, ok: false, error: "Section at full capacity" });
          continue;
        }

        const gradeCheck = await query<RowDataPacket[]>(
          "SELECT grade_level FROM students WHERE id = ?",
          [student_id]
        );
        if (gradeCheck[0].grade_level !== section[0].grade_level) {
          results.push({ student_id, name: student[0].name, section_id, section_name: section[0].name, ok: false, error: "Grade level mismatch" });
          continue;
        }

        const enrollResult = await query<ResultSetHeader>(
          `INSERT INTO enrollments (student_id, section_id, school_year_id, program, enrollment_date, enrolled_by)
           VALUES (?, ?, ?, 'regular', CURDATE(), ?)`,
          [student_id, section_id, school_year_id, enrolledBy]
        );

        await query<ResultSetHeader>(
          "UPDATE sections SET current_count = current_count + 1 WHERE id = ?",
          [section_id]
        );

        await query<ResultSetHeader>(
          "UPDATE students SET status = 'enrolled' WHERE id = ?",
          [student_id]
        );

        results.push({
          student_id,
          name: student[0].name,
          section_id,
          section_name: section[0].name,
          ok: true,
        });
      } catch (err: any) {
        results.push({ student_id: a.student_id, name: "?", section_id: a.section_id, section_name: "?", ok: false, error: err.message });
      }
    }

    const succeeded = results.filter(r => r.ok).length;
    await logActivity(
      enrolledBy,
      `Auto-sectioning: ${succeeded}/${assignments.length} students assigned`,
      "enrollments",
      null
    );

    res.json({
      message: `Sectioning complete. ${succeeded}/${assignments.length} assigned successfully.`,
      succeeded,
      total: assignments.length,
      results,
    });
  } catch (error) {
    console.error("Auto sectioning error:", error);
    res.status(500).json({ error: "Failed to run auto-sectioning." });
  }
}
