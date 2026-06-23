import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";

/**
 * GET /api/enrollments — List enrollments with filters
 * Query: ?school_year_id=1&section_id=1&student_id=1&status=enrolled&unassigned=1
 */
export async function listEnrollments(req: Request, res: Response): Promise<void> {
  try {
    const { school_year_id, section_id, student_id, status, unassigned } = req.query;

    let sql = `
      SELECT e.*, s.name AS student_name, s.student_id AS student_display_id, s.lrn, s.grade_level,
             sec.name AS section_name, sec.section_type,
             u.name AS enrolled_by_name, sy.sy_label
      FROM enrollments e
      JOIN students s ON e.student_id = s.id
      LEFT JOIN sections sec ON e.section_id = sec.id
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
    if (unassigned === "1") {
      conditions.push("e.section_id IS NULL");
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY s.grade_level ASC, COALESCE(sec.name, '') ASC, s.name ASC";

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
       LEFT JOIN sections sec ON e.section_id = sec.id
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
 * Body: { student_id, section_id?, school_year_id, enrollment_date, program?, remarks?, requirements? }
 *
 * When section_id is omitted/null, the enrollment goes into the Pending Section Queue
 * and the Registrar assigns a section later via the section assignment workflow.
 */
export async function createEnrollment(req: Request, res: Response): Promise<void> {
  try {
    const { student_id, section_id, school_year_id, enrollment_date, program, remarks, requirements } = req.body;

    if (!student_id || !school_year_id || !enrollment_date) {
      res.status(400).json({ error: "Missing required fields: student_id, school_year_id, enrollment_date." });
      return;
    }

    // Verify student exists
    const student = await query<RowDataPacket[]>("SELECT id, name, status, grade_level FROM students WHERE id = ?", [student_id]);
    if (student.length === 0) {
      res.status(404).json({ error: "Student not found." });
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

    // Section validation only when section_id is provided
    let sectionName = "Pending Section";
    if (section_id) {
      const section = await query<RowDataPacket[]>(
        "SELECT id, name, grade_level, capacity, current_count FROM sections WHERE id = ?",
        [section_id]
      );
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

      sectionName = section[0].name;
    }

    const enrolled_by = req.user!.userId;

    const result = await query<ResultSetHeader>(
      `INSERT INTO enrollments (student_id, section_id, school_year_id, program, enrollment_date, enrolled_by, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [student_id, section_id || null, school_year_id, program || "regular", enrollment_date, enrolled_by, remarks || null]
    );

    // Insert requirements checklist if provided
    if (requirements && Array.isArray(requirements) && requirements.length > 0) {
      for (const r of requirements) {
        await query<ResultSetHeader>(
          `INSERT INTO enrollment_requirements (enrollment_id, requirement_key, label, is_submitted, submitted_at, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, IF(?, NOW(), NULL), NULL, NOW(), NOW())`,
          [result.insertId, r.requirement_key, r.label, r.is_submitted ? 1 : 0, r.is_submitted ? 1 : 0]
        );
      }
    }

    // Increment section current_count only if section was assigned
    if (section_id) {
      await query<ResultSetHeader>(
        "UPDATE sections SET current_count = current_count + 1 WHERE id = ?",
        [section_id]
      );
    }

    // Update student status to enrolled
    await query<ResultSetHeader>(
      "UPDATE students SET status = 'enrolled' WHERE id = ?",
      [student_id]
    );

    await logActivity(
      req.user!.userId,
      sectionName !== "Pending Section"
        ? `Enrolled student: ${student[0].name} into ${sectionName}`
        : `Enrolled student: ${student[0].name} (Pending Section — awaiting Registrar assignment)`,
      "enrollments",
      result.insertId
    );

    const newEnrollment = await query<RowDataPacket[]>(
      `SELECT e.*, s.name AS student_name, s.student_id, sec.name AS section_name, sy.sy_label
       FROM enrollments e
       JOIN students s ON e.student_id = s.id
       LEFT JOIN sections sec ON e.section_id = sec.id
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
 * PUT /api/enrollments/:id — Update enrollment (drop/transfer/assign-section)
 * Body: { status?, remarks?, section_id? }
 */
export async function updateEnrollment(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status, remarks, section_id } = req.body;

    const existing = await query<RowDataPacket[]>(
      `SELECT e.*, s.name AS student_name, sec.name AS section_name
       FROM enrollments e
       JOIN students s ON e.student_id = s.id
       LEFT JOIN sections sec ON e.section_id = sec.id
       WHERE e.id = ?`,
      [id]
    );

    if (existing.length === 0) {
      res.status(404).json({ error: "Enrollment not found." });
      return;
    }

    const enrollment = existing[0];

    // --- Section assignment (Registrar assigning section to a pending student) ---
    if (section_id && !enrollment.section_id && (!status || status === "enrolled")) {
      const newSection = await query<RowDataPacket[]>(
        "SELECT id, name, capacity, current_count, grade_level FROM sections WHERE id = ?",
        [section_id]
      );

      if (newSection.length === 0) {
        res.status(404).json({ error: "Section not found." });
        return;
      }

      if (newSection[0].current_count >= newSection[0].capacity) {
        res.status(400).json({ error: `Section "${newSection[0].name}" is at full capacity.` });
        return;
      }

      // Check grade level match
      const student = await query<RowDataPacket[]>(
        "SELECT grade_level FROM students WHERE id = ?",
        [enrollment.student_id]
      );
      if (student.length > 0 && student[0].grade_level !== newSection[0].grade_level) {
        res.status(400).json({
          error: `Student grade level (${student[0].grade_level}) does not match section grade level (${newSection[0].grade_level}).`
        });
        return;
      }

      // Assign section
      await query<ResultSetHeader>(
        "UPDATE enrollments SET section_id = ?, assigned_at = NOW(), assigned_by = ? WHERE id = ?",
        [section_id, req.user!.userId, id]
      );

      // Increment new section count
      await query<ResultSetHeader>(
        "UPDATE sections SET current_count = current_count + 1 WHERE id = ?",
        [section_id]
      );

      await logActivity(
        req.user!.userId,
        `Assigned student: ${enrollment.student_name} to section ${newSection[0].name}`,
        "enrollments",
        id
      );

      const updated = await query<RowDataPacket[]>(
        `SELECT e.*, s.name AS student_name, sec.name AS section_name, sy.sy_label
         FROM enrollments e
         JOIN students s ON e.student_id = s.id
         LEFT JOIN sections sec ON e.section_id = sec.id
         JOIN school_years sy ON e.school_year_id = sy.id
         WHERE e.id = ?`,
        [id]
      );

      res.json(updated[0]);
      return;
    }

    // --- Drop or Transfer ---
    if (status === "dropped" || status === "transferred") {
      // Decrement old section count only if section was assigned
      if (enrollment.section_id) {
        await query<ResultSetHeader>(
          "UPDATE sections SET current_count = GREATEST(current_count - 1, 0) WHERE id = ?",
          [enrollment.section_id]
        );
      }

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
        `${status === "dropped" ? "Dropped" : "Transferred"} student: ${enrollment.student_name}` +
          (enrollment.section_name ? ` from ${enrollment.section_name}` : ""),
        "enrollments",
        id
      );

      res.json({ message: `Student ${status} successfully.`, status });
      return;
    }

    // --- Transfer to a new section (re-assign) ---
    if (section_id && section_id !== enrollment.section_id && enrollment.section_id) {
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
        "UPDATE enrollments SET section_id = ?, assigned_at = NOW(), assigned_by = ?, remarks = ?, status = 'enrolled' WHERE id = ?",
        [section_id, req.user!.userId, remarks || null, id]
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
         LEFT JOIN sections sec ON e.section_id = sec.id
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

/**
 * DELETE /api/enrollments/:id — Delete enrollment (hard delete)
 */
export async function deleteEnrollment(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await query<RowDataPacket[]>(
      `SELECT e.*, s.name AS student_name FROM enrollments e JOIN students s ON e.student_id = s.id WHERE e.id = ?`,
      [id]
    );

    if (existing.length === 0) {
      res.status(404).json({ error: "Enrollment not found." });
      return;
    }

    const enrollment = existing[0];

    // Decrement section count if section was assigned
    if (enrollment.section_id) {
      await query<ResultSetHeader>(
        "UPDATE sections SET current_count = GREATEST(current_count - 1, 0) WHERE id = ?",
        [enrollment.section_id]
      );
    }

    await query<ResultSetHeader>("DELETE FROM enrollments WHERE id = ?", [id]);

    await logActivity(
      req.user!.userId,
      `Deleted enrollment for student: ${enrollment.student_name}`,
      "enrollments",
      id
    );

    res.json({ message: "Enrollment deleted." });
  } catch (error) {
    console.error("Delete enrollment error:", error);
    res.status(500).json({ error: "Failed to delete enrollment." });
  }
}

/**
 * GET /api/enrollments/:id/requirements — List enrollment requirements
 */
export async function listRequirements(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const rows = await query<RowDataPacket[]>(
      "SELECT * FROM enrollment_requirements WHERE enrollment_id = ? ORDER BY requirement_key ASC",
      [id]
    );
    res.json(rows);
  } catch (error) {
    console.error("List requirements error:", error);
    res.status(500).json({ error: "Failed to fetch requirements." });
  }
}

/**
 * PUT /api/enrollments/:id/requirements — Batch update requirements
 * Body: { requirements: [{ requirement_key, is_submitted }] }
 */
export async function updateRequirements(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { requirements } = req.body;

    if (!requirements || !Array.isArray(requirements)) {
      res.status(400).json({ error: "requirements array is required." });
      return;
    }

    for (const r of requirements) {
      if (r.is_submitted) {
        await query<ResultSetHeader>(
          "UPDATE enrollment_requirements SET is_submitted = 1, submitted_at = COALESCE(submitted_at, NOW()) WHERE enrollment_id = ? AND requirement_key = ?",
          [id, r.requirement_key]
        );
      } else {
        await query<ResultSetHeader>(
          "UPDATE enrollment_requirements SET is_submitted = 0, submitted_at = NULL WHERE enrollment_id = ? AND requirement_key = ?",
          [id, r.requirement_key]
        );
      }
    }

    // Return updated list
    const rows = await query<RowDataPacket[]>(
      "SELECT * FROM enrollment_requirements WHERE enrollment_id = ? ORDER BY requirement_key ASC",
      [id]
    );
    res.json(rows);
  } catch (error) {
    console.error("Update requirements error:", error);
    res.status(500).json({ error: "Failed to update requirements." });
  }
}
