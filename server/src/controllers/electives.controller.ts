import { Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { validateElectivePick } from "../utils/shsCurriculum";

/**
 * Strengthened SHS Curriculum — elective catalog & per-learner assignments.
 *
 * Electives are subjects with `subject_type='elective'`, grouped under fixed
 * `elective_cluster` headings and track-scoped through `subject_strand_tracks`
 * (Academic / Technical-Professional). Availability per school year is stored
 * as exclusion rows in `elective_year_exclusions` (absence of a row = offered).
 * Learner picks live in `student_electives` — one assignment per learner,
 * subject and school year, belonging to the LEARNER, not the section.
 */

interface ElectiveSubjectRow extends RowDataPacket {
  id: number;
  name: string;
  grade_level: number;
  elective_cluster: string | null;
  is_offered: number | null;
}

interface ClusterRow extends RowDataPacket {
  id: number;
  name: string;
  code: string;
}

/**
 * GET /api/electives/catalog — Elective catalog grouped by track + fixed
 * cluster headings, honoring per-school-year on/off switches.
 * Query: ?school_year_id (defaults to current) & grade_level (11|12, optional —
 * when omitted, rows for BOTH grade levels are returned and the frontend
 * filters by grade_level, e.g. for the G11/G12 enrollment wizard).
 * Response: a flat array of groups —
 *   [{ track_id, track_name, cluster, subjects: [{ id, name, grade_level, is_offered }] }]
 * Access: any authenticated user.
 */
export async function getElectiveCatalog(req: Request, res: Response): Promise<void> {
  try {
    const gradeLevel = req.query.grade_level ? Number(req.query.grade_level) : null;
    if (gradeLevel !== null && ![11, 12].includes(gradeLevel)) {
      res.status(400).json({ error: "grade_level must be 11 or 12." });
      return;
    }

    let schoolYearId: number | null = req.query.school_year_id
      ? Number(req.query.school_year_id)
      : null;
    if (!schoolYearId) {
      const cur = await query<RowDataPacket[]>(
        "SELECT id FROM school_years WHERE is_current = 1 ORDER BY id DESC LIMIT 1"
      );
      schoolYearId = cur.length > 0 ? Number(cur[0].id) : null;
      if (!schoolYearId) {
        res.status(500).json({ error: "No current school year configured." });
        return;
      }
    }

    const tracks = await query<ClusterRow[]>(
      "SELECT id, name, code FROM strand_tracks WHERE track_type = 'shs_track' AND is_active = 1 ORDER BY sort_order ASC, name ASC"
    );
    if (tracks.length === 0) {
      res.status(500).json({ error: "No SHS tracks configured." });
      return;
    }

    const subjects = await query<ElectiveSubjectRow[]>(
      `SELECT s.id, s.name, s.grade_level, s.elective_cluster,
              (ex.subject_id IS NULL) AS is_offered
         FROM subjects s
         LEFT JOIN elective_year_exclusions ex
           ON ex.subject_id = s.id AND ex.school_year_id = ?
        WHERE s.is_active = 1
          AND s.subject_type = 'elective'
          AND s.grade_level IN (11, 12)
          ${gradeLevel !== null ? "AND s.grade_level = ?" : ""}
          AND s.program IS NULL
          AND EXISTS (
            SELECT 1 FROM subject_strand_tracks sst
            JOIN strand_tracks tFiltered ON tFiltered.id = sst.strand_track_id
            WHERE sst.subject_id = s.id AND tFiltered.track_type = 'shs_track'
          )
        ORDER BY s.elective_cluster ASC, s.name ASC`,
      gradeLevel !== null ? [schoolYearId, gradeLevel] : [schoolYearId]
    );

    const links = await query<RowDataPacket[]>(
      `SELECT sst.subject_id, sst.strand_track_id
         FROM subject_strand_tracks sst
         JOIN strand_tracks t ON t.id = sst.strand_track_id
        WHERE t.track_type = 'shs_track'
          AND sst.subject_id IN (${subjects.map(() => "?").join(",") || "0"})`,
      subjects.map((s) => s.id)
    );
    const subjectTracks = new Map<number, number[]>();
    for (const l of links) {
      const sid = Number(l.subject_id);
      subjectTracks.set(sid, [...(subjectTracks.get(sid) ?? []), Number(l.strand_track_id)]);
    }

    const result: {
      track_id: number;
      track_name: string;
      cluster: string;
      subjects: {
        id: number;
        name: string;
        grade_level: number;
        is_offered: number;
      }[];
    }[] = [];
    for (const track of tracks) {
      const clusters = new Map<
        string,
        { id: number; name: string; grade_level: number; is_offered: number }[]
      >();
      for (const s of subjects) {
        const owningTracks = subjectTracks.get(Number(s.id)) ?? [];
        if (!owningTracks.includes(Number(track.id))) continue;
        const heading = s.elective_cluster ?? "";
        if (!clusters.has(heading)) clusters.set(heading, []);
        clusters.get(heading)!.push({
          id: Number(s.id),
          name: s.name,
          grade_level: Number(s.grade_level),
          is_offered: Number(s.is_offered ?? 1) === 1 ? 1 : 0,
        });
      }
      for (const [cluster, groupSubjects] of clusters) {
        result.push({
          track_id: Number(track.id),
          track_name: track.name,
          cluster,
          subjects: groupSubjects,
        });
      }
    }

    res.json(result);
  } catch (error) {
    console.error("Elective catalog error:", error);
    res.status(500).json({ error: "Failed to load the elective catalog." });
  }
}

/** Shared validation for a proposed pick (subject exists, elective, offered). */
async function validatePick(
  subjectId: number,
  schoolYearId: number,
  gradeLevel: number
): Promise<string | null> {
  return validateElectivePick(subjectId, schoolYearId, gradeLevel);
}

/**
 * GET /api/electives/assignments?student_id&school_year_id — the learner's
 * elective picks. Access: any authenticated user.
 */
export async function getAssignments(req: Request, res: Response): Promise<void> {
  try {
    const { student_id, school_year_id } = req.query;
    if (!student_id || !school_year_id) {
      res.status(400).json({ error: "student_id and school_year_id are required." });
      return;
    }
    const rows = await query<RowDataPacket[]>(
      `SELECT se.id, se.subject_id, s.name, s.elective_cluster, se.strand_track_id, t.name AS track_name
         FROM student_electives se
         JOIN subjects s ON s.id = se.subject_id
         LEFT JOIN strand_tracks t ON t.id = se.strand_track_id
        WHERE se.student_id = ? AND se.school_year_id = ?
        ORDER BY s.name ASC`,
      [student_id, school_year_id]
    );
    res.json(rows);
  } catch (error) {
    console.error("Elective assignment list error:", error);
    res.status(500).json({ error: "Failed to load elective assignments." });
  }
}

/**
 * PUT /api/electives/assignments — replace a learner's elective picks.
 * Body: { student_id, school_year_id, subject_ids: number[] }
 * Access: admin, enrollment_committee, registrar (Reg-L / committee only per
 * the client guide). Logs old and new values in the Activity Log.
 */
export async function saveAssignments(req: Request, res: Response): Promise<void> {
  try {
    const { student_id, school_year_id, subject_ids } = req.body as {
      student_id?: number;
      school_year_id?: number;
      subject_ids?: unknown;
    };
    if (!student_id || !school_year_id || !Array.isArray(subject_ids)) {
      res.status(400).json({ error: "student_id, school_year_id and subject_ids array are required." });
      return;
    }
    const requested = [...new Set(
      subject_ids.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0)
    )];

    const student = await query<RowDataPacket[]>(
      "SELECT id, name, grade_level FROM students WHERE id = ?",
      [student_id]
    );
    if (student.length === 0) {
      res.status(404).json({ error: "Student not found." });
      return;
    }

    const enrollment = await query<RowDataPacket[]>(
      `SELECT program, strand_track_id, status FROM enrollments
        WHERE student_id = ? AND school_year_id = ?
        ORDER BY id DESC LIMIT 1`,
      [student_id, school_year_id]
    );
    if (enrollment.length === 0) {
      res.status(404).json({ error: "Student is not enrolled for this school year." });
      return;
    }
    const program = String(enrollment[0].program ?? "regular");
    const gradeLevel = Number(student[0].grade_level);

    // ALS keeps its own learning strands — tracks/clusters never apply to ALS.
    if (program.startsWith("als")) {
      res.status(400).json({ error: "Electives do not apply to ALS learners." });
      return;
    }
    if (gradeLevel < 11) {
      res.status(400).json({ error: "Electives apply only to Grade 11 and Grade 12." });
      return;
    }

    const errors: string[] = [];
    for (const sid of requested) {
      const problem = (await validatePick(sid, school_year_id, gradeLevel));
      if (problem) errors.push(problem);
    }
    if (errors.length > 0) {
      res.status(422).json({ error: errors[0], problems: errors });
      return;
    }

    const existing = await query<RowDataPacket[]>(
      `SELECT se.subject_id, s.name FROM student_electives se
         JOIN subjects s ON s.id = se.subject_id
        WHERE se.student_id = ? AND se.school_year_id = ?`,
      [student_id, school_year_id]
    );
    const oldNames = existing.map((r) => String(r.name)).sort();

    if (requested.length > 0) {
      // Confirm every requested id really is a same-row elective (belt & braces
      // after validatePick) then write everything in one transaction.
      await query(
        `INSERT INTO student_electives (student_id, school_year_id, subject_id, strand_track_id, assigned_by)
         VALUES ${requested.map(() => "(?, ?, ?, ?, ?)").join(", ")}
         ON DUPLICATE KEY UPDATE subject_id = VALUES(subject_id)`,
        requested.flatMap((sid) => [student_id, school_year_id, sid, enrollment[0].strand_track_id ?? null, req.user!.userId])
      );
    }
    await query(
      `DELETE FROM student_electives
        WHERE student_id = ? AND school_year_id = ?
          AND subject_id NOT IN (${requested.map(() => "?").join(",") || "0"})`,
      [student_id, school_year_id, ...requested]
    );

    const fresh = await query<RowDataPacket[]>(
      `SELECT s.name FROM student_electives se JOIN subjects s ON s.id = se.subject_id
        WHERE se.student_id = ? AND se.school_year_id = ? ORDER BY s.name ASC`,
      [student_id, school_year_id]
    );
    const newNames = fresh.map((r) => String(r.name));
    if (JSON.stringify(oldNames) !== JSON.stringify(newNames)) {
      await logActivity(
        req.user!.userId,
        `Updated electives for ${student[0].name}: [${oldNames.join(", ") || "none"}] → [${newNames.join(", ") || "none"}]`,
        "student_electives",
        String(student_id)
      );
    }

    res.json({ student_id, school_year_id, subject_ids: newNames });
  } catch (error) {
    console.error("Elective assignment save error:", error);
    res.status(500).json({ error: "Failed to save elective assignments." });
  }
}

/**
 * POST /api/electives/offerings/off — switch an elective OFF for a school year.
 * Body: { subject_id, school_year_id }. Access: admin.
 */
export async function excludeElective(req: Request, res: Response): Promise<void> {
  try {
    const { subject_id, school_year_id } = req.body as {
      subject_id?: number;
      school_year_id?: number;
    };
    if (!subject_id || !school_year_id) {
      res.status(400).json({ error: "subject_id and school_year_id are required." });
      return;
    }
    const subject = await query<RowDataPacket[]>(
      "SELECT name, subject_type FROM subjects WHERE id = ?",
      [subject_id]
    );
    if (subject.length === 0) {
      res.status(404).json({ error: "Subject not found." });
      return;
    }
    if (subject[0].subject_type !== "elective") {
      res.status(400).json({ error: "Only electives can be switched off for a school year." });
      return;
    }
    await query(
      `INSERT IGNORE INTO elective_year_exclusions (school_year_id, subject_id, excluded_by)
       VALUES (?, ?, ?)`,
      [school_year_id, subject_id, req.user!.userId]
    );
    await logActivity(
      req.user!.userId,
      `Switched elective OFF for school year #${school_year_id}: ${subject[0].name}`,
      "elective_year_exclusions",
      String(subject_id)
    );
    res.json({ subject_id, school_year_id, is_offered: false });
  } catch (error) {
    console.error("Elective exclusion error:", error);
    res.status(500).json({ error: "Failed to switch off the elective." });
  }
}

/**
 * POST /api/electives/offerings/on — switch an elective ON for a school year.
 * Body/query: { subject_id, school_year_id }. Access: admin.
 */
export async function restoreElective(req: Request, res: Response): Promise<void> {
  try {
    const subjectId = Number(req.query.subject_id ?? (req.body as { subject_id?: number }).subject_id);
    const schoolYearId = Number(
      req.query.school_year_id ?? (req.body as { school_year_id?: number }).school_year_id
    );
    if (!subjectId || !schoolYearId) {
      res.status(400).json({ error: "subject_id and school_year_id are required." });
      return;
    }
    const subject = await query<RowDataPacket[]>(
      "SELECT name FROM subjects WHERE id = ?",
      [subjectId]
    );
    if (subject.length === 0) {
      res.status(404).json({ error: "Subject not found." });
      return;
    }
    await query(
      "DELETE FROM elective_year_exclusions WHERE school_year_id = ? AND subject_id = ?",
      [schoolYearId, subjectId]
    );
    await logActivity(
      req.user!.userId,
      `Switched elective ON for school year #${schoolYearId}: ${subject[0].name}`,
      "elective_year_exclusions",
      String(subjectId)
    );
    res.json({ subject_id: subjectId, school_year_id: schoolYearId, is_offered: true });
  } catch (error) {
    console.error("Elective restore error:", error);
    res.status(500).json({ error: "Failed to switch on the elective." });
  }
}

/**
 * GET /api/electives/assignments/batch?school_year_id — every learner's
 * elective picks for one school year in a single response (SF1 remarks,
 * sectioning review pages). Access: any authenticated user.
 */
export async function getAssignmentsBatch(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const schoolYearId = Number(req.query.school_year_id);
    if (!schoolYearId) {
      res.status(400).json({ error: "school_year_id is required." });
      return;
    }
    const rows = await query<RowDataPacket[]>(
      `SELECT se.student_id, se.subject_id, s.name AS subject_name, s.elective_cluster
         FROM student_electives se
         JOIN subjects s ON s.id = se.subject_id
        WHERE se.school_year_id = ?
        ORDER BY se.student_id ASC, s.name ASC`,
      [schoolYearId]
    );
    res.json(rows);
  } catch (error) {
    console.error("Elective batch error:", error);
    res.status(500).json({ error: "Failed to load elective assignments." });
  }
}

/**
 * GET /api/electives/roster?subject_id&school_year_id — learners assigned to an
 * elective offering (may come from many sections). Access: teachers assigned to
 * the subject, plus admin / enrollment_committee / registrar / principal.
 */
export async function getElectiveRoster(req: Request, res: Response): Promise<void> {
  try {
    const subjectId = Number(req.query.subject_id);
    const schoolYearId = Number(req.query.school_year_id);
    if (!subjectId || !schoolYearId) {
      res.status(400).json({ error: "subject_id and school_year_id are required." });
      return;
    }

    if (req.user!.role === "teacher") {
      const assigned = await query<RowDataPacket[]>(
        `SELECT 1 FROM teacher_subject_assignments
          WHERE teacher_id = ? AND subject_id = ? AND (school_year_id = ? OR school_year_id IS NULL)
          LIMIT 1`,
        [req.user!.userId, subjectId, schoolYearId]
      );
      if (assigned.length === 0) {
        res.status(403).json({ error: "You are not assigned to this elective." });
        return;
      }
    }

    const subject = await query<RowDataPacket[]>(
      "SELECT name, subject_type FROM subjects WHERE id = ?",
      [subjectId]
    );
    if (subject.length === 0) {
      res.status(404).json({ error: "Subject not found." });
      return;
    }

    // Non-elective subjects keep the existing section rosters (See /students
    // my-students and the gradebook endpoints) — only electives rosters
    // individual picks across sections here.
    if (subject[0].subject_type !== "elective") {
      res.status(400).json({ error: "Rosters for non-elective subjects are section-based." });
      return;
    }

    const roster = await query<RowDataPacket[]>(
      `SELECT st.id AS student_id, st.name, st.student_id, st.grade_level, st.lrn,
              sec.id AS section_id, sec.name AS section_name, sy.sy_label
         FROM student_electives se
         JOIN students st ON st.id = se.student_id AND st.is_archived = 0
         JOIN school_years sy ON sy.id = se.school_year_id
         LEFT JOIN enrollments e
           ON e.student_id = se.student_id AND e.school_year_id = se.school_year_id AND e.status = 'enrolled'
         LEFT JOIN sections sec ON sec.id = e.section_id
        WHERE se.subject_id = ? AND se.school_year_id = ?
        ORDER BY st.name ASC`,
      [subjectId, schoolYearId]
    );
    res.json(roster);
  } catch (error) {
    console.error("Elective roster error:", error);
    res.status(500).json({ error: "Failed to load the elective roster." });
  }
}
