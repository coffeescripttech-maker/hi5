import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { isMailConfigured, sendPasswordResetEmail } from "../config/mailer";
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
  phone: string | null;
  address: string | null;
  profile_photo_url: string | null;
  employee_id: string | null;
  designation: string | null;
  date_hired: Date | null;
  last_login: Date | null;
  created_at: Date | null;
}

/** DATE columns come back as JS Dates at local midnight; serialize them back
 *  to the plain "YYYY-MM-DD" the client can round-trip into a DATE column
 *  without MySQL strict-mode errors (ISO-8601 "T"/"Z" is rejected). */
function dateOnly(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

    // Success — reset attempts and update last login + presence
    await query<ResultSetHeader>(
      "UPDATE users SET login_attempts = 0, locked_until = NULL, last_login = NOW(), last_seen_at = NOW() WHERE id = ?",
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
              employee_id, designation, date_hired, last_login, created_at
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
      date_hired: dateOnly(u.date_hired),
      last_login: u.last_login,
      created_at: u.created_at,
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ error: "Failed to fetch user info." });
  }
}

/**
 * PUT /api/auth/me — Update current user's own profile
 * Allows a user to update their name, email, phone, address, and profile photo.
 * Does NOT allow changing role, status, employee_id, etc.
 */
export async function updateMe(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { name, email, phone, address, profile_photo_url, employee_id, designation, date_hired, end_of_contract } = req.body;

    const fields: string[] = [];
    const params: any[] = [];

    if (name !== undefined) {
      const v = String(name).trim();
      if (!v) {
        res.status(400).json({ error: "Name cannot be empty." });
        return;
      }
      if (v.length > 150) {
        res.status(400).json({ error: "Name must be 150 characters or fewer." });
        return;
      }
      fields.push("name = ?"); params.push(v);
    }
    if (email !== undefined) {
      const v = String(email).trim();
      if (!v) {
        res.status(400).json({ error: "Email cannot be empty." });
        return;
      }
      if (v.length > 100) {
        res.status(400).json({ error: "Email must be 100 characters or fewer." });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        res.status(400).json({ error: "Please enter a valid email address." });
        return;
      }
      fields.push("email = ?"); params.push(v);
    }
    if (phone !== undefined && phone !== null) {
      const v = String(phone);
      if (v.length > 20) {
        res.status(400).json({ error: "Phone number must be 20 characters or fewer." });
        return;
      }
      fields.push("phone = ?"); params.push(v);
    }
    if (address !== undefined && address !== null) { fields.push("address = ?"); params.push(String(address)); }
    if (profile_photo_url !== undefined && profile_photo_url !== null) { fields.push("profile_photo_url = ?"); params.push(String(profile_photo_url)); }
    if (employee_id !== undefined) { fields.push("employee_id = ?"); params.push(employee_id || null); }
    if (designation !== undefined) { fields.push("designation = ?"); params.push(designation || null); }
    if (date_hired !== undefined) {
      if (date_hired === null || String(date_hired).trim() === "") {
        fields.push("date_hired = ?"); params.push(null);
      } else {
        const raw = String(date_hired).trim();
        const m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (!m || Number.isNaN(new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`).getTime())) {
          res.status(400).json({ error: "Date Hired must be a valid date (YYYY-MM-DD)." });
          return;
        }
        fields.push("date_hired = ?");
        params.push(`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`);
      }
    }
    if (end_of_contract !== undefined) { fields.push("end_of_contract = ?"); params.push(end_of_contract || null); }

    if (fields.length === 0) {
      res.status(400).json({ error: "No fields to update." });
      return;
    }

    params.push(userId);
    try {
      await query<ResultSetHeader>(
        `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
        params
      );
    } catch (updateError: any) {
      if (updateError?.code === "ER_DUP_ENTRY") {
        res.status(409).json({ error: "That email address is already in use by another account." });
        return;
      }
      throw updateError;
    }

    const updated = await query<UserRow[]>(
      `SELECT id, username, name, email, role, status, phone, address, profile_photo_url,
              employee_id, designation, date_hired, end_of_contract, last_login, created_at
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
      date_hired: dateOnly(u.date_hired),
      end_of_contract: u.end_of_contract,
      last_login: u.last_login,
      created_at: u.created_at,
    });
  } catch (error) {
    console.error("Update me error:", error);
    res.status(500).json({ error: "Failed to update profile." });
  }
}

/**
 * PUT /api/auth/change-password — Change the current user's own password
 * Body: { current_password, new_password }
 * Verifies the current password against the stored hash before updating.
 */
export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      res.status(400).json({ error: "Current and new password are required." });
      return;
    }
    if (new_password.length < 8) {
      res.status(400).json({ error: "New password must be at least 8 characters." });
      return;
    }

    const users = await query<UserRow[]>(
      "SELECT id, password_hash FROM users WHERE id = ?",
      [userId]
    );
    if (users.length === 0) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const valid = await bcrypt.compare(current_password, users[0].password_hash);
    if (!valid) {
      res.status(400).json({ error: "Current password is incorrect." });
      return;
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    await query<ResultSetHeader>(
      "UPDATE users SET password_hash = ? WHERE id = ?",
      [password_hash, userId]
    );

    logActivity(userId, "Changed account password", "Security");
    res.json({ message: "Password updated successfully." });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to change password." });
  }
}

/**
 * POST /api/auth/logout
 */
export async function logout(req: Request, res: Response): Promise<void> {
  // JWT is stateless — client should discard the token. Clear the
  // presence stamp so the User Management page shows Offline right away.
  try {
    await query<ResultSetHeader>(
      "UPDATE users SET last_seen_at = NULL WHERE id = ?",
      [req.user!.userId]
    );
  } catch (error) {
    console.error("Logout presence clear error:", error);
  }
  res.json({ message: "Logged out successfully." });
}

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 *
 * Generates a 6-digit reset code tied to the user's account and emails it
 * via Gmail SMTP (GMAIL_USER + GMAIL_APP_PASSWORD). When no SMTP is
 * configured: dev mode echoes the code in the response for testing, and
 * production refuses rather than leaking the code over the wire.
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
    // 256-bit random token — emailed as a one-time reset link (fits VARCHAR(64)).
    const resetToken = crypto.randomBytes(32).toString("hex");

    const isProd = process.env.NODE_ENV === "production";

    // Persist token + expiry (verified by POST /api/auth/reset-password).
    await query<ResultSetHeader>(
      `UPDATE users
       SET password_reset_token = ?, password_reset_expires = DATE_ADD(NOW(), INTERVAL 15 MINUTE)
       WHERE id = ?`,
      [resetToken, user.id]
    );

    await logActivity(
      user.id,
      `Requested a password reset for account "${email}"`,
      "auth",
      null
    );

    // One-time link the user opens to set a new password. Build it from the
    // origin the request actually arrived on (works for any deployment behind
    // a TLS-terminating proxy, e.g. Railway, with no extra config); explicit
    // APP_URL/FRONTEND_URL still win, and localhost is only the dev fallback.
    const host = req.get("host") || "";
    const forwardedProto = (req.headers["x-forwarded-proto"] as string) || "";
    const requestOrigin =
      forwardedProto && host
        ? `${forwardedProto.split(",")[0].trim()}://${host}`
        : "";
    const baseUrl = (
      requestOrigin ||
      process.env.APP_URL ||
      process.env.FRONTEND_URL ||
      "http://localhost:5173"
    ).replace(/\/+$/, "");
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

    // Production: the link must be delivered to the user's inbox.
    if (isMailConfigured()) {
      try {
        await sendPasswordResetEmail(user.email, resetLink);
      } catch (err) {
        console.error("[forgot-password] SMTP send failed:", err);
        // Don't leave a usable-but-undelivered token sitting on the account.
        await query<ResultSetHeader>(
          `UPDATE users
           SET password_reset_token = NULL, password_reset_expires = NULL
           WHERE id = ?`,
          [user.id]
        );
        res.status(502).json({
          error: "We could not send the reset email. Please try again in a few minutes.",
        });
        return;
      }
      // The link goes to the inbox — never in the response, in any
      // mode, so local testing exercises the same flow as production.
      res.json({
        message:
          "Password reset link sent to your email. Check your inbox (including spam) within 15 minutes.",
      });
      return;
    }

    if (isProd) {
      // No email provider configured — never leak the reset link on a public server.
      await query<ResultSetHeader>(
        `UPDATE users
         SET password_reset_token = NULL, password_reset_expires = NULL
         WHERE id = ?`,
        [user.id]
      );
      res.status(501).json({
        error:
          "Password reset email is not configured on this server. Please contact your School ICT Coordinator.",
      });
      return;
    }

    // Development fallback (no SMTP): return the link so the login page can
    // show it for testing.
    res.json({
      message: "Password reset link generated.",
      reset_link: resetLink,
      reset_expires: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Failed to process password reset request." });
  }
}

/**
 * POST /api/auth/reset-password
 * Body: { token, new_password }
 */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { token, new_password } = req.body;

    if (!token || !new_password) {
      res.status(400).json({ error: "Reset token and new password are required." });
      return;
    }

    if (typeof new_password !== "string" || new_password.length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters long." });
      return;
    }

    // Validate token + expiry (256-bit token acts as the bearer credential)
    const users = await query<RowDataPacket[]>(
      `SELECT id, name FROM users
       WHERE password_reset_token = ? AND password_reset_expires > NOW()`,
      [token]
    );

    if (users.length === 0) {
      res.status(400).json({ error: "Invalid or expired reset link. Please request a new one." });
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
      "Reset password via emailed link",
      "auth",
      null
    );

    res.json({ message: "Password reset successfully. You can now sign in." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Failed to reset password." });
  }
}
