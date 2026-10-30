import { Request, Response } from "express";
import { query } from "../config/database";
import { RowDataPacket } from "mysql2";
import { logActivity } from "../utils/activityLogger";

/**
 * Saved School Form Edits (docs/MAJOR_CHANGES_IN_FORMS.txt).
 *
 * Every handwritten edit on SF1/SF5/SF9/SF10 is stored per
 * (form, school year, learner|null, field_key) and is re-applied the next
 * time anyone opens, regenerates, or prints that form — no re-typing.
 *
 * Rules implemented here:
 *  #4  save keyed (learner, SY, form, field, value)
 *  #7  clearing a field is a valid edit (stored as "")
 *  #8  shared fields (header/signers) saved once — student_id NULL rows
 *  #10 strict teacher scope: SF9 attendance cells only, own advisory
 *  #14 every save -> Activity Log entry (actor, field, old -> new)
 *  #16 closed school years (is_current = 0): Registrar/Admin only
 */

const FORMS = new Set(["SF1", "SF5", "SF9", "SF10"]);
/** field_key segments: 1-4 colon-separated, non-empty segments. */
const FIELD_KEY_RE = /^[^:]{1,40}(:[^:]{1,60}){0,3}$/;
const MAX_EDITS_PER_PUT = 400;

interface EditRow extends RowDataPacket {
  id: number;
  form: string;
  school_year_id: number;
  student_id: number | null;
  field_key: string;
  value: string | null;
  updated_by: number;
  updated_at: Date;
}

interface StudentRow extends RowDataPacket {
  id: number;
  name: string;
}

interface SyRow extends RowDataPacket {
  id: number;
  sy_label: string;
  is_current: number;
}

/**
 * Strict teacher scope (rule 10): a teacher may save SF9 attendance cells
 * only for learners of a section they advise in that school year. Note this
 * is narrower than the forms controller's `isTeacherAllowedForStudent`
 * (which also accepts assigned sections and elective rosters for reading).
 */
async function isAdviserOfStudent(
  userId: number,
  studentId: number,
  schoolYearId: number
): Promise<boolean> {
  const rows = await query<RowDataPacket[]>(
    `SELECT 1 AS allowed
       FROM enrollments e
       JOIN sections sec ON e.section_id = sec.id
      WHERE e.student_id = ?
        AND e.school_year_id = ?
        AND e.status IN ('enrolled', 'completed')
        AND sec.adviser_id = ?
      LIMIT 1`,
    [studentId, schoolYearId, userId]
  );
  return rows.length > 0;
}

/** Teacher reads a section-scoped form when advising/assigned to it. */
async function isTeacherAllowedForSection(
  userId: number,
  sectionId: number,
  schoolYearId: number
): Promise<boolean> {
  const rows = await query<RowDataPacket[]>(
    `SELECT 1 AS allowed
       FROM sections sec
      WHERE sec.id = ? AND school_year_id = ? AND (
              sec.adviser_id = ?
           OR EXISTS (
             SELECT 1 FROM teacher_section_assignments tsa
              WHERE tsa.teacher_id = ? AND tsa.section_id = sec.id
                AND tsa.school_year_id = ?
            )
            )
      LIMIT 1`,
    [sectionId, schoolYearId, userId, userId, schoolYearId]
  );
  return rows.length > 0;
}

/**
 * GET /api/forms/edits?form=SF9&school_year_id=3
 *   [&student_id=.. | &section_id=.. | &student_ids=1,2,3]
 *
 * Returns saved edits for the form/SY so the UI can re-apply them.
 * Rows with student_id NULL are form-level values (header blocks, signature
 * names) — always included. section_id additionally pulls the learner rows
 * of whoever was enrolled in that section that year; student_ids narrows it
 * to an explicit list; student_id selects a single learner.
 */
export async function getFormEdits(req: Request, res: Response): Promise<void> {
  try {
    const form = String(req.query.form ?? "");
    const school_year_id = parseInt(req.query.school_year_id as string);
    if (!FORMS.has(form) || !school_year_id) {
      res.status(400).json({ error: "form (SF1/SF5/SF9/SF10) and school_year_id are required." });
      return;
    }
    const user = req.user!;
    const role = user.role;

    const studentId = req.query.student_id ? parseInt(req.query.student_id as string) : null;
    const sectionId = req.query.section_id ? parseInt(req.query.section_id as string) : null;
    const studentIds = String(req.query.student_ids ?? "")
      .split(",")
      .map(s => parseInt(s))
      .filter(n => Number.isFinite(n) && n > 0)
      .slice(0, 2000);

    if (role === "teacher") {
      // Teachers read only what the existing form guards already let them see.
      if (studentId) {
        const rows = await query<RowDataPacket[]>(
          `SELECT 1 AS allowed
             FROM enrollments e
             LEFT JOIN sections sec ON e.section_id = sec.id
            WHERE e.student_id = ? AND e.school_year_id = ?
              AND e.status IN ('enrolled', 'completed')
              AND (
                sec.adviser_id = ?
                OR EXISTS (SELECT 1 FROM teacher_section_assignments tsa
                            WHERE tsa.teacher_id = ? AND tsa.school_year_id = e.school_year_id
                              AND tsa.section_id = e.section_id)
                OR EXISTS (SELECT 1 FROM student_electives se
                             JOIN teacher_subject_assignments tea
                               ON tea.subject_id = se.subject_id AND tea.teacher_id = ?
                            WHERE se.student_id = e.student_id
                              AND se.school_year_id = e.school_year_id)
              )
            LIMIT 1`,
          [studentId, school_year_id, user.userId, user.userId, user.userId]
        );
        if (rows.length === 0) {
          res.status(403).json({ error: "You can only view saved edits for your own students." });
          return;
        }
      } else if (sectionId) {
        if (!(await isTeacherAllowedForSection(user.userId, sectionId, school_year_id))) {
          res.status(403).json({ error: "You can only view saved edits for your own sections." });
          return;
        }
      } else {
        res.status(403).json({ error: "Specify a student or section." });
        return;
      }
    } else if (role !== "admin" && role !== "registrar" && role !== "principal") {
      res.status(403).json({ error: "You do not have access to saved school form edits." });
      return;
    }

    // Build the WHERE clause for the student scope.
    let studentScopeSql = "";
    const params: any[] = [form, school_year_id];
    if (studentId) {
      studentScopeSql = " AND (student_id IS NULL OR student_id = ?)";
      params.push(studentId);
    } else if (sectionId) {
      studentScopeSql = ` AND (student_id IS NULL OR student_id IN (
        SELECT e.student_id FROM enrollments e
         WHERE e.school_year_id = ? AND e.section_id = ?
           AND e.status IN ('enrolled', 'completed')))`;
      params.push(school_year_id, sectionId);
    } else if (studentIds.length > 0) {
      studentScopeSql = ` AND (student_id IS NULL OR student_id IN (${studentIds
        .map(() => "?")
        .join(",")}))`;
      params.push(...studentIds);
    }

    const rows = await query<EditRow[]>(
      `SELECT id, form, school_year_id, student_id, field_key, value, updated_by, updated_at
         FROM sf_form_edits
        WHERE form = ? AND school_year_id = ?${studentScopeSql}`,
      params
    );
    res.json({
      edits: rows.map(r => ({
        student_id: r.student_id,
        field_key: r.field_key,
        value: r.value ?? "",
        updated_by: r.updated_by,
        updated_at: r.updated_at,
      })),
    });
  } catch (error) {
    console.error("Get form edits error:", error);
    res.status(500).json({ error: "Failed to load saved form edits." });
  }
}

/**
 * PUT /api/forms/edits — save a batch of field edits.
 * Body: { form, school_year_id, edits: [{ student_id?, field_key, value }] }
 * Each edit upserts one row and, when the value changed, writes an Activity
 * Log entry with the old -> new value (rule 14).
 */
export async function saveFormEdits(req: Request, res: Response): Promise<void> {
  try {
    const { form, school_year_id, edits } = req.body as {
      form?: string;
      school_year_id?: number;
      edits?: { student_id?: number | null; field_key: string; value: string }[];
    };
    if (!FORMS.has(form ?? "") || !school_year_id) {
      res.status(400).json({ error: "form (SF1/SF5/SF9/SF10) and school_year_id are required." });
      return;
    }
    if (!Array.isArray(edits) || edits.length === 0) {
      res.status(400).json({ error: "edits must be a non-empty array." });
      return;
    }
    if (edits.length > MAX_EDITS_PER_PUT) {
      res.status(400).json({ error: `Too many edits in one request (max ${MAX_EDITS_PER_PUT}).` });
      return;
    }

    const user = req.user!;
    const role = user.role;

    if (!["admin", "registrar", "teacher"].includes(role)) {
      res.status(403).json({ error: "You are not allowed to save school form edits." });
      return;
    }

    // Rule 16: closed school years — only Registrar/Admin.
    const syRows = await query<SyRow[]>(
      "SELECT id, sy_label, is_current FROM school_years WHERE id = ? LIMIT 1",
      [school_year_id]
    );
    if (syRows.length === 0) {
      res.status(404).json({ error: "School year not found." });
      return;
    }
    const isCurrent = Number(syRows[0].is_current) === 1;
    if (!isCurrent && !["admin", "registrar"].includes(role)) {
      res.status(403).json({
        error: `School year ${syRows[0].sy_label} is closed — only the Registrar or Administrator can change its school forms.`,
      });
      return;
    }

    // Validate + normalize first so a bad key aborts everything up-front.
    const seen = new Set<string>();
    type NormEdit = { student_id: number | null; field_key: string; value: string };
    const normEdits: NormEdit[] = [];
    for (const e of edits) {
      const student_id = e.student_id == null ? null : Number(e.student_id);
      if (student_id != null && (!Number.isInteger(student_id) || student_id <= 0)) {
        res.status(400).json({ error: `Invalid student id: ${student_id}` });
        return;
      }
      if (typeof e.field_key !== "string" || !FIELD_KEY_RE.test(e.field_key)) {
        res.status(400).json({ error: `Invalid field key: ${e.field_key ?? "(empty)"}` });
        return;
      }
      if (typeof e.value !== "string" || e.value.length > 5000) {
        res.status(400).json({ error: `Invalid or too-long value at ${e.field_key} (max 5000 chars).` });
        return;
      }
      // Rule 7: clearing a field is a valid edit — empty string is stored.
      const key = `${student_id ?? 0}|${e.field_key}`;
      if (seen.has(key)) {
        res.status(400).json({ error: `Duplicate edit for ${e.field_key}.` });
        return;
      }
      seen.add(key);
      normEdits.push({ student_id, field_key: e.field_key, value: e.value });
    }

    const isAdminOrRegistrar = role === "admin" || role === "registrar";
    if (role === "teacher") {
      // Rule 10 (strict): teachers save only SF9 attendance cells, one
      // learner at a time, and only for their own advisory learners.
      if (form !== "SF9") {
        res.status(403).json({ error: "Teachers can only save SF9 attendance entries." });
        return;
      }
      if (!normEdits.every(e => e.field_key.startsWith("attendance:"))) {
        res.status(403).json({ error: "Teachers can only save attendance cells on SF9." });
        return;
      }
      const firstStudent = normEdits[0].student_id;
      if (firstStudent === null || !normEdits.every(e => e.student_id === firstStudent)) {
        res.status(400).json({ error: "Attendance edits must target a single student." });
        return;
      }
      if (!(await isAdviserOfStudent(user.userId, firstStudent, Number(school_year_id)))) {
        res.status(403).json({
          error: "You can only save attendance for learners of a section you advise.",
        });
        return;
      }
    } else if (isAdminOrRegistrar) {
      // Verify referenced students exist.
      const ids = [...new Set(normEdits.map(e => e.student_id).filter((n): n is number => n != null))];
      if (ids.length > 0) {
        const found = await query<RowDataPacket[]>(
          `SELECT id FROM students WHERE id IN (${ids.map(() => "?").join(",")})`,
          ids
        );
        if (found.length !== ids.length) {
          res.status(404).json({ error: "One or more students not found." });
          return;
        }
      }
    }

    // Student names for the Activity Log lines.
    const studentNames = new Map<number, string>();
    const studentIds = [...new Set(normEdits.map(e => e.student_id).filter((n): n is number => n != null))];
    if (studentIds.length > 0) {
      const rows = await query<StudentRow[]>(
        `SELECT id, name FROM students
          WHERE id IN (${studentIds.map(() => "?").join(",")})`,
        studentIds
      );
      for (const r of rows) studentNames.set(r.id, r.name ?? `student ${r.id}`);
    }

    // Pre-fetch existing values once (SELECT-then-upsert because MySQL unique
    // keys treat NULLs as distinct — ON DUPLICATE KEY cannot match them).
    const existingValues = new Map<string, string>();
    for (const e of normEdits) {
      const rows = await query<EditRow[]>(
        `SELECT value FROM sf_form_edits
          WHERE form = ? AND school_year_id = ? AND field_key = ?
            AND (${e.student_id === null ? "student_id IS NULL" : "student_id = ?"})`,
        e.student_id === null
          ? [form, school_year_id, e.field_key]
          : [form, school_year_id, e.field_key, e.student_id]
      );
      if (rows.length > 0) {
        existingValues.set(rowKey(e.student_id, e.field_key), rows[0].value ?? "");
      }
    }

    let savedCount = 0;
    for (const e of normEdits) {
      const existingRows = await query<RowDataPacket[]>(
        `SELECT id FROM sf_form_edits
          WHERE form = ? AND school_year_id = ? AND field_key = ?
            AND (${e.student_id === null ? "student_id IS NULL" : "student_id = ?"}) LIMIT 1`,
        e.student_id === null
          ? [form, school_year_id, e.field_key]
          : [form, school_year_id, e.field_key, e.student_id]
      );
      const oldValue = existingValues.get(rowKey(e.student_id, e.field_key)) ?? "";
      if (existingRows.length > 0) {
        await query(
          "UPDATE sf_form_edits SET value = ?, updated_by = ? WHERE id = ?",
          [e.value, user.userId, existingRows[0].id]
        );
      } else {
        await query(
          `INSERT INTO sf_form_edits (form, school_year_id, student_id, field_key, value, updated_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [form, school_year_id, e.student_id, e.field_key, e.value, user.userId]
        );
      }
      savedCount++;
      if (oldValue !== e.value) {
        // Rule 14 — actor, learner, form, field, old -> new. Time is on the log row.
        const target =
          e.student_id != null
            ? studentNames.get(e.student_id) ?? `student ${e.student_id}`
            : "form-level";
        await logActivity(
          user.userId,
          `Saved ${form} edit for ${target}: ${e.field_key} "${oldValue}" -> "${e.value}"`,
          "sf_form_edits",
          `${form}:${school_year_id}:${e.student_id ?? 0}:${e.field_key}`
        );
      }
    }

    res.json({
      message: `Saved ${savedCount} ${form} edit${savedCount === 1 ? "" : "s"}.`,
    });
  } catch (error) {
    console.error("Save form edits error:", error);
    res.status(500).json({ error: "Failed to save form edits." });
  }
}

function rowKey(student_id: number | null, field_key: string): string {
  return `${student_id ?? 0}|${field_key}`;
}
