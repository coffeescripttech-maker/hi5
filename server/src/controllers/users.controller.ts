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
  role: "admin" | "teacher" | "registrar";
  phone: string | null;
  address: string | null;
  profile_photo_url: string | null;
  status: "active" | "idle" | "inactive";
  employee_id: string | null;
  designation: string | null;
  date_hired: string | null;
  last_login: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * GET /api/users — List all users
 */
export async function listUsers(_req: Request, res: Response): Promise<void> {
  try {
    const users = await query<UserRow[]>(
      `SELECT id, username, name, email, role, phone, address, profile_photo_url,
              status, employee_id, designation, date_hired, last_login, created_at, updated_at
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
    const { id } = req.params;
    const users = await query<UserRow[]>(
      `SELECT id, username, name, email, role, phone, address, profile_photo_url,
              status, employee_id, designation, date_hired, last_login, created_at, updated_at
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
    const { username, password, name, email, role, phone, address, employee_id, designation, date_hired } = req.body;

    if (!username || !password || !name || !email || !role) {
      res.status(400).json({ error: "Missing required fields: username, password, name, email, role." });
      return;
    }

    if (!["admin", "teacher", "registrar"].includes(role)) {
      res.status(400).json({ error: "Invalid role. Must be admin, teacher, or registrar." });
      return;
    }

    // Check duplicate username
    const existing = await query<RowDataPacket[]>(
      "SELECT id FROM users WHERE username = ? OR email = ?",
      [username, email]
    );
    if (existing.length > 0) {
      res.status(409).json({ error: "Username or email already exists." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query<ResultSetHeader>(
      `INSERT INTO users (username, password_hash, name, email, role, phone, address, employee_id, designation, date_hired)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, passwordHash, name, email, role, phone || null, address || null, employee_id || null, designation || null, date_hired || null]
    );

    await logActivity(req.user!.userId, `Created user "${username}" (${role})`, "users", result.insertId);

    const newUser = await query<UserRow[]>(
      `SELECT id, username, name, email, role, phone, address, profile_photo_url,
              status, employee_id, designation, date_hired, created_at
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
    const { id } = req.params;
    const { password, name, email, role, phone, address, profile_photo_url, employee_id, designation, date_hired } = req.body;

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
      if (!["admin", "teacher", "registrar"].includes(role)) {
        res.status(400).json({ error: "Invalid role. Must be admin, teacher, or registrar." });
        return;
      }
      fields.push("role = ?"); params.push(role);
    }
    if (phone !== undefined) { fields.push("phone = ?"); params.push(phone); }
    if (address !== undefined) { fields.push("address = ?"); params.push(address); }
    if (profile_photo_url !== undefined) { fields.push("profile_photo_url = ?"); params.push(profile_photo_url); }
    if (employee_id !== undefined) { fields.push("employee_id = ?"); params.push(employee_id); }
    if (designation !== undefined) { fields.push("designation = ?"); params.push(designation); }
    if (date_hired !== undefined) { fields.push("date_hired = ?"); params.push(date_hired); }
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
              status, employee_id, designation, date_hired, last_login, created_at, updated_at
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
    const { id } = req.params;

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
    const { id } = req.params;
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
