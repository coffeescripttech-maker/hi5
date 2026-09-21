import { Request, Response } from "express";
import { query } from "../config/database";
import { RowDataPacket } from "mysql2";
import ExcelJS from "exceljs";

/**
 * Escape a value for CSV output.
 * Handles commas, quotes, and newlines by wrapping in double quotes and escaping internal quotes.
 */
function esc(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[,"\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Build standard CSV response headers and pipe the CSV string.
 */
function sendCSV(res: Response, filename: string, csv: string): void {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send("﻿" + csv); // BOM for Excel UTF-8 compatibility
}

/**
 * Resolve the active school year id. If school_year_id query param is provided and valid,
 * use it; otherwise look up the current SY.
 */
async function resolveSY(req: Request): Promise<{ id: number; label: string }> {
  if (req.query.school_year_id) {
    const id = parseInt(req.query.school_year_id as string);
    const rows = await query<RowDataPacket[]>(
      "SELECT id, sy_label FROM school_years WHERE id = ?",
      [id]
    );
    if (rows.length > 0) return { id: rows[0].id, label: rows[0].sy_label };
  }
  const rows = await query<RowDataPacket[]>(
    "SELECT id, sy_label FROM school_years WHERE is_current = 1 LIMIT 1"
  );
  return rows.length > 0
    ? { id: rows[0].id, label: rows[0].sy_label }
    : { id: 0, label: "unknown" };
}

/**
 * Build a WHERE clause fragment and params array from common filters.
 * Returns { clause, params } — clause includes leading " AND " if conditions exist.
 */
function buildFilters(req: Request, syId: number): { clause: string; params: any[] } {
  const parts: string[] = ["e.school_year_id = ?"];
  const params: any[] = [syId];

  const gradeLevel = req.query.grade_level;
  if (gradeLevel) {
    parts.push("s.grade_level = ?");
    params.push(parseInt(gradeLevel as string));
  }

  const sectionId = req.query.section_id;
  if (sectionId) {
    parts.push("e.section_id = ?");
    params.push(parseInt(sectionId as string));
  }

  return { clause: " AND " + parts.join(" AND "), params };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared dataset builders — one source of truth for CSV, Excel, JSON & PDF.
// Each returns { title, sy_label, columns, rows } with RAW (un-escaped) values;
// the CSV exporter applies esc() at serialization time (identical output).
// ─────────────────────────────────────────────────────────────────────────────

export interface LisDataset {
  title: string;
  sy_label: string;
  columns: string[];
  rows: (string | number)[][];
}

/** Learner Profile — personal data + enrollment info. */
async function fetchLearnerProfile(req: Request): Promise<LisDataset | null> {
  const sy = await resolveSY(req);
  if (!sy.id) return null;

  const { clause, params } = buildFilters(req, sy.id);

  const students = await query<RowDataPacket[]>(
    `SELECT s.lrn, s.name, s.birthdate, s.sex, s.address,
            s.guardian, s.contact, s.grade_level,
            sec.name AS section_name,
            e.program, e.status AS enrollment_status
     FROM enrollments e
     JOIN students s ON e.student_id = s.id
     LEFT JOIN sections sec ON e.section_id = sec.id
     WHERE e.status IN ('enrolled','pending')${clause}
     ORDER BY s.grade_level, sec.name, s.name`,
    params
  );

  return {
    title: "Learner Profile",
    sy_label: sy.label,
    columns: ["LRN", "Learner Name", "Birthdate", "Sex", "Address", "Guardian", "Contact", "Grade Level", "Section", "Program", "Status"],
    rows: students.map((s: any) => [
      s.lrn ?? "", s.name ?? "", formatDate(s.birthdate), s.sex ?? "",
      s.address ?? "", s.guardian ?? "", s.contact ?? "", s.grade_level ?? "",
      s.section_name ?? "", s.program ?? "", s.enrollment_status ?? "",
    ]),
  };
}

/**
 * GET /api/lis/learner-profile
 * Query: ?school_year_id=&grade_level=&section_id=
 *
 * Exports all enrolled students with their personal details and enrollment info.
 */
export async function downloadLearnerProfile(req: Request, res: Response): Promise<void> {
  try {
    const ds = await fetchLearnerProfile(req);
    if (!ds) { res.status(400).json({ error: "No school year found." }); return; }

    sendCSV(res, `lis-learner-profile-${ds.sy_label}.csv`, datasetToCsv(ds));
  } catch (error) {
    console.error("LIS learner profile error:", error);
    res.status(500).json({ error: "Failed to generate learner profile CSV." });
  }
}

/** Grade Summary — pivoted per-subject quarterly grades + general average. */
async function fetchGradesExport(req: Request): Promise<LisDataset | null> {
  const sy = await resolveSY(req);
  if (!sy.id) return null;

  const { clause, params } = buildFilters(req, sy.id);

  // Get all subjects for the queried grade levels
  const subjects = await query<RowDataPacket[]>(
    `SELECT DISTINCT sub.id, sub.name
     FROM subjects sub
     WHERE sub.is_active = 1
     ORDER BY sub.name`
  );

  // Get students with their grades
  const gradeData = await query<RowDataPacket[]>(
    `SELECT s.id, s.lrn, s.name, s.grade_level,
            sec.name AS section_name,
            g.subject_id, g.quarter, g.grade
     FROM enrollments e
     JOIN students s ON e.student_id = s.id
     LEFT JOIN sections sec ON e.section_id = sec.id
     LEFT JOIN grades g ON g.student_id = s.id AND g.school_year_id = e.school_year_id
     WHERE e.status IN ('enrolled','pending')${clause}
     ORDER BY s.name, g.subject_id, g.quarter`,
    params
  );

  // Pivot data: student_id → { subject_id → { quarter → grade } }
  const subjectMap = new Map<number, { id: number; name: string }>();
  subjects.forEach((sub: any) => subjectMap.set(sub.id, { id: sub.id, name: sub.name }));

  const studentGrades = new Map<number, Map<number, any>>();
  const studentInfo = new Map<number, any>();

  for (const row of gradeData as any[]) {
    if (!studentInfo.has(row.id)) {
      studentInfo.set(row.id, {
        lrn: row.lrn,
        name: row.name,
        grade_level: row.grade_level,
        section_name: row.section_name,
      });
    }
    if (row.subject_id && row.grade !== null) {
      if (!studentGrades.has(row.id)) studentGrades.set(row.id, new Map());
      const subMap = studentGrades.get(row.id)!;
      if (!subMap.has(row.subject_id)) subMap.set(row.subject_id, {});
      subMap.get(row.subject_id)![row.quarter] = row.grade;
    }
  }

  const orderedSubjects: { id: number; name: string }[] = [];
  const columns = ["LRN", "Learner Name", "Grade Level", "Section"];
  subjectMap.forEach((sub) => {
    orderedSubjects.push(sub);
    columns.push(`${sub.name}_Q1`, `${sub.name}_Q2`, `${sub.name}_Q3`, `${sub.name}_Q4`);
  });
  columns.push("General Average", "Promotion Status");

  const rows: (string | number)[][] = [];
  for (const [studentId, info] of studentInfo) {
    const grades = studentGrades.get(studentId) || new Map();
    const allGrades: number[] = [];
    const subjectGrades: (string | number)[] = [];

    orderedSubjects.forEach((sub) => {
      const qGrades = grades.get(sub.id);
      for (let q = 1; q <= 4; q++) {
        const g = qGrades?.[q];
        subjectGrades.push(g !== undefined ? String(g) : "");
        if (g !== undefined && g !== null) allGrades.push(Number(g));
      }
    });

    const ga = allGrades.length > 0
      ? (allGrades.reduce((a, b) => a + b, 0) / allGrades.length).toFixed(2)
      : "";
    const promoted = ga ? (parseFloat(ga) >= 75 ? "PROMOTED" : "RETAINED") : "";

    rows.push([
      info.lrn ?? "", info.name ?? "", info.grade_level ?? "", info.section_name ?? "",
      ...subjectGrades, ga, promoted,
    ]);
  }

  return { title: "Grade Summary", sy_label: sy.label, columns, rows };
}

/**
 * GET /api/lis/grades
 * Query: ?school_year_id=&grade_level=&section_id=
 *
 * Exports students with their subject grades per quarter, general average,
 * and promotion status. Subjects are pivoted into columns dynamically.
 */
export async function downloadGrades(req: Request, res: Response): Promise<void> {
  try {
    const ds = await fetchGradesExport(req);
    if (!ds) { res.status(400).json({ error: "No school year found." }); return; }

    sendCSV(res, `lis-grades-${ds.sy_label}.csv`, datasetToCsv(ds));
  } catch (error) {
    console.error("LIS grades error:", error);
    res.status(500).json({ error: "Failed to generate grades CSV." });
  }
}

/** Enrolled List — program/track info + classifications. */
async function fetchEnrolledList(req: Request): Promise<LisDataset | null> {
  const sy = await resolveSY(req);
  if (!sy.id) return null;

  const { clause, params } = buildFilters(req, sy.id);

  const students = await query<RowDataPacket[]>(
    `SELECT s.lrn, s.name, s.grade_level, s.sex, s.guardian,
            sec.name AS section_name,
            e.program, e.enrollment_date, e.status AS enrollment_status,
            st.code AS track_code,
            GROUP_CONCAT(DISTINCT sc.classification SEPARATOR '|') AS classifications
     FROM enrollments e
     JOIN students s ON e.student_id = s.id
     LEFT JOIN sections sec ON e.section_id = sec.id
     LEFT JOIN strand_tracks st ON e.strand_track_id = st.id
     LEFT JOIN student_classifications sc ON sc.student_id = s.id AND sc.school_year_id = e.school_year_id
     WHERE e.status IN ('enrolled','pending')${clause}
     GROUP BY s.id, s.lrn, s.name, s.grade_level, s.sex, s.guardian,
              sec.name, e.program, e.enrollment_date, e.status, st.code
     ORDER BY s.grade_level, sec.name, s.name`,
    params
  );

  return {
    title: "Enrolled List",
    sy_label: sy.label,
    columns: ["LRN", "Learner Name", "Grade Level", "Sex", "Section", "Program", "Track", "Guardian", "Classifications", "Enrollment Date", "Status"],
    rows: students.map((s: any) => [
      s.lrn ?? "", s.name ?? "", s.grade_level ?? "", s.sex ?? "",
      s.section_name ?? "", s.program ?? "", s.track_code ?? "",
      s.guardian ?? "", s.classifications ?? "", formatDate(s.enrollment_date), s.enrollment_status ?? "",
    ]),
  };
}

/**
 * GET /api/lis/enrolled-list
 * Query: ?school_year_id=&grade_level=&section_id=
 *
 * Exports currently enrolled students with program/track info and classifications.
 */
export async function downloadEnrolledList(req: Request, res: Response): Promise<void> {
  try {
    const ds = await fetchEnrolledList(req);
    if (!ds) { res.status(400).json({ error: "No school year found." }); return; }

    sendCSV(res, `lis-enrolled-list-${ds.sy_label}.csv`, datasetToCsv(ds));
  } catch (error) {
    console.error("LIS enrolled list error:", error);
    res.status(500).json({ error: "Failed to generate enrolled list CSV." });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Serialization helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Serialize a dataset to CSV (esc applied here, output identical to legacy). */
function datasetToCsv(ds: LisDataset): string {
  const lines = [ds.columns.map(esc).join(",")];
  for (const r of ds.rows) lines.push(r.map(esc).join(","));
  return lines.join("\n");
}

/**
 * Send a dataset as a styled Excel (.xlsx) workbook:
 *  - merged navy title + school-year banner rows
 *  - bold, centered, colored header row with frozen pane
 *  - thin borders everywhere + zebra striping on body rows
 *  - auto-sized columns (text/LRN-safe, no scientific notation)
 *  - autofilter on the header row
 */
async function sendXlsx(res: Response, filename: string, ds: LisDataset): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("LIS Export", {
    views: [{ state: "frozen", ySplit: 4 }],
  });

  const lastCol = (ExcelJS as any).utils.getExcelLetter(ds.columns.length);

  // Row 1 — merged title (navy fill, white bold text).
  ws.mergeCells(`A1:${lastCol}1`);
  const titleCell = ws.getCell("A1");
  titleCell.value = ds.title;
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
  ws.getRow(1).height = 28;

  // Row 2 — school-year banner (light blue fill).
  ws.mergeCells(`A2:${lastCol}2`);
  const subCell = ws.getCell("A2");
  subCell.value = `Department of Education · School Year ${ds.sy_label}`;
  subCell.font = { bold: true, size: 11, color: { argb: "FF1F2937" } };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
  ws.getRow(2).height = 22;

  // Row 4 — header row (indigo fill, white bold, centered, wrapped).
  const headerRow = ws.getRow(4);
  ds.columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46A5" } };
  });
  headerRow.height = 24;

  // Body rows (5+) — thin borders, zebra striping.
  ds.rows.forEach((row, r) => {
    const excelRow = ws.getRow(5 + r);
    row.forEach((v, i) => {
      const cell = excelRow.getCell(i + 1);
      cell.value = v;
      cell.border = {
        top: { style: "thin", color: { argb: "FFD1D5DB" } },
        bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
        left: { style: "thin", color: { argb: "FFD1D5DB" } },
        right: { style: "thin", color: { argb: "FFD1D5DB" } },
      };
      if (r % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5FF" } };
      }
      cell.alignment = { vertical: "middle", wrapText: true };
    });
  });

  // Content-based column widths, clamped for readability.
  ds.columns.forEach((c, i) => {
    const w = ws.getColumn(i + 1);
    let max = String(c).length;
    for (const r of ds.rows) {
      const v = r[i];
      if (v !== null && v !== undefined && String(v).length > max) max = String(v).length;
    }
    w.width = Math.min(Math.max(max + 2, 10), 45);
  });

  if (ds.rows.length > 0) {
    ws.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: 4 + ds.rows.length, column: ds.columns.length },
    };
  }

  const buf = await wb.xlsx.writeBuffer();
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(Buffer.from(buf));
}

/** Shared handler body for the three .xlsx endpoints. */
async function handleXlsx(
  req: Request,
  res: Response,
  fetcher: (r: Request) => Promise<LisDataset | null>,
  baseName: string,
  errorLabel: string
): Promise<void> {
  try {
    const ds = await fetcher(req);
    if (!ds) { res.status(400).json({ error: "No school year found." }); return; }
    await sendXlsx(res, `${baseName}-${ds.sy_label}.xlsx`, ds);
  } catch (error) {
    console.error(`${errorLabel} XLSX error:`, error);
    res.status(500).json({ error: `Failed to generate ${errorLabel} Excel file.` });
  }
}

/**
 * GET /api/lis/learner-profile.xlsx — official Excel workbook (Registrar).
 */
export async function downloadLearnerProfileXlsx(req: Request, res: Response): Promise<void> {
  await handleXlsx(req, res, fetchLearnerProfile, "lis-learner-profile", "learner profile");
}

/**
 * GET /api/lis/grades.xlsx — official Excel workbook (Registrar).
 */
export async function downloadGradesXlsx(req: Request, res: Response): Promise<void> {
  await handleXlsx(req, res, fetchGradesExport, "lis-grades", "grades");
}

/**
 * GET /api/lis/enrolled-list.xlsx — official Excel workbook (Registrar).
 */
export async function downloadEnrolledListXlsx(req: Request, res: Response): Promise<void> {
  await handleXlsx(req, res, fetchEnrolledList, "lis-enrolled-list", "enrolled list");
}

/**
 * GET /api/lis/data?card=learner-profile|grades|enrolled-list
 *
 * Returns the same dataset as JSON so clients can compose high-quality
 * official PDF documents (headers, school info, borders, spacing) and print
 * them through the existing /api/pdf/render pipeline.
 */
export async function lisData(req: Request, res: Response): Promise<void> {
  try {
    const card = String(req.query.card || "");
    let ds: LisDataset | null = null;
    if (card === "learner-profile") ds = await fetchLearnerProfile(req);
    else if (card === "grades") ds = await fetchGradesExport(req);
    else if (card === "enrolled-list") ds = await fetchEnrolledList(req);
    else {
      res.status(400).json({ error: "Unknown export type. Use card=learner-profile|grades|enrolled-list." });
      return;
    }
    if (!ds) { res.status(400).json({ error: "No school year found." }); return; }
    res.json(ds);
  } catch (error) {
    console.error("LIS data error:", error);
    res.status(500).json({ error: "Failed to fetch export data." });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(d: any): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toISOString().slice(0, 10); // YYYY-MM-DD
}
