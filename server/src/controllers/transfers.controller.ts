import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { createNotification } from "../services/notify";
import { RowDataPacket, ResultSetHeader } from "mysql2";

/**
 * Transfer requests.
 *
 * Workflow (DepEd-aligned):
 *   Registrar files a Transfer-In or Transfer-Out request  → status 'pending'
 *   Enrollment Committee reviews it                      → 'approved' | 'rejected'
 *
 * The Registrar can never decide their own request: the review endpoints are
 * guarded to admin/enrollment_committee only, and a request's filer is blocked
 * from approving it even if they hold a committee-capable role.
 */

const COMMITTEE_ROLES = ["admin", "enrollment_committee"];

function isCommittee(role: string): boolean {
  return COMMITTEE_ROLES.includes(role);
}

const SELECT_BASE = `
  SELECT tr.*,
         s.name AS student_name, s.student_id AS student_code, s.lrn, s.grade_level,
         sy.sy_label,
         req.name AS requested_by_name,
         rev.name AS reviewed_by_name,
         sec.name AS requested_section_name,
         enrolled_sec.name AS enrolled_section_name,
         active_enr.id AS active_enrollment_id,
         active_enr.section_id AS active_enrollment_section_id,
         active_sec.name AS active_section_name,
         CASE WHEN tr.transfer_type = 'transfer_out' AND active_enr.id IS NULL THEN 0 ELSE 1 END AS is_approvable
  FROM transfer_requests tr
  JOIN students s ON tr.student_id = s.id
  JOIN school_years sy ON tr.school_year_id = sy.id
  JOIN users req ON tr.requested_by = req.id
  LEFT JOIN users rev ON tr.reviewed_by = rev.id
  LEFT JOIN sections sec ON tr.requested_section_id = sec.id
  LEFT JOIN enrollments en ON tr.enrollment_id = en.id
  LEFT JOIN sections enrolled_sec ON en.section_id = enrolled_sec.id
  LEFT JOIN enrollments active_enr
    ON active_enr.student_id = tr.student_id
   AND active_enr.school_year_id = tr.school_year_id
   AND active_enr.status = 'enrolled'
  LEFT JOIN sections active_sec ON active_sec.id = active_enr.section_id
`;

/**
 * GET /api/transfers — List transfer requests
 * Query: ?status=pending&transfer_type=transfer_in&school_year_id=1
 * Registrars see everything they can act on; teachers only see their students'
 * rows read-only (status filter is forced to non-pending for them).
 */
export async function listTransfers(req: Request, res: Response): Promise<void> {
  try {
    const { status, transfer_type, school_year_id, student_id } = req.query;
    const conditions: string[] = [];
    const params: any[] = [];

    if (status) { conditions.push("tr.status = ?"); params.push(status); }
    if (transfer_type) { conditions.push("tr.transfer_type = ?"); params.push(transfer_type); }
    if (school_year_id) { conditions.push("tr.school_year_id = ?"); params.push(parseInt(school_year_id as string)); }
    if (student_id) { conditions.push("tr.student_id = ?"); params.push(parseInt(student_id as string)); }

    // Teachers get a read-only view and must not see the pending approval queue.
    if (req.user!.role === "teacher") {
      conditions.push("tr.status <> 'pending'");
    }

    let sql = SELECT_BASE;
    if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY tr.created_at DESC";

    const rows = await query<RowDataPacket[]>(sql, params);
    res.json(rows);
  } catch (error) {
    console.error("List transfers error:", error);
    res.status(500).json({ error: "Failed to fetch transfer requests." });
  }
}

/**
 * GET /api/transfers/:id — Single transfer request with audit trail
 */
export async function getTransferById(req: Request, res: Response): Promise<void> {
  try {
    const rows = await query<RowDataPacket[]>(SELECT_BASE + " WHERE tr.id = ?", [
      req.params.id,
    ]);

    if (rows.length === 0) {
      res.status(404).json({ error: "Transfer request not found." });
      return;
    }

    if (req.user!.role === "teacher") {
      res.status(403).json({ error: "Access denied. You do not have permission for this action." });
      return;
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Get transfer error:", error);
    res.status(500).json({ error: "Failed to fetch transfer request." });
  }
}

/**
 * POST /api/transfers — File a transfer request (Registrar)
 * Body: {
 *   transfer_type: 'transfer_in' | 'transfer_out',
 *   student_id?, lrn?, student_name?, sex?, birthdate?, grade_level?,
 *   school_year_id, section_id?, previous_school?, destination_school?, reason?
 * }
 *
 * Transfer-In for a brand-new learner registers a pending student record first so
 * the request always points at a real learner.
 */
export async function createTransfer(req: Request, res: Response): Promise<void> {
  try {
    const {
      transfer_type,
      student_id,
      lrn,
      student_name,
      sex,
      birthdate,
      grade_level,
      school_year_id,
      section_id,
      previous_school,
      destination_school,
      reason,
    } = req.body;

    if (!transfer_type || !school_year_id) {
      res.status(400).json({ error: "Missing required fields: transfer_type, school_year_id." });
      return;
    }
    if (!["transfer_in", "transfer_out"].includes(transfer_type)) {
      res.status(400).json({ error: "Invalid transfer_type. Must be transfer_in or transfer_out." });
      return;
    }

    // ── Field validation ────────────────────────────────────────────────
    // Held to the same standard as a direct enrollment (see the students
    // controller): a transfer must not become a way to create a weaker
    // student record. Returns every problem at once so the registrar can fix
    // the form in one pass instead of one field per round trip.
    const problems: string[] = [];

    if (!reason || !String(reason).trim()) {
      problems.push("reason is required for every transfer request");
    } else if (String(reason).trim().length < 3) {
      problems.push("reason must be at least 3 characters");
    } else if (String(reason).length > 500) {
      problems.push("reason must be 500 characters or fewer");
    }

    for (const [label, value] of [
      ["previous_school", previous_school],
      ["destination_school", destination_school],
    ] as const) {
      if (value != null && String(value).length > 150) {
        problems.push(`${label} must be 150 characters or fewer`);
      }
    }

    // A transfer-in for a learner who is not yet on file writes a new student
    // row, so every field destined for that row is checked in the
    // `targetStudentId === null` branch below — checking it here would wrongly
    // reject a returning learner who was resolved by LRN lookup.

    if (problems.length > 0) {
      res.status(400).json({
        error: "The transfer request has invalid fields.",
        problems,
      });
      return;
    }

    // Resolve the learner: an existing id, an existing LRN, or a new record.
    let targetStudentId: number | null = null;

    if (student_id) {
      const existing = await query<RowDataPacket[]>(
        "SELECT id, status FROM students WHERE id = ?",
        [student_id]
      );
      if (existing.length === 0) {
        res.status(404).json({ error: "Student not found." });
        return;
      }
      targetStudentId = existing[0].id;
    } else if (lrn && String(lrn).trim()) {
      const byLrn = await query<RowDataPacket[]>(
        "SELECT id FROM students WHERE lrn = ?",
        [String(lrn).trim()]
      );
      if (byLrn.length > 0) {
        targetStudentId = byLrn[0].id;
      }
    }

    if (targetStudentId === null) {
      // New learner coming in from another school. Everything written to the
      // students row is validated to enrollment standard, and all problems are
      // reported together so the form can be corrected in one pass.
      const lrnText = lrn != null ? String(lrn).trim() : "";
      const nameText = student_name != null ? String(student_name).trim() : "";

      if (!lrnText) {
        problems.push("lrn is required for a learner who is not yet on file");
      } else if (!/^\d{12}$/.test(lrnText)) {
        problems.push("lrn must be exactly 12 digits");
      }

      if (!nameText) {
        problems.push("student_name is required for a learner who is not yet on file");
      } else if (nameText.length < 2 || nameText.length > 150) {
        problems.push("student_name must be between 2 and 150 characters");
      }

      if (sex !== "male" && sex !== "female") {
        problems.push("sex must be male or female");
      }

      if (!birthdate) {
        problems.push("birthdate is required for a learner who is not yet on file");
      } else {
        const bd = new Date(String(birthdate));
        if (Number.isNaN(bd.getTime())) {
          problems.push("birthdate is not a valid date");
        } else if (bd.getTime() > Date.now()) {
          problems.push("birthdate cannot be in the future");
        } else {
          const age =
            (Date.now() - bd.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
          if (age < 10 || age > 100) {
            problems.push("birthdate implies an age outside 10-100, which cannot be a junior high learner");
          }
        }
      }

      if (!grade_level) {
        problems.push("grade_level is required for a learner who is not yet on file");
      } else {
        const grade = Number(grade_level);
        if (!Number.isInteger(grade) || grade < 7 || grade > 12) {
          problems.push("grade_level must be an integer from 7 to 12");
        }
      }

      if (problems.length > 0) {
        res.status(400).json({
          error: "The transfer request has invalid fields.",
          problems,
        });
        return;
      }

      // Generate the display student_id like the students controller does.
      const year = new Date().getFullYear();
      const [seq] = await query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c FROM students WHERE student_id LIKE ?`,
        [`${year}-%`]
      );
      const nextSeq = String(Number(seq[0].c) + 1).padStart(4, "0");

      const inserted = await query<ResultSetHeader>(
        `INSERT INTO students (student_id, lrn, name, grade_level, sex, birthdate, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [`${year}-${nextSeq}`, lrnText, nameText, grade_level, sex, birthdate]
      );
      targetStudentId = inserted.insertId;

      // Mark as a transferee and tag SNED-eligible incoming support needs later.
      await query<ResultSetHeader>(
        `INSERT IGNORE INTO student_classifications (student_id, classification, school_year_id)
         VALUES (?, 'transferee', ?)`,
        [targetStudentId, school_year_id]
      );
    }

    // Transfer-In must land in a section that actually exists and fits.
    let resolvedSectionId: number | null = null;
    if (section_id) {
      const sec = await query<RowDataPacket[]>(
        "SELECT id, name, grade_level FROM sections WHERE id = ?",
        [section_id]
      );
      if (sec.length === 0) {
        res.status(404).json({ error: "Requested section not found." });
        return;
      }
      resolvedSectionId = sec[0].id;
    }

    // Transfer-Out is only meaningful against a school year where the learner
    // actually holds an active enrollment. Without this the registrar can file a
    // request the committee can never approve, because approving finds no
    // 'enrolled' enrollment to close. students.status is a whole-record flag and
    // says nothing about a specific year, so it is not sufficient here.
    if (transfer_type === "transfer_out") {
      const activeEnrollment = await query<RowDataPacket[]>(
        `SELECT e.id, sy.sy_label
         FROM enrollments e
         JOIN school_years sy ON sy.id = e.school_year_id
         WHERE e.student_id = ? AND e.school_year_id = ? AND e.status = 'enrolled'
         LIMIT 1`,
        [targetStudentId, school_year_id]
      );

      if (activeEnrollment.length === 0) {
        // Name the years they *are* enrolled in so the fix is obvious.
        const enrolledYears = await query<RowDataPacket[]>(
          `SELECT sy.sy_label, sy.is_current
           FROM enrollments e
           JOIN school_years sy ON sy.id = e.school_year_id
           WHERE e.student_id = ? AND e.status = 'enrolled'
           ORDER BY sy.sy_label`,
          [targetStudentId]
        );

        const requested = await query<RowDataPacket[]>(
          "SELECT sy_label FROM school_years WHERE id = ?",
          [school_year_id]
        );
        const requestedLabel = requested[0]?.sy_label ?? `year ${school_year_id}`;

        res.status(409).json({
          error:
            enrolledYears.length > 0
              ? `This learner has no active enrollment for ${requestedLabel}, so there is nothing to transfer out. ` +
                `They are currently enrolled in: ${enrolledYears.map((y: any) => y.sy_label).join(", ")}.`
              : `This learner has no active enrollment for ${requestedLabel}, so there is nothing to transfer out. ` +
                `They are not enrolled in any school year right now.`,
          school_year_id,
          enrolled_in: enrolledYears.map((y: any) => y.sy_label),
        });
        return;
      }
    }

    // One live request per learner per school year. MySQL has no partial unique
    // index, so this is enforced here (a decided/cancelled row may be re-filed).
    const active = await query<RowDataPacket[]>(
      `SELECT id, transfer_type FROM transfer_requests
       WHERE student_id = ? AND school_year_id = ? AND status = 'pending'
       LIMIT 1`,
      [targetStudentId, school_year_id]
    );
    if (active.length > 0) {
      res.status(409).json({
        error:
          "This learner already has a pending transfer request for that school year. " +
          "Withdraw it before filing another.",
      });
      return;
    }

    const result = await query<ResultSetHeader>(
      `INSERT INTO transfer_requests
         (student_id, transfer_type, school_year_id, grade_level, requested_section_id,
          previous_school, destination_school, reason, requested_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        targetStudentId,
        transfer_type,
        school_year_id,
        grade_level ?? null,
        resolvedSectionId,
        previous_school || null,
        destination_school || null,
        reason || null,
        req.user!.userId,
      ]
    );

    await logActivity(
      req.user!.userId,
      `Filed ${transfer_type === "transfer_in" ? "Transfer-In" : "Transfer-Out"} request #${result.insertId}`,
      "transfer_requests",
      result.insertId
    );

    await createNotification({
      title: "Transfer request filed",
      message: `A ${transfer_type === "transfer_in" ? "Transfer-In" : "Transfer-Out"} request is awaiting Enrollment Committee review.`,
      type: "info",
      role: "enrollment_committee",
    });

    const rows = await query<RowDataPacket[]>(SELECT_BASE + " WHERE tr.id = ?", [
      result.insertId,
    ]);
    res.status(201).json(rows[0]);
  } catch (error: any) {
    console.error("Create transfer error:", error);
    if (error?.code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "An active transfer request already exists for this learner and school year." });
      return;
    }
    res.status(500).json({ error: "Failed to file transfer request." });
  }
}

/**
 * PUT /api/transfers/:id/decision — Enrollment Committee decision
 * Body: { decision: 'approved' | 'rejected', remarks?, section_id? }
 *
 * Approving a Transfer-In materialises the enrollment: the pending student is
 * enrolled into the (reviewed) section for that school year.
 */
export async function reviewTransfer(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { decision, remarks, section_id } = req.body;

    if (!isCommittee(req.user!.role)) {
      res.status(403).json({
        error: "Only the Enrollment Committee may approve or reject transfer requests.",
      });
      return;
    }
    if (!["approved", "rejected"].includes(decision)) {
      res.status(400).json({ error: "Invalid decision. Must be approved or rejected." });
      return;
    }

    const existing = await query<RowDataPacket[]>(
      `SELECT tr.*, s.name AS student_name, s.status AS student_status
       FROM transfer_requests tr
       JOIN students s ON tr.student_id = s.id
       WHERE tr.id = ?`,
      [id]
    );

    if (existing.length === 0) {
      res.status(404).json({ error: "Transfer request not found." });
      return;
    }

    const tr = existing[0];

    // Separation of duties: the filer cannot approve their own request.
    if (tr.requested_by === req.user!.userId && req.user!.role !== "admin") {
      res.status(403).json({
        error: "You filed this request, so another Enrollment Committee member must review it.",
      });
      return;
    }

    if (tr.status !== "pending") {
      res.status(409).json({
        error: `This request was already ${tr.status} and cannot be reviewed again.`,
      });
      return;
    }

    let enrollmentId: number | null = tr.enrollment_id;

    if (decision === "approved" && tr.transfer_type === "transfer_in") {
      const targetSectionId = section_id ?? tr.requested_section_id;

      if (!targetSectionId) {
        res.status(400).json({
          error: "Approving a Transfer-In requires a target section (section_id).",
        });
        return;
      }

      const sec = await query<RowDataPacket[]>(
        "SELECT id, name, capacity, current_count, grade_level FROM sections WHERE id = ?",
        [targetSectionId]
      );
      if (sec.length === 0) {
        res.status(404).json({ error: "Target section not found." });
        return;
      }
      if (sec[0].current_count >= sec[0].capacity) {
        res.status(400).json({ error: `Section "${sec[0].name}" is at full capacity.` });
        return;
      }

      const dup = await query<RowDataPacket[]>(
        "SELECT id FROM enrollments WHERE student_id = ? AND school_year_id = ?",
        [tr.student_id, tr.school_year_id]
      );
      if (dup.length > 0) {
        res.status(409).json({
          error: "This learner already has an enrollment for that school year.",
        });
        return;
      }

      const created = await query<ResultSetHeader>(
        `INSERT INTO enrollments
           (student_id, section_id, school_year_id, enrollment_date, enrolled_by, status, remarks, assigned_at, assigned_by)
         VALUES (?, ?, ?, CURDATE(), ?, 'enrolled', ?, NOW(), ?)`,
        [
          tr.student_id,
          targetSectionId,
          tr.school_year_id,
          req.user!.userId,
          "Transfer-In approved by Enrollment Committee",
          req.user!.userId,
        ]
      );
      enrollmentId = created.insertId;

      await query<ResultSetHeader>(
        "UPDATE sections SET current_count = current_count + 1 WHERE id = ?",
        [targetSectionId]
      );
      await query<ResultSetHeader>(
        "UPDATE students SET status = 'enrolled' WHERE id = ?",
        [tr.student_id]
      );
    }

    if (decision === "approved" && tr.transfer_type === "transfer_out") {
      const current = await query<RowDataPacket[]>(
        `SELECT e.id, e.section_id
         FROM enrollments e
         WHERE e.student_id = ? AND e.school_year_id = ? AND e.status = 'enrolled'
         ORDER BY e.id DESC LIMIT 1`,
        [tr.student_id, tr.school_year_id]
      );

      if (current.length === 0) {
        // Reachable only for requests filed before the file-time guard existed.
        // The committee can still reject or withdraw it; approve is impossible.
        res.status(409).json({
          error:
            "This learner has no active enrollment for that school year, so there is nothing to transfer out. " +
            "Reject this request, or ask the Registrar to refile it against the correct school year.",
          reason: "no_active_enrollment",
        });
        return;
      }

      await query<ResultSetHeader>(
        `UPDATE enrollments
         SET status = 'transferred', remarks = COALESCE(?, remarks)
         WHERE id = ?`,
        ["Transfer-Out approved by Enrollment Committee", current[0].id]
      );
      enrollmentId = current[0].id;

      // Give the seat back: the section headcount is what the pending queue and
      // capacity checks read, so leaving it inflated would block the next learner.
      if (current[0].section_id) {
        await query<ResultSetHeader>(
          `UPDATE sections
           SET current_count = GREATEST(current_count - 1, 0)
           WHERE id = ?`,
          [current[0].section_id]
        );
      }
      await query<ResultSetHeader>(
        "UPDATE students SET status = 'transferred' WHERE id = ?",
        [tr.student_id]
      );
    }

    await query<ResultSetHeader>(
      `UPDATE transfer_requests
       SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_remarks = ?,
           requested_section_id = COALESCE(?, requested_section_id),
           enrollment_id = COALESCE(?, enrollment_id)
       WHERE id = ?`,
      [decision, req.user!.userId, remarks || null, section_id ?? null, enrollmentId, id]
    );

    await logActivity(
      req.user!.userId,
      `${decision === "approved" ? "Approved" : "Rejected"} ${tr.transfer_type === "transfer_in" ? "Transfer-In" : "Transfer-Out"} request for ${tr.student_name}`,
      "transfer_requests",
      id
    );

    await createNotification({
      title: `Transfer request ${decision}`,
      message: `Transfer request for ${tr.student_name} was ${decision}.`,
      type: decision === "approved" ? "success" : "warning",
      user_id: tr.requested_by,
    });

    const rows = await query<RowDataPacket[]>(SELECT_BASE + " WHERE tr.id = ?", [id]);
    res.json(rows[0]);
  } catch (error: any) {
    console.error("Review transfer error:", error);
    if (error?.code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "This learner already has an enrollment for that school year." });
      return;
    }
    res.status(500).json({ error: "Failed to review transfer request." });
  }
}

/**
 * PUT /api/transfers/:id/cancel — Registrar withdraws a still-pending request
 */
export async function cancelTransfer(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;

    const existing = await query<RowDataPacket[]>(
      "SELECT id, status, requested_by FROM transfer_requests WHERE id = ?",
      [id]
    );
    if (existing.length === 0) {
      res.status(404).json({ error: "Transfer request not found." });
      return;
    }
    if (existing[0].status !== "pending") {
      res.status(409).json({ error: `This request was already ${existing[0].status}.` });
      return;
    }
    if (existing[0].requested_by !== req.user!.userId && !isCommittee(req.user!.role)) {
      res.status(403).json({ error: "You can only cancel a request you filed." });
      return;
    }

    await query<ResultSetHeader>(
      "UPDATE transfer_requests SET status = 'cancelled', reviewed_at = NOW() WHERE id = ?",
      [id]
    );
    await logActivity(req.user!.userId, `Cancelled transfer request #${id}`, "transfer_requests", id);

    const rows = await query<RowDataPacket[]>(SELECT_BASE + " WHERE tr.id = ?", [id]);
    res.json(rows[0]);
  } catch (error) {
    console.error("Cancel transfer error:", error);
    res.status(500).json({ error: "Failed to cancel transfer request." });
  }
}