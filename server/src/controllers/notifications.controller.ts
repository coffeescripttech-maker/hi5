import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";

/**
 * GET /api/notifications — List notifications for the current user
 * Shows: personal notifications + role broadcast + unread count
 */
export async function listNotifications(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    const notifications = await query<RowDataPacket[]>(
      `SELECT n.*, nr.read_at IS NOT NULL AS is_read
       FROM notifications n
       LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = ?
       WHERE n.user_id = ? OR n.user_id IS NULL
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [userId, userId]
    );

    // Get unread count
    const unreadResult = await query<RowDataPacket[]>(
      `SELECT COUNT(*) AS unread_count FROM notifications n
       LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = ?
       WHERE (n.user_id = ? OR n.user_id IS NULL) AND nr.id IS NULL`,
      [userId, userId]
    );

    res.json({
      notifications,
      unread_count: unreadResult[0]?.unread_count || 0,
    });
  } catch (error) {
    console.error("List notifications error:", error);
    res.status(500).json({ error: "Failed to fetch notifications." });
  }
}

/**
 * POST /api/notifications — Create a notification (admin only)
 * Body: { title, message, type?, user_id?, role? }
 */
export async function createNotification(req: Request, res: Response): Promise<void> {
  try {
    const { title, message, type, user_id, role } = req.body;

    if (!title || !message) {
      res.status(400).json({ error: "title and message are required." });
      return;
    }

    const notifType = type || "info";
    const validTypes = ["info", "success", "warning", "error", "security"];
    if (!validTypes.includes(notifType)) {
      res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(", ")}` });
      return;
    }

    const result = await query<ResultSetHeader>(
      `INSERT INTO notifications (user_id, role, type, title, message)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id || null, role || null, notifType, title, message]
    );

    await logActivity(req.user!.userId, `Created notification: "${title}"`, "notifications", result.insertId);

    const newNotif = await query<RowDataPacket[]>("SELECT * FROM notifications WHERE id = ?", [result.insertId]);
    res.status(201).json(newNotif[0]);
  } catch (error) {
    console.error("Create notification error:", error);
    res.status(500).json({ error: "Failed to create notification." });
  }
}

/**
 * POST /api/notifications/:id/read — Mark a notification as read
 */
export async function markAsRead(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Check notification exists
    const notif = await query<RowDataPacket[]>("SELECT id FROM notifications WHERE id = ?", [id]);
    if (notif.length === 0) {
      res.status(404).json({ error: "Notification not found." });
      return;
    }

    // Insert read record (ignore duplicate)
    await query<ResultSetHeader>(
      "INSERT IGNORE INTO notification_reads (notification_id, user_id) VALUES (?, ?)",
      [id, userId]
    );

    res.json({ message: "Notification marked as read." });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({ error: "Failed to mark notification as read." });
  }
}

/**
 * POST /api/notifications/read-all — Mark all notifications as read for current user
 */
export async function markAllAsRead(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    // Get unread notifications for this user
    const unread = await query<RowDataPacket[]>(
      `SELECT id FROM notifications n
       LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = ?
       WHERE (n.user_id = ? OR n.user_id IS NULL) AND nr.id IS NULL`,
      [userId, userId]
    );

    for (const n of unread) {
      await query<ResultSetHeader>(
        "INSERT IGNORE INTO notification_reads (notification_id, user_id) VALUES (?, ?)",
        [n.id, userId]
      );
    }

    res.json({ message: `Marked ${unread.length} notification(s) as read.` });
  } catch (error) {
    console.error("Mark all as read error:", error);
    res.status(500).json({ error: "Failed to mark notifications as read." });
  }
}
