import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import path from "path";
import fs from "fs";

const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * GET /api/documents — List documents with filters
 */
export async function listDocuments(req: Request, res: Response): Promise<void> {
  try {
    const { student_id, section_id, status, file_type } = req.query;

    let sql = `
      SELECT d.*, u.name AS uploaded_by_name
      FROM uploaded_documents d
      JOIN users u ON d.uploaded_by = u.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (student_id) { conditions.push("d.student_id = ?"); params.push(parseInt(student_id as string)); }
    if (section_id) { conditions.push("d.section_id = ?"); params.push(parseInt(section_id as string)); }
    if (status) { conditions.push("d.status = ?"); params.push(status); }
    if (file_type) { conditions.push("d.file_type = ?"); params.push(file_type); }

    if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY d.created_at DESC";

    const docs = await query<RowDataPacket[]>(sql, params);
    res.json(docs);
  } catch (error) {
    console.error("List documents error:", error);
    res.status(500).json({ error: "Failed to fetch documents." });
  }
}

/**
 * GET /api/documents/:id/download — Download a document
 */
export async function downloadDocument(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const docs = await query<RowDataPacket[]>(
      "SELECT * FROM uploaded_documents WHERE id = ?",
      [id]
    );

    if (docs.length === 0) {
      res.status(404).json({ error: "Document not found." });
      return;
    }

    const doc = docs[0];
    const filePath = path.resolve(doc.file_path);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found on disk." });
      return;
    }

    res.download(filePath, doc.file_name);
  } catch (error) {
    console.error("Download document error:", error);
    res.status(500).json({ error: "Failed to download document." });
  }
}

/**
 * POST /api/documents/upload — Upload a document (multipart)
 */
export async function uploadDocument(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded." });
      return;
    }

    const { student_id, section_id, quarter, record_count } = req.body;

    const file = req.file;
    const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
    const allowedTypes = ["pdf", "xlsx", "xls", "docx"];

    if (!allowedTypes.includes(ext)) {
      // Remove uploaded file
      fs.unlinkSync(file.path);
      res.status(400).json({ error: `Invalid file type "${ext}". Allowed: ${allowedTypes.join(", ")}` });
      return;
    }

    const result = await query<ResultSetHeader>(
      `INSERT INTO uploaded_documents (student_id, section_id, file_name, file_type, file_path, file_size, uploaded_by, record_count, quarter)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        student_id || null,
        section_id || null,
        file.originalname,
        ext,
        file.path,
        file.size,
        req.user!.userId,
        record_count || null,
        quarter || null,
      ]
    );

    await logActivity(
      req.user!.userId,
      `Uploaded document: ${file.originalname} (${(file.size / 1024).toFixed(1)} KB)`,
      "uploaded_documents",
      result.insertId
    );

    const newDoc = await query<RowDataPacket[]>(
      "SELECT * FROM uploaded_documents WHERE id = ?",
      [result.insertId]
    );

    res.status(201).json(newDoc[0]);
  } catch (error) {
    console.error("Upload document error:", error);
    res.status(500).json({ error: "Failed to upload document." });
  }
}

/**
 * PUT /api/documents/:id/status — Update document status
 * Body: { status: "validated" | "imported" | "failed" }
 */
export async function updateDocumentStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["pending", "validated", "imported", "failed"];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
      return;
    }

    const existing = await query<RowDataPacket[]>("SELECT id FROM uploaded_documents WHERE id = ?", [id]);
    if (existing.length === 0) {
      res.status(404).json({ error: "Document not found." });
      return;
    }

    await query<ResultSetHeader>("UPDATE uploaded_documents SET status = ? WHERE id = ?", [status, id]);
    await logActivity(req.user!.userId, `Updated document ID ${id} status to ${status}`, "uploaded_documents", id);

    res.json({ message: "Document status updated.", status });
  } catch (error) {
    console.error("Update document status error:", error);
    res.status(500).json({ error: "Failed to update document status." });
  }
}
