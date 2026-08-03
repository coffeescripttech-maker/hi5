import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";

interface StrandTrackRow extends RowDataPacket {
  id: number;
  code: string;
  name: string;
  track_type: "tle" | "shs_strand";
  grade_level: number;
  description: string | null;
  is_active: number;
  sort_order: number;
  created_at: Date;
}

/**
 * GET /api/strand-tracks — List all active strand tracks
 * Query: ?track_type=tle&grade_level=11&include_inactive=1
 */
export async function listStrandTracks(req: Request, res: Response): Promise<void> {
  try {
    const { track_type, grade_level, include_inactive } = req.query;

    let sql = "SELECT * FROM strand_tracks";
    const params: any[] = [];
    const conditions: string[] = [];

    if (!include_inactive) {
      conditions.push("is_active = 1");
    }
    if (track_type) {
      conditions.push("track_type = ?");
      params.push(track_type);
    }
    if (grade_level) {
      conditions.push("(grade_level = 0 OR grade_level = ?)");
      params.push(parseInt(grade_level as string));
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY sort_order ASC, name ASC";

    const tracks = await query<StrandTrackRow[]>(sql, params);
    res.json(tracks);
  } catch (error) {
    console.error("List strand tracks error:", error);
    res.status(500).json({ error: "Failed to fetch strand tracks." });
  }
}

/**
 * GET /api/strand-tracks/:id — Get track by ID
 */
export async function getStrandTrackById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const tracks = await query<StrandTrackRow[]>(
      "SELECT * FROM strand_tracks WHERE id = ?",
      [id]
    );

    if (tracks.length === 0) {
      res.status(404).json({ error: "Strand track not found." });
      return;
    }

    res.json(tracks[0]);
  } catch (error) {
    console.error("Get strand track error:", error);
    res.status(500).json({ error: "Failed to fetch strand track." });
  }
}

/**
 * POST /api/strand-tracks — Create new strand track
 */
export async function createStrandTrack(req: Request, res: Response): Promise<void> {
  try {
    const { code, name, track_type, grade_level, description, sort_order } = req.body;

    if (!code || !name || !track_type) {
      res.status(400).json({ error: "Missing required fields: code, name, track_type." });
      return;
    }

    if (!["tle", "shs_strand"].includes(track_type)) {
      res.status(400).json({ error: "Invalid track_type. Must be 'tle' or 'shs_strand'." });
      return;
    }

    // Check unique code
    const existing = await query<RowDataPacket[]>(
      "SELECT id FROM strand_tracks WHERE code = ?",
      [code]
    );
    if (existing.length > 0) {
      res.status(409).json({ error: `Strand track code "${code}" already exists.` });
      return;
    }

    const result = await query<ResultSetHeader>(
      `INSERT INTO strand_tracks (code, name, track_type, grade_level, description, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [code, name, track_type, grade_level || 0, description || null, sort_order || 0]
    );

    await logActivity(req.user!.userId, `Created strand track "${name}" (${code})`, "settings", result.insertId);

    const newTrack = await query<StrandTrackRow[]>(
      "SELECT * FROM strand_tracks WHERE id = ?",
      [result.insertId]
    );
    res.status(201).json(newTrack[0]);
  } catch (error) {
    console.error("Create strand track error:", error);
    res.status(500).json({ error: "Failed to create strand track." });
  }
}

/**
 * PUT /api/strand-tracks/:id — Update strand track
 */
export async function updateStrandTrack(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { code, name, track_type, grade_level, description, sort_order, is_active } = req.body;

    const existing = await query<RowDataPacket[]>(
      "SELECT id FROM strand_tracks WHERE id = ?",
      [id]
    );
    if (existing.length === 0) {
      res.status(404).json({ error: "Strand track not found." });
      return;
    }

    const fields: string[] = [];
    const params: any[] = [];

    if (code !== undefined) { fields.push("code = ?"); params.push(code); }
    if (name !== undefined) { fields.push("name = ?"); params.push(name); }
    if (track_type !== undefined) {
      if (!["tle", "shs_strand"].includes(track_type)) {
        res.status(400).json({ error: "Invalid track_type." });
        return;
      }
      fields.push("track_type = ?");
      params.push(track_type);
    }
    if (grade_level !== undefined) { fields.push("grade_level = ?"); params.push(grade_level); }
    if (description !== undefined) { fields.push("description = ?"); params.push(description); }
    if (sort_order !== undefined) { fields.push("sort_order = ?"); params.push(sort_order); }
    if (is_active !== undefined) { fields.push("is_active = ?"); params.push(is_active); }

    if (fields.length === 0) {
      res.status(400).json({ error: "No fields to update." });
      return;
    }

    params.push(id);
    await query<ResultSetHeader>(
      `UPDATE strand_tracks SET ${fields.join(", ")} WHERE id = ?`,
      params
    );

    await logActivity(req.user!.userId, `Updated strand track ID ${id}`, "settings", id);

    const updated = await query<StrandTrackRow[]>(
      "SELECT * FROM strand_tracks WHERE id = ?",
      [id]
    );
    res.json(updated[0]);
  } catch (error) {
    console.error("Update strand track error:", error);
    res.status(500).json({ error: "Failed to update strand track." });
  }
}

/**
 * DELETE /api/strand-tracks/:id — Soft-delete (set inactive)
 */
export async function deleteStrandTrack(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await query<RowDataPacket[]>(
      "SELECT id, code, name FROM strand_tracks WHERE id = ?",
      [id]
    );
    if (existing.length === 0) {
      res.status(404).json({ error: "Strand track not found." });
      return;
    }

    // Check if track is in use by enrollments
    const inUse = await query<RowDataPacket[]>(
      "SELECT COUNT(*) AS cnt FROM enrollments WHERE strand_track_id = ?",
      [id]
    );
    if ((inUse[0] as any).cnt > 0) {
      res.status(400).json({
        error: `Cannot delete: ${(inUse[0] as any).cnt} enrollment(s) are using this strand track. Set it inactive instead.`
      });
      return;
    }

    await query<ResultSetHeader>(
      "UPDATE strand_tracks SET is_active = 0 WHERE id = ?",
      [id]
    );

    await logActivity(req.user!.userId, `Deactivated strand track "${existing[0].name}" (${existing[0].code})`, "settings", id);
    res.json({ message: "Strand track deactivated successfully." });
  } catch (error) {
    console.error("Delete strand track error:", error);
    res.status(500).json({ error: "Failed to deactivate strand track." });
  }
}

/* ─────────────── Subject ↔ Track linking ─────────────── */

/**
 * GET /api/strand-tracks/:id/subjects — Get subjects linked to a track
 */
export async function getTrackSubjects(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const subjects = await query<RowDataPacket[]>(
      `SELECT s.* FROM subjects s
       JOIN subject_strand_tracks sst ON sst.subject_id = s.id
       WHERE sst.strand_track_id = ?
       ORDER BY s.grade_level ASC, s.name ASC`,
      [id]
    );

    res.json(subjects);
  } catch (error) {
    console.error("Get track subjects error:", error);
    res.status(500).json({ error: "Failed to fetch track subjects." });
  }
}

/**
 * PUT /api/strand-tracks/:id/subjects — Replace subject links for a track
 * Body: { subject_ids: number[] }
 */
export async function setTrackSubjects(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { subject_ids } = req.body;

    if (!Array.isArray(subject_ids)) {
      res.status(400).json({ error: "subject_ids array is required." });
      return;
    }

    // Verify track exists
    const track = await query<RowDataPacket[]>(
      "SELECT id FROM strand_tracks WHERE id = ?",
      [id]
    );
    if (track.length === 0) {
      res.status(404).json({ error: "Strand track not found." });
      return;
    }

    // Replace all links
    await query<ResultSetHeader>(
      "DELETE FROM subject_strand_tracks WHERE strand_track_id = ?",
      [id]
    );

    if (subject_ids.length > 0) {
      const values = subject_ids.map(sid => `(${id}, ${sid})`).join(",");
      await query<ResultSetHeader>(
        `INSERT INTO subject_strand_tracks (strand_track_id, subject_id) VALUES ${values}`
      );
    }

    await logActivity(req.user!.userId, `Updated subject links for strand track ID ${id}`, "settings", id);

    res.json({ message: `Linked ${subject_ids.length} subject(s) to strand track.` });
  } catch (error) {
    console.error("Set track subjects error:", error);
    res.status(500).json({ error: "Failed to link subjects." });
  }
}
