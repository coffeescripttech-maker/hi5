import { Request, Response } from "express";
import { query } from "../config/database";
import { RowDataPacket } from "mysql2";
import { logActivity } from "../utils/activityLogger";
import {
  normalizeForStorage,
  sharedKeyForForm,
  CARRY_OVER_KEYS,
  CARRY_OVER_EXCLUDED,
  CarryRow,
  StorageEdit,
} from "../utils/formSharedKeys";

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
 *  #8  shared fields (school-identity header, learner identity) saved ONCE
 *      under form='SHARED' and shown on every form via key translation
 *  #10 strict teacher scope: SF9 attendance cells only, own advisory
 *  #14 every save -> Activity Log entry (actor, field, old -> new)
 *  #15 new school year: learner-level details carried over (read-only
 *      prefill until saved into the new year), quarterly fields blank
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
  /** Rule 11/12 — the system value the edit replaced (NULL = unknown/legacy). */
  system_value: string | null;
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
 * The database's own wall-clock ("YYYY-MM-DD HH:MM:SS"). Used for rule 13:
 * both `opened_at` and `updated_at` live on the same clock so the
 * `updated_at > opened_at` comparison can run inside SQL and stay immune to
 * client clock skew and mixed timezones between the DB and the API host.
 */
async function dbNow(): Promise<string> {
  const rows = await query<RowDataPacket[]>(
    "SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS dbnow"
  );
  return String(rows[0]?.dbnow ?? "");
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
    // The SHARED scope reuses the exact same student scope (the enrollment
    // subquery is form-agnostic); params are everything after (form, SY).
    const sharedScopeSql = studentScopeSql;
    const sharedParams = params.slice(2);

    const rows = await query<EditRow[]>(
      `SELECT id, form, school_year_id, student_id, field_key, value, system_value, updated_by, updated_at
         FROM sf_form_edits
        WHERE form = ? AND school_year_id = ?${studentScopeSql}`,
      params
    );

    // Rule 8 — pull the SHARED (cross-form) rows. They are SY-agnostic for
    // reading (a school-identity fix shows on historical forms too); if the
    // same key was ever written under several school years, the latest write
    // wins. Canonical keys are then translated into this form's namespace.
    const sharedRows = await query<EditRow[]>(
      `SELECT id, form, school_year_id, student_id, field_key, value, system_value, updated_by, updated_at
         FROM sf_form_edits
        WHERE form = 'SHARED'${sharedScopeSql}`,
      sharedParams
    );
    const sharedLatest = new Map<string, EditRow>();
    for (const r of sharedRows) {
      const key = `${r.student_id ?? 0}|${r.field_key}`;
      const prev = sharedLatest.get(key);
      if (
        !prev ||
        new Date(r.updated_at).getTime() > new Date(prev.updated_at).getTime()
      ) {
        sharedLatest.set(key, r);
      }
    }
    // Per-form rows win over SHARED for the exact same form key (more
    // specific, and lets a registrar correct one form without touching the
    // rest — the SHARED copy still serves the other forms).
    const ownKeys = new Set(rows.map(r => `${r.student_id ?? 0}|${r.field_key}`));
    const sharedMerged: EditRow[] = [];
    for (const [, r] of sharedLatest) {
      const fk = sharedKeyForForm(form, r.field_key);
      if (!fk) continue; // canonical key has no counterpart on this form
      if (ownKeys.has(`${r.student_id ?? 0}|${fk}`)) continue;
      sharedMerged.push({ ...r, field_key: fk });
    }

    const edits = [...rows, ...sharedMerged].map(r => ({
      student_id: r.student_id,
      field_key: r.field_key,
      value: r.value ?? "",
      system_value: r.system_value ?? null,
      updated_by: r.updated_by,
      updated_at: r.updated_at,
    }));

    // Rule 15 — learner-level details carried over from the previous school
    // year as a read-only prefill (quarterly fields start blank). Returned
    // separately so the client layers it UNDER the current-SY saved values.
    const carried: CarryRow[] = [];
    const carryPatterns = CARRY_OVER_KEYS[form] ?? [];
    if (carryPatterns.length > 0) {
      const prevSyRows = await query<SyRow[]>(
        `SELECT id FROM school_years WHERE id < ? ORDER BY id DESC LIMIT 1`,
        [school_year_id]
      );
      if (prevSyRows.length > 0) {
        const prevSyId = prevSyRows[0].id;
        const excluded = CARRY_OVER_EXCLUDED[form] ?? [];
        const likeSql = carryPatterns
          .map(() => "field_key LIKE ?")
          .join(" OR ");
        const excludedSql =
          excluded.length > 0
            ? ` AND field_key NOT IN (${excluded.map(() => "?").join(",")})`
            : "";
        const carriedRows = await query<EditRow[]>(
          `SELECT id, form, school_year_id, student_id, field_key, value, updated_by, updated_at
             FROM sf_form_edits
            WHERE form = ? AND school_year_id = ? AND (${likeSql})${excludedSql}`,
          [form, prevSyId, ...carryPatterns, ...excluded]
        );
        const carriedKeys = new Set(edits.map(e => `${e.student_id ?? 0}|${e.field_key}`));
        for (const r of carriedRows) {
          const key = `${r.student_id ?? 0}|${r.field_key}`;
          if (carriedKeys.has(key)) continue; // current-SY (or shared) value wins
          carriedKeys.add(key);
          carried.push({
            student_id: r.student_id,
            field_key: r.field_key,
            value: r.value ?? "",
            updated_at: r.updated_at,
            carried_from_sy: prevSyId,
          });
        }
      }
    }

    const opened = await dbNow();
    res.json({ edits, carried, opened_at: opened });
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
    const { form, school_year_id, edits, opened_at, force } = req.body as {
      form?: string;
      school_year_id?: number;
      edits?: {
        student_id?: number | null;
        field_key: string;
        value: string;
        /** Optional rule 11/12 baseline: the system value this edit replaces. */
        system_value?: string | null;
      }[];
      /** When the form was opened — used for rule 13 conflict detection. */
      opened_at?: string;
      /** Set on the confirmed overwrite after a rule 13 conflict. */
      force?: boolean;
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
    // Rule 8: shared fields (school-identity header, learner identity
    // SF1<->SF10) are stored ONCE on the SHARED form and shown on every
    // form via key translation.
    const seen = new Set<string>();
    type NormEdit = {
      storage: StorageEdit;
      requested_form: string;
      student_id: number | null;
      field_key: string;
      value: string;
      system_value: string | null;
    };
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
      if (e.system_value != null && (typeof e.system_value !== "string" || e.system_value.length > 5000)) {
        res.status(400).json({ error: `Invalid system_value at ${e.field_key} (max 5000 chars).` });
        return;
      }
      const storage = normalizeForStorage(form as string, e.field_key);
      if (storage && storage.shared) {
        if (storage.field_key.startsWith("header:") && student_id !== null) {
          res.status(400).json({
            error: `Header field ${e.field_key} is a school-wide value — it must not be scoped to one learner.`,
          });
          return;
        }
        if (storage.field_key.startsWith("shared:learner:") && student_id === null) {
          res.status(400).json({
            error: `Shared learner field ${e.field_key} requires a learner (student_id).`,
          });
          return;
        }
      }
      if (typeof e.value !== "string" || e.value.length > 5000) {
        res.status(400).json({ error: `Invalid or too-long value at ${e.field_key} (max 5000 chars).` });
        return;
      }
      // Rule 7: clearing a field is a valid edit — empty string is stored.
      const norm = storage ?? { form: form as string, field_key: e.field_key, shared: false };
      const key = `${student_id ?? 0}|${norm.form}|${norm.field_key}`;
      if (seen.has(key)) {
        res.status(400).json({ error: `Duplicate edit for ${e.field_key}.` });
        return;
      }
      seen.add(key);
      normEdits.push({
        storage: norm,
        requested_form: form as string,
        student_id,
        field_key: e.field_key,
        value: e.value,
        system_value: e.system_value ?? null,
      });
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
    // Rule 13: the client echoes the database-side clock captured when the
    // form loaded (`opened_at`, returned by GET). Rows whose updated_at is
    // newer than that belong to someone else's saved edit — refuse with 409
    // unless the caller confirmed the overwrite (force) or the incoming value
    // is identical (harmless no-op). The comparison runs inside SQL so both
    // sides share one session timezone.
    const openedAt =
      opened_at != null && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(opened_at)
        ? opened_at
        : null;
    const existingValues = new Map<
      string,
      { value: string; stale: boolean; updated_at: Date }
    >();
    for (const e of normEdits) {
      const rows = await query<
        (EditRow & { stale?: number })[]
      >(
        `SELECT value, updated_at${openedAt ? ", (updated_at > ?) AS stale" : ""}
          FROM sf_form_edits
          WHERE form = ? AND school_year_id = ? AND field_key = ?
            AND (${e.student_id === null ? "student_id IS NULL" : "student_id = ?"})`,
        openedAt
          ? e.student_id === null
            ? [openedAt, e.storage.form, school_year_id, e.storage.field_key]
            : [openedAt, e.storage.form, school_year_id, e.storage.field_key, e.student_id]
          : e.student_id === null
            ? [e.storage.form, school_year_id, e.storage.field_key]
            : [e.storage.form, school_year_id, e.storage.field_key, e.student_id]
      );
      if (rows.length > 0) {
        existingValues.set(
          `${e.student_id ?? 0}|${e.storage.form}|${e.storage.field_key}`,
          {
            value: rows[0].value ?? "",
            stale: Number(rows[0].stale ?? 0) === 1,
            updated_at: rows[0].updated_at,
          }
        );
      }
    }
    if (openedAt && !force) {
      const conflicts = normEdits
        .filter(e => {
          const ex = existingValues.get(
            `${e.student_id ?? 0}|${e.storage.form}|${e.storage.field_key}`
          );
          if (!ex) return false;
          if (ex.value === e.value) return false; // identical write is a no-op
          return ex.stale;
        })
        .map(e => ({
          student_id: e.student_id,
          field_key: e.field_key,
          updated_at:
            existingValues.get(
              `${e.student_id ?? 0}|${e.storage.form}|${e.storage.field_key}`
            )?.updated_at.toISOString() ?? null,
        }));
      if (conflicts.length > 0) {
        res.status(409).json({
          error: `Changed by someone else since this form was opened (${conflicts.length} field${conflicts.length === 1 ? "" : "s"}). Overwrite or reload to continue.`,
          conflicts,
        });
        return;
      }
    }

    let savedCount = 0;
    for (const e of normEdits) {
      const existingRows = await query<RowDataPacket[]>(
        `SELECT id FROM sf_form_edits
          WHERE form = ? AND school_year_id = ? AND field_key = ?
            AND (${e.student_id === null ? "student_id IS NULL" : "student_id = ?"}) LIMIT 1`,
        e.student_id === null
          ? [e.storage.form, school_year_id, e.storage.field_key]
          : [e.storage.form, school_year_id, e.storage.field_key, e.student_id]
      );
      const oldValue =
        existingValues.get(
          `${e.student_id ?? 0}|${e.storage.form}|${e.storage.field_key}`
        )?.value ?? "";
      if (existingRows.length > 0) {
        await query(
          `UPDATE sf_form_edits
              SET value = ?, system_value = COALESCE(?, system_value), updated_by = ?
            WHERE id = ?`,
          [e.value, e.system_value, user.userId, existingRows[0].id]
        );
      } else {
        await query(
          `INSERT INTO sf_form_edits (form, school_year_id, student_id, field_key, value, system_value, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            e.storage.form,
            school_year_id,
            e.student_id,
            e.storage.field_key,
            e.value,
            e.system_value,
            user.userId,
          ]
        );
      }
      savedCount++;
      if (oldValue !== e.value) {
        // Rule 14 — actor, learner, form, field, old -> new. Time is on the
        // log row. SHARED rows are labeled with both the shared store and the
        // form the edit was typed on.
        const target =
          e.student_id != null
            ? studentNames.get(e.student_id) ?? `student ${e.student_id}`
            : "form-level";
        await logActivity(
          user.userId,
          `Saved ${e.storage.shared ? "SHARED" : e.storage.form} edit${
            e.storage.shared ? ` (typed on ${e.requested_form})` : ""
          } for ${target}: ${e.field_key} "${oldValue}" -> "${e.value}"`,
          "sf_form_edits",
          `${e.storage.form}:${school_year_id}:${e.student_id ?? 0}:${e.storage.field_key}`
        );
      }
    }

    // Rule 13 — hand the client a fresh database-side clock stamp so the
    // next save from the same session compares against this save's turn.
    res.json({
      message: `Saved ${savedCount} edit${savedCount === 1 ? "" : "s"} on ${form}.`,
      opened_at: await dbNow(),
    });
  } catch (error) {
    console.error("Save form edits error:", error);
    res.status(500).json({ error: "Failed to save form edits." });
  }
}

function rowKey(student_id: number | null, field_key: string): string {
  return `${student_id ?? 0}|${field_key}`;
}

/**
 * DELETE /api/forms/edits — rule 11 "Reset to system value": remove saved
 * edits so the form shows the system-derived value again.
 * Body: { form, school_year_id, keys: [{ student_id?, field_key }] }
 * Gating mirrors saveFormEdits (rule 10 strict / rule 16 closed SY); every
 * removal is logged with the value that was discarded (rule 14).
 */
export async function resetFormEdits(req: Request, res: Response): Promise<void> {
  try {
    const { form, school_year_id, keys } = req.body as {
      form?: string;
      school_year_id?: number;
      keys?: { student_id?: number | null; field_key: string }[];
    };
    if (!FORMS.has(form ?? "") || !school_year_id) {
      res.status(400).json({ error: "form (SF1/SF5/SF9/SF10) and school_year_id are required." });
      return;
    }
    if (!Array.isArray(keys) || keys.length === 0) {
      res.status(400).json({ error: "keys must be a non-empty array." });
      return;
    }
    if (keys.length > MAX_EDITS_PER_PUT) {
      res.status(400).json({ error: `Too many keys in one request (max ${MAX_EDITS_PER_PUT}).` });
      return;
    }

    const user = req.user!;
    const role = user.role;
    if (!["admin", "registrar", "teacher"].includes(role)) {
      res.status(403).json({ error: "You are not allowed to reset school form edits." });
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
    if (Number(syRows[0].is_current) !== 1 && !["admin", "registrar"].includes(role)) {
      res.status(403).json({
        error: `School year ${syRows[0].sy_label} is closed — only the Registrar or Administrator can change its school forms.`,
      });
      return;
    }

    // Normalize to storage coordinates (shared keys included) + validate.
    const seen = new Set<string>();
    type NormKey = {
      storage: StorageEdit;
      student_id: number | null;
      field_key: string;
    };
    const normKeys: NormKey[] = [];
    for (const k of keys) {
      const student_id = k.student_id == null ? null : Number(k.student_id);
      if (student_id != null && (!Number.isInteger(student_id) || student_id <= 0)) {
        res.status(400).json({ error: `Invalid student id: ${student_id}` });
        return;
      }
      if (typeof k.field_key !== "string" || !FIELD_KEY_RE.test(k.field_key)) {
        res.status(400).json({ error: `Invalid field key: ${k.field_key ?? "(empty)"}` });
        return;
      }
      const storage = normalizeForStorage(form as string, k.field_key);
      if (storage && storage.shared) {
        if (storage.field_key.startsWith("header:") && student_id !== null) {
          res.status(400).json({
            error: `Header field ${k.field_key} is a school-wide value — it must not be scoped to one learner.`,
          });
          return;
        }
        if (storage.field_key.startsWith("shared:learner:") && student_id === null) {
          res.status(400).json({
            error: `Shared learner field ${k.field_key} requires a learner (student_id).`,
          });
          return;
        }
      }
      const norm = storage ?? { form: form as string, field_key: k.field_key, shared: false };
      const key = `${student_id ?? 0}|${norm.form}|${norm.field_key}`;
      if (seen.has(key)) continue;
      seen.add(key);
      normKeys.push({ storage: norm, student_id, field_key: k.field_key });
    }

    // Rule 10 (strict) — teachers reset only SF9 attendance keys, one
    // learner at a time, own advisory only.
    if (role === "teacher") {
      if (form !== "SF9") {
        res.status(403).json({ error: "Teachers can only reset SF9 attendance entries." });
        return;
      }
      if (!normKeys.every(e => e.field_key.startsWith("attendance:"))) {
        res.status(403).json({ error: "Teachers can only reset attendance cells on SF9." });
        return;
      }
      const firstStudent = normKeys[0].student_id;
      if (firstStudent === null || !normKeys.every(e => e.student_id === firstStudent)) {
        res.status(400).json({ error: "Attendance resets must target a single student." });
        return;
      }
      if (!(await isAdviserOfStudent(user.userId, firstStudent, Number(school_year_id)))) {
        res.status(403).json({
          error: "You can only reset attendance for learners of a section you advise.",
        });
        return;
      }
    }

    // Fetch ids + values for logging; verify referenced students for everyone.
    const studentIds = [...new Set(normKeys.map(e => e.student_id).filter((n): n is number => n != null))];
    if (studentIds.length > 0) {
      const found = await query<RowDataPacket[]>(
        `SELECT id FROM students WHERE id IN (${studentIds.map(() => "?").join(",")})`,
        studentIds
      );
      if (found.length !== studentIds.length) {
        res.status(404).json({ error: "One or more students not found." });
        return;
      }
    }
    const studentNames = new Map<number, string>();
    if (studentIds.length > 0) {
      const rows = await query<StudentRow[]>(
        `SELECT id, name FROM students WHERE id IN (${studentIds.map(() => "?").join(",")})`,
        studentIds
      );
      for (const r of rows) studentNames.set(r.id, r.name ?? `student ${r.id}`);
    }

    let resetCount = 0;
    for (const e of normKeys) {
      const rows = await query<EditRow[]>(
        `SELECT id, value FROM sf_form_edits
          WHERE form = ? AND school_year_id = ? AND field_key = ?
            AND (${e.student_id === null ? "student_id IS NULL" : "student_id = ?"}) LIMIT 1`,
        e.student_id === null
          ? [e.storage.form, school_year_id, e.storage.field_key]
          : [e.storage.form, school_year_id, e.storage.field_key, e.student_id]
      );
      if (rows.length === 0) {
        resetCount++; // nothing saved — the effective value again is the system value
        continue;
      }
      await query("DELETE FROM sf_form_edits WHERE id = ?", [rows[0].id]);
      resetCount++;
      const target =
        e.student_id != null
          ? studentNames.get(e.student_id) ?? `student ${e.student_id}`
          : "form-level";
      await logActivity(
        user.userId,
        `Reset ${e.storage.shared ? "SHARED" : e.storage.form} edit${
          e.storage.shared ? ` (typed on ${form})` : ""
        } for ${target}: ${e.field_key} "${rows[0].value ?? ""}" -> system value`,
        "sf_form_edits",
        `${e.storage.form}:${school_year_id}:${e.student_id ?? 0}:${e.storage.field_key}`
      );
    }

    res.json({
      message: `Reset ${resetCount} edit${resetCount === 1 ? "" : "s"} on ${form} to system values.`,
    });
  } catch (error) {
    console.error("Reset form edits error:", error);
    res.status(500).json({ error: "Failed to reset form edits." });
  }
}
