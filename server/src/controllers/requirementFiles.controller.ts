/**
 * Digital Requirements Upload (client revision §A).
 *
 * Scanned copies of enrollment requirements attached to the learner's
 * Enrollment Document Checklist. Physical documents stay with the school.
 *
 * Permissions (per client doc):
 *   Upload / Replace / Delete: Enrollment Committee, Registrar
 *   View:                      Enrollment Committee, Registrar, Administrator
 *   Teacher / Principal:       no access at all
 *
 * Storage: private — files are renamed (UUID), stored under
 * uploads/enrollment-docs/, and served only through an authenticated
 * endpoint. No public links. Max 5 MB per file, max 3 files per
 * requirement. Actual file content is validated (magic bytes), not just
 * the extension. Accepted: PDF, JPG/JPEG, PNG.
 *
 * Uploading does NOT check the checklist item; checking does NOT require a
 * file. Every action is recorded in the Activity Log.
 */
import { Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { query, getConnection } from "../config/database";
import { logActivity } from "../utils/activityLogger";

const DOCS_DIR = path.resolve(
  __dirname,
  process.env.UPLOAD_DIR ? "../../uploads/enrollment-docs" : "../../uploads/enrollment-docs"
);
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILES_PER_REQUIREMENT = 3;
const ALLOWED = {
  pdf: { mime: "application/pdf", magic: Buffer.from([0x25, 0x50, 0x44, 0x46]) },
  jpg: { mime: "image/jpeg", magic: Buffer.from([0xff, 0xd8, 0xff]) },
  png: { mime: "image/png", magic: Buffer.from([0x89, 0x50, 0x4e, 0x47]) }
} as const;

/** Can this role upload/replace/delete? (Committee + Registrar per client doc) */
function canManage(role: string): boolean {
  return role === "registrar" || role === "enrollment_committee";
}

/** Can this role view files? (Committee + Registrar + Administrator) */
function canView(role: string): boolean {
  return canManage(role) || role === "admin";
}

function ensureDir(): void {
  if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
}

/** Detect the real file type from magic bytes. */
function detectType(buf: Buffer): "pdf" | "jpg" | "png" | null {
  for (const [ext, spec] of Object.entries(ALLOWED)) {
    if (buf.subarray(0, spec.magic.length).equals(spec.magic)) {
      return ext as "pdf" | "jpg" | "png";
    }
  }
  return null;
}

async function loadEnrollment(enrollmentId: number) {
  const rows = await query<RowDataPacket[]>(
    "SELECT id, student_id, school_year_id FROM enrollments WHERE id = ? LIMIT 1",
    [enrollmentId]
  );
  return rows[0] || null;
}

/** GET /api/enrollments/:id/requirement-files — list grouped by requirement. */
export async function listRequirementFiles(req: Request, res: Response): Promise<void> {
  const enrollmentId = parseInt(req.params.id as string);
  if (!Number.isInteger(enrollmentId)) {
    res.status(400).json({ error: "Invalid enrollment id." });
    return;
  }
  if (!canView(req.user!.role)) {
    res.status(403).json({ error: "You do not have access to requirement files." });
    return;
  }
  const rows = await query<RowDataPacket[]>(
    `SELECT f.id, f.enrollment_id, f.requirement_key, f.original_name, f.mime_type,
            f.file_size, f.uploaded_by, u.name AS uploaded_by_name, f.created_at
       FROM enrollment_requirement_files f
       JOIN users u ON u.id = f.uploaded_by
      WHERE f.enrollment_id = ?
      ORDER BY f.requirement_key ASC, f.created_at ASC`,
    [enrollmentId]
  );
  res.json(rows);
}

/**
 * POST /api/enrollments/:id/requirements/:key/files — multipart "file".
 * Committee/Registrar. ≤5 MB, ≤3 files per requirement, content-validated.
 */
export async function uploadRequirementFile(req: Request, res: Response): Promise<void> {
  const enrollmentId = parseInt(req.params.id as string);
  const key = String(req.params.key || "").trim();
  if (!Number.isInteger(enrollmentId) || !key) {
    res.status(400).json({ error: "Invalid enrollment or requirement." });
    return;
  }
  if (!canManage(req.user!.role)) {
    res.status(403).json({ error: "Only the Enrollment Committee or Registrar can upload requirement files." });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded." });
    return;
  }
  const buf = req.file.buffer;
  if (buf.length > MAX_FILE_BYTES) {
    res.status(400).json({ error: "The file exceeds the 5 MB limit." });
    return;
  }
  const ext = detectType(buf);
  if (!ext) {
    res.status(400).json({ error: "Only PDF, JPG/JPEG, or PNG files are accepted (the file content must match)." });
    return;
  }
  const enrollment = await loadEnrollment(enrollmentId);
  if (!enrollment) {
    res.status(404).json({ error: "Enrollment not found." });
    return;
  }

  const countRows = await query<RowDataPacket[]>(
    "SELECT COUNT(*) n FROM enrollment_requirement_files WHERE enrollment_id = ? AND requirement_key = ?",
    [enrollmentId, key]
  );
  if (countRows[0].n >= MAX_FILES_PER_REQUIREMENT) {
    res.status(400).json({ error: `A requirement can hold up to ${MAX_FILES_PER_REQUIREMENT} files.` });
    return;
  }

  ensureDir();
  const storedName = `${randomUUID()}.${ext}`;
  const filePath = path.join(DOCS_DIR, storedName);
  fs.writeFileSync(filePath, buf);

  const result = await query<ResultSetHeader>(
    `INSERT INTO enrollment_requirement_files (enrollment_id, requirement_key, file_path, original_name, mime_type, file_size, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [enrollmentId, key, filePath, req.file.originalname.slice(0, 150), ALLOWED[ext].mime, buf.length, req.user!.userId]
  );

  logActivity(
    req.user!.userId,
    `Uploaded requirement file "${req.file.originalname}" (${key}) — enrollment ID ${enrollmentId}`,
    "enrollments",
    enrollmentId
  );

  const saved = await query<RowDataPacket[]>(
    "SELECT id, requirement_key, original_name, mime_type, file_size, created_at FROM enrollment_requirement_files WHERE id = ?",
    [result.insertId]
  );
  res.status(201).json(saved[0]);
}

/**
 * GET /api/enrollments/:id/requirements/:key/files/:fileId — stream a file
 * (Committee/Registrar/Administrator; private, no public links).
 */
export async function viewRequirementFile(req: Request, res: Response): Promise<void> {
  const enrollmentId = parseInt(req.params.id as string);
  const fileId = parseInt(req.params.fileId as string);
  if (!Number.isInteger(enrollmentId) || !Number.isInteger(fileId)) {
    res.status(400).json({ error: "Invalid identifiers." });
    return;
  }
  if (!canView(req.user!.role)) {
    res.status(403).json({ error: "You do not have access to requirement files." });
    return;
  }
  const rows = await query<RowDataPacket[]>(
    "SELECT * FROM enrollment_requirement_files WHERE id = ? AND enrollment_id = ? LIMIT 1",
    [fileId, enrollmentId]
  );
  if (rows.length === 0) {
    res.status(404).json({ error: "File not found." });
    return;
  }
  const f = rows[0];
  if (!fs.existsSync(String(f.file_path))) {
    res.status(404).json({ error: "File not found on disk." });
    return;
  }
  res.setHeader("Content-Type", String(f.mime_type));
  res.setHeader("Content-Disposition", `inline; filename="${String(f.original_name).replace(/"/g, "")}"`);
  fs.createReadStream(String(f.file_path)).pipe(res);
}

/**
 * DELETE /api/enrollments/:id/requirements/:key/files/:fileId
 * Committee/Registrar; the file and row are removed, action logged.
 */
export async function deleteRequirementFile(req: Request, res: Response): Promise<void> {
  const enrollmentId = parseInt(req.params.id as string);
  const fileId = parseInt(req.params.fileId as string);
  if (!Number.isInteger(enrollmentId) || !Number.isInteger(fileId)) {
    res.status(400).json({ error: "Invalid identifiers." });
    return;
  }
  if (!canManage(req.user!.role)) {
    res.status(403).json({ error: "Only the Enrollment Committee or Registrar can delete requirement files." });
    return;
  }
  const rows = await query<RowDataPacket[]>(
    "SELECT * FROM enrollment_requirement_files WHERE id = ? AND enrollment_id = ? LIMIT 1",
    [fileId, enrollmentId]
  );
  if (rows.length === 0) {
    res.status(404).json({ error: "File not found." });
    return;
  }
  const f = rows[0];
  await query("DELETE FROM enrollment_requirement_files WHERE id = ?", [fileId]);
  try {
    if (fs.existsSync(String(f.file_path))) fs.unlinkSync(String(f.file_path));
  } catch {
    /* disk cleanup is best-effort; the row is already gone */
  }
  logActivity(
    req.user!.userId,
    `Deleted requirement file "${f.original_name}" (${f.requirement_key}) — enrollment ID ${enrollmentId}`,
    "enrollments",
    enrollmentId
  );
  res.json({ message: "File deleted." });
}
