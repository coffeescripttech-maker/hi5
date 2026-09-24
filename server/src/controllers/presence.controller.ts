import { Request, Response } from "express";
import { query } from "../config/database";
import { ResultSetHeader } from "mysql2";

/**
 * POST /api/presence/heartbeat
 * Authenticated client ping that stamps last_seen_at so the admin
 * User Management page can show live online / idle / offline status.
 * The client throttles itself (once ~45s) and fires on user activity,
 * so the DB load is negligible even with many simultaneous users.
 */
export async function heartbeat(req: Request, res: Response): Promise<void> {
  try {
    await query<ResultSetHeader>(
      "UPDATE users SET last_seen_at = NOW() WHERE id = ?",
      [req.user!.userId]
    );
    res.json({ ok: true });
  } catch (error) {
    console.error("Heartbeat error:", error);
    res.status(500).json({ error: "Failed to update presence." });
  }
}