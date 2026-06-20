import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";

/**
 * GET /api/enrollments — List enrollments with filters
 * Query: ?school_year_id=1&section_id=1&student_id=1&status=enrolled
 */
export async function listEnrollments(req: Request, res: Response): Promise<void> {
  try {
    const { school_year_id, section_id, student_id, status } = req.query;

    let sql = `
      SELECT e.*, s.name AS student_name, s.student_id AS student_display_id, s.lrn, s.grade_level,
             sec.name AS section_name, sec.section_type,
             u.name AS enrolled_by_name, sy.sy_label
      FROM enrollments e
      JOIN students s ON e.student_id = s.id
      JOIN sections sec ON e.section_id = sec.id
      JOIN users u ON e.enrolled_by = u.id
      JOIN school_years sy ON e.school_year_id = sy.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (school_year_id) {
      conditions.push("e.school_year_id = ?");
      params.push(parseInt(school_year_id as string));
    }
    if (section_id) {
      conditions.push("e.section_id = ?");
      params.push(parseInt(section_id as string));
    }
    if (student_id) {
      conditions.push("e.student_id = ?");
      params.push(parseInt(student_id as string));
    }
    if (status) {
      conditions.push("e.status = ?");
      params.push(status);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY s.grade_level ASC, sec.name ASC, s.name ASC";

    const enrollments = await query<RowDataPacket[]>(sql, params);
    res.json(enrollments);
  } catch (error) {
    console.error("List enrollments error:", error);
    res.status(500).json({ error: "Failed to fetch enrollments." });
  }
}

/**
 * GET /api/enrollments/:id — Get enrollment by ID
 */
export async function getEnrollmentById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const enrollments = await query<RowDataPacket[]>(
      `SELECT e.*, s.name AS student_name, s.student_id, s.lrn, s.grade_level,
              sec.name AS section_name, sec.section_type, sec.capacity,
              u.name AS enrolled_by_name, sy.sy_label
       FROM enrollments e
       JOIN students s ON e.student_id = s.id
       JOIN sections sec ON e.section_id = sec.id
       JOIN users u ON e.enrolled_by = u.id
       JOIN school_years sy ON e.school_year_id = sy.id
       WHERE e.id = ?`,
      [id]
    );

    if (enrollments.length === 0) {
      res.status(404).json({ error: "Enrollment not found." });
      return;
    }

    res.json(enrollments[0]);
  } catch (error) {
    console.error("Get enrollment error:", error);
    res.status(500).json({ error: "Failed to fetch enrollment." });
  }
}

/**
 * POST /api/enrollments — Create enrollment
 * Body: { student_id, section_id, school_year_id, enrollment_date, remarks? }
 */
export async function createEnrollment(req: Request, res: Response): Promise<void> {
  try {
    const { student_id, section_id, school_year_id, enrollment_date, remarks } = req.body;

    if (!student_id || !section_id || !school_year_id || !enrollment_date) {
      res.status(400).json({ error: "Missing required fields: student_id, section_id, school_year_id, enrollment_date." });
      return;
    }

    // Verify student exists
    const student = await query<RowDataPacket[]>("SELECT id, name, status, grade_level FROM students WHERE id = ?", [student_id]);
    if (student.length === 0) {
      res.status(404).json({ error: "Student not found." });
      return;
    }

    // Verify section exists
    const section = await query<RowDataPacket[]>("SELECT id, name, grade_level, capacity, current_count FROM sections WHERE id = ?", [section_id]);
    if (section.length === 0) {
      res.status(404).json({ error: "Section not found." });
      return;
    }

    // Check capacity
    if (section[0].current_count >= section[0].capacity) {
      res.status(400).json({ error: `Section "${section[0].name}" has reached its capacity (${section[0].capacity}).` });
      return;
    }

    // Check grade level match
    if (student[0].grade_level !== section[0].grade_level) {
      res.status(400).json({
        error: `Student grade level (${student[0].grade_level}) does not match section grade level (${section[0].grade_level}).`
      });
      return;
    }

    // Check duplicate enrollment for same SY
    const existing = await query<RowDataPacket[]>(
      "SELECT id FROM enrollments WHERE student_id = ? AND school_year_id = ?",
      [student_id, school_year_id]
    );
    if (existing.length > 0) {
      res.status(409).json({ error: "Student is already enrolled in this school year." });
      return;
    }

    const enrolled_by = req.user!.userId;

    const result = await query<ResultSetHeader>(
      `INSERT INTO enrollments (student_id, section_id, school_year_id, enrollment_date, enrolled_by, remarks)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [student_id, section_id, school_year_id, enrollment_date, enrolled_by, remarks || null]
    );

    // Increment section current_count
    await query<ResultSetHeader>(
      "UPDATE sections SET current_count = current_count + 1 WHERE id = ?",
      [section_id]
    );

    // Update student status to enrolled
    await query<ResultSetHeader>(
      "UPDATE students SET status = 'enrolled' WHERE id = ?",
      [student_id]
    );

    await logActivity(
      req.user!.userId,
      `Enrolled student: ${student[0].name} into ${section[0].name}`,
      "enrollments",
      result.insertId
    );

    const newEnrollment = await query<RowDataPacket[]>(
      `SELECT e.*, s.name AS student_name, s.student_id, sec.name AS section_name, sy.sy_label
       FROM enrollments e
       JOIN students s ON e.student_id = s.id
       JOIN sections sec ON e.section_id = sec.id
       JOIN school_years sy ON e.school_year_id = sy.id
       WHERE e.id = ?`,
      [result.insertId]
    );

    res.status(201).json(newEnrollment[0]);
  } catch (error) {
    console.error("Create enrollment error:", error);
    res.status(500).json({ error: "Failed to create enrollment." });
  }
}

/**
 * PUT /api/enrollments/:id — Update enrollment (drop/transfer)
 * Body: { status: "dropped" | "transferred", remarks? }
 */
export async function updateEnrollment(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status, remarks, section_id } = req.body;

    const existing = await query<RowDataPacket[]>(
      "SELECT e.*, s.name AS student_name, sec.name AS section_name FROM enrollments e JOIN students s ON e.student_id = s.id JOIN sections sec ON e.section_id = sec.id WHERE e.id = ?",
      [id]
    );

    if (existing.length === 0) {
      res.status(404).json({ error: "Enrollment not found." });
      return;
    }

    const enrollment = existing[0];

    if (status === "dropped" || status === "transferred") {
      // Decrement old section count
      await query<ResultSetHeader>(
        "UPDATE sections SET current_count = GREATEST(current_count - 1, 0) WHERE id = ?",
        [enrollment.section_id]
      );

      // Update student status
      const newStudentStatus = status === "dropped" ? "dropped" : "transferred";
      await query<ResultSetHeader>(
        "UPDATE students SET status = ? WHERE id = ?",
        [newStudentStatus, enrollment.student_id]
      );

      await query<ResultSetHeader>(
        "UPDATE enrollments SET status = ?, remarks = ? WHERE id = ?",
        [status, remarks || null, id]
      );

      await logActivity(
        req.user!.userId,
        `${status === "dropped" ? "Dropped" : "Transferred"} student: ${enrollment.student_name} from ${enrollment.section_name}`,
        "enrollments",
        id
      );

      res.json({ message: `Student ${status} successfully.`, status });
      return;
    }

    // Transfer to a new section
    if (section_id && section_id !== enrollment.section_id) {
      const newSection = await query<RowDataPacket[]>(
        "SELECT id, name, capacity, current_count, grade_level FROM sections WHERE id = ?",
        [section_id]
      );

      if (newSection.length === 0) {
        res.status(404).json({ error: "Target section not found." });
        return;
      }

      if (newSection[0].current_count >= newSection[0].capacity) {
        res.status(400).json({ error: `Target section "${newSection[0].name}" is at full capacity.` });
        return;
      }

      // Decrement old section
      await query<ResultSetHeader>(
        "UPDATE sections SET current_count = GREATEST(current_count - 1, 0) WHERE id = ?",
        [enrollment.section_id]
      );

      // Increment new section
      await query<ResultSetHeader>(
        "UPDATE sections SET current_count = current_count + 1 WHERE id = ?",
        [section_id]
      );

      await query<ResultSetHeader>(
        "UPDATE enrollments SET section_id = ?, remarks = ?, status = 'enrolled' WHERE id = ?",
        [section_id, remarks || null, id]
      );

      await logActivity(
        req.user!.userId,
        `Transferred student: ${enrollment.student_name} from ${enrollment.section_name} to ${newSection[0].name}`,
        "enrollments",
        id
      );

      const updated = await query<RowDataPacket[]>(
        `SELECT e.*, s.name AS student_name, sec.name AS section_name, sy.sy_label
         FROM enrollments e
         JOIN students s ON e.student_id = s.id
         JOIN sections sec ON e.section_id = sec.id
         JOIN school_years sy ON e.school_year_id = sy.id
         WHERE e.id = ?`,
        [id]
      );

      res.json(updated[0]);
      return;
    }

    // Just update remarks
    if (remarks !== undefined) {
      await query<ResultSetHeader>(
        "UPDATE enrollments SET remarks = ? WHERE id = ?",
        [remarks, id]
      );
    }

    res.json({ message: "Enrollment updated." });
  } catch (error) {
    console.error("Update enrollment error:", error);
    res.status(500).json({ error: "Failed to update enrollment." });
  }
}
