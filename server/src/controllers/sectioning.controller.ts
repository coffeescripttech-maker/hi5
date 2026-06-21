import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";

/**
 * GET /api/sectioning/pending — Get pending students with GA, classifications, and available sections
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
 * POST /api/sectioning/assign — Run auto-sectioning assignments
 * Body: { school_year_id: number, assignments: Array<{ student_id: number, section_id: number }> }
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

    // Process each assignment
    for (const a of assignments) {
      try {
        const { student_id, section_id } = a;

        // Verify student
        const student = await query<RowDataPacket[]>(
          "SELECT id, name FROM students WHERE id = ? AND status = 'pending'",
          [student_id]
        );
        if (student.length === 0) {
          results.push({ student_id, name: "?", section_id, section_name: "?", ok: false, error: "Student not found or not pending" });
          continue;
        }

        // Verify section
        const section = await query<RowDataPacket[]>(
          "SELECT id, name, capacity, current_count, grade_level FROM sections WHERE id = ? AND is_active = 1",
          [section_id]
        );
        if (section.length === 0) {
          results.push({ student_id, name: student[0].name, section_id, section_name: "?", ok: false, error: "Section not found" });
          continue;
        }

        // Check capacity
        if (section[0].current_count >= section[0].capacity) {
          results.push({ student_id, name: student[0].name, section_id, section_name: section[0].name, ok: false, error: "Section at full capacity" });
          continue;
        }

        // Check grade level match
        const gradeCheck = await query<RowDataPacket[]>(
          "SELECT grade_level FROM students WHERE id = ?",
          [student_id]
        );
        if (gradeCheck[0].grade_level !== section[0].grade_level) {
          results.push({ student_id, name: student[0].name, section_id, section_name: section[0].name, ok: false, error: "Grade level mismatch" });
          continue;
        }

        // Create enrollment
        const enrollResult = await query<ResultSetHeader>(
          `INSERT INTO enrollments (student_id, section_id, school_year_id, program, enrollment_date, enrolled_by)
           VALUES (?, ?, ?, 'regular', CURDATE(), ?)`,
          [student_id, section_id, school_year_id, enrolledBy]
        );

        // Increment section count
        await query<ResultSetHeader>(
          "UPDATE sections SET current_count = current_count + 1 WHERE id = ?",
          [section_id]
        );

        // Update student status to enrolled
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
