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
 * GET /api/subjects — List subjects with filters
 * Query: ?grade_level=7&subject_type=core
 */
export async function listSubjects(req: Request, res: Response): Promise<void> {
  try {
    const { grade_level, subject_type, is_active } = req.query;

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
