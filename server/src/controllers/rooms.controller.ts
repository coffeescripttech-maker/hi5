import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";

interface RoomRow extends RowDataPacket {
  id: number;
  name: string;
  building: string | null;
  floor: string | null;
  capacity: number | null;
  room_type: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * GET /api/rooms — List all rooms
 * Public read (authenticated). Optional ?status= filter.
 */
export async function listRooms(req: Request, res: Response): Promise<void> {
  try {
    const { status } = req.query;
    const params: any[] = [];
    let sql = "SELECT * FROM rooms";
    if (status) { sql += " WHERE status = ?"; params.push(status); }
    sql += " ORDER BY building ASC, name ASC";
    const rooms = await query<RoomRow[]>(sql, params);
    res.json(rooms);
  } catch (error) {
    console.error("List rooms error:", error);
    res.status(500).json({ error: "Failed to fetch rooms." });
  }
}

/**
 * GET /api/rooms/:id — Get room by ID
 */
export async function getRoomById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const rooms = await query<RoomRow[]>("SELECT * FROM rooms WHERE id = ?", [id]);
    if (rooms.length === 0) {
      res.status(404).json({ error: "Room not found." });
      return;
    }
    res.json(rooms[0]);
  } catch (error) {
    console.error("Get room error:", error);
    res.status(500).json({ error: "Failed to fetch room." });
  }
}

/**
 * POST /api/rooms — Create room (admin/registrar)
 */
export async function createRoom(req: Request, res: Response): Promise<void> {
  try {
    const { name, building, floor, capacity, room_type, status } = req.body;
    if (!name) {
      res.status(400).json({ error: "Room name is required." });
      return;
    }
    const result = await query<ResultSetHeader>(
      "INSERT INTO rooms (name, building, floor, capacity, room_type, status) VALUES (?, ?, ?, ?, ?, ?)",
      [name, building ?? null, floor ?? null, capacity ?? null, room_type ?? "Classroom", status ?? "Available"]
    );
    await logActivity(req.user!.userId, `Created room "${name}"`, "rooms", result.insertId);
    const created = await query<RoomRow[]>("SELECT * FROM rooms WHERE id = ?", [result.insertId]);
    res.status(201).json(created[0]);
  } catch (error: any) {
    console.error("Create room error:", error);
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "A room with that name already exists." });
      return;
    }
    res.status(500).json({ error: "Failed to create room." });
  }
}

/**
 * PUT /api/rooms/:id — Update room (admin/registrar)
 */
export async function updateRoom(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, building, floor, capacity, room_type, status } = req.body;
    const fields: string[] = [];
    const params: any[] = [];
    if (name !== undefined) { fields.push("name = ?"); params.push(name); }
    if (building !== undefined) { fields.push("building = ?"); params.push(building); }
    if (floor !== undefined) { fields.push("floor = ?"); params.push(floor); }
    if (capacity !== undefined) { fields.push("capacity = ?"); params.push(capacity); }
    if (room_type !== undefined) { fields.push("room_type = ?"); params.push(room_type); }
    if (status !== undefined) { fields.push("status = ?"); params.push(status); }

    if (fields.length === 0) {
      res.status(400).json({ error: "No fields to update." });
      return;
    }
        params.push(id);
    await query<ResultSetHeader>(`UPDATE rooms SET ${fields.join(", ")} WHERE id = ?`, params);
        await logActivity(req.user!.userId, `Updated room ID ${id}`, "rooms", Number(id));
    const updated = await query<RoomRow[]>("SELECT * FROM rooms WHERE id = ?", [id]);
    res.json(updated[0]);
  } catch (error: any) {
    console.error("Update room error:", error);
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "A room with that name already exists." });
      return;
    }
    res.status(500).json({ error: "Failed to update room." });
  }
}
