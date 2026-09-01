import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";

interface SubjectRow extends RowDataPacket {
  id: number;
  name: string;
  grade_level: number;
  hours_per_week: number;
  subject_type: "core" | "applied" | "specialized";
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * GET /api/subjects/me/assigned — Get subjects assigned to the logged-in teacher
 * (from teacher_subject_assignments for the current school year).
 * Teachers only: returns subject IDs to enforce subject-level grade encoding scope.
 */
export async function getAssignedSubjects(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    // Get current school year
    const currentSY = await query<RowDataPacket[]>(
      "SELECT id FROM school_years WHERE is_current = 1 LIMIT 1"
    );
    const schoolYearId = currentSY.length > 0 ? currentSY[0].id : null;

    let sql = `
      SELECT DISTINCT s.*, tsa.created_at AS assigned_at
      FROM subjects s
      JOIN teacher_subject_assignments tsa ON tsa.subject_id = s.id
      WHERE tsa.teacher_id = ?
    `;
    const params: any[] = [userId];

    if (schoolYearId) {
      sql += " AND (tsa.school_year_id = ? OR tsa.school_year_id IS NULL)";
      params.push(schoolYearId);
    }

    sql += " ORDER BY s.grade_level ASC, s.name ASC";

    const subjects = await query<SubjectRow[]>(sql, params);
    res.json(subjects);
  } catch (error) {
    console.error("Get assigned subjects error:", error);
    res.status(500).json({ error: "Failed to fetch assigned subjects." });
  }
}

/**
 * GET /api/subjects — List subjects with filters
 * Query: ?grade_level=7&subject_type=core&strand_track_id=1
 *
 * When strand_track_id is provided, returns subjects that are either:
 *   - Shared (not linked to any strand track), OR
 *   - Linked to the specified strand track
 */
export async function listSubjects(req: Request, res: Response): Promise<void> {
  try {
    const { grade_level, subject_type, is_active, strand_track_id } = req.query;

    let sql = "SELECT * FROM subjects";
    const params: any[] = [];
    const conditions: string[] = [];

    if (grade_level) {
      conditions.push("grade_level = ?");
      params.push(parseInt(grade_level as string));
    }
    if (subject_type) {
      conditions.push("subject_type = ?");
      params.push(subject_type);
    }
    if (is_active !== undefined) {
      conditions.push("is_active = ?");
      params.push(parseInt(is_active as string));
    }

    // Strand track filter — show shared subjects + track-specific subjects
    if (strand_track_id) {
      conditions.push(`(
        NOT EXISTS (SELECT 1 FROM subject_strand_tracks WHERE subject_id = subjects.id)
        OR id IN (SELECT subject_id FROM subject_strand_tracks WHERE strand_track_id = ?)
      )`);
      params.push(parseInt(strand_track_id as string));
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY grade_level ASC, name ASC";

    const subjects = await query<SubjectRow[]>(sql, params);
    res.json(subjects);
  } catch (error) {
    console.error("List subjects error:", error);
    res.status(500).json({ error: "Failed to fetch subjects." });
  }
}

/**
 * GET /api/subjects/:id — Get subject by ID
 */
export async function getSubjectById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const subjects = await query<SubjectRow[]>("SELECT * FROM subjects WHERE id = ?", [id]);

    if (subjects.length === 0) {
      res.status(404).json({ error: "Subject not found." });
      return;
    }

    res.json(subjects[0]);
  } catch (error) {
    console.error("Get subject error:", error);
    res.status(500).json({ error: "Failed to fetch subject." });
  }
}

/**
 * POST /api/subjects — Create subject
 */
export async function createSubject(req: Request, res: Response): Promise<void> {
  try {
    const { name, grade_level, hours_per_week, subject_type, is_active } = req.body;

    if (!name || !grade_level || hours_per_week === undefined || !subject_type) {
      res.status(400).json({ error: "Missing required fields: name, grade_level, hours_per_week, subject_type." });
      return;
    }

    if (!["core", "applied", "specialized"].includes(subject_type)) {
      res.status(400).json({ error: "Invalid subject_type. Must be core, applied, or specialized." });
      return;
    }

    // Check unique name + grade
    const existing = await query<RowDataPacket[]>(
      "SELECT id FROM subjects WHERE name = ? AND grade_level = ?",
      [name, grade_level]
    );
    if (existing.length > 0) {
      res.status(409).json({ error: `Subject "${name}" already exists for grade ${grade_level}.` });
      return;
    }

    const result = await query<ResultSetHeader>(
      `INSERT INTO subjects (name, grade_level, hours_per_week, subject_type, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [name, grade_level, hours_per_week, subject_type, is_active !== undefined ? is_active : 1]
    );

    await logActivity(req.user!.userId, `Created subject "${name}" (Grade ${grade_level})`, "subjects", result.insertId);

    const newSubject = await query<SubjectRow[]>("SELECT * FROM subjects WHERE id = ?", [result.insertId]);
    res.status(201).json(newSubject[0]);
  } catch (error) {
    console.error("Create subject error:", error);
    res.status(500).json({ error: "Failed to create subject." });
  }
}

/**
 * PUT /api/subjects/:id — Update subject
 */
export async function updateSubject(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, grade_level, hours_per_week, subject_type, is_active } = req.body;

    const existing = await query<RowDataPacket[]>("SELECT id FROM subjects WHERE id = ?", [id]);
    if (existing.length === 0) {
      res.status(404).json({ error: "Subject not found." });
      return;
    }

    const fields: string[] = [];
    const params: any[] = [];

    if (name !== undefined) { fields.push("name = ?"); params.push(name); }
    if (grade_level !== undefined) { fields.push("grade_level = ?"); params.push(grade_level); }
    if (hours_per_week !== undefined) { fields.push("hours_per_week = ?"); params.push(hours_per_week); }
    if (subject_type !== undefined) { fields.push("subject_type = ?"); params.push(subject_type); }
    if (is_active !== undefined) { fields.push("is_active = ?"); params.push(is_active); }

    if (fields.length === 0) {
      res.status(400).json({ error: "No fields to update." });
      return;
    }

    params.push(id);
    await query<ResultSetHeader>(`UPDATE subjects SET ${fields.join(", ")} WHERE id = ?`, params);
    await logActivity(req.user!.userId, `Updated subject ID ${id}`, "subjects", id);

    const updated = await query<SubjectRow[]>("SELECT * FROM subjects WHERE id = ?", [id]);
    res.json(updated[0]);
  } catch (error) {
    console.error("Update subject error:", error);
    res.status(500).json({ error: "Failed to update subject." });
  }
}

/**
 * DELETE /api/subjects/:id — Delete subject
 */
export async function deleteSubject(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await query<RowDataPacket[]>("SELECT id, name FROM subjects WHERE id = ?", [id]);
    if (existing.length === 0) {
      res.status(404).json({ error: "Subject not found." });
      return;
    }

    await query<ResultSetHeader>("DELETE FROM subjects WHERE id = ?", [id]);
    await logActivity(req.user!.userId, `Deleted subject "${existing[0].name}"`, "subjects", id);

    res.json({ message: "Subject deleted successfully." });
  } catch (error) {
    console.error("Delete subject error:", error);
    res.status(500).json({ error: "Failed to delete subject." });
  }
}

/**
 * POST /api/subjects/populate — Bulk-create subjects from a curriculum preset
 * Body: { items: [{ name, grade_level, hours_per_week, subject_type }] }
 *
 * Idempotent: rows matching an existing (name, grade_level) pair are skipped so
 * running a preset twice (or against a partially-populated grade) never duplicates.
 * Returns: { created: SubjectRow[], created_count, skipped_count }
 */
export async function populateSubjects(req: Request, res: Response): Promise<void> {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "items array is required." });
      return;
    }

    const VALID_GRADES = [7, 8, 9, 10, 11, 12];
    const cleaned: { name: string; grade_level: number; hours_per_week: number; subject_type: string }[] = [];

    for (const [idx, item] of items.entries()) {
      const name = typeof item.name === "string" ? item.name.trim() : "";
      const grade_level = parseInt(item.grade_level);
      const hours_per_week = parseFloat(item.hours_per_week);
      const subject_type = item.subject_type;

      if (!name) {
        res.status(400).json({ error: `Item ${idx + 1}: name is required.` });
        return;
      }
      if (!VALID_GRADES.includes(grade_level) || isNaN(grade_level)) {
        res.status(400).json({ error: `Item ${idx + 1} ("${name}"): grade_level must be between 7 and 12.` });
        return;
      }
      if (isNaN(hours_per_week) || hours_per_week <= 0) {
        res.status(400).json({ error: `Item ${idx + 1} ("${name}"): invalid hours_per_week.` });
        return;
      }
      if (!["core", "applied", "specialized"].includes(subject_type)) {
        res.status(400).json({ error: `Item ${idx + 1} ("${name}"): invalid subject_type.` });
        return;
      }
      cleaned.push({ name, grade_level, hours_per_week, subject_type });
    }

    // Snapshot existing (name, grade) pairs so we never insert duplicates
    const existing = await query<RowDataPacket[]>("SELECT name, grade_level FROM subjects");
    const existingKeys = new Set(existing.map((e: any) => `${String(e.name).toLowerCase()}|${e.grade_level}`));

    const toCreate = cleaned.filter(c => !existingKeys.has(`${c.name.toLowerCase()}|${c.grade_level}`));
    const skippedCount = cleaned.length - toCreate.length;

    let createdCount = 0;
    if (toCreate.length > 0) {
      const placeholders = toCreate.map(() => "(?, ?, ?, ?, ?)").join(", ");
      const params = toCreate.flatMap(c => [c.name, c.grade_level, c.hours_per_week, c.subject_type, 1]);
      const result = await query<ResultSetHeader>(
        `INSERT INTO subjects (name, grade_level, hours_per_week, subject_type, is_active)
         VALUES ${placeholders}`,
        params
      );
      createdCount = result.affectedRows;
    }

    if (createdCount > 0) {
      await logActivity(req.user!.userId, `Populated ${createdCount} subject(s), skipped ${skippedCount} duplicate(s)`, "subjects", 0);
    }

    // Return the freshly created rows so the UI can refresh without a second call
    const created = toCreate.length > 0
      ? await query<SubjectRow[]>(
          `SELECT * FROM subjects WHERE (name, grade_level) IN (${toCreate.map(() => "(?, ?)").join(", ")})`,
          toCreate.flatMap(c => [c.name, c.grade_level])
        )
      : [];

    res.json({ created, created_count: createdCount, skipped_count: skippedCount });
  } catch (error) {
    console.error("Populate subjects error:", error);
    res.status(500).json({ error: "Failed to populate subjects." });
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Teacher–Subject Assignments (Admin UI for grade encoding scope)
   Backed by teacher_subject_assignments for the CURRENT school year.
   ═══════════════════════════════════════════════════════════════════ */

interface TeacherAssignmentRow extends RowDataPacket {
  subject_id: number;
  teacher_id: number;
  teacher_name: string;
  employee_id: string | null;
}

/** Resolve the current school year id (or null when none is active). */
async function getCurrentSchoolYearId(): Promise<number | null> {
  const rows = await query<RowDataPacket[]>(
    "SELECT id FROM school_years WHERE is_current = 1 LIMIT 1"
  );
  return rows.length > 0 ? (rows[0].id as number) : null;
}

/**
 * GET /api/subjects/teachers/assignments — All teacher-subject assignments
 * for the current school year, used by the Admin Subject Management page.
 */
export async function listTeacherAssignments(_req: Request, res: Response): Promise<void> {
  try {
    const schoolYearId = await getCurrentSchoolYearId();
    if (!schoolYearId) {
      res.json([]);
      return;
    }
    const rows = await query<TeacherAssignmentRow[]>(
      `SELECT tsa.subject_id, tsa.teacher_id, u.name AS teacher_name, u.employee_id
       FROM teacher_subject_assignments tsa
       JOIN users u ON u.id = tsa.teacher_id
       WHERE tsa.school_year_id = ?
       ORDER BY u.name ASC`,
      [schoolYearId]
    );
    res.json(rows);
  } catch (error) {
    console.error("List teacher assignments error:", error);
    res.status(500).json({ error: "Failed to fetch teacher assignments." });
  }
}

/**
 * POST /api/subjects/:id/teachers — Assign a teacher to a subject
 * for the current school year. Body: { teacher_id: number }
 */
export async function assignTeacherToSubject(req: Request, res: Response): Promise<void> {
  try {
    const subjectId = parseInt(String(req.params.id));
    const teacherId = parseInt(String(req.body?.teacher_id ?? ""));
    if (!Number.isFinite(subjectId) || !Number.isFinite(teacherId)) {
      res.status(400).json({ error: "Valid subject_id and teacher_id are required." });
      return;
    }

    // Validate subject exists
    const subjects = await query<RowDataPacket[]>("SELECT id, name FROM subjects WHERE id = ?", [subjectId]);
    if (subjects.length === 0) {
      res.status(404).json({ error: "Subject not found." });
      return;
    }

    // Validate the user is an active teacher
    const teachers = await query<RowDataPacket[]>(
      "SELECT id, name FROM users WHERE id = ? AND role = 'teacher'",
      [teacherId]
    );
    if (teachers.length === 0) {
      res.status(400).json({ error: "Selected user is not a teacher." });
      return;
    }

    const schoolYearId = await getCurrentSchoolYearId();
    if (!schoolYearId) {
      res.status(400).json({ error: "No active school year. Set a current school year first." });
      return;
    }

    // Guard against duplicates (unique key also protects, but check for a clean 409)
    const existing = await query<RowDataPacket[]>(
      "SELECT id FROM teacher_subject_assignments WHERE teacher_id = ? AND subject_id = ? AND school_year_id = ?",
      [teacherId, subjectId, schoolYearId]
    );
    if (existing.length > 0) {
      res.status(409).json({ error: "This teacher is already assigned to this subject." });
      return;
    }

    await query<ResultSetHeader>(
      "INSERT INTO teacher_subject_assignments (teacher_id, subject_id, school_year_id) VALUES (?, ?, ?)",
      [teacherId, subjectId, schoolYearId]
    );

    await logActivity(
      req.user!.userId,
      `Assigned teacher "${teachers[0].name}" to subject "${subjects[0].name}"`,
      "teacher_subject_assignments",
      `${teacherId}-${subjectId}`
    );

    res.status(201).json({ message: "Teacher assigned successfully." });
  } catch (error) {
    console.error("Assign teacher error:", error);
    res.status(500).json({ error: "Failed to assign teacher." });
  }
}

/**
 * DELETE /api/subjects/:id/teachers/:teacherId — Remove a teacher's
 * assignment from a subject for the current school year.
 */
export async function unassignTeacherFromSubject(req: Request, res: Response): Promise<void> {
  try {
    const subjectId = parseInt(String(req.params.id));
    const teacherId = parseInt(String(req.params.teacherId));
    if (!Number.isFinite(subjectId) || !Number.isFinite(teacherId)) {
      res.status(400).json({ error: "Valid subject_id and teacher_id are required." });
      return;
    }

    const schoolYearId = await getCurrentSchoolYearId();
    if (!schoolYearId) {
      res.status(400).json({ error: "No active school year." });
      return;
    }

    const result = await query<ResultSetHeader>(
      "DELETE FROM teacher_subject_assignments WHERE teacher_id = ? AND subject_id = ? AND school_year_id = ?",
      [teacherId, subjectId, schoolYearId]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ error: "Assignment not found." });
      return;
    }

    await logActivity(
      req.user!.userId,
      `Unassigned teacher ID ${teacherId} from subject ID ${subjectId}`,
      "teacher_subject_assignments",
      `${teacherId}-${subjectId}`
    );

    res.json({ message: "Teacher unassigned successfully." });
  } catch (error) {
    console.error("Unassign teacher error:", error);
    res.status(500).json({ error: "Failed to unassign teacher." });
  }
}
