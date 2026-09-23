import { Request, Response } from "express";
import { query, getConnection } from "../config/database";
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
  room_id: number | null;
  created_at: Date;
  updated_at: Date;
}

interface ScheduleWithNames extends ScheduleRow {
  teacher_name: string;
  section_name: string;
  subject_name: string;
  sy_label: string;
  room_name: string | null;
}

interface ScheduleConflict {
  type: "room" | "teacher" | "section";
  message: string;
  existing: { subject_name: string; section_name: string; teacher_name: string; room_name: string | null };
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const SELECT_WITH_NAMES = `
  SELECT sc.*,
         u.name AS teacher_name,
         sec.name AS section_name,
         sub.name AS subject_name,
         sy.sy_label,
         r.name AS room_name
    FROM schedules sc
    JOIN users u ON sc.teacher_id = u.id
    JOIN sections sec ON sc.section_id = sec.id
    JOIN subjects sub ON sc.subject_id = sub.id
    JOIN school_years sy ON sc.school_year_id = sy.id
    LEFT JOIN rooms r ON sc.room_id = r.id
`;

function summarise(r: any): ScheduleConflict["existing"] {
  return {
    subject_name: r.subject_name,
    section_name: r.section_name,
    teacher_name: r.teacher_name,
    room_name: r.room_name ?? r.room,
  };
}

/**
 * Recompute room availability after a schedule change so Room Management
 * stays in sync with the Scheduling module. Manual statuses (Maintenance /
 * Inactive) are preserved — only 'Occupied' and 'Available' are touched.
 */
async function syncRoomStatus(conn: any, roomIds: Array<number | null | undefined>): Promise<void> {
  const ids = [...new Set(roomIds.filter((r): r is number => typeof r === "number" && r > 0))];
  for (const roomId of ids) {
    const [rows] = await conn.execute(
      "SELECT COUNT(*) AS cnt FROM schedules WHERE room_id = ?",
      [roomId]
    );
    const count = (rows as RowDataPacket[])[0]?.cnt || 0;
    if (count > 0) {
      // Only promote from 'Available' — a manually set 'Maintenance' or
      // 'Inactive' status is left alone.
      await conn.execute(
        "UPDATE rooms SET status = 'Occupied' WHERE id = ? AND status = 'Available'",
        [roomId]
      );
    } else {
      await conn.execute("UPDATE rooms SET status = 'Available' WHERE id = ? AND status = 'Occupied'", [roomId]);
    }
  }
}

/**
 * Overlap detection — returns existing schedules overlapping the proposed
 * (day, start, end) for the same room, teacher, OR section within a school
 * year, excluding the optional excludeScheduleId.
 * Overlap condition: A.start < B.end AND A.end > B.start (same day + same SY).
 * The shared-dimension filter is an OR (not AND): a teacher double-booking
 * across two rooms must still be caught, and a room double-booking across
 * two teachers must still be caught.
 */
export async function findConflicts(
  conn: any,
  opts: {
    school_year_id?: number;
    day_of_week?: number;
    start_time?: string;
    end_time?: string;
    room_id?: number | null;
    teacher_id?: number;
    section_id?: number;
    excludeScheduleId?: number;
  }
): Promise<ScheduleConflict[]> {
  const { school_year_id, day_of_week, start_time, end_time, room_id, teacher_id, section_id, excludeScheduleId } = opts;
  if (!school_year_id || !day_of_week || !start_time || !end_time) return [];

  const params: any[] = [school_year_id, day_of_week, end_time, start_time];
  const ands: string[] = [
    "sc.school_year_id = ?", "sc.day_of_week = ?",
    "sc.start_time < ?", "sc.end_time > ?",
  ];
  // Match on ANY shared dimension — otherwise a teacher already booked in a
  // different room (or the room booked by another teacher) slips through.
  const ors: string[] = [];
  if (room_id) { ors.push("sc.room_id = ?"); params.push(room_id); }
  if (teacher_id) { ors.push("sc.teacher_id = ?"); params.push(teacher_id); }
  if (section_id) { ors.push("sc.section_id = ?"); params.push(section_id); }
  if (ors.length === 0) return [];
  if (excludeScheduleId) { ands.push("sc.id <> ?"); params.push(excludeScheduleId); }

  const sql = `${SELECT_WITH_NAMES} WHERE ${ands.join(" AND ")} AND (${ors.join(" OR ")}) ORDER BY sc.start_time ASC`;
  const [rows] = (await conn.execute(sql, params)) as [RowDataPacket[], unknown];
  const conflicts: ScheduleConflict[] = [];
  for (const r of rows) {
    if (room_id && r.room_id === room_id) conflicts.push({ type: "room", message: "Room is already occupied at this time", existing: summarise(r) });
    if (teacher_id && r.teacher_id === teacher_id) conflicts.push({ type: "teacher", message: "Teacher is already assigned at this time", existing: summarise(r) });
    if (section_id && r.section_id === section_id) conflicts.push({ type: "section", message: "Section already has a class at this time", existing: summarise(r) });
  }
  return conflicts;
}

/**
 * GET /api/schedules/:id/history — Schedule change history (admin/registrar)
 */
export async function getHistory(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const rows = await query<RowDataPacket[]>(
      `SELECT sch.*, u.name AS changed_by_name
         FROM schedule_changes sch
         JOIN users u ON sch.changed_by = u.id
        WHERE sch.schedule_id = ?
        ORDER BY sch.created_at DESC`,
      [id]
    );
    res.json(rows);
  } catch (error) {
    console.error("Schedule history error:", error);
    res.status(500).json({ error: "Failed to fetch schedule history." });
  }
}

/**
 * POST /api/schedules/check-conflicts — Preview conflicts for a proposed schedule
 */
export async function checkConflicts(req: Request, res: Response): Promise<void> {
  try {
    const { schedule_id, teacher_id, section_id, subject_id, school_year_id, day_of_week, start_time, end_time, room_id } = req.body;
    if (!school_year_id || !day_of_week || !start_time || !end_time) {
      res.status(400).json({ error: "school_year_id, day_of_week, start_time, and end_time are required." });
      return;
    }
    if (start_time >= end_time) {
      res.status(400).json({ error: "end_time must be later than start_time." });
      return;
    }
    const conn = await getConnection();
    try {
      const conflicts = await findConflicts(conn, {
        school_year_id: Number(school_year_id), day_of_week: Number(day_of_week),
        start_time, end_time, room_id: room_id ?? null,
        teacher_id: Number(teacher_id), section_id: Number(section_id),
        excludeScheduleId: schedule_id ? Number(schedule_id) : undefined,
      });
      res.json({ conflicts });
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("Check conflicts error:", error);
    res.status(500).json({ error: "Failed to check conflicts." });
  }
}

/**
 * GET /api/schedules — List schedules with filters
 * Query: ?teacher_id=1&section_id=1&subject_id=1&school_year_id=1
 */
export async function listSchedules(req: Request, res: Response): Promise<void> {
  try {
    const { teacher_id, section_id, subject_id, school_year_id } = req.query;

        let sql = SELECT_WITH_NAMES;
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

        const schedules = await query<ScheduleWithNames[]>(sql, params);
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
        const schedules = await query<ScheduleWithNames[]>(
      `${SELECT_WITH_NAMES} WHERE sc.id = ?`,
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
        const { teacher_id, section_id, subject_id, school_year_id, day_of_week, start_time, end_time, room, room_id } = req.body;

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
      query<RowDataPacket[]>("SELECT id, name FROM users WHERE id = ? AND role = 'teacher'", [teacher_id]),
      query<RowDataPacket[]>("SELECT id, name FROM sections WHERE id = ?", [section_id]),
      query<RowDataPacket[]>("SELECT id, name FROM subjects WHERE id = ?", [subject_id]),
      query<RowDataPacket[]>("SELECT id, sy_label FROM school_years WHERE id = ?", [school_year_id]),
    ]);

    if (teacher.length === 0) { res.status(404).json({ error: "Teacher not found." }); return; }
    if (section.length === 0) { res.status(404).json({ error: "Section not found." }); return; }
    if (subject.length === 0) { res.status(404).json({ error: "Subject not found." }); return; }
    if (schoolYear.length === 0) { res.status(404).json({ error: "School year not found." }); return; }

    // Verify the chosen room exists so the schedule is properly linked to it.
    if (room_id) {
      const room = await query<RowDataPacket[]>("SELECT id FROM rooms WHERE id = ?", [room_id]);
      if (room.length === 0) { res.status(400).json({ error: "Room not found." }); return; }
    }

    const conn = await getConnection();
    try {
      await conn.beginTransaction();

      // Overlap-based conflict detection (supersedes the old exact-match unique keys)
      const conflicts = await findConflicts(conn, {
        school_year_id: Number(school_year_id), day_of_week: Number(day_of_week),
        start_time, end_time, room_id: room_id ?? null,
        teacher_id: Number(teacher_id), section_id: Number(section_id),
      });
      if (conflicts.length > 0) {
        await conn.rollback();
        res.status(409).json({ error: "Conflicts detected", conflicts });
        return;
      }

      const result = await conn.execute<ResultSetHeader>(
        `INSERT INTO schedules (teacher_id, section_id, subject_id, school_year_id, day_of_week, start_time, end_time, room, room_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [teacher_id, section_id, subject_id, school_year_id, day_of_week, start_time, end_time, room ?? null, room_id ?? null]
      );
      const scheduleId = result[0].insertId;

      await logActivity(req.user!.userId,
        `Created schedule: ${subject[0].name} - ${section[0].name} (${DAY_NAMES[day_of_week - 1]} ${start_time.slice(0, 5)})`,
        "schedules", scheduleId);

      // Keep Room Management in sync: the room is now Occupied.
      await syncRoomStatus(conn, [room_id ?? null]);

      await conn.commit();
      const created = await query<ScheduleWithNames[]>(`${SELECT_WITH_NAMES} WHERE sc.id = ?`, [scheduleId]);
      res.status(201).json(created[0]);
    } catch (error: any) {
      await conn.rollback();
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
    } finally {
      conn.release();
    }
  } catch (error: any) {
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
        const { teacher_id, section_id, subject_id, school_year_id, day_of_week, start_time, end_time, room, room_id, reason } = req.body;

    const existing = await query<ScheduleRow[]>("SELECT * FROM schedules WHERE id = ?", [id]);
    if (existing.length === 0) {
      res.status(404).json({ error: "Schedule not found." });
      return;
    }
    const old = existing[0];

    // Resolve effective values (fall back to existing for omitted fields)
    const eff: { teacher_id: number; section_id: number; school_year_id: number; day_of_week: number; start_time: string; end_time: string; room_id: number | null; room: string | null } = {
      teacher_id: teacher_id !== undefined ? teacher_id : old.teacher_id,
      section_id: section_id !== undefined ? section_id : old.section_id,
      school_year_id: school_year_id !== undefined ? school_year_id : old.school_year_id,
      day_of_week: day_of_week !== undefined ? day_of_week : old.day_of_week,
      start_time: start_time !== undefined ? start_time : old.start_time,
      end_time: end_time !== undefined ? end_time : old.end_time,
      room_id: room_id !== undefined ? room_id : old.room_id,
      room: room !== undefined ? room : old.room,
    };

    // Time validation
    if (eff.start_time >= eff.end_time) {
      res.status(400).json({ error: "start_time must be before end_time." });
      return;
    }

    const conn = await getConnection();
    try {
      await conn.beginTransaction();

      // Overlap-based conflict detection (excludes self)
      const conflicts = await findConflicts(conn, {
        school_year_id: Number(eff.school_year_id), day_of_week: Number(eff.day_of_week),
        start_time: eff.start_time, end_time: eff.end_time,
        room_id: eff.room_id ?? null,
        teacher_id: Number(eff.teacher_id), section_id: Number(eff.section_id),
        excludeScheduleId: Number(id),
      });
      if (conflicts.length > 0) {
        await conn.rollback();
        res.status(409).json({ error: "Conflicts detected", conflicts });
        return;
      }

      const fields: string[] = [];
      const params: any[] = [];
      if (subject_id !== undefined) { fields.push("subject_id = ?"); params.push(subject_id); }
      if (teacher_id !== undefined) { fields.push("teacher_id = ?"); params.push(teacher_id); }
      if (section_id !== undefined) { fields.push("section_id = ?"); params.push(section_id); }
      if (school_year_id !== undefined) { fields.push("school_year_id = ?"); params.push(school_year_id); }
      if (day_of_week !== undefined) { fields.push("day_of_week = ?"); params.push(day_of_week); }
      if (start_time !== undefined) { fields.push("start_time = ?"); params.push(start_time); }
      if (end_time !== undefined) { fields.push("end_time = ?"); params.push(end_time); }
      if (room_id !== undefined) { fields.push("room_id = ?"); params.push(room_id); }
      if (room !== undefined) { fields.push("room = ?"); params.push(room); }

      if (fields.length > 0) {
        params.push(id);
        await conn.execute<ResultSetHeader>(`UPDATE schedules SET ${fields.join(", ")} WHERE id = ?`, params);
      }

      // Audit trail
      const changeType =
        (eff.room_id !== old.room_id || eff.room !== old.room) ? "reassign_room" :
        (eff.teacher_id !== old.teacher_id) ? "reassign_teacher" : "reschedule";
      await conn.execute(
        `INSERT INTO schedule_changes
           (schedule_id, changed_by, change_type, old_day, old_start, old_end, old_room,
            new_day, new_start, new_end, new_room, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, req.user!.userId, changeType,
          old.day_of_week, old.start_time, old.end_time, old.room,
          eff.day_of_week, eff.start_time, eff.end_time, eff.room, reason ?? null]
      );

            await logActivity(req.user!.userId, `Updated schedule ID ${id}`, "schedules", Number(id));

      // Keep Room Management in sync (old and new rooms, if changed).
      await syncRoomStatus(conn, [old.room_id, eff.room_id]);

      await conn.commit();

      const updated = await query<ScheduleWithNames[]>(`${SELECT_WITH_NAMES} WHERE sc.id = ?`, [id]);
      res.json(updated[0]);
    } catch (error: any) {
      await conn.rollback();
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
      console.error("Update schedule error:", error);
      res.status(500).json({ error: "Failed to update schedule." });
    } finally {
      conn.release();
    }
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
      `SELECT sc.id, sc.room_id, sub.name AS subject_name, sec.name AS section_name
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

    // Keep Room Management in sync: the room is freed up again.
    const conn = await getConnection();
    try {
      await syncRoomStatus(conn, [existing[0].room_id]);
    } finally {
      conn.release();
    }

    await logActivity(req.user!.userId,
      `Deleted schedule: ${existing[0].subject_name} - ${existing[0].section_name}`,
            "schedules", Number(id));

    res.json({ message: "Schedule deleted successfully." });
  } catch (error) {
    console.error("Delete schedule error:", error);
    res.status(500).json({ error: "Failed to delete schedule." });
  }
}
