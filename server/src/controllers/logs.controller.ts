import { Request, Response } from "express";
import { query } from "../config/database";
import { RowDataPacket } from "mysql2";

/**
 * GET /api/logs — Paginated activity logs
 * Query: ?page=1&limit=50&user_id=1&entity_type=users
 */
export async function listLogs(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;
    const { user_id, entity_type, action } = req.query;

    let countSql = "SELECT COUNT(*) AS total FROM activity_logs al LEFT JOIN users u ON al.user_id = u.id";
    let dataSql = `SELECT al.*, u.name AS user_name, u.username FROM activity_logs al LEFT JOIN users u ON al.user_id = u.id`;
    const params: any[] = [];
    const conditions: string[] = [];

    if (user_id) {
      conditions.push("al.user_id = ?");
      params.push(parseInt(user_id as string));
    }
    if (entity_type) {
      conditions.push("al.entity_type = ?");
      params.push(entity_type);
    }
    if (action) {
      conditions.push("al.action LIKE ?");
      params.push(`%${action}%`);
    }

    if (conditions.length > 0) {
      const where = " WHERE " + conditions.join(" AND ");
      countSql += where;
      dataSql += where;
    }

    const countResult = await query<RowDataPacket[]>(countSql, params);
    const total = countResult[0].total;

    dataSql += " ORDER BY al.created_at DESC LIMIT ? OFFSET ?";
    const logs = await query<RowDataPacket[]>(dataSql, [...params, limit, offset]);

    res.json({
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("List logs error:", error);
    res.status(500).json({ error: "Failed to fetch activity logs." });
  }
}
