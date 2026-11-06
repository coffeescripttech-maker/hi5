import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";

interface SectionRow extends RowDataPacket {
  id: number;
  name: string;
  grade_level: number;
  section_type: string;
  capacity: number;
  current_count: number;
  adviser_id: number | null;
  min_average: number;
  max_average: number | null;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * GET /api/sections/teachers — List teachers for adviser search
 * Lightweight: returns only id, name, employee_id, designation.
 * Accessible by admin, registrar, and teacher.
 */
export async function listTeachers(_req: Request, res: Response): Promise<void> {
  try {
    const teachers = await query<RowDataPacket[]>(
      `SELECT id, name, employee_id, designation
       FROM users WHERE role = 'teacher' ORDER BY name ASC`
    );
    res.json(teachers);
  } catch (error) {
    console.error("List teachers error:", error);
    res.status(500).json({ error: "Failed to fetch teachers." });
  }
}

/**
 * GET /api/sections — List sections with filters
 * Query: ?grade_level=7&section_type=star
 */
export async function listSections(req: Request, res: Response): Promise<void> {
  try {
    const { grade_level, section_type, is_active } = req.query;

    let sql = `SELECT s.*, u.name AS adviser_name,
                      (SELECT COUNT(DISTINCT e.student_id) FROM enrollments e
                       JOIN school_years sy ON e.school_year_id = sy.id
                       WHERE e.section_id = s.id AND sy.is_current = 1 AND e.status = 'enrolled') AS current_count
               FROM sections s
               LEFT JOIN users u ON s.adviser_id = u.id`;
    const params: any[] = [];
    const conditions: string[] = [];

    if (grade_level) {
      conditions.push("s.grade_level = ?");
      params.push(parseInt(grade_level as string));
    }
    if (section_type) {
      conditions.push("s.section_type = ?");
      params.push(section_type);
    }
    if (is_active !== undefined) {
      conditions.push("s.is_active = ?");
      params.push(parseInt(is_active as string));
    }

    // Privacy: a teacher only sees sections they advise or are assigned to
    // (strict grant model — per-section-subject rows only).
    if (req.user?.role === "teacher") {
      const userId = req.user.userId;
      conditions.push(
        "(s.adviser_id = ? OR s.id IN (SELECT sta.section_id FROM section_teacher_assignments sta WHERE sta.teacher_id = ? AND sta.school_year_id = (SELECT id FROM school_years WHERE is_current = 1 LIMIT 1)))"
      );
      params.push(userId, userId);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY s.grade_level ASC, s.name ASC";

    const sections = await query<SectionRow[]>(sql, params);
    res.json(sections);
  } catch (error) {
    console.error("List sections error:", error);
    res.status(500).json({ error: "Failed to fetch sections." });
  }
}

/**
 * GET /api/sections/my-sections — Sections scoped to the logged-in teacher
 */
export async function getTeacherSections(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const advisoryOnly = req.query.advisory === "1";
    const sections = await query<SectionRow[]>(
      `SELECT DISTINCT s.*, u.name AS adviser_name,
              (SELECT COUNT(DISTINCT e.student_id) FROM enrollments e
               JOIN school_years sy ON e.school_year_id = sy.id
               WHERE e.section_id = s.id AND sy.is_current = 1 AND e.status = 'enrolled') AS current_count
       FROM sections s
       LEFT JOIN users u ON s.adviser_id = u.id
       WHERE s.is_active = 1
         AND ${
           advisoryOnly
             ? "s.adviser_id = ?"
             : "(s.adviser_id = ? OR s.id IN (SELECT sta.section_id FROM section_teacher_assignments sta WHERE sta.teacher_id = ? AND sta.school_year_id = (SELECT id FROM school_years WHERE is_current = 1 LIMIT 1)))"
         }
       ORDER BY s.grade_level ASC, s.name ASC`,
      advisoryOnly ? [userId] : [userId, userId]
    );
    res.json(sections);
  } catch (error) {
    console.error("Get teacher sections error:", error);
    res.status(500).json({ error: "Failed to fetch sections." });
  }
}

/**
 * GET /api/sections/:id — Get section by ID
 */
export async function getSectionById(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const sections = await query<RowDataPacket[]>(
      `SELECT s.*, u.name AS adviser_name,
              (SELECT COUNT(*) FROM enrollments e JOIN school_years sy ON e.school_year_id = sy.id WHERE e.section_id = s.id AND sy.is_current = 1) AS enrolled_count
       FROM sections s
       LEFT JOIN users u ON s.adviser_id = u.id
       WHERE s.id = ?`,
      [id]
    );

    if (sections.length === 0) {
      res.status(404).json({ error: "Section not found." });
      return;
    }

    // Privacy: teachers may only open sections they advise or are assigned to
    // (strict grant model — the exact per-section-subject rows).
    if (req.user?.role === "teacher") {
      const userId = req.user.userId;
      const allowed = await query<RowDataPacket[]>(
        `SELECT 1 FROM sections s
         WHERE s.id = ?
           AND (s.adviser_id = ?
             OR s.id IN (SELECT sta.section_id FROM section_teacher_assignments sta WHERE sta.teacher_id = ? AND sta.school_year_id = (SELECT id FROM school_years WHERE is_current = 1 LIMIT 1)))
         LIMIT 1`,
        [id, userId, userId]
      );
      if (allowed.length === 0) {
        res.status(403).json({ error: "Access denied. This section is not yours." });
        return;
      }
    }

    // Get adviser details
    const section = sections[0];
    if (section.adviser_id) {
      const adviser = await query<RowDataPacket[]>(
        "SELECT id, name, employee_id, designation, email FROM users WHERE id = ?",
        [section.adviser_id]
      );
      section.adviser = adviser[0] || null;
    }

    res.json(section);
  } catch (error) {
    console.error("Get section error:", error);
    res.status(500).json({ error: "Failed to fetch section." });
  }
}

/**
 * POST /api/sections — Create section
 */
export async function createSection(req: Request, res: Response): Promise<void> {
  try {
    const { name, grade_level, section_type, capacity, adviser_id, min_average, max_average, is_active } = req.body;

    if (!name || !grade_level || !section_type || !capacity || min_average === undefined) {
      res.status(400).json({ error: "Missing required fields: name, grade_level, section_type, capacity, min_average." });
      return;
    }

    // Validate section_type exists in the dynamic section_types table
    const validTypes = await query<RowDataPacket[]>(
      "SELECT id FROM section_types WHERE name = ? AND is_active = 1",
      [section_type]
    );
    if (validTypes.length === 0) {
      res.status(400).json({ error: `Invalid section_type "${section_type}". No matching section type found.` });
      return;
    }

    // Check unique name
    const existing = await query<RowDataPacket[]>("SELECT id FROM sections WHERE name = ?", [name]);
    if (existing.length > 0) {
      res.status(409).json({ error: "Section name already exists." });
      return;
    }

    // new_requirement.txt R6: the adviser must be a teacher, and one teacher
    // advises at most one section (decide 10.9-5 — hard error).
    const adviserError = await advisersErrorIfInvalid(adviser_id, null);
    if (adviserError) {
      res.status(409).json({ error: adviserError });
      return;
    }

    const result = await query<ResultSetHeader>(
      `INSERT INTO sections (name, grade_level, section_type, capacity, adviser_id, min_average, max_average, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, grade_level, section_type, capacity, adviser_id || null, min_average, max_average ?? null, is_active !== undefined ? is_active : 1]
    );

    await logActivity(req.user!.userId, `Created section "${name}"`, "sections", result.insertId);

    const newSection = await query<SectionRow[]>("SELECT * FROM sections WHERE id = ?", [result.insertId]);
    res.status(201).json(newSection[0]);
  } catch (error) {
    console.error("Create section error:", error);
    res.status(500).json({ error: "Failed to create section." });
  }
}

/**
 * PUT /api/sections/:id — Update section
 */
export async function updateSection(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { name, grade_level, section_type, capacity, adviser_id, min_average, max_average, is_active } = req.body;

    const existing = await query<RowDataPacket[]>("SELECT id FROM sections WHERE id = ?", [id]);
    if (existing.length === 0) {
      res.status(404).json({ error: "Section not found." });
      return;
    }

    // new_requirement.txt R6 + R10: adviser must be a teacher, may advise at
    // most one section, and every change is logged old -> new.
    if (adviser_id !== undefined) {
      const rows = await query<RowDataPacket[]>(
        "SELECT adviser_id, name FROM sections WHERE id = ?",
        [id]
      );
      const currentAdviser = Number(rows[0].adviser_id) || null;
      const adviserError = await advisersErrorIfInvalid(adviser_id, Number(id));
      if (adviserError) {
        res.status(409).json({ error: adviserError });
        return;
      }
      const newAdviser = Number(adviser_id) || null;
      if (newAdviser !== currentAdviser) {
        const names = await query<RowDataPacket[]>(
          `SELECT id, name FROM users WHERE id IN (${[currentAdviser, newAdviser]
            .filter((n) => n != null)
            .map(() => "?")
            .join(",") || "NULL"})`,
          [currentAdviser, newAdviser].filter((n) => n != null)
        );
        const findName = (uid: number | null) =>
          uid == null ? null : String(names.find((r) => Number(r.id) === uid)?.name ?? `user ${uid}`);
        const oldName = findName(currentAdviser);
        const newName = findName(newAdviser);
        await logActivity(
          req.user!.userId,
          `Changed adviser of section "${rows[0].name}": ${oldName ?? "(none)"} -> ${newName ?? "(none)"}`,
          "sections",
          id
        );
      }
    }

    const fields: string[] = [];
    const params: any[] = [];

    if (name !== undefined) { fields.push("name = ?"); params.push(name); }
    if (grade_level !== undefined) { fields.push("grade_level = ?"); params.push(grade_level); }
    if (section_type !== undefined) { fields.push("section_type = ?"); params.push(section_type); }
    if (capacity !== undefined) { fields.push("capacity = ?"); params.push(capacity); }
    if (min_average !== undefined) { fields.push("min_average = ?"); params.push(min_average); }
    if (max_average !== undefined) { fields.push("max_average = ?"); params.push(max_average); }
    if (adviser_id !== undefined) { fields.push("adviser_id = ?"); params.push(adviser_id); }
    if (is_active !== undefined) { fields.push("is_active = ?"); params.push(is_active); }

    if (fields.length === 0) {
      res.status(400).json({ error: "No fields to update." });
      return;
    }

    params.push(id);
    await query<ResultSetHeader>(`UPDATE sections SET ${fields.join(", ")} WHERE id = ?`, params);
    await logActivity(req.user!.userId, `Updated section ID ${id}`, "sections", id);

    const updated = await query<SectionRow[]>("SELECT * FROM sections WHERE id = ?", [id]);
    res.json(updated[0]);
  } catch (error) {
    console.error("Update section error:", error);
    res.status(500).json({ error: "Failed to update section." });
  }
}

/**
 * DELETE /api/sections/:id — Delete section
 */
export async function deleteSection(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await query<RowDataPacket[]>("SELECT id, name FROM sections WHERE id = ?", [id]);
    if (existing.length === 0) {
      res.status(404).json({ error: "Section not found." });
      return;
    }

    await query<ResultSetHeader>("DELETE FROM sections WHERE id = ?", [id]);
    await logActivity(req.user!.userId, `Deleted section "${existing[0].name}"`, "sections", id);

    res.json({ message: "Section deleted successfully." });
  } catch (error) {
    console.error("Delete section error:", error);
    res.status(500).json({ error: "Failed to delete section." });
  }
}

/* =========================================================================
 * Subject teachers per section (docs/new_requirement.txt R1-R10)
 *
 * A grade belongs to ONE teacher, ONE subject and ONE section; the adviser
 * designation alone gives no grading rights. Written by Section Creation
 * (Administrator + Registrar), read by the teacher class lists (Phase C).
 * ========================================================================= */

/** Section types whose extra subjects live on subject.program (R2). */
const SECTION_PROGRAM_TYPES = new Set(["ste", "spfl", "spj", "sned"]);

/**
 * R6 helper — returns an error message or null.
 *  - the adviser must be an existing user with the Teacher role
 *  - one teacher advises at most one section (decide 10.9-5, hard error);
 *    this call ignores the section identified by currentSectionId
 */
async function advisersErrorIfInvalid(
  adviserId: unknown,
  currentSectionId: number | null
): Promise<string | null> {
  const uid = Number(adviserId);
  if (!adviserId || !Number.isInteger(uid) || uid <= 0) return null; // optional field
  const userRows = await query<RowDataPacket[]>(
    "SELECT id, name, role, status FROM users WHERE id = ? LIMIT 1",
    [uid]
  );
  if (userRows.length === 0) return `User ${uid} does not exist.`;
  if (userRows[0].role !== "teacher") {
    return `"${userRows[0].name}" is not a Teacher. Only teachers can be advisers.`;
  }
  if (userRows[0].status && userRows[0].status !== "active") {
    return `"${userRows[0].name}" is ${userRows[0].status} — an inactive account cannot be an adviser.`;
  }
  const conflict = await query<RowDataPacket[]>(
    `SELECT id, name FROM sections
      WHERE adviser_id = ? AND is_active = 1 AND id <> COALESCE(?, 0)
      LIMIT 1`,
    [uid, currentSectionId]
  );
  if (conflict.length > 0) {
    return `"${userRows[0].name}" is already the adviser of "${conflict[0].name}". One teacher can advise only one section.`;
  }
  return null;
}

/** Closed school years keep their assignments as history (R9). */
async function schoolYearOpenError(syId: number): Promise<string | null> {
  const rows = await query<RowDataPacket[]>(
    "SELECT id, sy_label, is_current, enrollment_open FROM school_years WHERE id = ? LIMIT 1",
    [syId]
  );
  if (rows.length === 0) return `School year ${syId} does not exist.`;
  const sy = rows[0];
  if (Number(sy.is_current) === 1 || Number(sy.enrollment_open) === 1) return null;
  return `School year ${sy.sy_label} is closed — its assignments stay as history. Edit the current school year (or one whose enrollment window is open).`;
}

/**
 * Master-Schedule overlap warnings (R7 — warn only, never block). A teacher
 * assigned here who already has schedule rows in another section at an
 * overlapping day/time (same school year) produces a warning string.
 */
async function scheduleConflictWarnings(
  section: { id: number; name: string },
  teacherIds: number[],
  schoolYearId: number
): Promise<string[]> {
  const warnings: string[] = [];
  if (teacherIds.length === 0) return warnings;
  const placeholders = teacherIds.map(() => "?").join(",");
  const mine = await query<RowDataPacket[]>(
    `SELECT sc.teacher_id, sc.day_of_week, sc.start_time, sc.end_time, sec.name AS section_name
       FROM schedules sc
       JOIN sections sec ON sec.id = sc.section_id
      WHERE sc.school_year_id = ? AND sc.teacher_id IN (${placeholders})
        AND sec.id <> ?`,
    [schoolYearId, ...teacherIds, section.id]
  );
  if (mine.length === 0) return warnings;
  const here = await query<RowDataPacket[]>(
    `SELECT teacher_id, subject_id, day_of_week, start_time, end_time
       FROM schedules WHERE school_year_id = ? AND section_id = ?`,
    [schoolYearId, section.id]
  );
  const userNames = await query<RowDataPacket[]>(
    `SELECT id, name FROM users WHERE id IN (${placeholders})`,
    teacherIds
  );
  const teacherName = (uid: number) =>
    String(userNames.find((u) => Number(u.id) === uid)?.name ?? `user ${uid}`);
  for (const row of here) {
    if (!teacherIds.includes(Number(row.teacher_id))) continue;
    for (const other of mine) {
      if (Number(other.teacher_id) !== Number(row.teacher_id)) continue;
      if (Number(other.day_of_week) !== Number(row.day_of_week)) continue;
      const overlap = String(row.start_time) < String(other.end_time) && String(other.start_time) < String(row.end_time);
      if (overlap) {
        warnings.push(
          `${teacherName(Number(row.teacher_id))} also teaches in "${other.section_name}" on the same schedule slot (day ${row.day_of_week}, ${row.start_time}–${row.end_time}) — this is allowed but may overlap the Master Schedule.`
        );
      }
    }
  }
  return warnings;
}

/**
 * Teaching-load maximum (R7 item 7 — warn only, never block; the
 * Administrator can still save). A teacher whose per-section-subject
 * assignments sum to more than 30 weekly hours (≈6 h/day × 5 days — the
 * decided school maximum) produces a warning string.
 */
async function teachingLoadWarnings(
  teacherIds: number[],
  schoolYearId: number
): Promise<string[]> {
  const warnings: string[] = [];
  if (teacherIds.length === 0) return warnings;
  const MAX_WEEKLY_HOURS = 30;
  const placeholders = teacherIds.map(() => "?").join(",");
  const rows = await query<RowDataPacket[]>(
    `SELECT sta.teacher_id, u.name AS teacher_name,
            COALESCE(SUM(s.hours_per_week), 0) AS weekly_hours
       FROM section_teacher_assignments sta
       JOIN users u ON u.id = sta.teacher_id
       JOIN subjects s ON s.id = sta.subject_id
      WHERE sta.school_year_id = ? AND sta.teacher_id IN (${placeholders})
      GROUP BY sta.teacher_id, u.name`,
    [schoolYearId, ...teacherIds]
  );
  for (const r of rows) {
    const h = Number(r.weekly_hours);
    if (h > MAX_WEEKLY_HOURS) {
      warnings.push(
        `${r.teacher_name}'s total teaching load is now ${h} hours/week — above the ${MAX_WEEKLY_HOURS} hour maximum. Saved, but flagged for review.`
      );
    }
  }
  return warnings;
}

/** Subjects eligible for a section's Subject Teachers part (R2). */
async function sectionSubjectCatalog(gradeLevel: number, sectionType: string) {
  return query<RowDataPacket[]>(
    `SELECT s.id, s.name, s.subject_type, s.subject_group, s.program, s.hours_per_week
       FROM subjects s
      WHERE s.is_active = 1
        AND s.grade_level = ?
        AND (s.subject_type IS NULL OR s.subject_type <> 'elective')
        AND (s.program IS NULL OR (s.program IN ('${[...SECTION_PROGRAM_TYPES].join("','")}') AND s.program = ?))
      ORDER BY s.name ASC`,
    [gradeLevel, sectionType]
  );
}

/**
 * GET /api/sections/subject-catalog?grade_level=&section_type=
 * The grade+program subject list for the Subject Teachers part of Section
 * Creation WITHOUT needing an existing section id (create mode). Electives
 * are excluded (R5) — they are assigned on the elective offering.
 */
export async function getSubjectCatalog(req: Request, res: Response): Promise<void> {
  try {
    const gradeLevel = Number(req.query.grade_level);
    const sectionType = String(req.query.section_type ?? "");
    if (!Number.isInteger(gradeLevel) || gradeLevel <= 0 || !sectionType) {
      res.status(400).json({ error: "grade_level and section_type are required." });
      return;
    }
    const catalog = await sectionSubjectCatalog(gradeLevel, sectionType);
    res.json(catalog);
  } catch (error) {
    console.error("Subject catalog error:", error);
    res.status(500).json({ error: "Failed to fetch the subject catalog." });
  }
}

/**
 * GET /api/sections/:id/teachers?school_year_id=
 * Returns { subjects: [{subject..., teacher_ids, teachers:[{id,name}]}],
 *           warnings: [] } — the Section Creation "Subject Teachers part".
 */
export async function getSectionTeachers(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const schoolYearId = Number(req.query.school_year_id);
    if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
      res.status(400).json({ error: "school_year_id is required." });
      return;
    }
    const sections = await query<RowDataPacket[]>(
      "SELECT id, name, grade_level, section_type, adviser_id, capacity, min_average, max_average FROM sections WHERE id = ?",
      [id]
    );
    if (sections.length === 0) {
      res.status(404).json({ error: "Section not found." });
      return;
    }
    const section = sections[0];
    const catalog = await sectionSubjectCatalog(Number(section.grade_level), String(section.section_type));
    const rows = await query<RowDataPacket[]>(
      `SELECT sta.subject_id, sta.teacher_id, u.name AS teacher_name
         FROM section_teacher_assignments sta
         JOIN users u ON u.id = sta.teacher_id
        WHERE sta.section_id = ? AND sta.school_year_id = ?`,
      [id, schoolYearId]
    );
    const subjects = catalog.map((sub: any) => {
      const mine = rows.filter(
        (r: any) => Number(r.subject_id) === Number(sub.id)
      ) as any[];
      return {
        ...sub,
        teacher_ids: mine.map((r) => Number(r.teacher_id)),
        teachers: mine.map((r) => ({ id: Number(r.teacher_id), name: String(r.teacher_name) })),
      };
    });
    res.json({ section, school_year_id: schoolYearId, subjects });
  } catch (error) {
    console.error("Get section teachers error:", error);
    res.status(500).json({ error: "Failed to fetch section teachers." });
  }
}

/**
 * PUT /api/sections/:id/teachers  (R2, R3, R5, R9, R10)
 * Body: { school_year_id, assignments: [{ subject_id, teacher_ids: number[] }] }
 * Full replace for this section + school year. Every add/remove is logged
 * (actor, section, subject, old -> new, timestamp). Elective subjects are
 * refused here — they are assigned on the elective offering (R5).
 */
export async function updateSectionTeachers(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const schoolYearId = Number(req.body?.school_year_id);
    const assignments = Array.isArray(req.body?.assignments) ? req.body.assignments : null;
    // Missing assignments key = keep stored rows as-is; [] = clear them all.
    const wantsReplace = assignments !== null;
    if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
      res.status(400).json({ error: "school_year_id is required." });
      return;
    }
    const closed = await schoolYearOpenError(schoolYearId);
    if (closed) {
      res.status(403).json({ error: closed });
      return;
    }
    const sections = await query<RowDataPacket[]>(
      "SELECT id, name, grade_level, section_type FROM sections WHERE id = ?",
      [id]
    );
    if (sections.length === 0) {
      res.status(404).json({ error: "Section not found." });
      return;
    }
    const section = sections[0];

    // Validate the incoming list
    type Item = { subject_id: number; teacher_ids: number[] };
    const items: Item[] = [];
    if (assignments !== null) {
      for (const a of assignments) {
        const subjectId = Number(a?.subject_id);
        if (!Number.isInteger(subjectId) || subjectId <= 0) {
          res.status(400).json({ error: "Each assignment needs a subject_id." });
          return;
        }
        const teacherIds = (Array.isArray(a?.teacher_ids) ? a.teacher_ids : [])
          .map((t: unknown) => Number(t))
          .filter((t: number) => Number.isInteger(t) && t > 0);
        items.push({ subject_id: subjectId, teacher_ids: teacherIds });
      }
    }
    // Duplicated subject rows are a client bug; keep the section consistent.
    const seenSubjects = new Set<number>();
    for (const item of items) {
      if (seenSubjects.has(item.subject_id)) {
        res.status(400).json({ error: `Duplicate subject_id ${item.subject_id} in assignments.` });
        return;
      }
      seenSubjects.add(item.subject_id);
    }

    // Every submitted subject must be section-eligible (grade+program + not an elective)
    if (items.length > 0) {
      const ph = items.map(() => "?").join(",");
      const subs = await query<RowDataPacket[]>(
        `SELECT s.id, s.name, s.program, s.subject_type, s.is_active, s.grade_level
           FROM subjects s WHERE s.id IN (${ph})`,
        items.map((i) => i.subject_id)
      );
      const byId = new Map(subs.map((s: any) => [Number(s.id), s]));
      for (const item of items) {
        const sub: any = byId.get(item.subject_id);
        if (!sub) {
          res.status(400).json({ error: `Subject ${item.subject_id} does not exist.` });
          return;
        }
        if (!sub.is_active) {
          res.status(400).json({ error: `Subject "${sub.name}" is deactivated.` });
          return;
        }
        if (sub.grade_level !== Number(section.grade_level)) {
          res.status(400).json({
            error: `Subject "${sub.name}" belongs to Grade ${sub.grade_level}, not this section's Grade ${section.grade_level}.`,
          });
          return;
        }
        if (sub.subject_type === "elective") {
          res.status(400).json({
            error: `Elective subjects are never assigned in sections (R5). "${sub.name}" belongs on Subject Management > Elective Offerings.`,
          });
          return;
        }
        const prog = sub.program ? String(sub.program) : null;
        const allowed = prog === null || (SECTION_PROGRAM_TYPES.has(prog) && prog === String(section.section_type));
        if (!allowed) {
          res.status(400).json({
            error: `Subject "${sub.name}" (program ${prog ?? "shared"}) does not belong in a ${section.section_type} section.`,
          });
          return;
        }
      }
      // Teachers must exist and be real teachers
      const allTeachers = [...new Set(items.flatMap((i) => i.teacher_ids))];
      if (allTeachers.length > 0) {
        const tph = allTeachers.map(() => "?").join(",");
        const teachers = await query<RowDataPacket[]>(
          `SELECT id, name, role FROM users WHERE id IN (${tph})`,
          allTeachers
        );
        const byT = new Map(teachers.map((t: any) => [Number(t.id), t]));
        for (const tid of allTeachers) {
          const t: any = byT.get(tid);
          if (!t) {
            res.status(400).json({ error: `Teacher ${tid} does not exist.` });
            return;
          }
          if (t.role !== "teacher") {
            res.status(400).json({ error: `"${t.name}" is not a Teacher — only teachers can hold subject assignments.` });
            return;
          }
        }
      }
    }

    // Diff against the stored rows so every change is logged old -> new (R10)
    const current = await query<RowDataPacket[]>(
      `SELECT sta.id, sta.subject_id, sta.teacher_id, u.name AS teacher_name, s.name AS subject_name
         FROM section_teacher_assignments sta
         JOIN users u ON u.id = sta.teacher_id
         JOIN subjects s ON s.id = sta.subject_id
        WHERE sta.section_id = ? AND sta.school_year_id = ?`,
      [id, schoolYearId]
    );
    const nameOf = new Map<number, string>(
      current.map((r: any) => [Number(r.teacher_id), String(r.teacher_name)])
    );
    const subjectOf = new Map<number, string>(current.map((r: any) => [Number(r.subject_id), String(r.subject_name)]));
    for (const item of items) {
      if (!subjectOf.has(item.subject_id)) {
        const sub = await query<RowDataPacket[]>("SELECT name FROM subjects WHERE id = ?", [item.subject_id]);
        if (sub.length > 0) subjectOf.set(item.subject_id, String(sub[0].name));
      }
    }
    for (const item of items) {
      for (const tid of item.teacher_ids) {
        if (!nameOf.has(tid)) {
          const u = await query<RowDataPacket[]>("SELECT name FROM users WHERE id = ?", [tid]);
          if (u.length > 0) nameOf.set(tid, String(u[0].name));
        }
      }
    }
    const keyOf = (sid: number, tid: number) => `${sid}|${tid}`;
    const currentKeys = new Set(current.map((r: any) => keyOf(Number(r.subject_id), Number(r.teacher_id))));
    const targetSet = new Set<string>();
    for (const item of items) {
      for (const tid of item.teacher_ids) targetSet.add(keyOf(item.subject_id, tid));
    }

    const removalIds: number[] = [];
    if (wantsReplace) {
      for (const r of current) {
        const k = keyOf(Number(r.subject_id), Number(r.teacher_id));
        if (!targetSet.has(k)) removalIds.push(Number(r.id));
      }
    }
    const additions: { subject_id: number; teacher_id: number }[] = [];
    if (wantsReplace) {
      for (const item of items) {
        for (const tid of item.teacher_ids) {
          const k = keyOf(item.subject_id, tid);
          if (!currentKeys.has(k) && !targetSet.has(`dup:${k}`)) {
            if (!additions.some((a) => a.subject_id === item.subject_id && a.teacher_id === tid)) {
              additions.push({ subject_id: item.subject_id, teacher_id: tid });
            }
          }
        }
      }
    }

    if (removalIds.length > 0) {
      await query<ResultSetHeader>(
        `DELETE FROM section_teacher_assignments WHERE id IN (${removalIds.map(() => "?").join(",")})`,
        removalIds
      );
      for (const r of current) {
        const k = keyOf(Number(r.subject_id), Number(r.teacher_id));
        if (!targetSet.has(k)) {
          await logActivity(
            req.user!.userId,
            `Unassigned teacher "${r.teacher_name}" from "${r.subject_name}" in "${section.name}"`,
            "section_teacher_assignments",
            id
          );
        }
      }
    }
    for (const a of additions) {
      await query<ResultSetHeader>(
        `INSERT INTO section_teacher_assignments (section_id, subject_id, teacher_id, school_year_id)
         VALUES (?, ?, ?, ?)`,
        [id, a.subject_id, a.teacher_id, schoolYearId]
      );
      await logActivity(
        req.user!.userId,
        `Assigned teacher "${nameOf.get(a.teacher_id)}" to "${subjectOf.get(a.subject_id)}" in "${section.name}"`,
        "section_teacher_assignments",
        id
      );
    }

    // R7 — Master-Schedule overlap warnings (warn only)
    const warnings = wantsReplace
      ? [
          ...(await scheduleConflictWarnings(
            { id: Number(id), name: String(section.name) },
            [...new Set(items.flatMap((i) => i.teacher_ids))],
            schoolYearId
          )),
          // Teaching-load maximum (R7 item 7 — warn only)
          ...(await teachingLoadWarnings(
            [...new Set(items.flatMap((i) => i.teacher_ids))],
            schoolYearId
          )),
        ]
      : [];

    res.json({ id: Number(id), added: additions.length, removed: removalIds.length, warnings });
  } catch (error) {
    console.error("Update section teachers error:", error);
    res.status(500).json({ error: "Failed to save section teachers." });
  }
}

/**
 * R4 — POST /api/sections/teachers/apply
 * Body: { school_year_id, subject_id, teacher_ids, section_ids }
 * One subject's teacher(s) applied to several sections in one save (per the
 * client's "Math 7 in 7-A to 7-F" example). Same validation as the single
 * PUT, plus per-section checks.
 */
export async function applyTeacherToSections(req: Request, res: Response): Promise<void> {
  try {
    const schoolYearId = Number(req.body?.school_year_id);
    const subjectId = Number(req.body?.subject_id);
    const teacherIds: number[] = (req.body?.teacher_ids ?? []).map(Number).filter(Number.isInteger);
    const sectionIds: number[] = (req.body?.section_ids ?? []).map(Number).filter(Number.isInteger);
    if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
      res.status(400).json({ error: "school_year_id is required." });
      return;
    }
    const closed = await schoolYearOpenError(schoolYearId);
    if (closed) {
      res.status(403).json({ error: closed });
      return;
    }
    if (!Number.isInteger(subjectId) || subjectId <= 0) {
      res.status(400).json({ error: "subject_id is required." });
      return;
    }
    if (teacherIds.length === 0 || sectionIds.length === 0) {
      res.status(400).json({ error: "teacher_ids and section_ids must not be empty." });
      return;
    }
    const subjectRows = await query<RowDataPacket[]>(
      "SELECT id, name, grade_level, program, subject_type, is_active FROM subjects WHERE id = ?",
      [subjectId]
    );
    if (subjectRows.length === 0) {
      res.status(404).json({ error: "Subject not found." });
      return;
    }
    const subject = subjectRows[0];
    if (!subject.is_active) {
      res.status(400).json({ error: `Subject "${subject.name}" is deactivated.` });
      return;
    }
    if (subject.subject_type === "elective") {
      res.status(400).json({
        error: "Elective subjects are never assigned in sections (R5) — assign teachers on the elective offering in Subject Management.",
      });
      return;
    }
    const assigned: number[] = [];
    const skipped: { section_id: number; reason: string }[] = [];
    let sectionName = "";
    for (const sid of sectionIds) {
      const sRows = await query<RowDataPacket[]>(
        "SELECT id, name, grade_level, section_type FROM sections WHERE id = ?",
        [sid]
      );
      if (sRows.length === 0) {
        skipped.push({ section_id: sid, reason: "Section not found" });
        continue;
      }
      const s = sRows[0];
      sectionName = String(s.name);
      if (Number(s.grade_level) !== Number(subject.grade_level)) {
        skipped.push({ section_id: sid, reason: `Grade ${s.grade_level} does not teach this subject (Grade ${subject.grade_level})` });
        continue;
      }
      const prog = subject.program ? String(subject.program) : null;
      const allowed = prog === null || (SECTION_PROGRAM_TYPES.has(prog) && prog === String(s.section_type));
      if (!allowed) {
        skipped.push({ section_id: sid, reason: `Subject program ${prog ?? "shared"} does not match a ${s.section_type} section` });
        continue;
      }
      let changed = false;
      for (const tid of teacherIds) {
        const u = await query<RowDataPacket[]>("SELECT id, name, role FROM users WHERE id = ?", [tid]);
        if (u.length === 0 || u[0].role !== "teacher") continue;
        const dup = await query<RowDataPacket[]>(
          "SELECT id FROM section_teacher_assignments WHERE section_id = ? AND subject_id = ? AND teacher_id = ? AND school_year_id = ?",
          [sid, subjectId, tid, schoolYearId]
        );
        if (dup.length > 0) continue;
        await query<ResultSetHeader>(
          `INSERT INTO section_teacher_assignments (section_id, subject_id, teacher_id, school_year_id)
           VALUES (?, ?, ?, ?)`,
          [sid, subjectId, tid, schoolYearId]
        );
        changed = true;
      }
      if (changed) {
        assigned.push(sid);
        const nameRows = await query<RowDataPacket[]>(
          `SELECT u.name FROM users u WHERE u.id IN (${teacherIds.map(() => "?").join(",")})`,
          teacherIds
        );
        await logActivity(
          req.user!.userId,
          `Assigned teacher${teacherIds.length === 1 ? "" : "s"} "${nameRows.map((n: any) => n.name).join('", "')}" to "${subject.name}" in "${sectionName}" (applied across sections)`,
          "section_teacher_assignments",
          sid
        );
      }
    }
    const warnings = [
      ...(await scheduleConflictWarnings(
        { id: -1, name: "(" + sectionIds.join(", ") + ")" },
        teacherIds,
        schoolYearId
      )),
      // Teaching-load maximum (R7 item 7 — warn only)
      ...(await teachingLoadWarnings(teacherIds, schoolYearId)),
    ];
    res.json({ assigned, skipped, warnings });
  } catch (error) {
    console.error("Apply teacher across sections error:", error);
    res.status(500).json({ error: "Failed to apply teacher to sections." });
  }
}

/**
 * R8 — GET /api/sections/teaching-coverage?school_year_id=
 * Per active section: how many of its grade-level subjects still have no
 * teacher, so administrators see what is missing before grading starts.
 */
export async function getTeachingCoverage(req: Request, res: Response): Promise<void> {
  try {
    const schoolYearId = Number(req.query.school_year_id);
    if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
      res.status(400).json({ error: "school_year_id is required." });
      return;
    }
    // One query: per active section, the section-eligible (grade + program,
    // elective-free — R2/R5) subject count and how many of them have no
    // section-subject teacher for this school year. Places are positional
    // because MySQL correlated subqueries need the values twice.
    const rows = await query<RowDataPacket[]>(
      `SELECT sec.id,
              sec.name,
              sec.grade_level,
              sec.section_type,
              (SELECT COUNT(*) FROM subjects s
                 WHERE s.is_active = 1
                   AND s.grade_level = sec.grade_level
                   AND (s.subject_type IS NULL OR s.subject_type <> 'elective')
                   AND (s.program IS NULL OR (s.program IN ('ste','spfl','spj','sned') AND s.program = sec.section_type))) AS subjects_total,
              (SELECT COUNT(*) FROM subjects s
                 WHERE s.is_active = 1
                   AND s.grade_level = sec.grade_level
                   AND (s.subject_type IS NULL OR s.subject_type <> 'elective')
                   AND (s.program IS NULL OR (s.program IN ('ste','spfl','spj','sned') AND s.program = sec.section_type))
                   AND NOT EXISTS (
                     SELECT 1 FROM section_teacher_assignments sta
                      WHERE sta.section_id = sec.id
                        AND sta.subject_id = s.id
                        AND sta.school_year_id = ?)) AS subjects_without_teacher
         FROM sections sec
        WHERE sec.is_active = 1
        ORDER BY sec.grade_level, sec.name`,
      [schoolYearId]
    );
    const out = rows
      .map((r) => ({
        section_id: Number(r.id),
        name: String(r.name),
        grade_level: Number(r.grade_level),
        section_type: String(r.section_type),
        subjects_total: Number(r.subjects_total),
        subjects_without_teacher: Number(r.subjects_without_teacher),
      }))
      .filter((r) => r.subjects_total > 0);
    res.json(out);
  } catch (error) {
    console.error("Teaching coverage error:", error);
    res.status(500).json({ error: "Failed to compute teaching coverage." });
  }
}

/**
 * R9 — POST /api/sections/teachers/copy-previous-year
 * Body: { from_school_year_id, to_school_year_id, overwrite?: boolean }
 * Administrator opt-in: copies each section's subject-teacher rows (matched
 * by section name across years) into the new school year. Advisers are NOT
 * copied because sections.adviser_id spans years — the adviser is set on the
 * section itself. Every copy is logged.
 */
export async function copyTeacherAssignments(req: Request, res: Response): Promise<void> {
  try {
    const from = Number(req.body?.from_school_year_id);
    const to = Number(req.body?.to_school_year_id);
    if (!Number.isInteger(from) || from <= 0 || !Number.isInteger(to) || to <= 0 || from === to) {
      res.status(400).json({ error: "from_school_year_id and to_school_year_id must be different existing years." });
      return;
    }
    const closed = await schoolYearOpenError(to);
    if (closed) {
      res.status(403).json({ error: closed });
      return;
    }
    const labels = await query<RowDataPacket[]>(
      `SELECT id, sy_label FROM school_years WHERE id IN (?, ?)`,
      [from, to]
    );
    if (labels.length < 2) {
      res.status(404).json({ error: "Source or target school year not found." });
      return;
    }
    const toLabel = String(labels.find((r: any) => Number(r.id) === to)?.sy_label ?? to);
    const fromLabel = String(labels.find((r: any) => Number(r.id) === from)?.sy_label ?? from);
    const sourceCount = await query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM section_teacher_assignments WHERE school_year_id = ?",
      [from]
    );
    if (Number(sourceCount[0]?.n) === 0) {
      // Do not wipe the target when there is nothing to copy.
      res.json({ copied: 0, sections_touched: 0, message: `No subject-teacher assignments exist in ${fromLabel}.` });
      return;
    }
    if (req.body.overwrite) {
      await query<ResultSetHeader>(
        "DELETE FROM section_teacher_assignments WHERE school_year_id = ?",
        [to]
      );
    }
    const rows = await query<RowDataPacket[]>(
      `SELECT sta.section_id, sta.subject_id, sta.teacher_id
         FROM section_teacher_assignments sta
         JOIN sections src ON src.id = sta.section_id
        WHERE sta.school_year_id = ?`,
      [from]
    );
    if (rows.length === 0) {
      res.json({ copied: 0, sections_touched: 0, message: `No subject-teacher assignments exist in ${fromLabel}.` });
      return;
    }
    // Match sections across years by name (section names are unique per school).
    const targetSections = await query<RowDataPacket[]>("SELECT id, name FROM sections");
    const byNameId = new Map(
      targetSections.map((s: any) => [String(s.name).toUpperCase().trim(), Number(s.id)])
    );
    const srcNames = await query<RowDataPacket[]>(
      `SELECT id, name FROM sections WHERE id IN (SELECT DISTINCT section_id FROM section_teacher_assignments WHERE school_year_id = ?)`,
      [from]
    );
    const srcIdName = new Map(srcNames.map((s: any) => [Number(s.id), String(s.name)]));
    let copied = 0;
    const sectionsTouched = new Set<number>();
    const skippedNoMatch: string[] = [];
    for (const row of rows) {
      const srcName = srcIdName.get(Number(row.section_id));
      if (!srcName) continue;
      const targetId = byNameId.get(String(srcName).toUpperCase().trim());
      if (!targetId) {
        if (!skippedNoMatch.includes(String(srcName))) skippedNoMatch.push(String(srcName));
        continue;
      }
      const dup = await query<RowDataPacket[]>(
        `SELECT id FROM section_teacher_assignments
          WHERE section_id = ? AND subject_id = ? AND teacher_id = ? AND school_year_id = ?`,
        [targetId, Number(row.subject_id), Number(row.teacher_id), to]
      );
      if (dup.length > 0) continue;
      await query<ResultSetHeader>(
        `INSERT INTO section_teacher_assignments (section_id, subject_id, teacher_id, school_year_id)
         VALUES (?, ?, ?, ?)`,
        [targetId, Number(row.subject_id), Number(row.teacher_id), to]
      );
      copied++;
      sectionsTouched.add(targetId);
    }
    await logActivity(
      req.user!.userId,
      `Copied ${copied} subject-teacher assignment(s) from ${fromLabel} into ${toLabel}${req.body.overwrite ? " (overwrite)" : ""}`,
      "section_teacher_assignments",
      to
    );
    res.json({ copied, sections_touched: sectionsTouched.size, sections_without_match: skippedNoMatch });
  } catch (error) {
    console.error("Copy teacher assignments error:", error);
    res.status(500).json({ error: "Failed to copy teacher assignments." });
  }
}
