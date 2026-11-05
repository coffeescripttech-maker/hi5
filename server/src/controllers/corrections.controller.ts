import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { teacherCanEditStudentSubject } from "../utils/teacherGrants";
import { RowDataPacket, ResultSetHeader } from "mysql2";

/**
 * GET /api/grades/corrections — List correction requests
 * Query: ?status=pending&student_id=1
 */
export async function listCorrections(req: Request, res: Response): Promise<void> {
  try {
    const { status, student_id, school_year_id } = req.query;

    let sql = `
      SELECT gcr.*, s.name AS student_name, s.student_id,
             COALESCE(sub.name, 'All subjects') AS subject_name,
             sy.sy_label,
             req.name AS requested_by_name,
             rev.name AS reviewed_by_name
      FROM grade_correction_requests gcr
      JOIN students s ON gcr.student_id = s.id
      LEFT JOIN subjects sub ON gcr.subject_id = sub.id
      JOIN school_years sy ON gcr.school_year_id = sy.id
      JOIN users req ON gcr.requested_by = req.id
      LEFT JOIN users rev ON gcr.reviewed_by = rev.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (status) { conditions.push("gcr.status = ?"); params.push(status); }
    if (student_id) { conditions.push("gcr.student_id = ?"); params.push(parseInt(student_id as string)); }
    if (school_year_id) { conditions.push("gcr.school_year_id = ?"); params.push(parseInt(school_year_id as string)); }

    // Teachers only see their own requests; admin/registrar see all
    if (req.user!.role === "teacher") {
      conditions.push("gcr.requested_by = ?");
      params.push(req.user!.userId);
    }

    if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY gcr.created_at DESC";

    const corrections = await query<RowDataPacket[]>(sql, params);
    res.json(corrections);
  } catch (error) {
    console.error("List corrections error:", error);
    res.status(500).json({ error: "Failed to fetch correction requests." });
  }
}

/**
 * GET /api/grades/corrections/:id — Get correction request detail
 */
export async function getCorrectionById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const corrections = await query<RowDataPacket[]>(
      `SELECT gcr.*, s.name AS student_name, s.student_id, s.lrn,
              COALESCE(sub.name, 'All subjects') AS subject_name, sub.grade_level,
              req.name AS requested_by_name, req.employee_id AS requested_by_emp,
              rev.name AS reviewed_by_name
       FROM grade_correction_requests gcr
       JOIN students s ON gcr.student_id = s.id
       LEFT JOIN subjects sub ON gcr.subject_id = sub.id
       JOIN users req ON gcr.requested_by = req.id
       LEFT JOIN users rev ON gcr.reviewed_by = rev.id
       WHERE gcr.id = ?`,
      [id]
    );

    if (corrections.length === 0) {
      res.status(404).json({ error: "Correction request not found." });
      return;
    }

    res.json(corrections[0]);
  } catch (error) {
    console.error("Get correction error:", error);
    res.status(500).json({ error: "Failed to fetch correction request." });
  }
}

/**
 * POST /api/grades/corrections — Create a correction request
 * Body: { student_id, subject_id, school_year_id, quarter?, justification }
 */
export async function createCorrection(req: Request, res: Response): Promise<void> {
  try {
    const { student_id, subject_id, school_year_id, quarter, justification, common_mistake, other_mistake } = req.body;

    if (!student_id || !school_year_id || !justification) {
      res.status(400).json({ error: "Missing required fields: student_id, school_year_id, justification." });
      return;
    }

    // "Other" preset without free text is not actionable — require it.
    if (common_mistake === "Other" && !(other_mistake || "").trim()) {
      res.status(400).json({ error: "Please describe the mistake when selecting 'Other'." });
      return;
    }

    // Grades are quartered (Q1–Q3); a correction against Q4 (or any other
    // quarter) targets a grade that cannot exist, so reject it at the door
    // rather than leaving a permanently pending request nobody can action.
    if (quarter != null) {
      const q = Number(quarter);
      if (!Number.isInteger(q) || q < 1 || q > 3) {
        res.status(400).json({
          error: "Quarter must be 1, 2, or 3. Leave it blank to request a correction across all quarters.",
        });
        return;
      }
    }

    // R18: a teacher may only ask to correct a subject/learner they teach.
    // The Registrar can file broader requests.
    if (req.user!.role === "teacher") {
      if (!subject_id) {
        res.status(400).json({
          error: "Select the subject you are correcting — teachers may only request corrections for subjects they handle.",
        });
        return;
      }
      const allowed = await teacherCanEditStudentSubject(
        req.user!.userId,
        Number(school_year_id),
        Number(student_id),
        Number(subject_id)
      );
      if (!allowed) {
        res.status(403).json({
          error: "Access denied: you may only request corrections for subjects assigned to you.",
        });
        return;
      }
    }

    const result = await query<ResultSetHeader>(
      `INSERT INTO grade_correction_requests (student_id, subject_id, school_year_id, quarter, requested_by, justification, common_mistake, other_mistake)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        student_id,
        subject_id || null,
        school_year_id,
        quarter || null,
        req.user!.userId,
        justification,
        (common_mistake || "").trim() || null,
        (other_mistake || "").trim() || null,
      ]
    );

    const corrNames = await query<RowDataPacket[]>(
      `SELECT st.name AS student_name, st.lrn, sub.name AS subject_name
         FROM students st
         LEFT JOIN subjects sub ON sub.id = ?
        WHERE st.id = ?`,
      [subject_id || null, student_id]
    );
    const cn: any = corrNames[0];
    const correctionTarget = cn
      ? `${cn.student_name} (${cn.lrn}), ${cn.subject_name || (subject_id ? `subject ID ${subject_id}` : "all subjects")}`
      : `student ID ${student_id}${subject_id ? `, subject ID ${subject_id}` : " (all subjects)"}`;
    const justificationNote =
      typeof justification === "string" && justification.length > 200
        ? `${justification.slice(0, 200)}…`
        : justification;
    await logActivity(
      req.user!.userId,
      `Filed correction request #${result.insertId} — ${correctionTarget}, ${quarter ? `Q${quarter}` : "all quarters"}: ${justificationNote}`,
      "grade_correction_requests",
      result.insertId
    );

    const newRequest = await query<RowDataPacket[]>(
      `SELECT gcr.*, s.name AS student_name, COALESCE(sub.name, 'All subjects') AS subject_name
       FROM grade_correction_requests gcr
       JOIN students s ON gcr.student_id = s.id
       LEFT JOIN subjects sub ON gcr.subject_id = sub.id
       WHERE gcr.id = ?`,
      [result.insertId]
    );

    res.status(201).json(newRequest[0]);
  } catch (error) {
    console.error("Create correction error:", error);
    res.status(500).json({ error: "Failed to create correction request." });
  }
}

/**
 * PUT /api/grades/corrections/:id — Review a correction request (approve/reject)
 * Body: { status: "approved" | "rejected" }
 */
export async function reviewCorrection(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    if (!status || !["approved", "rejected"].includes(status)) {
      res.status(400).json({ error: "Status must be 'approved' or 'rejected'." });
      return;
    }

    const existing = await query<RowDataPacket[]>(
      "SELECT * FROM grade_correction_requests WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      res.status(404).json({ error: "Correction request not found." });
      return;
    }

    if (existing[0].status !== "pending") {
      res.status(400).json({ error: `Correction request is already ${existing[0].status}.` });
      return;
    }

    await query<ResultSetHeader>(
      "UPDATE grade_correction_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?",
      [status, req.user!.userId, id]
    );

    // On approval, unlock only the requested scope: one subject (or all when the
    // request used subject_id = NULL) and one quarter (or all when quarter =
    // NULL). The request already stores both, so approval must not open the
    // student's whole grade sheet — a single-subject/quarter correction must
    // leave every other cell locked.
    if (status === "approved") {
      const target = existing[0];
      const revNames = await query<RowDataPacket[]>(
        `SELECT st.name AS student_name, st.lrn, sub.name AS subject_name
           FROM students st
           LEFT JOIN subjects sub ON sub.id = ?
          WHERE st.id = ?`,
        [target.subject_id || null, target.student_id]
      );
      const rn: any = revNames[0];
      const revTarget = rn
        ? `${rn.student_name} (${rn.lrn}), ${rn.subject_name || "all subjects"}`
        : `student ID ${target.student_id}, subject ID ${target.subject_id ?? "all"}`;
      const revScope = `${target.quarter ? `Q${target.quarter}` : "all quarters"}`;
      const unlockResult = await query<ResultSetHeader>(
        `UPDATE grades
         SET is_locked = 0, locked_at = NULL, locked_by = NULL
         WHERE student_id = ? AND school_year_id = ?
           AND (subject_id = ? OR ? IS NULL)
           AND (quarter = ? OR ? IS NULL)`,
        [
          target.student_id,
          target.school_year_id,
          target.subject_id,
          target.subject_id,
          target.quarter,
          target.quarter,
        ]
      );
      await logActivity(
        req.user!.userId,
        `Unlocked ${unlockResult.affectedRows} grade row(s) — ${revTarget}, ${revScope} (correction request #${id} approved; re-entry limited to the subject's current teacher)`,
        "grades",
        id
      );
      await logActivity(
        req.user!.userId,
        `Approved grade correction request #${id} — ${revTarget}, ${revScope}`,
        "grade_correction_requests",
        id
      );
    } else {
      await logActivity(
        req.user!.userId,
        `Rejected grade correction request #${id}`,
        "grade_correction_requests",
        id
      );
    }

    const updated = await query<RowDataPacket[]>(
      `SELECT gcr.*, s.name AS student_name,
              COALESCE(sub.name, 'All subjects') AS subject_name,
              req.name AS requested_by_name, rev.name AS reviewed_by_name
       FROM grade_correction_requests gcr
       JOIN students s ON gcr.student_id = s.id
       LEFT JOIN subjects sub ON gcr.subject_id = sub.id
       JOIN users req ON gcr.requested_by = req.id
       LEFT JOIN users rev ON gcr.reviewed_by = rev.id
       WHERE gcr.id = ?`,
      [id]
    );

    res.json(updated[0]);
  } catch (error) {
    console.error("Review correction error:", error);
    res.status(500).json({ error: "Failed to review correction request." });
  }
}
