import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";

/**
 * GET /api/school-years — List all school years
 */
export async function listSchoolYears(_req: Request, res: Response): Promise<void> {
  try {
    const years = await query<RowDataPacket[]>(
      "SELECT * FROM school_years ORDER BY sy_label DESC"
    );
    res.json(years);
  } catch (error) {
    console.error("List school years error:", error);
    res.status(500).json({ error: "Failed to fetch school years." });
  }
}

/**
 * GET /api/school-years/current — Get the current school year
 */
export async function getCurrentSchoolYear(_req: Request, res: Response): Promise<void> {
  try {
    const years = await query<RowDataPacket[]>(
      "SELECT * FROM school_years WHERE is_current = 1 LIMIT 1"
    );
    if (years.length === 0) {
      res.status(404).json({ error: "No current school year set." });
      return;
    }
    res.json(years[0]);
  } catch (error) {
    console.error("Get current school year error:", error);
    res.status(500).json({ error: "Failed to fetch current school year." });
  }
}

/**
 * POST /api/school-years — Create a new school year
 * Body: { sy_label, enrollment_start_date?, enrollment_end_date? }
 */
export async function createSchoolYear(req: Request, res: Response): Promise<void> {
  try {
    const { sy_label, enrollment_start_date, enrollment_end_date } = req.body;

    if (!sy_label) {
      res.status(400).json({ error: "sy_label is required (e.g. '2026-2027')." });
      return;
    }

    // Check duplicate
    const existing = await query<RowDataPacket[]>(
      "SELECT id FROM school_years WHERE sy_label = ?",
      [sy_label]
    );
    if (existing.length > 0) {
      res.status(409).json({ error: `School year "${sy_label}" already exists.` });
      return;
    }

    const result = await query<ResultSetHeader>(
      `INSERT INTO school_years (sy_label, enrollment_start_date, enrollment_end_date)
       VALUES (?, ?, ?)`,
      [sy_label, enrollment_start_date || null, enrollment_end_date || null]
    );

    await logActivity(req.user!.userId, `Created school year "${sy_label}"`, "school_years", result.insertId);

    const newYear = await query<RowDataPacket[]>("SELECT * FROM school_years WHERE id = ?", [result.insertId]);
    res.status(201).json(newYear[0]);
  } catch (error) {
    console.error("Create school year error:", error);
    res.status(500).json({ error: "Failed to create school year." });
  }
}

/**
 * PUT /api/school-years/:id — Update a school year
 */
export async function updateSchoolYear(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { sy_label, enrollment_open, enrollment_start_date, enrollment_end_date } = req.body;

    const existing = await query<RowDataPacket[]>("SELECT id FROM school_years WHERE id = ?", [id]);
    if (existing.length === 0) {
      res.status(404).json({ error: "School year not found." });
      return;
    }

    const fields: string[] = [];
    const params: any[] = [];

    if (sy_label !== undefined) { fields.push("sy_label = ?"); params.push(sy_label); }
    if (enrollment_open !== undefined) { fields.push("enrollment_open = ?"); params.push(enrollment_open ? 1 : 0); }
    if (enrollment_start_date !== undefined) { fields.push("enrollment_start_date = ?"); params.push(enrollment_start_date); }
    if (enrollment_end_date !== undefined) { fields.push("enrollment_end_date = ?"); params.push(enrollment_end_date); }

    if (fields.length === 0) {
      res.status(400).json({ error: "No fields to update." });
      return;
    }

    params.push(id);
    await query<ResultSetHeader>(`UPDATE school_years SET ${fields.join(", ")} WHERE id = ?`, params);
    await logActivity(req.user!.userId, `Updated school year ID ${id}`, "school_years", id);

    const updated = await query<RowDataPacket[]>("SELECT * FROM school_years WHERE id = ?", [id]);
    res.json(updated[0]);
  } catch (error) {
    console.error("Update school year error:", error);
    res.status(500).json({ error: "Failed to update school year." });
  }
}

/**
 * POST /api/school-years/:id/set-current — Set a school year as current
 */
export async function setCurrentSchoolYear(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await query<RowDataPacket[]>("SELECT id, sy_label FROM school_years WHERE id = ?", [id]);
    if (existing.length === 0) {
      res.status(404).json({ error: "School year not found." });
      return;
    }

    // Unset all, then set one
    await query<ResultSetHeader>("UPDATE school_years SET is_current = 0");
    await query<ResultSetHeader>("UPDATE school_years SET is_current = 1 WHERE id = ?", [id]);

    // Also update school_settings
    await query<ResultSetHeader>(
      "UPDATE school_settings SET current_sy_id = ? WHERE id = 1",
      [id]
    );

    await logActivity(req.user!.userId, `Set "${existing[0].sy_label}" as current school year`, "school_years", id);

    const updated = await query<RowDataPacket[]>("SELECT * FROM school_years WHERE id = ?", [id]);
    res.json(updated[0]);
  } catch (error) {
    console.error("Set current school year error:", error);
    res.status(500).json({ error: "Failed to set current school year." });
  }
}

/**
 * POST /api/school-years/:id/archive — Archive the current school year
 *
 * Closes enrollment for the current school year, finds/creates the next one
 * (label +1), and makes the next one the active school year with enrollment open.
 */
export async function archiveSchoolYear(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await query<RowDataPacket[]>("SELECT * FROM school_years WHERE id = ?", [id]);
    if (existing.length === 0) {
      res.status(404).json({ error: "School year not found." });
      return;
    }

    const current = existing[0];
    if (current.is_current !== 1) {
      res.status(400).json({ error: "Only the current school year can be archived." });
      return;
    }

    // Determine the next school year label (e.g. 2025-2026 → 2026-2027)
    const parts = String(current.sy_label).split(/[-–]/);
    let nextLabel: string | null = null;
    if (parts.length === 2 && !Number.isNaN(parseInt(parts[0])) && !Number.isNaN(parseInt(parts[1]))) {
      nextLabel = `${parseInt(parts[0]) + 1}-${parseInt(parts[1]) + 1}`;
    }

    if (!nextLabel) {
      res.status(400).json({ error: "Could not determine the next school year label." });
      return;
    }

    // Find or create the next school year
    const nxt = await query<RowDataPacket[]>(
      "SELECT * FROM school_years WHERE sy_label = ?",
      [nextLabel]
    );
    let next: RowDataPacket;
    if (nxt.length > 0) {
      next = nxt[0];
    } else {
      const ins = await query<ResultSetHeader>(
        "INSERT INTO school_years (sy_label, enrollment_open) VALUES (?, 1)",
        [nextLabel]
      );
      next = (await query<RowDataPacket[]>("SELECT * FROM school_years WHERE id = ?", [ins.insertId]))[0];
    }

    // Archive the current year and activate the next
    await query<ResultSetHeader>(
      "UPDATE school_years SET is_current = 0, enrollment_open = 0 WHERE id = ?",
      [id]
    );
    await query<ResultSetHeader>(
      "UPDATE school_years SET is_current = 1, enrollment_open = 1 WHERE id = ?",
      [next.id]
    );

    // Keep school_settings in sync
    await query<ResultSetHeader>(
      "UPDATE school_settings SET current_sy_id = ? WHERE id = 1",
      [next.id]
    );

    await logActivity(
      req.user!.userId,
      `Archived "${current.sy_label}" and activated "${next.sy_label}"`,
      "school_years",
      next.id
    );

    res.json({
      message: `School year ${current.sy_label} archived. ${next.sy_label} is now active.`,
      archived: current,
      next,
    });
  } catch (error) {
    console.error("Archive school year error:", error);
    res.status(500).json({ error: "Failed to archive school year." });
  }
}
