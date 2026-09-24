import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";

interface UserRow extends RowDataPacket {
  id: number;
  username: string;
  name: string;
  email: string;
  role: "admin" | "teacher" | "registrar" | "principal";
  phone: string | null;
  address: string | null;
  profile_photo_url: string | null;
  status: "active" | "idle" | "inactive";
  employee_id: string | null;
  designation: string | null;
  date_hired: string | null;
  end_of_contract: string | null;
  last_login: Date | null;
  last_seen_at: Date | null;
  presence: "online" | "idle" | "offline";
  created_at: Date;
  updated_at: Date;
}

// Presence thresholds (mirror the client-friendly description in the migration):
//   online   → last_seen_at within 2 minutes
//   idle     → last_seen_at 2–15 minutes ago
//   offline  → older than 15 minutes or never seen
const PRESENCE_SELECT = `
  CASE
    WHEN last_seen_at IS NOT NULL AND last_seen_at >= DATE_SUB(NOW(), INTERVAL 2 MINUTE) THEN 'online'
    WHEN last_seen_at IS NOT NULL AND last_seen_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE) THEN 'idle'
    ELSE 'offline'
  END AS presence`;

/**
 * GET /api/users — List all users
 */
export async function listUsers(_req: Request, res: Response): Promise<void> {
  try {
    const users = await query<UserRow[]>(
      `SELECT id, username, name, email, role, phone, address, profile_photo_url,
              status, employee_id, designation, date_hired, end_of_contract, last_login, last_seen_at,
              created_at, updated_at, ${PRESENCE_SELECT}
       FROM users ORDER BY name ASC`
    );
    res.json(users);
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ error: "Failed to fetch users." });
  }
}

/**
 * GET /api/users/:id — Get user by ID
 */
export async function getUserById(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const users = await query<UserRow[]>(
      `SELECT id, username, name, email, role, phone, address, profile_photo_url,
              status, employee_id, designation, date_hired, end_of_contract, last_login, last_seen_at,
              created_at, updated_at, ${PRESENCE_SELECT}
       FROM users WHERE id = ?`,
      [id]
    );

    if (users.length === 0) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    res.json(users[0]);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to fetch user." });
  }
}

/**
 * POST /api/users — Create user
 */
export async function createUser(req: Request, res: Response): Promise<void> {
  try {
    const { username, password, name, email, role, phone, address, employee_id, designation, date_hired, end_of_contract } = req.body;

    if (!username || !password || !name || !email || !role) {
      res.status(400).json({ error: "Missing required fields: username, password, name, email, role." });
      return;
    }

    if (!["admin", "teacher", "registrar", "principal"].includes(role)) {
      res.status(400).json({ error: "Invalid role. Must be admin, teacher, registrar, or principal." });
      return;
    }

    // Username syntax rules (shared with the frontend): 3-50 chars,
    // letters, numbers, dots, underscores, and hyphens only.
    if (
      typeof username !== "string" ||
      username.length < 3 ||
      username.length > 50 ||
      !/^[a-zA-Z0-9_.-]+$/.test(username)
    ) {
      res.status(400).json({
        error:
          "Username must be 3-50 characters and may only contain letters, numbers, dots, underscores, and hyphens."
      });
      return;
    }

    // Check duplicate username (case-insensitive)
    const existing = await query<RowDataPacket[]>(
      "SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR email = ?",
      [username, email]
    );
    if (existing.length > 0) {
      res.status(409).json({ error: "Username or email already exists." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query<ResultSetHeader>(
      `INSERT INTO users (username, password_hash, name, email, role, phone, address, employee_id, designation, date_hired, end_of_contract)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, passwordHash, name, email, role, phone || null, address || null, employee_id || null, designation || null, date_hired || null, end_of_contract || null]
    );

    await logActivity(req.user!.userId, `Created user "${username}" (${role})`, "users", result.insertId);

    const newUser = await query<UserRow[]>(
      `SELECT id, username, name, email, role, phone, address, profile_photo_url,
              status, employee_id, designation, date_hired, end_of_contract, last_login, last_seen_at,
              created_at, updated_at, ${PRESENCE_SELECT}
       FROM users WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json(newUser[0]);
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ error: "Failed to create user." });
  }
}

/**
 * PUT /api/users/:id — Update user
 */
export async function updateUser(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { password, username, name, email, role, status, phone, address, profile_photo_url, employee_id, designation, date_hired, end_of_contract } = req.body;

    const existing = await query<RowDataPacket[]>("SELECT id FROM users WHERE id = ?", [id]);
    if (existing.length === 0) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const fields: string[] = [];
    const params: any[] = [];

    if (name !== undefined) { fields.push("name = ?"); params.push(name); }
    if (email !== undefined) { fields.push("email = ?"); params.push(email); }
    if (role !== undefined) {
      if (!["admin", "teacher", "registrar", "principal"].includes(role)) {
        res.status(400).json({ error: "Invalid role. Must be admin, teacher, registrar, or principal." });
        return;
      }
      fields.push("role = ?"); params.push(role);
    }
    if (username !== undefined) {
      if (
        typeof username !== "string" ||
        username.length < 3 ||
        username.length > 50 ||
        !/^[a-zA-Z0-9_.-]+$/.test(username)
      ) {
        res.status(400).json({
          error:
            "Username must be 3-50 characters and may only contain letters, numbers, dots, underscores, and hyphens."
        });
        return;
      }
      // Case-insensitive uniqueness, excluding this user.
      const clash = await query<RowDataPacket[]>(
        "SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id <> ?",
        [username, id]
      );
      if (clash.length > 0) {
        res.status(409).json({ error: "Username already exists." });
        return;
      }
      fields.push("username = ?"); params.push(username);
    }
    if (phone !== undefined) { fields.push("phone = ?"); params.push(phone); }
    if (address !== undefined) { fields.push("address = ?"); params.push(address); }
    if (status !== undefined) {
      if (!["active", "idle", "inactive"].includes(status)) {
        res.status(400).json({ error: "Invalid status. Must be active, idle, or inactive." });
        return;
      }
      fields.push("status = ?"); params.push(status);
    }
    if (profile_photo_url !== undefined) { fields.push("profile_photo_url = ?"); params.push(profile_photo_url); }
    if (employee_id !== undefined) { fields.push("employee_id = ?"); params.push(employee_id); }
    if (designation !== undefined) { fields.push("designation = ?"); params.push(designation); }
    if (date_hired !== undefined) { fields.push("date_hired = ?"); params.push(date_hired); }
    if (end_of_contract !== undefined) { fields.push("end_of_contract = ?"); params.push(end_of_contract); }
    if (password !== undefined) {
      const passwordHash = await bcrypt.hash(password, 10);
      fields.push("password_hash = ?"); params.push(passwordHash);
    }

    if (fields.length === 0) {
      res.status(400).json({ error: "No fields to update." });
      return;
    }

    params.push(id);
    await query<ResultSetHeader>(
      `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
      params
    );

    await logActivity(req.user!.userId, `Updated user ID ${id}`, "users", id);

    const updated = await query<UserRow[]>(
      `SELECT id, username, name, email, role, phone, address, profile_photo_url,
              status, employee_id, designation, date_hired, end_of_contract, last_login, last_seen_at,
              created_at, updated_at, ${PRESENCE_SELECT}
       FROM users WHERE id = ?`,
      [id]
    );

    res.json(updated[0]);
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ error: "Failed to update user." });
  }
}

/**
 * DELETE /api/users/:id — Delete user
 */
export async function deleteUser(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    if (parseInt(id) === req.user!.userId) {
      res.status(400).json({ error: "You cannot delete your own account." });
      return;
    }

    const existing = await query<RowDataPacket[]>("SELECT id, username FROM users WHERE id = ?", [id]);
    if (existing.length === 0) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    await query<ResultSetHeader>("DELETE FROM users WHERE id = ?", [id]);
    await logActivity(req.user!.userId, `Deleted user "${existing[0].username}"`, "users", id);

    res.json({ message: "User deleted successfully." });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Failed to delete user." });
  }
}

/**
 * PUT /api/users/:id/status — Update user status
 */
export async function updateUserStatus(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    if (!["active", "idle", "inactive"].includes(status)) {
      res.status(400).json({ error: "Invalid status. Must be active, idle, or inactive." });
      return;
    }

    if (parseInt(id) === req.user!.userId && status === "inactive") {
      res.status(400).json({ error: "You cannot deactivate your own account." });
      return;
    }

    const existing = await query<RowDataPacket[]>("SELECT id FROM users WHERE id = ?", [id]);
    if (existing.length === 0) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    await query<ResultSetHeader>("UPDATE users SET status = ? WHERE id = ?", [status, id]);
    await logActivity(req.user!.userId, `Updated user ID ${id} status to ${status}`, "users", id);

    res.json({ message: "User status updated.", status });
  } catch (error) {
    console.error("Update user status error:", error);
    res.status(500).json({ error: "Failed to update user status." });
  }
}
