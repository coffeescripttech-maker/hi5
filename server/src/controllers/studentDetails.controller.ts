/**
 * Student Details Edit (client revision: Hi5_Portal_Student_Details_Edit_
 * Expected_Behavior.md) — lets the Enrollment Committee, Registrar, and
 * Administrator correct a learner's details after enrollment with:
 *   - validation (LRN uniqueness/format, name parts, suffix list, dates)
 *   - a required reason for identity changes
 *   - a permanent change history (student_field_history, Phase 1)
 *   - reset of stale saved School Form edits for changed identity fields
 *   - one transaction (any failure rolls everything back)
 *   - Registrar notifications when identity changes after grades exist
 *
 * There is no approval step; safety comes from the checks above.
 * Not editable here: student_id, grade level, section, status, grades.
 */
import { Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { randomUUID } from "crypto";
import { query, getConnection } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { createNotification } from "../services/notify";
import { parseName } from "../utils/nameFormatter";

interface StudentRowFull extends RowDataPacket {
  id: number;
  student_id: string;
  lrn: string;
  name: string;
  last_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  name_ext: string | null;
  sex: "male" | "female";
  birthdate: string | null;
  status: string;
  is_archived: number;
  guardian: string | null;
  guardian_relationship: string | null;
  contact: string | null;
  mother_tongue: string | null;
  ip_ethnic_group: string | null;
  religion: string | null;
  father_name: string | null;
  mother_name: string | null;
  house_street: string | null;
  barangay: string | null;
  city_municipality: string | null;
  province: string | null;
  zip_code: string | null;
  guardian_4ps: number;
  height_cm: string | number | null;
  weight_kg: string | number | null;
  updated_at: string;
}

/** field spec: [column, label, group, kind] */
const FIELD_SPECS: Record<
  string,
  { label: string; group: "routine" | "identity"; kind: "string" | "date" | "sex" | "lrn" | "bool" | "number" }
> = {
  first_name: { label: "First Name", group: "identity", kind: "string" },
  middle_name: { label: "Middle Name", group: "identity", kind: "string" },
  last_name: { label: "Last Name", group: "identity", kind: "string" },
  name_ext: { label: "Name Suffix", group: "identity", kind: "string" },
  lrn: { label: "LRN", group: "identity", kind: "lrn" },
  birthdate: { label: "Birthdate", group: "identity", kind: "date" },
  sex: { label: "Sex", group: "identity", kind: "sex" },
  mother_tongue: { label: "Mother Tongue", group: "routine", kind: "string" },
  ip_ethnic_group: { label: "IP (Ethnic Group)", group: "routine", kind: "string" },
  religion: { label: "Religion", group: "routine", kind: "string" },
  father_name: { label: "Father's Name", group: "routine", kind: "string" },
  mother_name: { label: "Mother's Maiden Name", group: "routine", kind: "string" },
  guardian: { label: "Guardian Name", group: "routine", kind: "string" },
  guardian_relationship: { label: "Guardian Relationship", group: "routine", kind: "string" },
  contact: { label: "Contact Number", group: "routine", kind: "string" },
  house_street: { label: "House #/Street", group: "routine", kind: "string" },
  barangay: { label: "Barangay", group: "routine", kind: "string" },
  city_municipality: { label: "Municipality/City", group: "routine", kind: "string" },
  province: { label: "Province", group: "routine", kind: "string" },
  zip_code: { label: "ZIP", group: "routine", kind: "string" },
  guardian_4ps: { label: "4Ps Member", group: "routine", kind: "bool" },
  height_cm: { label: "Height (cm)", group: "routine", kind: "number" },
  weight_kg: { label: "Weight (kg)", group: "routine", kind: "number" }
};

const SUFFIX_RE = /^[A-Za-z][A-Za-z. \-]{0,11}$/;
const REASONS = ["Typo", "Per birth certificate", "Per LIS or LRN record", "Other"];

const clean = (v: unknown): string => String(v ?? "").trim();

/** PUT /api/students/:id/details */
export async function updateStudentDetails(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);
  const body = (req.body || {}) as Record<string, unknown>;
  const fieldsIn = (body.fields ?? body) as Record<string, unknown>;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const reasonNote = typeof body.reason_note === "string" ? body.reason_note.trim() : "";
  const openedAt = typeof body.opened_at === "string" ? body.opened_at : "";

  try {
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid student id." });
      return;
    }

    // Only three roles reach here (route guard); teachers/principals 403.
    const role = req.user!.role;
    if (!["admin", "registrar", "enrollment_committee"].includes(role)) {
      res.status(403).json({ error: "You cannot edit learner details." });
      return;
    }

    const rows = await query<StudentRowFull[]>("SELECT * FROM students WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) {
      res.status(404).json({ error: "Student not found." });
      return;
    }
    const current = rows[0];

    if (current.is_archived === 1 && role !== "admin") {
      res.status(403).json({ error: "This learner is archived — only the Administrator can edit them." });
      return;
    }

    // Identity lock: after promotion/graduation or when the learner's school
    // year is closed, only the Administrator changes identity fields.
    const enrRows = await query<RowDataPacket[]>(
      `SELECT sy.is_current FROM enrollments e JOIN school_years sy ON sy.id = e.school_year_id
        WHERE e.student_id = ? ORDER BY e.school_year_id DESC LIMIT 1`,
      [id]
    );
    const latestEnrollmentClosed =
      enrRows.length > 0 && Number(enrRows[0].is_current) !== 1;
    const identityLocked =
      role !== "admin" &&
      (current.status === "graduated" || latestEnrollmentClosed);

    const provided: Record<string, unknown> = {};
    for (const key of Object.keys(FIELD_SPECS)) {
      if (fieldsIn[key] !== undefined) provided[key] = fieldsIn[key];
    }
    if (Object.keys(provided).length === 0) {
      res.status(400).json({ error: "No fields to update." });
      return;
    }

    const hasIdentityChange = Object.keys(provided).some(k => FIELD_SPECS[k].group === "identity");
    if (identityLocked && hasIdentityChange) {
      res.status(403).json({
        error: "Identity fields are locked for this learner — only the Administrator can change them (closed school year / already promoted)."
      });
      return;
    }

    // Validate reason
    let historyReason = "Routine edit";
    if (hasIdentityChange) {
      if (!REASONS.includes(reason)) {
        res.status(400).json({ error: "A reason is required for identity changes (Typo / Per birth certificate / Per LIS or LRN record / Other)." });
        return;
      }
      if (reason === "Other" && !reasonNote) {
        res.status(400).json({ error: "Describe the reason when selecting 'Other'." });
        return;
      }
      historyReason = reason === "Other" ? `Other: ${reasonNote}` : reason;
    }

    // Per-field normalization + validation
    const changes: { field: string; label: string; group: string; old: string; new: string }[] = [];
    const updateCols: Record<string, string | number | null> = {};

    for (const [field, spec] of Object.entries(FIELD_SPECS)) {
      if (!(field in provided)) continue;
      let newVal: string | number | null;
      let oldVal: string | number | null = (current as any)[field] as string | number | null;

      if (spec.kind === "lrn") {
        newVal = clean(provided[field]);
        if (!/^\d{12}$/.test(newVal)) {
          res.status(400).json({ error: "LRN must be exactly 12 digits." });
          return;
        }
        const dupeRows = await query<RowDataPacket[]>(
          "SELECT id, name, lrn FROM students WHERE lrn = ? AND id <> ? LIMIT 1",
          [newVal, id]
        );
        if (dupeRows.length > 0) {
          res.status(409).json({
            error: `LRN is already used by "${dupeRows[0].name}" (${dupeRows[0].lrn}).`,
            conflict_learner: { id: dupeRows[0].id, name: dupeRows[0].name, lrn: dupeRows[0].lrn }
          });
          return;
        }
      } else if (spec.kind === "date") {
        newVal = clean(provided[field]);
        const d = new Date(newVal);
        if (isNaN(d.getTime()) || d > new Date()) {
          res.status(400).json({ error: "Birthdate must be a valid past date (YYYY-MM-DD)." });
          return;
        }
        newVal = newVal.slice(0, 10);
      } else if (spec.kind === "sex") {
        newVal = clean(provided[field]).toLowerCase();
        if (newVal !== "male" && newVal !== "female") {
          res.status(400).json({ error: "Sex must be male or female." });
          return;
        }
      } else if (spec.kind === "bool") {
        newVal = provided[field] === true || provided[field] === 1 || provided[field] === "1" ? 1 : 0;
      } else if (spec.kind === "number") {
        const n = parseFloat(String(provided[field]));
        newVal = isNaN(n) ? null : n;
      } else {
        newVal = clean(provided[field]);
        if (newVal.length > 150) {
          res.status(400).json({ error: `${spec.label} must be 150 characters or fewer.` });
          return;
        }
      }

      const oldStr = oldVal == null ? "" : String(oldVal);
      const newStr = newVal == null ? "" : String(newVal);
      if (oldStr === newStr) continue; // no actual change
      changes.push({ field, label: spec.label, group: spec.group, old: oldStr, new: newStr });
      updateCols[field] = newVal;
    }

    // Name parts compose: first/last required when any name part provided
    const nameProvided = ["first_name", "middle_name", "last_name", "name_ext"].some(f => f in updateCols || f in provided);
    if (nameProvided) {
      const firstName = clean(updateCols.first_name ?? current.first_name ?? provided.first_name ?? "");
      const lastName = clean(updateCols.last_name ?? current.last_name ?? provided.last_name ?? "");
      if (!firstName || !lastName) {
        res.status(400).json({ error: "First and last name are required." });
        return;
      }
      const ext = clean(updateCols.name_ext ?? current.name_ext ?? "");
      if (ext && !SUFFIX_RE.test(ext)) {
        res.status(400).json({ error: "Name suffix must be 1-12 letters/dots (e.g. Jr., Sr., III)." });
        return;
      }
      updateCols.last_name = lastName;
      updateCols.first_name = firstName;
      updateCols.middle_name = clean(updateCols.middle_name ?? current.middle_name ?? "");
      updateCols.name_ext = ext || null;
      // The composed full name is itself a tracked change vs the old name.
      // Natural form ("First Middle Last Ext") — consistent with createStudent.
      const composed = [
        firstName,
        updateCols.middle_name as string,
        lastName,
        ext
      ]
        .filter(Boolean)
        .join(" ");
      if (composed !== current.name) {
        changes.push({ field: "name", label: "Full Name", group: "identity", old: current.name, new: composed });
        updateCols.name = composed;
      }
    }

    // Duplicate warning (warn only — twins and similar names exist)
    let duplicate_warning: { id: number; name: string; lrn: string } | null = null;
    if (updateCols.last_name || updateCols.first_name || "birthdate" in updateCols) {
      const newLast = clean(updateCols.last_name ?? current.last_name ?? "");
      const newFirst = clean(updateCols.first_name ?? current.first_name ?? "");
      const newBd = clean(updateCols.birthdate ?? current.birthdate ?? "");
      const dupeRows = await query<RowDataPacket[]>(
        `SELECT id, name, lrn FROM students
          WHERE id <> ? AND last_name = ? AND first_name = ? ${newBd ? "AND birthdate = ?" : ""}
          LIMIT 1`,
        newBd ? [id, newLast, newFirst, newBd] : [id, newLast, newFirst]
      );
      if (dupeRows.length > 0) {
        duplicate_warning = { id: dupeRows[0].id, name: dupeRows[0].name, lrn: dupeRows[0].lrn };
      }
    }

    if (changes.length === 0) {
      res.json({ message: "No changes to save.", learner: current, changes: [] });
      return;
    }

    // Optimistic conflict: someone else saved after the form was opened.
    if (openedAt) {
      const opened = new Date(openedAt);
      const rawUpdated = current.updated_at as unknown;
      const lastModified =
        rawUpdated instanceof Date
          ? rawUpdated
          : new Date(String(current.updated_at).replace(" ", "T"));
      if (
        !isNaN(opened.getTime()) &&
        !isNaN(lastModified.getTime()) &&
        lastModified.getTime() > opened.getTime() + 1000
      ) {
        const freshRows = await query<StudentRowFull[]>("SELECT * FROM students WHERE id = ? LIMIT 1", [id]);
        res.status(409).json({
          error: "This record was changed by someone else while you were editing. The latest values are shown.",
          conflict: true,
          learner: freshRows[0] || current
        });
        return;
      }
    }

    const batchId = randomUUID();
    const conn = await getConnection();
    try {
      await conn.beginTransaction();

      const setClauses = Object.keys(updateCols).map(k => `${k} = ?`).join(", ");
      const setParams = Object.values(updateCols);
      await conn.execute(`UPDATE students SET ${setClauses}, updated_at = NOW() WHERE id = ?`, [...setParams, id]);

      for (const ch of changes) {
        await conn.execute(
          `INSERT INTO student_field_history (student_id, field, old_value, new_value, reason, changed_by, batch_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, ch.field, ch.old, ch.new, historyReason, req.user!.userId, batchId]
        );
      }

      // Identity changes: reset stale saved SF edits for the changed fields in
      // the OPEN school year. Closed school years are never touched.
      const identityChangedFields = changes.filter(c => c.group === "identity").map(c => c.field);
      if (identityChangedFields.length > 0) {
        const nameReset = identityChangedFields.some(f => ["first_name", "middle_name", "last_name", "name_ext", "name"].includes(f));
        const lrnReset = identityChangedFields.includes("lrn");
        const bdReset = identityChangedFields.includes("birthdate");
        const sexReset = identityChangedFields.includes("sex");

        const keyClauses: string[] = [];
        const keyParams: (string | number)[] = [];
        if (nameReset) {
          keyClauses.push("(form = 'SF1' AND field_key = 's:name')", "(form = 'SF5' AND field_key = 's:name')", "(form = 'SF10' AND field_key IN ('learner:lastName','learner:firstName','learner:middleName','learner:nameExt'))");
        }
        if (lrnReset) {
          keyClauses.push("(form = 'SF10' AND field_key = 'learner:lrn')");
        }
        if (bdReset) {
          keyClauses.push("(form = 'SF10' AND field_key = 'learner:birthDate')");
        }
        if (sexReset) {
          keyClauses.push("(form = 'SF10' AND field_key = 'learner:sex')");
        }
        if (keyClauses.length > 0) {
          const [stale] = await conn.query<RowDataPacket[]>(
            `SELECT id, form, field_key, value FROM sf_form_edits
              WHERE student_id = ? AND school_year_id = (SELECT id FROM school_years WHERE is_current = 1)
                AND (${keyClauses.join(" OR ")})`,
            [id, ...keyParams]
          );
          for (const edit of stale) {
            await conn.execute(
              `INSERT INTO student_field_history (student_id, field, old_value, new_value, reason, changed_by, batch_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [id, `sf_edit:${edit.form}:${edit.field_key}`, String(edit.value ?? ""), "", historyReason, req.user!.userId, batchId]
            );
          }
          if (stale.length > 0) {
            const staleIds = stale.map(s => Number(s.id));
            await conn.execute(`DELETE FROM sf_form_edits WHERE id IN (${staleIds.map(() => "?").join(",")})`, staleIds);
          }
        }
      }

      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }

    // Notifications: identity change with existing grades → the Registrar is
    // notified with the old and new values.
    const identityChanged = changes.some(c => c.group === "identity");
    if (identityChanged) {
      const gradesRows = await query<RowDataPacket[]>("SELECT COUNT(*) n FROM grades WHERE student_id = ? LIMIT 1", [id]);
      if (gradesRows[0].n > 0) {
        const detail = changes
          .filter(c => c.group === "identity")
          .map(c => `${c.label}: "${c.old}" → "${c.new}"`)
          .join("; ");
        createNotification({
          title: "Learner identity changed",
          message: `${current.name} (LRN ${current.lrn}) — ${detail}`,
          type: "warning",
          role: "registrar"
        }).catch(() => {});
      }
    }

    const updatedRows = await query<StudentRowFull[]>("SELECT * FROM students WHERE id = ? LIMIT 1", [id]);
    const updated = updatedRows[0];
    logActivity(
      req.user!.userId,
      `Updated details of "${updated.name}" (${updated.student_id}) — ${changes.length} field(s) changed`,
      "students",
      id
    );

    res.json({
      message: `${changes.length} field(s) updated.`,
      learner: updated,
      changes,
      duplicate_warning: duplicate_warning ? `${duplicate_warning.name} (LRN ${duplicate_warning.lrn}) has a similar name/birthdate.` : null,
      batch_id: batchId
    });
  } catch (error) {
    console.error("Update student details error:", error);
    res.status(500).json({ error: "Failed to update learner details." });
  }
}

/** GET /api/students/:id/history — the learner's change history tab. */
export async function getStudentHistory(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);
  try {
    const historyRows = await query<RowDataPacket[]>(
      `SELECT h.id, h.field, h.old_value, h.new_value, h.reason, h.changed_by,
              u.name AS changed_by_name, h.created_at, h.batch_id
         FROM student_field_history h
         LEFT JOIN users u ON u.id = h.changed_by
        WHERE h.student_id = ?
        ORDER BY h.created_at DESC, h.id DESC
        LIMIT 300`,
      [id]
    );
    res.json(historyRows);
  } catch (error) {
    console.error("Student history error:", error);
    res.status(500).json({ error: "Failed to load change history." });
  }
}
