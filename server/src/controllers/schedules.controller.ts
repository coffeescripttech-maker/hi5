import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";

interface ScheduleRow extends RowDataPacket {
  id: number;
  teacher_id: number;
  section_id: number;
  subject_id: number;
  school_year_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  created_at: Date;
  updated_at: Date;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/**
 * GET /api/schedules — List schedules with filters
 * Query: ?teacher_id=1&section_id=1&subject_id=1&school_year_id=1
 */
export async function listSchedules(req: Request, res: Response): Promise<void> {
  try {
    const { teacher_id, section_id, subject_id, school_year_id } = req.query;

    let sql = `
      SELECT sc.*,
             u.name AS teacher_name,
             sec.name AS section_name,
             sub.name AS subject_name,
             sy.sy_label
      FROM schedules sc
      JOIN users u ON sc.teacher_id = u.id
      JOIN sections sec ON sc.section_id = sec.id
      JOIN subjects sub ON sc.subject_id = sub.id
      JOIN school_years sy ON sc.school_year_id = sy.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (teacher_id) { conditions.push("sc.teacher_id = ?"); params.push(parseInt(teacher_id as string)); }
    if (section_id) { conditions.push("sc.section_id = ?"); params.push(parseInt(section_id as string)); }
    if (subject_id) { conditions.push("sc.subject_id = ?"); params.push(parseInt(subject_id as string)); }
    if (school_year_id) { conditions.push("sc.school_year_id = ?"); params.push(parseInt(school_year_id as string)); }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY sc.day_of_week ASC, sc.start_time ASC";

    const schedules = await query<RowDataPacket[]>(sql, params);
    res.json(schedules);
  } catch (error) {
    console.error("List schedules error:", error);
    res.status(500).json({ error: "Failed to fetch schedules." });
  }
}

/**
 * GET /api/schedules/:id — Get schedule by ID
 */
export async function getScheduleById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const schedules = await query<RowDataPacket[]>(
      `SELECT sc.*,
              u.name AS teacher_name,
              sec.name AS section_name,
              sub.name AS subject_name,
              sy.sy_label
       FROM schedules sc
       JOIN users u ON sc.teacher_id = u.id
       JOIN sections sec ON sc.section_id = sec.id
       JOIN subjects sub ON sc.subject_id = sub.id
       JOIN school_years sy ON sc.school_year_id = sy.id
       WHERE sc.id = ?`,
      [id]
    );

    if (schedules.length === 0) {
      res.status(404).json({ error: "Schedule not found." });
      return;
    }

    res.json(schedules[0]);
  } catch (error) {
    console.error("Get schedule error:", error);
    res.status(500).json({ error: "Failed to fetch schedule." });
  }
}

/**
 * POST /api/schedules — Create schedule entry
 * Body: { teacher_id, section_id, subject_id, school_year_id, day_of_week, start_time, end_time, room? }
 */
export async function createSchedule(req: Request, res: Response): Promise<void> {
  try {
    const { teacher_id, section_id, subject_id, school_year_id, day_of_week, start_time, end_time, room } = req.body;

    if (!teacher_id || !section_id || !subject_id || !school_year_id || !day_of_week || !start_time || !end_time) {
      res.status(400).json({ error: "Missing required fields: teacher_id, section_id, subject_id, school_year_id, day_of_week, start_time, end_time." });
      return;
    }

    if (day_of_week < 1 || day_of_week > 5) {
      res.status(400).json({ error: "day_of_week must be between 1 (Monday) and 5 (Friday)." });
      return;
    }

    // Validate start < end
    if (start_time >= end_time) {
      res.status(400).json({ error: "start_time must be before end_time." });
      return;
    }

    // Verify all foreign keys exist
    const [teacher, section, subject, schoolYear] = await Promise.all([
      query<RowDataPacket[]>("SELECT id, name FROM users WHERE id = ?", [teacher_id]),
      query<RowDataPacket[]>("SELECT id, name FROM sections WHERE id = ?", [section_id]),
      query<RowDataPacket[]>("SELECT id, name FROM subjects WHERE id = ?", [subject_id]),
      query<RowDataPacket[]>("SELECT id, sy_label FROM school_years WHERE id = ?", [school_year_id]),
    ]);

    if (teacher.length === 0) { res.status(404).json({ error: "Teacher not found." }); return; }
    if (section.length === 0) { res.status(404).json({ error: "Section not found." }); return; }
    if (subject.length === 0) { res.status(404).json({ error: "Subject not found." }); return; }
    if (schoolYear.length === 0) { res.status(404).json({ error: "School year not found." }); return; }

    const result = await query<ResultSetHeader>(
      `INSERT INTO schedules (teacher_id, section_id, subject_id, school_year_id, day_of_week, start_time, end_time, room)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [teacher_id, section_id, subject_id, school_year_id, day_of_week, start_time, end_time, room || null]
    );

    await logActivity(req.user!.userId,
      `Created schedule: ${subject[0].name} - ${section[0].name} (${DAY_NAMES[day_of_week - 1]} ${start_time?.toString().slice(0, 5)})`,
      "schedules", result.insertId);

    const newSchedule = await query<RowDataPacket[]>(
      `SELECT sc.*,
              u.name AS teacher_name,
              sec.name AS section_name,
              sub.name AS subject_name,
              sy.sy_label
       FROM schedules sc
       JOIN users u ON sc.teacher_id = u.id
       JOIN sections sec ON sc.section_id = sec.id
       JOIN subjects sub ON sc.subject_id = sub.id
       JOIN school_years sy ON sc.school_year_id = sy.id
       WHERE sc.id = ?`,
      [result.insertId]
    );

    res.status(201).json(newSchedule[0]);
  } catch (error: any) {
    // Handle unique constraint violations
    if (error?.code === 'ER_DUP_ENTRY') {
      const msg = error.sqlMessage?.includes('uk_teacher_time')
        ? "This teacher already has a class scheduled at this time."
        : error.sqlMessage?.includes('uk_section_time')
          ? "This section already has a class scheduled at this time."
          : error.sqlMessage?.includes('uk_room_time')
            ? "This room is already booked at this time."
            : "A schedule conflict was detected.";
      res.status(409).json({ error: msg });
      return;
    }
    console.error("Create schedule error:", error);
    res.status(500).json({ error: "Failed to create schedule." });
  }
}

/**
 * PUT /api/schedules/:id — Update schedule entry
 */
export async function updateSchedule(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { teacher_id, section_id, subject_id, school_year_id, day_of_week, start_time, end_time, room } = req.body;

    const existing = await query<RowDataPacket[]>("SELECT id FROM schedules WHERE id = ?", [id]);
    if (existing.length === 0) {
      res.status(404).json({ error: "Schedule not found." });
      return;
    }

    const fields: string[] = [];
    const params: any[] = [];

    if (teacher_id !== undefined) { fields.push("teacher_id = ?"); params.push(teacher_id); }
    if (section_id !== undefined) { fields.push("section_id = ?"); params.push(section_id); }
    if (subject_id !== undefined) { fields.push("subject_id = ?"); params.push(subject_id); }
    if (school_year_id !== undefined) { fields.push("school_year_id = ?"); params.push(school_year_id); }
    if (day_of_week !== undefined) { fields.push("day_of_week = ?"); params.push(day_of_week); }
    if (start_time !== undefined) { fields.push("start_time = ?"); params.push(start_time); }
    if (end_time !== undefined) { fields.push("end_time = ?"); params.push(end_time); }
    if (room !== undefined) { fields.push("room = ?"); params.push(room); }

    if (fields.length === 0) {
      res.status(400).json({ error: "No fields to update." });
      return;
    }

    params.push(id);
    await query<ResultSetHeader>(`UPDATE schedules SET ${fields.join(", ")} WHERE id = ?`, params);
    await logActivity(req.user!.userId, `Updated schedule ID ${id}`, "schedules", id);

    const updated = await query<RowDataPacket[]>(
      `SELECT sc.*,
              u.name AS teacher_name,
              sec.name AS section_name,
              sub.name AS subject_name,
              sy.sy_label
       FROM schedules sc
       JOIN users u ON sc.teacher_id = u.id
       JOIN sections sec ON sc.section_id = sec.id
       JOIN subjects sub ON sc.subject_id = sub.id
       JOIN school_years sy ON sc.school_year_id = sy.id
       WHERE sc.id = ?`,
      [id]
    );

    res.json(updated[0]);
  } catch (error) {
    console.error("Update schedule error:", error);
    res.status(500).json({ error: "Failed to update schedule." });
  }
}

/**
 * DELETE /api/schedules/:id — Delete schedule entry
 */
export async function deleteSchedule(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await query<RowDataPacket[]>(
      `SELECT sc.id, sub.name AS subject_name, sec.name AS section_name
       FROM schedules sc
       JOIN subjects sub ON sc.subject_id = sub.id
       JOIN sections sec ON sc.section_id = sec.id
       WHERE sc.id = ?`,
      [id]
    );

    if (existing.length === 0) {
      res.status(404).json({ error: "Schedule not found." });
      return;
    }

    await query<ResultSetHeader>("DELETE FROM schedules WHERE id = ?", [id]);

    await logActivity(req.user!.userId,
      `Deleted schedule: ${existing[0].subject_name} - ${existing[0].section_name}`,
      "schedules", id);

    res.json({ message: "Schedule deleted successfully." });
  } catch (error) {
    console.error("Delete schedule error:", error);
    res.status(500).json({ error: "Failed to delete schedule." });
  }
}
