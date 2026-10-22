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
  /** Curriculum program this subject is scoped to — NULL = shared by all. */
  program: string | null;
  is_active: number;
  /** Attached below from `subject_strand_tracks` (not a column). */
  strand_track_ids?: number[];
  strand_tracks?: { id: number; name: string; code: string }[];
}

const GRADES = [7, 8, 9, 10, 11, 12];

/**
 * Program values a special subject may be scoped to. Mirrors
 * `enrollments.program`, so a subject scoped here surfaces on the SF9 only for
 * learners enrolled in that program.
 */
const PROGRAM_SCOPES = ["regular", "ste", "spfl", "spj", "open_high", "als_shs", "als_jhs"];

/**
 * Validate a `strand_track_ids` payload and confirm every id exists.
 * Returns the clean id list plus an optional human-readable error.
 */
async function validateStrandTracks(
  value: unknown
): Promise<{ ids: number[]; error?: string }> {
  if (!Array.isArray(value)) {
    return { ids: [], error: "strand_track_ids must be an array of track ids" };
  }
  const ids = value.map(Number).filter(n => Number.isInteger(n) && n > 0);
  if (ids.length !== value.length) {
    return { ids: [], error: "strand_track_ids contains an invalid track id" };
  }
  if (ids.length > 0) {
    const found = await query<RowDataPacket[]>(
      `SELECT id FROM strand_tracks WHERE id IN (${ids.map(() => "?").join(",")})`,
      ids
    );
    if (found.length !== new Set(ids).size) {
      return { ids: [], error: "One or more strand tracks were not found" };
    }
  }
  return { ids: [...new Set(ids)] };
}

/** Replace the subject's strand-track links with exactly `ids`. */
async function replaceStrandTracks(subjectId: number | string, ids: number[]): Promise<void> {
  await query<ResultSetHeader>("DELETE FROM subject_strand_tracks WHERE subject_id = ?", [subjectId]);
  if (ids.length > 0) {
    const values = ids.map(t => `(${t}, ${Number(subjectId)})`).join(",");
    await query<ResultSetHeader>(
      `INSERT INTO subject_strand_tracks (strand_track_id, subject_id) VALUES ${values}`
    );
  }
}

/** Attach each row's linked strand tracks (id/name/code) for the UI. */
async function attachStrandTracks<T extends SpecialSubjectRow>(rows: T[]): Promise<T[]> {
  if (rows.length === 0) return rows;
  const ids = rows.map(r => r.id);
  const links = await query<RowDataPacket[]>(
    `SELECT sst.subject_id, st.id AS track_id, st.name AS track_name, st.code AS track_code
     FROM subject_strand_tracks sst
     JOIN strand_tracks st ON st.id = sst.strand_track_id
     WHERE sst.subject_id IN (${ids.map(() => "?").join(",")})
     ORDER BY st.sort_order ASC, st.name ASC`,
    ids
  );
  const bySubject = new Map<number, { id: number; name: string; code: string }[]>();
  for (const l of links) {
    const list = bySubject.get(l.subject_id) ?? [];
    list.push({ id: l.track_id, name: l.track_name, code: l.track_code });
    bySubject.set(l.subject_id, list);
  }
  for (const r of rows) {
    const tracks = bySubject.get(r.id) ?? [];
    r.strand_tracks = tracks;
    r.strand_track_ids = tracks.map(t => t.id);
  }
  return rows;
}

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
    res.json(await attachStrandTracks(subjects));
  } catch (error) {
    console.error("List special subjects error:", error);
    res.status(500).json({ error: "Failed to fetch special subjects." });
  }
}

/**
 * POST /api/subjects/special — Create a special subject
 * Body: { name, grade_level, hours_per_week, program?, strand_track_ids? }
 *
 * subject_type is forced to 'specialized' and subject_group is forced to NULL
 * so the subject reports as its own row rather than being folded into a
 * TLE/EPP or TVL group. `program` (optional) scopes the subject to a curriculum
 * — NULL (the default) means shared by every program. `strand_track_ids`
 * (optional) further narrows it to learners carrying one of those tracks.
 */
export async function createSpecialSubject(req: Request, res: Response): Promise<void> {
  try {
    const { name, grade_level, hours_per_week, program, strand_track_ids } = req.body;

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

    // NULL = shared across all programs; any other value must be a known program.
    const programScope =
      program === undefined || program === null || program === ""
        ? null
        : String(program).trim();
    if (programScope !== null && !PROGRAM_SCOPES.includes(programScope)) {
      problems.push(`program must be one of: ${PROGRAM_SCOPES.join(", ")}`);
    }

    let strandIds: number[] = [];
    if (strand_track_ids !== undefined) {
      const strand = await validateStrandTracks(strand_track_ids);
      if (strand.error) problems.push(strand.error);
      else strandIds = strand.ids;
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
      `INSERT INTO subjects (name, grade_level, hours_per_week, subject_type, subject_group, program, is_active)
       VALUES (?, ?, ?, 'specialized', NULL, ?, 1)`,
      [nameText, grade, hours, programScope]
    );

    if (strandIds.length > 0) {
      await replaceStrandTracks(result.insertId, strandIds);
    }

    await logActivity(
      req.user!.userId,
      `Created special subject "${nameText}" (Grade ${grade})${
        programScope ? ` — ${programScope.toUpperCase()} only` : ""
      }`,
      "subjects",
      result.insertId
    );

    const created = await query<SpecialSubjectRow[]>(
      "SELECT * FROM subjects WHERE id = ?",
      [result.insertId]
    );
    res.status(201).json((await attachStrandTracks(created))[0]);
  } catch (error) {
    console.error("Create special subject error:", error);
    res.status(500).json({ error: "Failed to create special subject." });
  }
}

/**
 * PUT /api/subjects/special/:id — Rename / re-hour / re-scope / activate
 *
 * `program` and `strand_track_ids` are optional: omit them to leave the current
 * curriculum scope untouched, or send `program: null` (and/or `strand_track_ids:
 * []`) to widen the subject back to every learner.
 *
 * Deactivation is preferred over deletion: `grades.subject_id` is a foreign key,
 * so deleting a subject that has grades recorded would fail or orphan history.
 * An inactive subject drops out of the SF9 query, which is the intended way to
 * retire one from a template without losing its grades.
 */
export async function updateSpecialSubject(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { name, hours_per_week, is_active, program, strand_track_ids } = req.body;

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

    // undefined = leave the current program untouched; ""/null = shared again.
    let programScope: string | null | undefined = undefined;
    if (program !== undefined) {
      if (program === null || program === "") {
        programScope = null;
      } else {
        const p = String(program).trim();
        if (!PROGRAM_SCOPES.includes(p)) {
          problems.push(`program must be one of: ${PROGRAM_SCOPES.join(", ")}`);
        } else {
          programScope = p;
        }
      }
    }

    // undefined = leave links untouched; an array (even empty) replaces them.
    let strandIds: number[] | undefined = undefined;
    if (strand_track_ids !== undefined) {
      const strand = await validateStrandTracks(strand_track_ids);
      if (strand.error) problems.push(strand.error);
      else strandIds = strand.ids;
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

    const fields: string[] = ["name = ?", "hours_per_week = ?", "is_active = ?"];
    const values: any[] = [nameText, hours, active];
    if (programScope !== undefined) {
      fields.push("program = ?");
      values.push(programScope);
    }
    values.push(id);
    await query<ResultSetHeader>(
      `UPDATE subjects SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    if (strandIds !== undefined) {
      await replaceStrandTracks(id, strandIds);
    }

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
    res.json((await attachStrandTracks(updated))[0]);
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
