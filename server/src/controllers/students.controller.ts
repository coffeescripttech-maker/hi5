import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";

interface StudentRow extends RowDataPacket {
  id: number;
  student_id: string;
  lrn: string;
  name: string;
  grade_level: number;
  sex: "male" | "female";
  birthdate: string;
  address: string | null;
  guardian: string | null;
  contact: string | null;
  status: "enrolled" | "pending" | "dropped" | "transferred" | "graduated";
  created_at: Date;
  updated_at: Date;
}

/**
 * GET /api/students — List students with optional filters
 * Query: ?grade_level=7&status=enrolled&search=maria
 */
export async function listStudents(req: Request, res: Response): Promise<void> {
  try {
    const { grade_level, status, search, section_id, school_year_id } = req.query;

    let sql = `SELECT s.* FROM students s`;
    const params: any[] = [];
    const conditions: string[] = [];

    if (section_id && school_year_id) {
      sql += ` JOIN enrollments e ON e.student_id = s.id`;
      conditions.push("e.section_id = ?");
      params.push(section_id);
      conditions.push("e.school_year_id = ?");
      params.push(school_year_id);
    }

    if (grade_level) {
      conditions.push("s.grade_level = ?");
      params.push(parseInt(grade_level as string));
    }

    if (status) {
      conditions.push("s.status = ?");
      params.push(status);
    }

    if (search) {
      conditions.push("(s.name LIKE ? OR s.student_id LIKE ? OR s.lrn LIKE ?)");
      const q = `%${search}%`;
      params.push(q, q, q);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY s.grade_level ASC, s.name ASC";

    const students = await query<StudentRow[]>(sql, params);
    res.json(students);
  } catch (error) {
    console.error("List students error:", error);
    res.status(500).json({ error: "Failed to fetch students." });
  }
}

/**
 * GET /api/students/my-students — Get students scoped to the logged-in teacher
 * Returns students enrolled in sections where the current user is the adviser,
 * for the current active school year.
 */
export async function getTeacherStudents(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    // Find sections where this user is the adviser
    const sections = await query<RowDataPacket[]>(
      "SELECT id, name, grade_level FROM sections WHERE adviser_id = ? AND is_active = 1",
      [userId]
    );

    if (sections.length === 0) {
      res.json([]);
      return;
    }

    // Get current school year
    const currentSY = await query<RowDataPacket[]>(
      "SELECT id FROM school_years WHERE is_current = 1 LIMIT 1"
    );

    if (currentSY.length === 0) {
      res.json([]);
      return;
    }

    const schoolYearId = currentSY[0].id;
    const sectionIds = sections.map(s => s.id);

    // Get enrolled students in those sections for this school year
    const placeholders = sectionIds.map(() => "?").join(",");
    const students = await query<StudentRow[]>(
      `SELECT s.*, e.section_id, sec.name AS section_name, e.status AS enrollment_status,
              e.enrollment_date, e.program
       FROM students s
       JOIN enrollments e ON e.student_id = s.id
       JOIN sections sec ON e.section_id = sec.id
       WHERE e.section_id IN (${placeholders}) AND e.school_year_id = ?
       ORDER BY sec.grade_level ASC, sec.name ASC, s.name ASC`,
      [...sectionIds, schoolYearId]
    );

    res.json(students);
  } catch (error) {
    console.error("Get teacher students error:", error);
    res.status(500).json({ error: "Failed to fetch teacher's students." });
  }
}

/**
 * GET /api/students/:id — Get student by ID with enrollment info
 */
export async function getStudentById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const students = await query<StudentRow[]>(
      `SELECT * FROM students WHERE id = ?`,
      [id]
    );

    if (students.length === 0) {
      res.status(404).json({ error: "Student not found." });
      return;
    }

    // Get current enrollment
    const enrollments = await query<RowDataPacket[]>(
      `SELECT e.id, e.enrollment_date, e.status AS enrollment_status, e.remarks,
              sec.name AS section_name, sec.grade_level, sec.section_type,
              sy.sy_label, sy.id AS school_year_id
       FROM enrollments e
       JOIN sections sec ON e.section_id = sec.id
       JOIN school_years sy ON e.school_year_id = sy.id
       WHERE e.student_id = ?
       ORDER BY sy.is_current DESC, e.created_at DESC
       LIMIT 1`,
      [id]
    );

    // Get classifications
    const classifications = await query<RowDataPacket[]>(
      `SELECT sc.id, sc.classification, sc.school_year_id, sy.sy_label
       FROM student_classifications sc
       JOIN school_years sy ON sc.school_year_id = sy.id
       WHERE sc.student_id = ?
       ORDER BY sc.created_at DESC`,
      [id]
    );

    res.json({
      ...students[0],
      current_enrollment: enrollments[0] || null,
      classifications,
    });
  } catch (error) {
    console.error("Get student error:", error);
    res.status(500).json({ error: "Failed to fetch student." });
  }
}

/**
 * POST /api/students — Create student
 */
export async function createStudent(req: Request, res: Response): Promise<void> {
  try {
    const { student_id, lrn, name, grade_level, sex, birthdate, address, guardian, contact, status } = req.body;

    if (!student_id || !lrn || !name || !grade_level || !sex || !birthdate) {
      res.status(400).json({ error: "Missing required fields: student_id, lrn, name, grade_level, sex, birthdate." });
      return;
    }

    if (grade_level < 7 || grade_level > 12) {
      res.status(400).json({ error: "Grade level must be between 7 and 12." });
      return;
    }

    // Check duplicates
    const existing = await query<RowDataPacket[]>(
      "SELECT id FROM students WHERE student_id = ? OR lrn = ?",
      [student_id, lrn]
    );
    if (existing.length > 0) {
      res.status(409).json({ error: "Student ID or LRN already exists." });
      return;
    }

    const result = await query<ResultSetHeader>(
      `INSERT INTO students (student_id, lrn, name, grade_level, sex, birthdate, address, guardian, contact, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [student_id, lrn, name, grade_level, sex, birthdate, address || null, guardian || null, contact || null, status || "pending"]
    );

    await logActivity(req.user!.userId, `Created student "${name}" (${student_id})`, "students", result.insertId);

    const newStudent = await query<StudentRow[]>("SELECT * FROM students WHERE id = ?", [result.insertId]);
    res.status(201).json(newStudent[0]);
  } catch (error) {
    console.error("Create student error:", error);
    res.status(500).json({ error: "Failed to create student." });
  }
}

/**
 * PUT /api/students/:id — Update student
 */
export async function updateStudent(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { lrn, name, grade_level, sex, birthdate, address, guardian, contact, status } = req.body;

    const existing = await query<RowDataPacket[]>("SELECT id FROM students WHERE id = ?", [id]);
    if (existing.length === 0) {
      res.status(404).json({ error: "Student not found." });
      return;
    }

    const fields: string[] = [];
    const params: any[] = [];

    if (lrn !== undefined) { fields.push("lrn = ?"); params.push(lrn); }
    if (name !== undefined) { fields.push("name = ?"); params.push(name); }
    if (grade_level !== undefined) {
      if (grade_level < 7 || grade_level > 12) {
        res.status(400).json({ error: "Grade level must be between 7 and 12." });
        return;
      }
      fields.push("grade_level = ?"); params.push(grade_level);
    }
    if (sex !== undefined) { fields.push("sex = ?"); params.push(sex); }
    if (birthdate !== undefined) { fields.push("birthdate = ?"); params.push(birthdate); }
    if (address !== undefined) { fields.push("address = ?"); params.push(address); }
    if (guardian !== undefined) { fields.push("guardian = ?"); params.push(guardian); }
    if (contact !== undefined) { fields.push("contact = ?"); params.push(contact); }
    if (status !== undefined) { fields.push("status = ?"); params.push(status); }

    if (fields.length === 0) {
      res.status(400).json({ error: "No fields to update." });
      return;
    }

    params.push(id);
    await query<ResultSetHeader>(`UPDATE students SET ${fields.join(", ")} WHERE id = ?`, params);
    await logActivity(req.user!.userId, `Updated student ID ${id}`, "students", id);

    const updated = await query<StudentRow[]>("SELECT * FROM students WHERE id = ?", [id]);
    res.json(updated[0]);
  } catch (error) {
    console.error("Update student error:", error);
    res.status(500).json({ error: "Failed to update student." });
  }
}

/**
 * POST /api/students/:id/classifications — Add or update classifications
 * Body: { classifications: ["4ps", "pwd", ...], school_year_id: 1 }
 */
export async function updateClassifications(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { classifications, school_year_id } = req.body;

    if (!classifications || !Array.isArray(classifications) || classifications.length === 0) {
      res.status(400).json({ error: "Classifications array is required." });
      return;
    }

    if (!school_year_id) {
      res.status(400).json({ error: "school_year_id is required." });
      return;
    }

    const validClassifications = ["4ps", "pwd", "transferee", "non_reader", "regular"];
    for (const c of classifications) {
      if (!validClassifications.includes(c)) {
        res.status(400).json({ error: `Invalid classification: "${c}". Must be one of: ${validClassifications.join(", ")}` });
        return;
      }
    }

    const student = await query<RowDataPacket[]>("SELECT id FROM students WHERE id = ?", [id]);
    if (student.length === 0) {
      res.status(404).json({ error: "Student not found." });
      return;
    }

    // Delete existing classifications for this student + school year
    await query<ResultSetHeader>(
      "DELETE FROM student_classifications WHERE student_id = ? AND school_year_id = ?",
      [id, school_year_id]
    );

    // Insert new ones
    for (const classification of classifications) {
      await query<ResultSetHeader>(
        "INSERT INTO student_classifications (student_id, classification, school_year_id) VALUES (?, ?, ?)",
        [id, classification, school_year_id]
      );
    }

    await logActivity(req.user!.userId, `Updated classifications for student ID ${id}`, "student_classifications", id);

    // Return updated classifications
    const updated = await query<RowDataPacket[]>(
      `SELECT sc.*, sy.sy_label FROM student_classifications sc
       JOIN school_years sy ON sc.school_year_id = sy.id
       WHERE sc.student_id = ? AND sc.school_year_id = ?
       ORDER BY sc.classification ASC`,
      [id, school_year_id]
    );

    res.json(updated);
  } catch (error) {
    console.error("Update classifications error:", error);
    res.status(500).json({ error: "Failed to update classifications." });
  }
}

/**
 * DELETE /api/students/:id — Delete student
 */
export async function deleteStudent(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await query<RowDataPacket[]>("SELECT id, name, student_id FROM students WHERE id = ?", [id]);
    if (existing.length === 0) {
      res.status(404).json({ error: "Student not found." });
      return;
    }

    await query<ResultSetHeader>("DELETE FROM students WHERE id = ?", [id]);
    await logActivity(req.user!.userId, `Deleted student "${existing[0].name}" (${existing[0].student_id})`, "students", id);

    res.json({ message: "Student deleted successfully." });
  } catch (error) {
    console.error("Delete student error:", error);
    res.status(500).json({ error: "Failed to delete student." });
  }
}
