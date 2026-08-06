import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";

const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/* ─────────────── Excel helpers ─────────────── */

/** Normalize an LRN value from a spreadsheet cell to plain digits. */
function lrnFromCell(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v === null || cell.v === undefined) return "";
  if (cell.t === "n") return String(Math.round(cell.v as number));
  return String(cell.v).trim().replace(/\D/g, "");
}

/** Find the header row and the LRN / Name / Grade column indices. */
function findHeader(ws: XLSX.WorkSheet): { row: number; lrnCol: number; nameCol: number; gradeCol: number } | null {
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      row.push(cell ? String(cell.v).trim() : "");
    }
    const lrnCol = row.findIndex(x => /lrn/i.test(x));
    const gradeCol = row.findIndex(x => /grade/i.test(x));
    const nameCol = row.findIndex(x => /name/i.test(x));
    if (lrnCol >= 0 && gradeCol >= 0) {
      return { row: r, lrnCol, nameCol: nameCol >= 0 ? nameCol : lrnCol + 1, gradeCol };
    }
  }
  return null;
}

interface ParsedGradeRow {
  row: number;
  lrn: string;
  name: string;
  grade: number | null;
  status: "valid" | "skipped" | "invalid";
  error?: string;
}

/**
 * Parse a stored grade workbook against the document's section roster.
 * Returns rows with a status: valid (will import), skipped (no grade), or invalid.
 */
async function parseGradeWorkbook(doc: any): Promise<ParsedGradeRow[]> {
  if (!fs.existsSync(doc.file_path)) throw new Error("File not found on disk.");
  const wb = XLSX.readFile(doc.file_path);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const header = findHeader(ws);
  if (!header) throw new Error("Template format not recognized. Expected LRN, Student Name, and Grade columns.");

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");

  // Section roster for the document's school year
  const roster = await query<RowDataPacket[]>(
    `SELECT st.id AS student_id, st.lrn, st.name, e.id AS enrollment_id
     FROM enrollments e
     JOIN students st ON e.student_id = st.id
     WHERE e.section_id = ? AND e.school_year_id = ? AND e.status = 'enrolled'`,
    [doc.section_id, doc.school_year_id]
  );
  const rosterByLrn = new Map<string, any>();
  for (const r of roster as any[]) {
    rosterByLrn.set(String(r.lrn).replace(/\D/g, ""), r);
  }

  const rows: ParsedGradeRow[] = [];
  for (let r = header.row + 1; r <= range.e.r; r++) {
    const cell = (c: number) => ws[XLSX.utils.encode_cell({ r, c })];
    const lrn = lrnFromCell(cell(header.lrnCol));
    const name = cell(header.nameCol) ? String(cell(header.nameCol).v).trim() : "";

    if (!lrn) continue; // skip fully empty rows

    const gradeCell = cell(header.gradeCol);
    const gradeRaw = gradeCell ? gradeCell.v : null;
    const grade = gradeRaw === null || gradeRaw === undefined || gradeRaw === ""
      ? null
      : Number(gradeRaw);

    const entry = rosterByLrn.get(lrn);
    let status: ParsedGradeRow["status"] = "valid";
    let error: string | undefined;

    if (!entry) {
      status = "invalid";
      error = "LRN not enrolled in this section";
    } else if (grade === null) {
      status = "skipped";
    } else if (isNaN(grade)) {
      status = "invalid";
      error = "Grade is not a number";
    } else if (grade < 0 || grade > 100) {
      status = "invalid";
      error = "Grade must be between 0 and 100";
    }

    rows.push({
      row: r + 1,
      lrn,
      name: name || entry?.name || "",
      grade: status === "valid" ? grade : null,
      status,
      error,
    });
  }

  return rows;
}

/* ─────────────── Documents CRUD ─────────────── */

/**
 * GET /api/documents — List documents with filters
 */
export async function listDocuments(req: Request, res: Response): Promise<void> {
  try {
    const { student_id, section_id, subject_id, status, file_type } = req.query;

    let sql = `
      SELECT d.*, u.name AS uploaded_by_name,
             sec.name AS section_name, sub.name AS subject_name
      FROM uploaded_documents d
      JOIN users u ON d.uploaded_by = u.id
      LEFT JOIN sections sec ON d.section_id = sec.id
      LEFT JOIN subjects sub ON d.subject_id = sub.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (student_id) { conditions.push("d.student_id = ?"); params.push(parseInt(student_id as string)); }
    if (section_id) { conditions.push("d.section_id = ?"); params.push(parseInt(section_id as string)); }
    if (subject_id) { conditions.push("d.subject_id = ?"); params.push(parseInt(subject_id as string)); }
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
 * Fields: file, section_id, subject_id, school_year_id, quarter, record_count
 */
export async function uploadDocument(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded." });
      return;
    }

    const { student_id, section_id, subject_id, school_year_id, quarter, record_count } = req.body;

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
      `INSERT INTO uploaded_documents (student_id, section_id, subject_id, school_year_id, file_name, file_type, file_path, file_size, uploaded_by, record_count, quarter)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        student_id || null,
        section_id || null,
        subject_id || null,
        school_year_id || null,
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
 * GET /api/documents/template — Download an Excel template for one subject + quarter
 * Query: ?section_id&school_year_id&subject_id&quarter
 */
export async function getTemplate(req: Request, res: Response): Promise<void> {
  try {
    const section_id = parseInt(req.query.section_id as string);
    const school_year_id = parseInt(req.query.school_year_id as string);
    const subject_id = parseInt(req.query.subject_id as string);
    const quarter = parseInt(req.query.quarter as string);

    if (!section_id || !school_year_id || !subject_id || ![1, 2, 3, 4].includes(quarter)) {
      res.status(400).json({ error: "section_id, school_year_id, subject_id, and quarter (1-4) are required." });
      return;
    }

    const [subject, section, students] = await Promise.all([
      query<RowDataPacket[]>("SELECT name FROM subjects WHERE id = ?", [subject_id]),
      query<RowDataPacket[]>("SELECT name FROM sections WHERE id = ?", [section_id]),
      query<RowDataPacket[]>(
        `SELECT st.lrn, st.name FROM enrollments e
         JOIN students st ON e.student_id = st.id
         WHERE e.section_id = ? AND e.school_year_id = ? AND e.status = 'enrolled'
         ORDER BY st.name ASC`,
        [section_id, school_year_id]
      ),
    ]);

    if (subject.length === 0) { res.status(404).json({ error: "Subject not found." }); return; }
    if (section.length === 0) { res.status(404).json({ error: "Section not found." }); return; }

    const gradeHeader = `Grade (Q${quarter} — ${subject[0].name})`;

    const aoa: (string | number)[][] = [["LRN", "Student Name", gradeHeader]];
    for (const s of students as any[]) {
      // LRN kept as a string so Excel doesn't mangle it into scientific notation
      aoa.push([String(s.lrn), s.name, ""]);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Keep the LRN column as text to preserve leading zeros / formatting
    for (let r = 1; r < aoa.length; r++) {
      const cell = ws[`A${r + 1}`];
      if (cell) { cell.t = "s"; cell.z = "@"; }
    }
    ws["!cols"] = [{ wch: 18 }, { wch: 40 }, { wch: 24 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Grades");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const safe = (s: string) => s.replace(/[^\w-]+/g, "_");
    const fileName = `${safe(section[0].name)}_Q${quarter}_${safe(subject[0].name)}_template.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(buf);
  } catch (error) {
    console.error("Template generation error:", error);
    res.status(500).json({ error: "Failed to generate template." });
  }
}

/**
 * GET /api/documents/:id/preview — Parse an uploaded workbook and validate each row
 */
export async function previewDocument(req: Request, res: Response): Promise<void> {
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

    if (!doc.section_id || !doc.school_year_id) {
      res.status(400).json({ error: "Document is missing section/school year context. Re-upload with section selected." });
      return;
    }

    const rows = await parseGradeWorkbook(doc);
    res.json({ rows });
  } catch (error: any) {
    console.error("Preview document error:", error);
    res.status(400).json({ error: error.message || "Failed to parse document." });
  }
}

/**
 * POST /api/documents/:id/import — Write validated grades into the grades table
 */
export async function importDocument(req: Request, res: Response): Promise<void> {
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

    if (!doc.subject_id || !doc.school_year_id || !doc.section_id) {
      res.status(400).json({ error: "Document is missing subject/section/school year context. Re-upload with the subject selected." });
      return;
    }

    const rows = await parseGradeWorkbook(doc);
    const validRows = rows.filter(r => r.status === "valid");

    let imported = 0;
    let locked = 0;
    let failed = 0;

    for (const row of validRows) {
      const rosterRows = await query<RowDataPacket[]>(
        `SELECT e.id AS enrollment_id FROM enrollments e
         JOIN students st ON e.student_id = st.id
         WHERE e.section_id = ? AND e.school_year_id = ? AND e.status = 'enrolled'
           AND st.id = (SELECT id FROM students WHERE REPLACE(lrn, ' ', '') = ?)`,
        [doc.section_id, doc.school_year_id, row.lrn]
      );
      if (rosterRows.length === 0) { failed++; continue; }
      const enrollment_id = rosterRows[0].enrollment_id;
      const student_id = row.lrn; // placeholder, resolved below

      // Skip grades that are already locked
      const lockedCheck = await query<RowDataPacket[]>(
        `SELECT g.id FROM grades g
         JOIN students st ON g.student_id = st.id
         WHERE st.lrn = ? AND g.subject_id = ? AND g.school_year_id = ? AND g.quarter = ? AND g.is_locked = 1
         LIMIT 1`,
        [row.lrn, doc.subject_id, doc.school_year_id, doc.quarter]
      );
      if (lockedCheck.length > 0) { locked++; continue; }

      await query<ResultSetHeader>(
        `INSERT INTO grades (student_id, subject_id, enrollment_id, school_year_id, quarter, grade)
         VALUES ((SELECT id FROM students WHERE lrn = ?), ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE grade = VALUES(grade), updated_at = NOW()`,
        [row.lrn, doc.subject_id, enrollment_id, doc.school_year_id, doc.quarter, row.grade]
      );
      imported++;
    }

    const skipped = rows.filter(r => r.status === "skipped").length;
    const invalid = rows.filter(r => r.status === "invalid").length;

    await query<ResultSetHeader>(
      "UPDATE uploaded_documents SET status = 'imported', record_count = ? WHERE id = ?",
      [imported, id]
    );
    await logActivity(req.user!.userId, `Imported ${imported} grade(s) from document ID ${id} (${locked} locked, ${invalid} invalid)`, "grades", null);

    res.json({ imported, skipped, locked, failed, invalid });
  } catch (error) {
    console.error("Import document error:", error);
    res.status(500).json({ error: "Failed to import grades." });
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
