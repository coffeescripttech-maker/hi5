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
 * GET /api/settings/thresholds — Get section type thresholds for all grade levels
 */
export async function getThresholds(_req: Request, res: Response): Promise<void> {
  try {
    const rows = await query<RowDataPacket[]>(
      `SELECT stc.* FROM section_type_config stc
       JOIN section_types st ON stc.section_type = st.name
       ORDER BY stc.grade_level, st.sort_order`
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

    // Current rows (needed to know each id's grade_level + section_type and to
    // validate the whole tiling per grade, not just the submitted subset).
    const current = await query<RowDataPacket[]>(
      `SELECT stc.*, st.name AS section_type, st.label FROM section_type_config stc
       JOIN section_types st ON stc.section_type = st.name`
    );

    // Merge submitted values over the current rows.
    const merged = current.map((r) => ({ ...r }));
    const updateMap = new Map<number, { min_average?: number | null; max_average?: number | null }>();
    for (const t of thresholds) {
      if (!t.id || (t.min_average === undefined && t.max_average === undefined)) continue;
      updateMap.set(Number(t.id), {
        min_average: t.min_average !== undefined ? Number(t.min_average) : undefined,
        max_average: t.max_average !== undefined ? (t.max_average === null ? null : Number(t.max_average)) : undefined,
      });
    }
    for (const row of merged) {
      const u = updateMap.get(Number(row.id));
      if (!u) continue;
      if (u.min_average !== undefined) row.min_average = u.min_average;
      if (u.max_average !== undefined) row.max_average = u.max_average;
    }

    // Which rows the client actually changed (frontend resends every row, so
    // only ids whose value differs from the stored row count as "edited").
    const minOf = (row: any) => Number(row.min_average);
    const maxOf = (row: any) => (row.max_average === null || row.max_average === undefined ? 100 : Number(row.max_average));
    const rangeString = (row: any) => `${minOf(row)}–${maxOf(row) === 100 ? "100" : maxOf(row)}`;

    const editedIds = new Set<number>();
    for (const t of thresholds) {
      const orig = current.find((c) => Number(c.id) === Number(t.id));
      if (!orig) continue;
      const key = Number(t.id);
      if (t.min_average !== undefined && Number(orig.min_average) !== Number(t.min_average)) editedIds.add(key);
      else if (t.max_average !== undefined && maxOf(orig) !== (t.max_average === null ? 100 : Number(t.max_average))) editedIds.add(key);
    }

    // Per-row sanity checks.
    for (const row of merged) {
      const min = minOf(row);
      const max = maxOf(row);
      if (!Number.isFinite(min) || min < 0 || min > 100) {
        res.status(400).json({ error: `Threshold "${row.section_type}" (Grade ${row.grade_level}): minimum average must be between 0 and 100. Try a value like 75.` });
        return;
      }
      if (!Number.isFinite(max) || max < 0 || max > 100) {
        res.status(400).json({ error: `Threshold "${row.section_type}" (Grade ${row.grade_level}): maximum average must be between 0 and 100. Try a value like 80.` });
        return;
      }
      if (min > max) {
        res.status(400).json({ error: `Threshold "${row.section_type}" (Grade ${row.grade_level}): minimum average (${min}) cannot exceed maximum average (${max}). Set the maximum average to ${min} or higher.` });
        return;
      }
    }

    // Tiling check per grade level: sorted lowest→highest, each band must run
    // straight into the next (upper.min === lower.max + 1) — that makes the
    // effective ranges continuous with no overlap and no gap. The bottom band
    // must start at 0 and the top band must end at 100.
    // e.g. non_reader [0,74] · regular [75,79] · ... · ste [90,100]
    const byGrade = new Map<number, any[]>();
    for (const row of merged) {
      if (!byGrade.has(row.grade_level)) byGrade.set(row.grade_level, []);
      byGrade.get(row.grade_level)!.push(row);
    }

    // Suggest the corrected value for the band the user just edited. When only
    // one of the two conflicting bands was changed, point at that one.
    const adjFix = (lower: any, upper: any): string => {
      const lowerEdited = editedIds.has(Number(lower.id));
      const upperEdited = editedIds.has(Number(upper.id));
      if (upperEdited && !lowerEdited) {
        return ` Set "${upper.section_type}" to start at ${maxOf(lower) + 1}.`;
      }
      if (lowerEdited && !upperEdited) {
        return ` Set "${lower.section_type}" to end at ${minOf(upper) - 1}.`;
      }
      return ` Start "${upper.section_type}" at ${maxOf(lower) + 1} (or end "${lower.section_type}" at ${minOf(upper) - 1}).`;
    };

    for (const [grade, tiers] of byGrade) {
      tiers.sort((a, b) => minOf(a) - minOf(b));
      const bottom = tiers[0];
      const top = tiers[tiers.length - 1];
      if (minOf(bottom) !== 0) {
        res.status(400).json({
          error: `Grade ${grade}: thresholds must cover the full range from 0 to 100. The lowest threshold "${bottom.section_type}" must start at 0 — set its minimum average to 0 (it is currently ${minOf(bottom)}).`,
        });
        return;
      }
      if (maxOf(top) !== 100) {
        res.status(400).json({
          error: `Grade ${grade}: thresholds must cover the full range from 0 to 100. The highest threshold "${top.section_type}" must end at 100 — set its maximum average to 100 (it is currently ${maxOf(top)}).`,
        });
        return;
      }
      for (let i = 0; i < tiers.length - 1; i++) {
        const lower = tiers[i];
        const upper = tiers[i + 1];
        if (minOf(upper) !== maxOf(lower) + 1) {
          if (minOf(upper) < maxOf(lower) + 1) {
            res.status(400).json({
              error: `Grade ${grade}: thresholds must not overlap. "${lower.section_type}" (${rangeString(lower)}) and "${upper.section_type}" (${rangeString(upper)}) overlap.${adjFix(lower, upper)}`,
            });
          } else {
            res.status(400).json({
              error: `Grade ${grade}: thresholds must cover the full range from 0 to 100. There is a gap between "${lower.section_type}" (ends at ${maxOf(lower)}) and "${upper.section_type}" (starts at ${minOf(upper)}).${adjFix(lower, upper)}`,
            });
          }
          return;
        }
      }
    }

    for (const t of thresholds) {
      if (t.id && (t.min_average !== undefined || t.max_average !== undefined)) {
        const fields: string[] = [];
        const params: any[] = [];
        if (t.min_average !== undefined) { fields.push("min_average = ?"); params.push(Number(t.min_average)); }
        if (t.max_average !== undefined) { fields.push("max_average = ?"); params.push(t.max_average === null ? null : Number(t.max_average)); }
        params.push(t.id);
        await query<ResultSetHeader>(
          `UPDATE section_type_config SET ${fields.join(", ")} WHERE id = ?`,
          params
        );
      }
    }

    await logActivity(req.user!.userId, "Updated section type thresholds", "settings", 0);

    const updated = await query<RowDataPacket[]>(
      `SELECT stc.* FROM section_type_config stc
       JOIN section_types st ON stc.section_type = st.name
       ORDER BY stc.grade_level, st.sort_order`
    );
    res.json(updated);
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
