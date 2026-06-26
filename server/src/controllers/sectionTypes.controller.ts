import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";

interface SectionTypeRow extends RowDataPacket {
  id: number;
  name: string;
  label: string;
  color_code: string | null;
  icon: string | null;
  sort_order: number;
  is_locked: number;
  is_active: number;
  created_at: Date;
}

/**
 * GET /api/section-types — List all active section types
 */
export async function listSectionTypes(_req: Request, res: Response): Promise<void> {
  try {
    const types = await query<SectionTypeRow[]>(
      "SELECT * FROM section_types WHERE is_active = 1 ORDER BY sort_order ASC"
    );
    res.json(types);
  } catch (error) {
    console.error("List section types error:", error);
    res.status(500).json({ error: "Failed to fetch section types." });
  }
}

/**
 * POST /api/section-types — Create a new section type (admin)
 */
export async function createSectionType(req: Request, res: Response): Promise<void> {
  try {
    const { name, label, color_code, icon, sort_order } = req.body;

    if (!name || !label) {
      res.status(400).json({ error: "Missing required fields: name, label." });
      return;
    }

    // Check uniqueness
    const existing = await query<RowDataPacket[]>(
      "SELECT id FROM section_types WHERE name = ?",
      [name]
    );
    if (existing.length > 0) {
      res.status(409).json({ error: `Section type "${name}" already exists.` });
      return;
    }

    const result = await query<ResultSetHeader>(
      `INSERT INTO section_types (name, label, color_code, icon, sort_order, is_locked, is_active)
       VALUES (?, ?, ?, ?, ?, 0, 1)`,
      [name, label, color_code || null, icon || null, sort_order !== undefined ? sort_order : 0]
    );

    await logActivity(req.user!.userId, `Created section type "${name}"`, "section_types", result.insertId);

    const created = await query<SectionTypeRow[]>(
      "SELECT * FROM section_types WHERE id = ?",
      [result.insertId]
    );
    res.status(201).json(created[0]);
  } catch (error) {
    console.error("Create section type error:", error);
    res.status(500).json({ error: "Failed to create section type." });
  }
}

/**
 * PUT /api/section-types/:id — Update a section type (admin)
 */
export async function updateSectionType(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { label, color_code, icon, sort_order, is_active } = req.body;

    const existing = await query<RowDataPacket[]>(
      "SELECT id FROM section_types WHERE id = ?",
      [id]
    );
    if (existing.length === 0) {
      res.status(404).json({ error: "Section type not found." });
      return;
    }

    const fields: string[] = [];
    const params: any[] = [];

    if (label !== undefined) { fields.push("label = ?"); params.push(label); }
    if (color_code !== undefined) { fields.push("color_code = ?"); params.push(color_code); }
    if (icon !== undefined) { fields.push("icon = ?"); params.push(icon); }
    if (sort_order !== undefined) { fields.push("sort_order = ?"); params.push(sort_order); }
    if (is_active !== undefined) { fields.push("is_active = ?"); params.push(is_active); }

    if (fields.length === 0) {
      res.status(400).json({ error: "No fields to update." });
      return;
    }

    params.push(id);
    await query<ResultSetHeader>(
      `UPDATE section_types SET ${fields.join(", ")} WHERE id = ?`,
      params
    );
    await logActivity(req.user!.userId, `Updated section type ID ${id}`, "section_types", id);

    const updated = await query<SectionTypeRow[]>(
      "SELECT * FROM section_types WHERE id = ?",
      [id]
    );
    res.json(updated[0]);
  } catch (error) {
    console.error("Update section type error:", error);
    res.status(500).json({ error: "Failed to update section type." });
  }
}

/**
 * DELETE /api/section-types/:id — Soft-delete a section type (admin)
 * Locked types (e.g. 'star', 'non_reader') cannot be deleted.
 */
export async function deleteSectionType(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await query<SectionTypeRow[]>(
      "SELECT id, name, is_locked FROM section_types WHERE id = ?",
      [id]
    );
    if (existing.length === 0) {
      res.status(404).json({ error: "Section type not found." });
      return;
    }

    const type = existing[0];
    if (type.is_locked === 1) {
      res.status(400).json({ error: `"${type.name}" is a core section type and cannot be deleted.` });
      return;
    }

    await query<ResultSetHeader>(
      "UPDATE section_types SET is_active = 0 WHERE id = ?",
      [id]
    );
    await logActivity(req.user!.userId, `Deleted section type "${type.name}"`, "section_types", id);

    res.json({ message: `Section type "${type.name}" deleted.` });
  } catch (error) {
    console.error("Delete section type error:", error);
    res.status(500).json({ error: "Failed to delete section type." });
  }
}
