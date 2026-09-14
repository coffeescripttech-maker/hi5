import { Router } from "express";
import { RowDataPacket } from "mysql2";
import { query } from "../config/database";

/**
 * Public, unauthenticated endpoints — safe for the login screen and
 * anything rendered before a session exists. Keep the surface minimal.
 */
const router = Router();

/**
 * GET /api/school-info
 * Lightweight school + current school-year info used by the login screen
 * (live "School Year 2026–2027 · Active" badge). No auth required.
 */
router.get("/school-info", async (_req, res) => {
  try {
    const settingsRows = await query<RowDataPacket[]>(
      "SELECT school_name FROM school_settings WHERE id = 1 LIMIT 1"
    );
    const settings = settingsRows[0] as { school_name: string } | undefined;
    const schoolName = settings?.school_name ?? "";

    const syRows = await query<RowDataPacket[]>(
      "SELECT sy_label, enrollment_open FROM school_years WHERE is_current = 1 LIMIT 1"
    );
    const sy = syRows[0] as { sy_label: string; enrollment_open: number } | undefined;

    res.json({
      school_name: schoolName,
      current_sy_label: sy?.sy_label ?? "",
      enrollment_open: sy ? (sy.enrollment_open === 1 || sy.enrollment_open === true) : false,
    });
  } catch (err) {
    // Never leak errors to the unauthenticated login page; degrade gracefully.
    console.error("[school-info] failed:", err);
    res.status(500).json({ error: "Could not load school info." });
  }
});

export default router;