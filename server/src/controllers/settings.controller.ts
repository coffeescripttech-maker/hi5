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
    const { school_name, school_id, region, division, district, current_sy_id, principal_name, registrar_name, grade_deadline_enabled, grade_edit_deadline, passing_grade, monitor_threshold } = req.body;
    const {
      terms_of_service_text,
      privacy_policy_text,
      conditions_text,
    } = req.body;

    const existing = await query<RowDataPacket[]>("SELECT id FROM school_settings WHERE id = 1");
    if (existing.length === 0) {
      // Create settings row if it doesn't exist
      await query<ResultSetHeader>(
        `INSERT INTO school_settings (school_name, school_id, region, division, district, principal_name, registrar_name, current_sy_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [school_name || "Don Servillano Platon Memorial National High School", school_id || "", region || "", division || "", district || null, principal_name || "", registrar_name || "", current_sy_id || null]
      );
    } else {
      const fields: string[] = [];
      const params: any[] = [];

      if (school_name !== undefined) { fields.push("school_name = ?"); params.push(school_name); }
      if (school_id !== undefined) { fields.push("school_id = ?"); params.push(school_id); }
      if (region !== undefined) { fields.push("region = ?"); params.push(region); }
      if (division !== undefined) { fields.push("division = ?"); params.push(division); }
      if (district !== undefined) { fields.push("district = ?"); params.push(district); }
      if (principal_name !== undefined) { fields.push("principal_name = ?"); params.push(principal_name); }
      if (registrar_name !== undefined) { fields.push("registrar_name = ?"); params.push(registrar_name); }
      if (current_sy_id !== undefined) { fields.push("current_sy_id = ?"); params.push(current_sy_id); }
      if (grade_deadline_enabled !== undefined) { fields.push("grade_deadline_enabled = ?"); params.push(grade_deadline_enabled ? 1 : 0); }
      if (grade_edit_deadline !== undefined) { fields.push("grade_edit_deadline = ?"); params.push(grade_edit_deadline ? new Date(grade_edit_deadline) : null); }

      if (terms_of_service_text !== undefined) {
        fields.push("terms_of_service_text = ?");
        params.push(terms_of_service_text ? terms_of_service_text : null);
      }
      if (privacy_policy_text !== undefined) {
        fields.push("privacy_policy_text = ?");
        params.push(privacy_policy_text ? privacy_policy_text : null);
      }
      if (conditions_text !== undefined) {
        fields.push("conditions_text = ?");
        params.push(conditions_text ? conditions_text : null);
      }

      // Configurable academic thresholds (migration 035).
      if (passing_grade !== undefined) {
        const passing = parseFloat(passing_grade);
        if (!Number.isFinite(passing) || passing < 0 || passing > 100) {
          res.status(400).json({ error: "Passing grade must be between 0 and 100." });
          return;
        }
        fields.push("passing_grade = ?");
        params.push(passing);
      }
      if (monitor_threshold !== undefined) {
        const monitor = parseFloat(monitor_threshold);
        if (!Number.isFinite(monitor) || monitor < 0 || monitor > 100) {
          res.status(400).json({ error: "Monitoring threshold must be between 0 and 100." });
          return;
        }
        fields.push("monitor_threshold = ?");
        params.push(monitor);
      }

      // The monitoring band sits above the passing mark — keep them sane together.
      if (passing_grade !== undefined || monitor_threshold !== undefined) {
        const current = await query<RowDataPacket[]>(
          `SELECT passing_grade, monitor_threshold FROM school_settings WHERE id = 1`
        );
        const passing = passing_grade !== undefined ? parseFloat(passing_grade) : parseFloat(current[0]?.passing_grade ?? "75");
        const monitor = monitor_threshold !== undefined ? parseFloat(monitor_threshold) : parseFloat(current[0]?.monitor_threshold ?? "80");
        if (monitor < passing) {
          res.status(400).json({ error: "Monitoring threshold must be equal to or higher than the passing mark." });
          return;
        }
      }

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
 * GET /api/settings/thresholds — Program eligibility minimums for the
 * Auto-Sectioning Grade Thresholds screen.
 *
 * Returns one entry per section TYPE (all grade rows share the same minimums):
 * STE, SPFL, SPJ and Regular carry the configurable minimums; Non-Reader
 * carries none (all null — teacher-tagged only); ALS and Open High School are
 * enrollment programs, never auto-sectioned, and are not listed.
 */
export async function getThresholds(_req: Request, res: Response): Promise<void> {
  try {
    const rows = await query<RowDataPacket[]>(
      `SELECT c.section_type, s.label, s.icon, s.color_code, s.sort_order,
              MIN(c.min_general_average) AS min_general_average,
              MIN(c.min_science) AS min_science,
              MIN(c.min_math) AS min_math,
              MIN(c.min_english) AS min_english,
              MIN(c.min_filipino) AS min_filipino,
              COUNT(DISTINCT c.grade_level) AS grade_row_count
       FROM section_type_config c
       JOIN section_types s ON c.section_type = s.name
       WHERE c.section_type IN ('ste', 'spfl', 'spj', 'regular', 'non_reader')
       GROUP BY c.section_type, s.label, s.icon, s.color_code, s.sort_order
       ORDER BY s.sort_order`
    );
    res.json(rows);
  } catch (error) {
    console.error("Get thresholds error:", error);
    res.status(500).json({ error: "Failed to fetch section thresholds." });
  }
}

/**
 * PUT /api/settings/thresholds — Save program eligibility minimums.
 * Body: { types: [{ section_type, min_general_average, min_science,
 *                   min_math, min_english, min_filipino }] }
 *
 * Finalized rules:
 *  - Every editable value must be a number from 0 to 100 — blank, non-numeric
 *    or out-of-range values are rejected with a clear message.
 *  - Non-Reader: saving ANY minimum is rejected — its fields are stored empty
 *    (NULL), never 0 or 100, because placement there is a teacher's tag only.
 *  - STE: General Average + Science + Mathematics minimums.
 *  - SPFL: English + Filipino minimums only (no General Average rule) — a
 *    General Average value for SPFL is rejected.
 *  - SPJ: General Average + English + Filipino minimums.
 *  - Regular: General Average minimum (passing grade); below-minimum students
 *    are retained, never blocked from a Regular section.
 *  - After saving, sections of the affected type are raised to their type's
 *    floor so a section can never admit a student the type's rule rejects.
 *  - Ordinary values are written to every grade row of the type; changes apply
 *    to the next sectioning run and every change is written to the Activity Log.
 */
export async function updateThresholds(req: Request, res: Response): Promise<void> {
  try {
    const { types } = req.body;

    if (!Array.isArray(types) || types.length === 0) {
      res.status(400).json({ error: "No threshold values were submitted. Enter the minimums and save again." });
      return;
    }

    // Applicable fields per type (from the finalized criteria table).
    const REQUIRED: Record<string, string[]> = {
      ste: ["min_general_average", "min_science", "min_math"],
      spfl: ["min_english", "min_filipino"],
      spj: ["min_general_average", "min_english", "min_filipino"],
      regular: ["min_general_average"],
    };
    const FIELDS = ["min_general_average", "min_science", "min_math", "min_english", "min_filipino"];
    const FIELD_LABELS: Record<string, string> = {
      min_general_average: "General Average minimum",
      min_science: "Science minimum",
      min_math: "Mathematics minimum",
      min_english: "English minimum",
      min_filipino: "Filipino minimum",
    };
    const typeLabels: Record<string, string> = { ste: "STE", spfl: "SPFL", spj: "SPJ", regular: "Regular", non_reader: "Non-Reader" };

    for (const t of types) {
      const type = String(t?.section_type ?? "").toLowerCase();

      if (type === "non_reader") {
        const anyValue = FIELDS.some((f) => t[f] !== undefined && t[f] !== null && t[f] !== "");
        if (anyValue) {
          res.status(400).json({
            error: "Non-Reader sections have no minimum and no maximum — they are placed by a teacher's tag only. Leave all Non-Reader fields empty.",
          });
          return;
        }
        continue;
      }

      const required = REQUIRED[type];
      if (!required) {
        res.status(400).json({ error: `"${type}" cannot be configured here. Only STE, SPFL, SPJ, Regular and Non-Reader appear on this screen; ALS and Open High School students are placed manually.` });
        return;
      }

      // Validate: required fields must be a number 0–100 (blank is blocked).
      for (const f of required) {
        const raw = t[f];
        if (raw === undefined || raw === null || raw === "") {
          res.status(400).json({
            error: `${FIELD_LABELS[f]} for ${typeLabels[type]} cannot be blank. Enter a value between 0 and 100.`,
          });
          return;
        }
        const n = Number(raw);
        if (!Number.isFinite(n)) {
          res.status(400).json({
            error: `${FIELD_LABELS[f]} for ${typeLabels[type]} must be a number. "${raw}" is not valid — try ${REQUIRED[type]!.indexOf(f) >= 0 ? "85" : "75"}.`,
          });
          return;
        }
        if (n < 0 || n > 100) {
          res.status(400).json({
            error: `${FIELD_LABELS[f]} for ${typeLabels[type]} must be between 0 and 100 (it is ${n}).`,
          });
          return;
        }
      }

      // Not-applicable subject fields for this type must stay empty.
      const notApplicable = FIELDS.filter((f) => !required.includes(f));
      for (const f of notApplicable) {
        const raw = t[f];
        if (raw !== undefined && raw !== null && raw !== "") {
          res.status(400).json({
            error: `${FIELD_LABELS[f]} does not apply to ${typeLabels[type]} under the school's criteria. Leave it empty.`,
          });
          return;
        }
      }
    }

    let sectionsRaised = 0;
    for (const t of types) {
      const type = String(t.section_type).toLowerCase();
      if (type === "non_reader") continue; // stays empty — no grade rule

      const fields: string[] = [];
      const params: any[] = [];
      for (const f of FIELDS) {
        if (REQUIRED[type].includes(f)) {
          fields.push(`${f} = ?`);
          params.push(Number(t[f]));
        } else {
          fields.push(`${f} = NULL`);
        }
      }
      params.push(type);
      await query<ResultSetHeader>(
        `UPDATE section_type_config SET ${fields.join(", ")} WHERE section_type = ?`,
        params
      );

      // Keep per-section minimums coherent: a section's minimum may exceed its
      // type's floor (adjustable per section) but never fall below it.
      const gaFloor = REQUIRED[type].includes("min_general_average") ? Number(t.min_general_average) : null;
      let floor = gaFloor;
      if (floor === null && type === "spfl") {
        // SPFL sections use the subject floor as their minimum average (85).
        floor = Math.max(Number(t.min_english ?? 0), Number(t.min_filipino ?? 0));
      }
      if (floor !== null) {
        const result = await query<ResultSetHeader>(
          `UPDATE sections SET min_average = GREATEST(min_average, ?)
           WHERE section_type = ? AND min_average < ?`,
          [floor, type, floor]
        );
        sectionsRaised += result.affectedRows || 0;
      }
    }

    const changed = types
      .map((t) => typeLabels[String(t.section_type).toLowerCase()])
      .filter(Boolean)
      .join(", ");
    await logActivity(
      req.user!.userId,
      `Updated sectioning eligibility minimums (${changed})${sectionsRaised > 0 ? ` — ${sectionsRaised} section minimum(s) raised to match` : ""}`,
      "settings",
      0
    );

    // Return the refreshed per-type view the screen renders.
    const rows = await query<RowDataPacket[]>(
      `SELECT c.section_type, s.label, s.icon, s.color_code, s.sort_order,
              MIN(c.min_general_average) AS min_general_average,
              MIN(c.min_science) AS min_science,
              MIN(c.min_math) AS min_math,
              MIN(c.min_english) AS min_english,
              MIN(c.min_filipino) AS min_filipino,
              COUNT(DISTINCT c.grade_level) AS grade_row_count
       FROM section_type_config c
       JOIN section_types s ON c.section_type = s.name
       WHERE c.section_type IN ('ste', 'spfl', 'spj', 'regular', 'non_reader')
       GROUP BY c.section_type, s.label, s.icon, s.color_code, s.sort_order
       ORDER BY s.sort_order`
    );
    res.json({ thresholds: rows, sections_raised: sectionsRaised });
  } catch (error) {
    console.error("Update thresholds error:", error);
    res.status(500).json({ error: "Failed to update section thresholds." });
  }
}

/* ─────────────── Backup Settings ─────────────── */

/**
 * GET /api/settings/backup — Get backup schedule configuration
 */
export async function getBackupSettings(_req: Request, res: Response): Promise<void> {
  try {
    const settings = await query<RowDataPacket[]>(
      `SELECT backup_frequency, backup_time, backup_retention, backup_enabled
       FROM school_settings WHERE id = 1`
    );

    if (settings.length === 0) {
      res.status(404).json({ error: "School settings not found." });
      return;
    }

    res.json(settings[0]);
  } catch (error) {
    console.error("Get backup settings error:", error);
    res.status(500).json({ error: "Failed to fetch backup settings." });
  }
}

/**
 * PUT /api/settings/backup — Update backup schedule configuration
 */
export async function updateBackupSettings(req: Request, res: Response): Promise<void> {
  try {
    const { backup_frequency, backup_time, backup_retention, backup_enabled } = req.body;

    const fields: string[] = [];
    const params: any[] = [];

    if (backup_frequency !== undefined) {
      if (!["daily", "every_12h", "weekly"].includes(backup_frequency)) {
        res.status(400).json({ error: "Invalid backup_frequency. Must be daily, every_12h, or weekly." });
        return;
      }
      fields.push("backup_frequency = ?");
      params.push(backup_frequency);
    }
    if (backup_time !== undefined) {
      fields.push("backup_time = ?");
      params.push(backup_time);
    }
    if (backup_retention !== undefined) {
      if (!["last_7", "last_30", "all"].includes(backup_retention)) {
        res.status(400).json({ error: "Invalid backup_retention. Must be last_7, last_30, or all." });
        return;
      }
      fields.push("backup_retention = ?");
      params.push(backup_retention);
    }
    if (backup_enabled !== undefined) {
      fields.push("backup_enabled = ?");
      params.push(backup_enabled ? 1 : 0);
    }

    if (fields.length === 0) {
      res.status(400).json({ error: "No fields to update." });
      return;
    }

    await query<ResultSetHeader>(`UPDATE school_settings SET ${fields.join(", ")} WHERE id = 1`, params);
    await logActivity(req.user!.userId, "Updated backup schedule settings", "settings", 1);

    const updated = await query<RowDataPacket[]>(
      `SELECT backup_frequency, backup_time, backup_retention, backup_enabled
       FROM school_settings WHERE id = 1`
    );

    res.json(updated[0]);
  } catch (error) {
    console.error("Update backup settings error:", error);
    res.status(500).json({ error: "Failed to update backup settings." });
  }
}

/* ─────────────── Activity Log Retention Settings ─────────────── */

/**
 * GET /api/settings/log-retention — Get activity log cleanup configuration
 */
export async function getLogRetentionSettings(_req: Request, res: Response): Promise<void> {
  try {
    const settings = await query<RowDataPacket[]>(
      `SELECT last_activity_log_cleanup, activity_log_cleanup_enabled, activity_log_retention_days
       FROM school_settings WHERE id = 1`
    );

    if (settings.length === 0) {
      res.status(404).json({ error: "School settings not found." });
      return;
    }

    res.json(settings[0]);
  } catch (error) {
    console.error("Get log retention settings error:", error);
    res.status(500).json({ error: "Failed to fetch log retention settings." });
  }
}

/**
 * PUT /api/settings/log-retention — Update activity log cleanup configuration
 */
export async function updateLogRetentionSettings(req: Request, res: Response): Promise<void> {
  try {
    const { activity_log_cleanup_enabled, activity_log_retention_days } = req.body;

    const fields: string[] = [];
    const params: any[] = [];

    if (activity_log_cleanup_enabled !== undefined) {
      fields.push("activity_log_cleanup_enabled = ?");
      params.push(activity_log_cleanup_enabled ? 1 : 0);
    }
    if (activity_log_retention_days !== undefined) {
      const days = parseInt(activity_log_retention_days as string, 10);
      if (!Number.isFinite(days) || days < 7 || days > 3650) {
        res.status(400).json({ error: "Retention days must be between 7 and 3650." });
        return;
      }
      fields.push("activity_log_retention_days = ?");
      params.push(days);
    }

    if (fields.length === 0) {
      res.status(400).json({ error: "No fields to update." });
      return;
    }

    await query<ResultSetHeader>(`UPDATE school_settings SET ${fields.join(", ")} WHERE id = 1`, params);
    await logActivity(req.user!.userId, "Updated activity log retention settings", "settings", 1);

    const updated = await query<RowDataPacket[]>(
      `SELECT last_activity_log_cleanup, activity_log_cleanup_enabled, activity_log_retention_days
       FROM school_settings WHERE id = 1`
    );

    res.json(updated[0]);
  } catch (error) {
    console.error("Update log retention settings error:", error);
    res.status(500).json({ error: "Failed to update log retention settings." });
  }
}
