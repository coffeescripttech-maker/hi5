import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import { buildGradeTemplate } from "../utils/gradeTemplate";

const UPLOADS_DIR = path.resolve(
  __dirname,
  process.env.UPLOAD_DIR || "../../uploads"
);

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Resolve a stored upload path for reading on THIS machine.
 *
 * Rows uploaded on another deployment (e.g. a Docker container recording
 * /app/uploads/...) carry absolute paths that have no meaning locally, which
 * made every download fail with "File not found on disk." Documents are all
 * stored flat in UPLOADS_DIR keyed by their unique multer filename, so:
 *   1. If the stored path exists as-is (local absolute path), use it.
 *   2. Otherwise remap the path's basename onto UPLOADS_DIR.
 *   3. Otherwise fall back to path.resolve(stored) so the caller reports 404.
 */
function resolveStoredFile(storedPath: string): string {
  if (fs.existsSync(storedPath)) return storedPath;
  const remapped = path.join(UPLOADS_DIR, path.basename(storedPath));
  if (fs.existsSync(remapped)) return remapped;
  return path.resolve(storedPath);
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
  const fp = resolveStoredFile(doc.file_path);
  if (!fs.existsSync(fp)) throw new Error("File not found on disk.");
  const wb = XLSX.readFile(fp);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const header = findHeader(ws);
  if (!header) throw new Error("Template format not recognized. Expected LRN, Student Name, and Grade columns.");

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");

  // Strengthened SHS Curriculum: elective documents roster the learners who
  // picked the elective (across sections) instead of one section's enrollment.
  const subjRows = await query<RowDataPacket[]>(
    "SELECT subject_type FROM subjects WHERE id = ?",
    [doc.subject_id]
  );
  const isElectiveDoc =
    subjRows.length > 0 && subjRows[0].subject_type === "elective";

  // Roster for the document's school year
  const roster = isElectiveDoc
    ? await query<RowDataPacket[]>(
        `SELECT st.id AS student_id, st.lrn, st.name, e.id AS enrollment_id
         FROM student_electives se
         JOIN students st ON st.id = se.student_id
         JOIN enrollments e ON e.student_id = st.id
           AND e.school_year_id = se.school_year_id AND e.status = 'enrolled'
         WHERE se.subject_id = ? AND se.school_year_id = ?`,
        [doc.subject_id, doc.school_year_id]
      )
    : await query<RowDataPacket[]>(
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
      error = isElectiveDoc
        ? "LRN is not on this elective's roster"
        : "LRN not enrolled in this section";
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
 * GET /api/documents/my-documents — Documents for the teacher's assigned
 * subjects in the active school year (teacher-scoped).
 */
export async function getMyDocuments(req: Request, res: Response): Promise<void> {
  try {
    const teacherId = req.user!.userId;

    const docs = await query<RowDataPacket[]>(
      `SELECT d.*, u.name AS uploaded_by_name,
              sec.name AS section_name, sub.name AS subject_name
       FROM uploaded_documents d
       JOIN users u ON d.uploaded_by = u.id
       LEFT JOIN sections sec ON d.section_id = sec.id
       LEFT JOIN subjects sub ON d.subject_id = sub.id
       JOIN teacher_subject_assignments tsa
         ON d.subject_id = tsa.subject_id
        AND d.school_year_id = tsa.school_year_id
       WHERE tsa.teacher_id = ?
         AND tsa.school_year_id = (SELECT id FROM school_years WHERE is_current = 1 LIMIT 1)
       ORDER BY d.created_at DESC`,
      [teacherId]
    );

    res.json(docs);
  } catch (error) {
    console.error("List my documents error:", error);
    res.status(500).json({ error: "Failed to fetch documents." });
  }
}

/**
 * GET /api/documents/:id/download — Download a document
 */
export async function downloadDocument(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const docs = await query<RowDataPacket[]>(
      "SELECT * FROM uploaded_documents WHERE id = ?",
      [id]
    );

    if (docs.length === 0) {
      res.status(404).json({ error: "Document not found." });
      return;
    }

    const doc = docs[0];
    const filePath = resolveStoredFile(doc.file_path);

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

    // A grade workbook carries the quarter it populates; grades are Q1–Q3 only,
    // so reject an out-of-range quarter here rather than importing rows into a
    // quarter that the report cards never read.
    if (quarter !== undefined && quarter !== null && quarter !== "") {
      const q = Number(quarter);
      if (!Number.isInteger(q) || q < 1 || q > 3) {
        fs.unlinkSync(file.path);
        res.status(400).json({ error: "Quarter must be 1, 2, or 3." });
        return;
      }
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
        // Store the portable filename only — multer puts it in UPLOADS_DIR, and
        // resolveStoredFile() maps it back per-machine. Recording absolute
        // paths previously broke downloads when the deployment env changed.
        file.filename,
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

    if (!school_year_id || !subject_id || ![1, 2, 3].includes(quarter)) {
      res.status(400).json({ error: "school_year_id, subject_id, and quarter (1-3) are required." });
      return;
    }

    const subjectRow = await query<RowDataPacket[]>(
      "SELECT name, subject_type FROM subjects WHERE id = ?",
      [subject_id]
    );
    if (subjectRow.length === 0) {
      res.status(404).json({ error: "Subject not found." });
      return;
    }
    const isElective = subjectRow[0].subject_type === "elective";

    // Strengthened SHS Curriculum: electives roster the learners who picked the
    // subject, so no section is required — an elective-only teacher (no
    // advisory section) can still download their roster template.
    let sectionName = "Elective";
    if (!isElective) {
      if (!section_id) {
        res.status(400).json({ error: "section_id is required for this subject." });
        return;
      }
      const section = await query<RowDataPacket[]>(
        "SELECT name FROM sections WHERE id = ?",
        [section_id]
      );
      if (section.length === 0) {
        res.status(404).json({ error: "Section not found." });
        return;
      }
      sectionName = String(section[0].name);
    }

    let students: RowDataPacket[];
    if (isElective) {
      // Strengthened SHS Curriculum: an elective's template lists the learners
      // who picked it — across sections, not a whole section roster.
      students = await query<RowDataPacket[]>(
        `SELECT st.lrn, st.name FROM student_electives se
         JOIN students st ON st.id = se.student_id
         WHERE se.subject_id = ? AND se.school_year_id = ?
         ORDER BY st.name ASC`,
        [subject_id, school_year_id]
      );
    } else {
      students = await query<RowDataPacket[]>(
        `SELECT st.lrn, st.name FROM enrollments e
         JOIN students st ON e.student_id = st.id
         WHERE e.section_id = ? AND e.school_year_id = ? AND e.status = 'enrolled'
         ORDER BY st.name ASC`,
        [section_id, school_year_id]
      );
    }

    const buf = buildGradeTemplate({
      sectionName,
      subjectName: subjectRow[0].name,
      quarter,
      rows: (students as any[]).map(s => ({ lrn: String(s.lrn), name: String(s.name) })),
    });
    const safe = (s: string) => s.replace(/[^\w-]+/g, "_");
    const fileName = `${safe(sectionName)}_Q${quarter}_${safe(subjectRow[0].name)}_template.xlsx`;

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
    const id = req.params.id as string;
    const docs = await query<RowDataPacket[]>(
      "SELECT * FROM uploaded_documents WHERE id = ?",
      [id]
    );
    if (docs.length === 0) {
      res.status(404).json({ error: "Document not found." });
      return;
    }
    const doc = docs[0];

    // Electives don't need a section — their roster is the elective pickers.
    if (!doc.subject_id || !doc.school_year_id) {
      res.status(400).json({ error: "Document is missing subject/school year context. Re-upload with subject and school year selected." });
      return;
    }
    if (!doc.section_id) {
      const subj = await query<RowDataPacket[]>(
        "SELECT subject_type FROM subjects WHERE id = ?",
        [doc.subject_id]
      );
      const electiveOk = subj.length > 0 && subj[0].subject_type === "elective";
      if (!electiveOk) {
        res.status(400).json({ error: "Document is missing section/school year context. Re-upload with section selected." });
        return;
      }
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
    const id = req.params.id as string;
    const docs = await query<RowDataPacket[]>(
      "SELECT * FROM uploaded_documents WHERE id = ?",
      [id]
    );
    if (docs.length === 0) {
      res.status(404).json({ error: "Document not found." });
      return;
    }
    const doc = docs[0];

    // Electives don't need a section — their roster is the elective pickers.
    if (!doc.subject_id || !doc.school_year_id) {
      res.status(400).json({ error: "Document is missing subject/school year context. Re-upload with the subject selected." });
      return;
    }
    if (!doc.section_id) {
      const subjEarly = await query<RowDataPacket[]>(
        "SELECT subject_type FROM subjects WHERE id = ?",
        [doc.subject_id]
      );
      if (!(subjEarly.length > 0 && subjEarly[0].subject_type === "elective")) {
        res.status(400).json({ error: "Document is missing section context. Re-upload with the section selected." });
        return;
      }
    }

    // Grade rows are only meaningful for Q1–Q3; a workbook tagged outside that
    // range (e.g. an older Q4 upload) must not write unreachable grades.
    if (![1, 2, 3].includes(Number(doc.quarter))) {
      res.status(400).json({
        error: `This document is tagged for quarter ${doc.quarter ?? "none"}. Grades are recorded for quarters 1-3 only — re-upload against the correct quarter.`,
      });
      return;
    }

    const subjectRow = await query<RowDataPacket[]>(
      "SELECT name, subject_type FROM subjects WHERE id = ?",
      [doc.subject_id]
    );
    if (subjectRow.length === 0) {
      res.status(404).json({ error: "Subject not found." });
      return;
    }
    const isElectiveSubject = subjectRow[0].subject_type === "elective";

    // Teachers may only import grades for subjects assigned to them.
    if (req.user!.role === "teacher") {
      const allowed = await query<RowDataPacket[]>(
        `SELECT 1 FROM teacher_subject_assignments
         WHERE teacher_id = ? AND subject_id = ? AND (school_year_id = ? OR school_year_id IS NULL)
         LIMIT 1`,
        [req.user!.userId, doc.subject_id, doc.school_year_id]
      );
      if (allowed.length === 0) {
        res.status(403).json({ error: "Access denied: you may only import grades for subjects assigned to you." });
        return;
      }
    }

    const rows = await parseGradeWorkbook(doc);
    const validRows = rows.filter(r => r.status === "valid");

    let imported = 0;
    let locked = 0;
    let failed = 0;

    for (const row of validRows) {
      const rosterRows = isElectiveSubject
        // Strengthened SHS Curriculum: for electives the roster is the elective
        // pickers — enrollment may belong to any section.
        ? await query<RowDataPacket[]>(
            `SELECT e.id AS enrollment_id FROM student_electives se
             JOIN students st ON st.id = se.student_id
             JOIN enrollments e ON e.student_id = st.id
               AND e.school_year_id = se.school_year_id AND e.status = 'enrolled'
             WHERE se.subject_id = ? AND se.school_year_id = ?
               AND st.id = (SELECT id FROM students WHERE REPLACE(lrn, ' ', '') = ?)
             LIMIT 1`,
            [doc.subject_id, doc.school_year_id, row.lrn]
          )
        : await query<RowDataPacket[]>(
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
    const id = req.params.id as string;
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
