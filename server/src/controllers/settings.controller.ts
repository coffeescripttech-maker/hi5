import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";

/**
 * GET /api/settings — Get school settings
 */
export async function getSettings(_req: Request, res: Response): Promise<void> {
  try {
    const settings = await query<RowDataPacket[]>(
      `SELECT ss.*, sy.sy_label AS current_sy_label
       FROM school_settings ss
       LEFT JOIN school_years sy ON ss.current_sy_id = sy.id
       WHERE ss.id = 1`
    );

    if (settings.length === 0) {
      res.status(404).json({ error: "School settings not found. Run the seed data first." });
      return;
    }

    res.json(settings[0]);
  } catch (error) {
    console.error("Get settings error:", error);
    res.status(500).json({ error: "Failed to fetch settings." });
  }
}

/**
 * PUT /api/settings — Update school settings
 */
export async function updateSettings(req: Request, res: Response): Promise<void> {
  try {
    const { school_name, school_id, region, division, district, current_sy_id } = req.body;

    const existing = await query<RowDataPacket[]>("SELECT id FROM school_settings WHERE id = 1");
    if (existing.length === 0) {
      // Create settings row if it doesn't exist
      await query<ResultSetHeader>(
        `INSERT INTO school_settings (school_name, school_id, region, division, district, current_sy_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [school_name || "Don Servillano Platon Memorial National High School", school_id || "", region || "", division || "", district || null, current_sy_id || null]
      );
    } else {
      const fields: string[] = [];
      const params: any[] = [];

      if (school_name !== undefined) { fields.push("school_name = ?"); params.push(school_name); }
      if (school_id !== undefined) { fields.push("school_id = ?"); params.push(school_id); }
      if (region !== undefined) { fields.push("region = ?"); params.push(region); }
      if (division !== undefined) { fields.push("division = ?"); params.push(division); }
      if (district !== undefined) { fields.push("district = ?"); params.push(district); }
      if (current_sy_id !== undefined) { fields.push("current_sy_id = ?"); params.push(current_sy_id); }

      if (fields.length === 0) {
        res.status(400).json({ error: "No fields to update." });
        return;
      }

      await query<ResultSetHeader>(`UPDATE school_settings SET ${fields.join(", ")} WHERE id = 1`, params);
    }

    await logActivity(req.user!.userId, "Updated school settings", "settings", 1);

    const updated = await query<RowDataPacket[]>(
      `SELECT ss.*, sy.sy_label AS current_sy_label
       FROM school_settings ss
       LEFT JOIN school_years sy ON ss.current_sy_id = sy.id
       WHERE ss.id = 1`
    );

    res.json(updated[0]);
  } catch (error) {
    console.error("Update settings error:", error);
    res.status(500).json({ error: "Failed to update settings." });
  }
}

/**
 * GET /api/settings/thresholds — Get section type thresholds for all grade levels
 */
export async function getThresholds(_req: Request, res: Response): Promise<void> {
  try {
    const rows = await query<RowDataPacket[]>(
      "SELECT * FROM section_type_config ORDER BY grade_level, FIELD(section_type, 'star','gold','silver','regular','non_reader')"
    );
    res.json(rows);
  } catch (error) {
    console.error("Get thresholds error:", error);
    res.status(500).json({ error: "Failed to fetch section thresholds." });
  }
}

/**
 * PUT /api/settings/thresholds — Update section type thresholds
 * Body: { thresholds: { id: number, min_average: number, max_average: number }[] }
 */
export async function updateThresholds(req: Request, res: Response): Promise<void> {
  try {
    const { thresholds } = req.body;

    if (!Array.isArray(thresholds) || thresholds.length === 0) {
      res.status(400).json({ error: "thresholds array is required." });
      return;
    }

    for (const t of thresholds) {
      if (t.id && (t.min_average !== undefined || t.max_average !== undefined)) {
        const fields: string[] = [];
        const params: any[] = [];
        if (t.min_average !== undefined) { fields.push("min_average = ?"); params.push(t.min_average); }
        if (t.max_average !== undefined) { fields.push("max_average = ?"); params.push(t.max_average); }
        params.push(t.id);
        await query<ResultSetHeader>(
          `UPDATE section_type_config SET ${fields.join(", ")} WHERE id = ?`,
          params
        );
      }
    }

    await logActivity(req.user!.userId, "Updated section type thresholds", "settings", 0);

    const updated = await query<RowDataPacket[]>(
      "SELECT * FROM section_type_config ORDER BY grade_level, FIELD(section_type, 'star','gold','silver','regular','non_reader')"
    );
    res.json(updated);
  } catch (error) {
    console.error("Update thresholds error:", error);
    res.status(500).json({ error: "Failed to update section thresholds." });
  }
}
