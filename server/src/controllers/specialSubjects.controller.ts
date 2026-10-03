import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";

/**
 * SF9 special subject rows.
 *
 * A "special subject" is an ordinary `subjects` row with subject_type
 * 'specialized' and no reporting group. Because the SF9 endpoint is
 * data-driven (`WHERE s.is_active = 1 AND s.grade_level = ?`) and the general
 * average is computed server-side from rows that carry a final_average, a
 * subject created here appears on the report card, in SF10, in LIS exports and
 * in the general average with no special-casing anywhere.
 *
 * These endpoints exist only to give the Registrar a safe way to manage them:
 * subject_type and subject_group are pinned by the server rather than taken
 * from the request, so a mis-tap cannot collapse a special subject into a
 * TLE/TVL group or quietly make it part of the standard template.
 */

interface SpecialSubjectRow extends RowDataPacket {
  id: number;
  name: string;
  grade_level: number;
  hours_per_week: number;
  subject_type: "core" | "applied" | "specialized";
  subject_group: string | null;
  is_active: number;
}

const GRADES = [7, 8, 9, 10, 11, 12];

/**
 * GET /api/subjects/special — List special subjects
 * Query: ?grade_level=7&include_inactive=1
 */
export async function listSpecialSubjects(req: Request, res: Response): Promise<void> {
  try {
    const { grade_level, include_inactive } = req.query;

    const params: any[] = [];
    let sql = "SELECT * FROM subjects WHERE subject_type = 'specialized'";

    if (grade_level) {
      const grade = Number(grade_level);
      if (!Number.isInteger(grade) || !GRADES.includes(grade)) {
        res.status(400).json({ error: "grade_level must be an integer from 7 to 12." });
        return;
      }
      sql += " AND grade_level = ?";
      params.push(grade);
    }

    // Inactive subjects are hidden by default: the SF9 query filters on
    // is_active = 1, so a deactivated subject silently disappears from report
    // cards. Surfacing them (opt-in) is what lets the registrar see why.
    if (include_inactive !== "1") {
      sql += " AND is_active = 1";
    }

    sql += " ORDER BY grade_level ASC, name ASC";

    const subjects = await query<SpecialSubjectRow[]>(sql, params);
    res.json(subjects);
  } catch (error) {
    console.error("List special subjects error:", error);
    res.status(500).json({ error: "Failed to fetch special subjects." });
  }
}

/**
 * POST /api/subjects/special — Create a special subject
 * Body: { name, grade_level, hours_per_week }
 *
 * subject_type is forced to 'specialized' and subject_group is forced to NULL
 * so the subject reports as its own row rather than being folded into a
 * TLE/EPP or TVL group.
 */
export async function createSpecialSubject(req: Request, res: Response): Promise<void> {
  try {
    const { name, grade_level, hours_per_week } = req.body;

    const problems: string[] = [];

    const nameText = name != null ? String(name).trim() : "";
    if (!nameText) {
      problems.push("name is required");
    } else if (nameText.length < 2 || nameText.length > 100) {
      problems.push("name must be between 2 and 100 characters");
    }

    const grade = Number(grade_level);
    if (!Number.isInteger(grade) || !GRADES.includes(grade)) {
      problems.push("grade_level must be an integer from 7 to 12");
    }

    const hours = Number(hours_per_week);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 40) {
      problems.push("hours_per_week must be a number greater than 0 and at most 40");
    }

    if (problems.length > 0) {
      res.status(400).json({
        error: "The special subject has invalid fields.",
        problems,
      });
      return;
    }

    // The unique key is (name, grade_level), so a collision only matters for the
    // grade being created — the same name is legitimately reusable per grade.
    const existing = await query<RowDataPacket[]>(
      "SELECT id, subject_type FROM subjects WHERE name = ? AND grade_level = ?",
      [nameText, grade]
    );
    if (existing.length > 0) {
      res.status(409).json({
        error: `"${nameText}" already exists for Grade ${grade}. Pick a different name.`,
        existing: { id: existing[0].id, subject_type: existing[0].subject_type },
      });
      return;
    }

    const result = await query<ResultSetHeader>(
      `INSERT INTO subjects (name, grade_level, hours_per_week, subject_type, subject_group, is_active)
       VALUES (?, ?, ?, 'specialized', NULL, 1)`,
      [nameText, grade, hours]
    );

    await logActivity(
      req.user!.userId,
      `Created special subject "${nameText}" (Grade ${grade})`,
      "subjects",
      result.insertId
    );

    const created = await query<SpecialSubjectRow[]>(
      "SELECT * FROM subjects WHERE id = ?",
      [result.insertId]
    );
    res.status(201).json(created[0]);
  } catch (error) {
    console.error("Create special subject error:", error);
    res.status(500).json({ error: "Failed to create special subject." });
  }
}

/**
 * PUT /api/subjects/special/:id — Rename / re-hour / activate a special subject
 *
 * Deactivation is preferred over deletion: `grades.subject_id` is a foreign key,
 * so deleting a subject that has grades recorded would fail or orphan history.
 * An inactive subject drops out of the SF9 query, which is the intended way to
 * retire one from a template without losing its grades.
 */
export async function updateSpecialSubject(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { name, hours_per_week, is_active } = req.body;

    const existing = await query<SpecialSubjectRow[]>(
      "SELECT * FROM subjects WHERE id = ?",
      [id]
    );
    if (existing.length === 0) {
      res.status(404).json({ error: "Subject not found." });
      return;
    }

    const current = existing[0];
    if (current.subject_type !== "specialized") {
      res.status(400).json({
        error: "That subject is part of the standard template and is not managed here.",
      });
      return;
    }

    const problems: string[] = [];
    let nameText = current.name;

    if (name !== undefined) {
      nameText = String(name).trim();
      if (nameText.length < 2 || nameText.length > 100) {
        problems.push("name must be between 2 and 100 characters");
      }
    }

    let hours = Number(current.hours_per_week);
    if (hours_per_week !== undefined) {
      hours = Number(hours_per_week);
      if (!Number.isFinite(hours) || hours <= 0 || hours > 40) {
        problems.push("hours_per_week must be a number greater than 0 and at most 40");
      }
    }

    let active = current.is_active;
    if (is_active !== undefined) {
      if (is_active !== 0 && is_active !== 1) {
        problems.push("is_active must be 0 or 1");
      } else {
        active = is_active;
      }
    }

    if (problems.length > 0) {
      res.status(400).json({
        error: "The special subject has invalid fields.",
        problems,
      });
      return;
    }

    if (nameText !== current.name) {
      const clash = await query<RowDataPacket[]>(
        "SELECT id FROM subjects WHERE name = ? AND grade_level = ? AND id <> ?",
        [nameText, current.grade_level, id]
      );
      if (clash.length > 0) {
        res.status(409).json({
          error: `"${nameText}" already exists for Grade ${current.grade_level}. Pick a different name.`,
        });
        return;
      }
    }

    await query<ResultSetHeader>(
      `UPDATE subjects SET name = ?, hours_per_week = ?, is_active = ? WHERE id = ?`,
      [nameText, hours, active, id]
    );

    const verb =
      active !== current.is_active
        ? active === 0
          ? "Deactivated"
          : "Reactivated"
        : "Updated";
    await logActivity(
      req.user!.userId,
      `${verb} special subject "${nameText}" (Grade ${current.grade_level})`,
      "subjects",
      Number(id)
    );

    const updated = await query<SpecialSubjectRow[]>(
      "SELECT * FROM subjects WHERE id = ?",
      [id]
    );
    res.json(updated[0]);
  } catch (error) {
    console.error("Update special subject error:", error);
    res.status(500).json({ error: "Failed to update special subject." });
  }
}

/**
 * DELETE /api/subjects/special/:id — Hard delete, refused when grades exist
 *
 * A subject with recorded grades is deactivated instead, because report cards
 * for past school years must keep rendering and `grades.subject_id` is a
 * foreign key. This is the one place that returns a body explaining the
 * difference rather than silently doing something else.
 */
export async function deleteSpecialSubject(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;

    const existing = await query<SpecialSubjectRow[]>(
      "SELECT * FROM subjects WHERE id = ?",
      [id]
    );
    if (existing.length === 0) {
      res.status(404).json({ error: "Subject not found." });
      return;
    }

    const current = existing[0];
    if (current.subject_type !== "specialized") {
      res.status(400).json({
        error: "That subject is part of the standard template and is not managed here.",
      });
      return;
    }

    const graded = await query<RowDataPacket[]>(
      "SELECT COUNT(*) AS c FROM grades WHERE subject_id = ?",
      [id]
    );
    const gradeCount = Number(graded[0].c);

    if (gradeCount > 0) {
      // Deactivate rather than delete, and say so in the response so the UI can
      // explain it instead of the registrar thinking the delete failed.
      await query<ResultSetHeader>(
        "UPDATE subjects SET is_active = 0 WHERE id = ?",
        [id]
      );
      await logActivity(
        req.user!.userId,
        `Deactivated special subject "${current.name}" (Grade ${current.grade_level}) — ${gradeCount} grade record(s) retained`,
        "subjects",
        Number(id)
      );
      res.json({
        deleted: false,
        deactivated: true,
        grade_records: gradeCount,
        message:
          `"${current.name}" has ${gradeCount} grade record(s), so it was deactivated instead of deleted. ` +
          `It no longer appears on report cards, and past grades are preserved.`,
      });
      return;
    }

    await query<ResultSetHeader>("DELETE FROM subjects WHERE id = ?", [id]);
    await logActivity(
      req.user!.userId,
      `Deleted special subject "${current.name}" (Grade ${current.grade_level})`,
      "subjects",
      Number(id)
    );
    res.json({ deleted: true, deactivated: false, grade_records: 0 });
  } catch (error) {
    console.error("Delete special subject error:", error);
    res.status(500).json({ error: "Failed to delete special subject." });
  }
}
