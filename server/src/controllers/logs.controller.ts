import { Request, Response } from "express";
import { query } from "../config/database";
import { RowDataPacket } from "mysql2";

const SORT_COLUMNS: Record<string, string> = {
  created_at: "al.created_at",
  user_name: "u.name",
  entity_type: "al.entity_type",
  action: "al.action",
};

/**
 * GET /api/logs — Paginated, filterable, sortable activity logs
 * Query: ?page=1&limit=50&user_id=1&entity_type=users&search=grade&sort_by=created_at&order=desc
 */
export async function listLogs(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;
    const { user_id, entity_type, action, search } = req.query;

    const sortByParam = (req.query.sort_by as string) || "created_at";
    const orderParam = ((req.query.order as string) || "desc").toLowerCase();
    const sortColumn = SORT_COLUMNS[sortByParam] || SORT_COLUMNS.created_at;
    const sortOrder = orderParam === "asc" ? "ASC" : "DESC";

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
    if (search) {
      conditions.push("(al.action LIKE ? OR u.name LIKE ? OR u.username LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      const where = " WHERE " + conditions.join(" AND ");
      countSql += where;
      dataSql += where;
    }

    const countResult = await query<RowDataPacket[]>(countSql, params);
    const total = countResult[0].total;

    // sortColumn comes from a fixed whitelist and order is a boolean flip,
    // so interpolating them is injection-safe. Limit/offset are interpolated
    // because MySQL/MariaDB prepared statements reject `LIMIT ? OFFSET ?`
    // (ER_WRONG_ARGUMENTS / errno 1210) when executed via pool.execute().
    dataSql += ` ORDER BY ${sortColumn} ${sortOrder}, al.id ${sortOrder === "ASC" ? "ASC" : "DESC"} LIMIT ${limit} OFFSET ${offset}`;
    const logs = await query<RowDataPacket[]>(dataSql, params);

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
