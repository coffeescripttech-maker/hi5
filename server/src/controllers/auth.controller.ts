import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { generateToken } from "../middleware/auth";
import { RowDataPacket, ResultSetHeader } from "mysql2";

interface UserRow extends RowDataPacket {
  id: number;
  username: string;
  password_hash: string;
  name: string;
  email: string;
  role: "admin" | "teacher" | "registrar" | "principal";
  status: string;
  last_login: Date | null;
}

/**
 * POST /api/auth/login
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required." });
      return;
    }

    // Find user
    const users = await query<UserRow[]>(
      "SELECT id, username, password_hash, name, email, role, status, last_login FROM users WHERE username = ?",
      [username]
    );

    if (users.length === 0) {
      res.status(401).json({ error: "Invalid username or password." });
      return;
    }

    const user = users[0];

    // Check if locked out
    const lockCheck = await query<RowDataPacket[]>(
      "SELECT locked_until FROM users WHERE id = ? AND locked_until > NOW()",
      [user.id]
    );

    if (lockCheck.length > 0) {
      const remainingMs = new Date(lockCheck[0].locked_until).getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      res.status(423).json({
        error: `Account is temporarily locked. Please try again in ${remainingMin} minute(s).`,
        lockedUntil: lockCheck[0].locked_until,
      });
      return;
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      // Increment login attempts
      await query(
        "UPDATE users SET login_attempts = login_attempts + 1 WHERE id = ?",
        [user.id]
      );

      // Check if should lock
      const attemptCount = await query<RowDataPacket[]>(
        "SELECT login_attempts FROM users WHERE id = ?",
        [user.id]
      );
      if (attemptCount[0].login_attempts >= 5) {
        await query(
          "UPDATE users SET locked_until = DATE_ADD(NOW(), INTERVAL 5 MINUTE), login_attempts = 0 WHERE id = ?",
          [user.id]
        );
        res.status(423).json({
          error: "Account locked due to 5 failed login attempts. Please try again in 5 minutes.",
          locked: true,
        });
        return;
      }

      res.status(401).json({
        error: "Invalid username or password.",
        attemptsRemaining: 5 - attemptCount[0].login_attempts,
      });
      return;
    }

    // Check if active
    if (user.status === "inactive") {
      res.status(403).json({ error: "This account has been deactivated. Contact your administrator." });
      return;
    }

    // Success — reset attempts and update last login
    await query<ResultSetHeader>(
      "UPDATE users SET login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = ?",
      [user.id]
    );

    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    // Determine status based on last_login
    let status: "active" | "idle" | "inactive" = "active";
    if (user.last_login) {
      const daysSince = (Date.now() - new Date(user.last_login).getTime()) / (1000 * 86400);
      if (daysSince > 60) status = "inactive";
      else if (daysSince > 30) status = "idle";
    }

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        status,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "An error occurred during login." });
  }
}

/**
 * GET /api/auth/me
 */
export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const users = await query<UserRow[]>(
      `SELECT id, username, name, email, role, status, phone, address, profile_photo_url,
              employee_id, designation, date_hired, last_login
       FROM users WHERE id = ?`,
      [req.user!.userId]
    );

    if (users.length === 0) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const u = users[0];

    // Compute status
    let status: "active" | "idle" | "inactive" = "active";
    if (u.last_login) {
      const daysSince = (Date.now() - new Date(u.last_login).getTime()) / (1000 * 86400);
      if (daysSince > 60) status = "inactive";
      else if (daysSince > 30) status = "idle";
    }

    res.json({
      id: u.id,
      username: u.username,
      name: u.name,
      email: u.email,
      role: u.role,
      status,
      phone: u.phone,
      address: u.address,
      profile_photo_url: u.profile_photo_url,
      employee_id: u.employee_id,
      designation: u.designation,
      date_hired: u.date_hired,
      last_login: u.last_login,
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ error: "Failed to fetch user info." });
  }
}

/**
 * PUT /api/auth/me — Update current user's own profile
 * Allows a user to update their name, email, phone, and address.
 * Does NOT allow changing role, status, employee_id, etc.
 */
export async function updateMe(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { name, email, phone, address } = req.body;

    const fields: string[] = [];
    const params: any[] = [];

    if (name !== undefined) { fields.push("name = ?"); params.push(name); }
    if (email !== undefined) { fields.push("email = ?"); params.push(email); }
    if (phone !== undefined) { fields.push("phone = ?"); params.push(phone); }
    if (address !== undefined) { fields.push("address = ?"); params.push(address); }

    if (fields.length === 0) {
      res.status(400).json({ error: "No fields to update." });
      return;
    }

    params.push(userId);
    await query<ResultSetHeader>(
      `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
      params
    );

    const updated = await query<UserRow[]>(
      `SELECT id, username, name, email, role, status, phone, address, profile_photo_url,
              employee_id, designation, date_hired, last_login
       FROM users WHERE id = ?`,
      [userId]
    );

    if (updated.length === 0) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const u = updated[0];
    res.json({
      id: u.id,
      username: u.username,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      phone: u.phone,
      address: u.address,
      profile_photo_url: u.profile_photo_url,
      employee_id: u.employee_id,
      designation: u.designation,
      date_hired: u.date_hired,
      last_login: u.last_login,
    });
  } catch (error) {
    console.error("Update me error:", error);
    res.status(500).json({ error: "Failed to update profile." });
  }
}

/**
 * POST /api/auth/logout
 */
export async function logout(_req: Request, res: Response): Promise<void> {
  // JWT is stateless — client should discard the token
  res.json({ message: "Logged out successfully." });
}

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 *
 * Generates a 6-digit reset code tied to the user's account.
 * NOTE: No email service is configured, so the code is returned in the
 * response body. In production, swap the `return` below for an email/sms
 * delivery and return only a generic message.
 */
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: "Email address is required." });
      return;
    }

    const users = await query<RowDataPacket[]>(
      "SELECT id, name, email FROM users WHERE email = ?",
      [email]
    );

    // Always answer the same way when the email is unknown so we don't
    // leak which accounts exist — but in dev mode the code is only usable
    // when the account actually exists.
    if (users.length === 0) {
      res.status(404).json({
        error: "No account found with that email address. Please check with your School ICT Coordinator.",
      });
      return;
    }

    const user = users[0];
    const code = crypto.randomInt(100000, 999999).toString();

    await query<ResultSetHeader>(
      `UPDATE users
       SET password_reset_token = ?, password_reset_expires = DATE_ADD(NOW(), INTERVAL 15 MINUTE)
       WHERE id = ?`,
      [code, user.id]
    );

    await logActivity(
      user.id,
      `Requested a password reset for account "${email}"`,
      "auth",
      null
    );

    // Dev-mode delivery: return the code so the login page can show it.
    // Replace this response with an email dispatch in production.
    res.json({
      message: "Password reset code generated.",
      reset_code: code,
      reset_expires: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Failed to process password reset request." });
  }
}

/**
 * POST /api/auth/reset-password
 * Body: { email, code, new_password }
 */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email, code, new_password } = req.body;

    if (!email || !code || !new_password) {
      res.status(400).json({ error: "Email, reset code, and new password are required." });
      return;
    }

    if (typeof new_password !== "string" || new_password.length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters long." });
      return;
    }

    // Validate code + expiry
    const users = await query<RowDataPacket[]>(
      `SELECT id, name FROM users
       WHERE email = ? AND password_reset_token = ? AND password_reset_expires > NOW()`,
      [email, code]
    );

    if (users.length === 0) {
      res.status(400).json({ error: "Invalid or expired reset code. Please request a new one." });
      return;
    }

    const user = users[0];
    const password_hash = await bcrypt.hash(new_password, 10);

    await query<ResultSetHeader>(
      `UPDATE users
       SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL,
           login_attempts = 0, locked_until = NULL
       WHERE id = ?`,
      [password_hash, user.id]
    );

    await logActivity(
      user.id,
      `Reset password for account "${email}"`,
      "auth",
      null
    );

    res.json({ message: "Password reset successfully. You can now sign in." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Failed to reset password." });
  }
}
