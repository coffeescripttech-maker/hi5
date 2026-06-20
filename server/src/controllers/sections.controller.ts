import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";

interface SectionRow extends RowDataPacket {
  id: number;
  name: string;
  grade_level: number;
  section_type: "star" | "gold" | "silver" | "regular" | "non_reader";
  capacity: number;
  current_count: number;
  adviser_id: number | null;
  min_average: number;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * GET /api/sections — List sections with filters
 * Query: ?grade_level=7&section_type=star
 */
export async function listSections(req: Request, res: Response): Promise<void> {
  try {
    const { grade_level, section_type, is_active } = req.query;

    let sql = `SELECT s.*, u.name AS adviser_name FROM sections s LEFT JOIN users u ON s.adviser_id = u.id`;
    const params: any[] = [];
    const conditions: string[] = [];

    if (grade_level) {
      conditions.push("s.grade_level = ?");
      params.push(parseInt(grade_level as string));
    }
    if (section_type) {
      conditions.push("s.section_type = ?");
      params.push(section_type);
    }
    if (is_active !== undefined) {
      conditions.push("s.is_active = ?");
      params.push(parseInt(is_active as string));
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY s.grade_level ASC, s.name ASC";

    const sections = await query<SectionRow[]>(sql, params);
    res.json(sections);
  } catch (error) {
    console.error("List sections error:", error);
    res.status(500).json({ error: "Failed to fetch sections." });
  }
}

/**
 * GET /api/sections/:id — Get section by ID
 */
export async function getSectionById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const sections = await query<RowDataPacket[]>(
      `SELECT s.*, u.name AS adviser_name,
              (SELECT COUNT(*) FROM enrollments e JOIN school_years sy ON e.school_year_id = sy.id WHERE e.section_id = s.id AND sy.is_current = 1) AS enrolled_count
       FROM sections s
       LEFT JOIN users u ON s.adviser_id = u.id
       WHERE s.id = ?`,
      [id]
    );

    if (sections.length === 0) {
      res.status(404).json({ error: "Section not found." });
      return;
    }

    // Get adviser details
    const section = sections[0];
    if (section.adviser_id) {
      const adviser = await query<RowDataPacket[]>(
        "SELECT id, name, employee_id, designation, email FROM users WHERE id = ?",
        [section.adviser_id]
      );
      section.adviser = adviser[0] || null;
    }

    res.json(section);
  } catch (error) {
    console.error("Get section error:", error);
    res.status(500).json({ error: "Failed to fetch section." });
  }
}

/**
 * POST /api/sections — Create section
 */
export async function createSection(req: Request, res: Response): Promise<void> {
  try {
    const { name, grade_level, section_type, capacity, adviser_id, min_average, is_active } = req.body;

    if (!name || !grade_level || !section_type || !capacity || min_average === undefined) {
      res.status(400).json({ error: "Missing required fields: name, grade_level, section_type, capacity, min_average." });
      return;
    }

    const validTypes = ["star", "gold", "silver", "regular", "non_reader"];
    if (!validTypes.includes(section_type)) {
      res.status(400).json({ error: `Invalid section_type. Must be one of: ${validTypes.join(", ")}` });
      return;
    }

    // Check unique name
    const existing = await query<RowDataPacket[]>("SELECT id FROM sections WHERE name = ?", [name]);
    if (existing.length > 0) {
      res.status(409).json({ error: "Section name already exists." });
      return;
    }

    const result = await query<ResultSetHeader>(
      `INSERT INTO sections (name, grade_level, section_type, capacity, adviser_id, min_average, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, grade_level, section_type, capacity, adviser_id || null, min_average, is_active !== undefined ? is_active : 1]
    );

    await logActivity(req.user!.userId, `Created section "${name}"`, "sections", result.insertId);

    const newSection = await query<SectionRow[]>("SELECT * FROM sections WHERE id = ?", [result.insertId]);
    res.status(201).json(newSection[0]);
  } catch (error) {
    console.error("Create section error:", error);
    res.status(500).json({ error: "Failed to create section." });
  }
}

/**
 * PUT /api/sections/:id — Update section
 */
export async function updateSection(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, grade_level, section_type, capacity, adviser_id, min_average, is_active } = req.body;

    const existing = await query<RowDataPacket[]>("SELECT id FROM sections WHERE id = ?", [id]);
    if (existing.length === 0) {
      res.status(404).json({ error: "Section not found." });
      return;
    }

    const fields: string[] = [];
    const params: any[] = [];

    if (name !== undefined) { fields.push("name = ?"); params.push(name); }
    if (grade_level !== undefined) { fields.push("grade_level = ?"); params.push(grade_level); }
    if (section_type !== undefined) { fields.push("section_type = ?"); params.push(section_type); }
    if (capacity !== undefined) { fields.push("capacity = ?"); params.push(capacity); }
    if (min_average !== undefined) { fields.push("min_average = ?"); params.push(min_average); }
    if (adviser_id !== undefined) { fields.push("adviser_id = ?"); params.push(adviser_id); }
    if (is_active !== undefined) { fields.push("is_active = ?"); params.push(is_active); }

    if (fields.length === 0) {
      res.status(400).json({ error: "No fields to update." });
      return;
    }

    params.push(id);
    await query<ResultSetHeader>(`UPDATE sections SET ${fields.join(", ")} WHERE id = ?`, params);
    await logActivity(req.user!.userId, `Updated section ID ${id}`, "sections", id);

    const updated = await query<SectionRow[]>("SELECT * FROM sections WHERE id = ?", [id]);
    res.json(updated[0]);
  } catch (error) {
    console.error("Update section error:", error);
    res.status(500).json({ error: "Failed to update section." });
  }
}

/**
 * DELETE /api/sections/:id — Delete section
 */
export async function deleteSection(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await query<RowDataPacket[]>("SELECT id, name FROM sections WHERE id = ?", [id]);
    if (existing.length === 0) {
      res.status(404).json({ error: "Section not found." });
      return;
    }

    await query<ResultSetHeader>("DELETE FROM sections WHERE id = ?", [id]);
    await logActivity(req.user!.userId, `Deleted section "${existing[0].name}"`, "sections", id);

    res.json({ message: "Section deleted successfully." });
  } catch (error) {
    console.error("Delete section error:", error);
    res.status(500).json({ error: "Failed to delete section." });
  }
}
