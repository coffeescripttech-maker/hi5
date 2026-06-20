import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
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
             sub.name AS subject_name,
             req.name AS requested_by_name,
             rev.name AS reviewed_by_name
      FROM grade_correction_requests gcr
      JOIN students s ON gcr.student_id = s.id
      JOIN subjects sub ON gcr.subject_id = sub.id
      JOIN users req ON gcr.requested_by = req.id
      LEFT JOIN users rev ON gcr.reviewed_by = rev.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (status) { conditions.push("gcr.status = ?"); params.push(status); }
    if (student_id) { conditions.push("gcr.student_id = ?"); params.push(parseInt(student_id as string)); }
    if (school_year_id) { conditions.push("gcr.school_year_id = ?"); params.push(parseInt(school_year_id as string)); }

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
              sub.name AS subject_name, sub.grade_level,
              req.name AS requested_by_name, req.employee_id AS requested_by_emp,
              rev.name AS reviewed_by_name
       FROM grade_correction_requests gcr
       JOIN students s ON gcr.student_id = s.id
       JOIN subjects sub ON gcr.subject_id = sub.id
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
    const { student_id, subject_id, school_year_id, quarter, justification } = req.body;

    if (!student_id || !subject_id || !school_year_id || !justification) {
      res.status(400).json({ error: "Missing required fields: student_id, subject_id, school_year_id, justification." });
      return;
    }

    const result = await query<ResultSetHeader>(
      `INSERT INTO grade_correction_requests (student_id, subject_id, school_year_id, quarter, requested_by, justification)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [student_id, subject_id, school_year_id, quarter || null, req.user!.userId, justification]
    );

    await logActivity(
      req.user!.userId,
      `Created grade correction request for student ID ${student_id}, subject ID ${subject_id}`,
      "grade_correction_requests",
      result.insertId
    );

    const newRequest = await query<RowDataPacket[]>(
      `SELECT gcr.*, s.name AS student_name, sub.name AS subject_name
       FROM grade_correction_requests gcr
       JOIN students s ON gcr.student_id = s.id
       JOIN subjects sub ON gcr.subject_id = sub.id
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
    const { id } = req.params;
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

    await logActivity(
      req.user!.userId,
      `${status === "approved" ? "Approved" : "Rejected"} grade correction request #${id}`,
      "grade_correction_requests",
      id
    );

    const updated = await query<RowDataPacket[]>(
      `SELECT gcr.*, s.name AS student_name, sub.name AS subject_name,
              req.name AS requested_by_name, rev.name AS reviewed_by_name
       FROM grade_correction_requests gcr
       JOIN students s ON gcr.student_id = s.id
       JOIN subjects sub ON gcr.subject_id = sub.id
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
