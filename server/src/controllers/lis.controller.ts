import { Request, Response } from "express";
import { query } from "../config/database";
import { RowDataPacket } from "mysql2";

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
// 1. Learner Profile CSV
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/lis/learner-profile
 * Query: ?school_year_id=&grade_level=&section_id=
 *
 * Exports all enrolled students with their personal details and enrollment info.
 */
export async function downloadLearnerProfile(req: Request, res: Response): Promise<void> {
  try {
    const sy = await resolveSY(req);
    if (!sy.id) { res.status(400).json({ error: "No school year found." }); return; }

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

    const header = "LRN,Learner Name,Birthdate,Sex,Address,Guardian,Contact,Grade Level,Section,Program,Status";
    const rows = students.map(s =>
      [esc(s.lrn), esc(s.name), esc(formatDate(s.birthdate)), esc(s.sex),
       esc(s.address), esc(s.guardian), esc(s.contact), esc(s.grade_level),
       esc(s.section_name), esc(s.program), esc(s.enrollment_status)].join(",")
    );

    sendCSV(res, `lis-learner-profile-${sy.label}.csv`, [header, ...rows].join("\n"));
  } catch (error) {
    console.error("LIS learner profile error:", error);
    res.status(500).json({ error: "Failed to generate learner profile CSV." });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Grade Summary CSV
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/lis/grades
 * Query: ?school_year_id=&grade_level=&section_id=
 *
 * Exports students with their subject grades per quarter, general average,
 * and promotion status. Subjects are pivoted into columns dynamically.
 */
export async function downloadGrades(req: Request, res: Response): Promise<void> {
  try {
    const sy = await resolveSY(req);
    if (!sy.id) { res.status(400).json({ error: "No school year found." }); return; }

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

    // Compute general averages and promotion status per student
    const subjectMap = new Map<number, { id: number; name: string }>();
    subjects.forEach((sub: any) => subjectMap.set(sub.id, { id: sub.id, name: sub.name }));

    // Pivot data: student_id → { subject_id → { quarter → grade } }
    const studentGrades = new Map<number, any>();
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
        const subMap = studentGrades.get(row.id);
        if (!subMap.has(row.subject_id)) subMap.set(row.subject_id, {});
        subMap.get(row.subject_id)[row.quarter] = row.grade;
      }
    }

    // Build header
    const subjHeaders: string[] = [];
    const subjNames: string[] = [];
    subjectMap.forEach((sub) => {
      subjNames.push(sub.name);
      subjHeaders.push(`${esc(sub.name)}_Q1`, `${esc(sub.name)}_Q2`, `${esc(sub.name)}_Q3`, `${esc(sub.name)}_Q4`);
    });

    const header = ["LRN", "Learner Name", "Grade Level", "Section", ...subjHeaders, "General Average", "Promotion Status"];

    // Build rows
    const rows: string[] = [];
    for (const [studentId, info] of studentInfo) {
      const grades = studentGrades.get(studentId) || new Map();
      const allGrades: number[] = [];
      const subjectGrades: string[] = [];

      subjNames.forEach((_, idx) => {
        const sub = subjects[idx];
        if (!sub) return;
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
        esc(info.lrn), esc(info.name), esc(info.grade_level), esc(info.section_name),
        ...subjectGrades, ga, promoted,
      ].join(","));
    }

    sendCSV(res, `lis-grades-${sy.label}.csv`, [header.join(","), ...rows].join("\n"));
  } catch (error) {
    console.error("LIS grades error:", error);
    res.status(500).json({ error: "Failed to generate grades CSV." });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Enrolled List CSV
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/lis/enrolled-list
 * Query: ?school_year_id=&grade_level=&section_id=
 *
 * Exports currently enrolled students with program/track info and classifications.
 */
export async function downloadEnrolledList(req: Request, res: Response): Promise<void> {
  try {
    const sy = await resolveSY(req);
    if (!sy.id) { res.status(400).json({ error: "No school year found." }); return; }

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

    const header = "LRN,Learner Name,Grade Level,Sex,Section,Program,Track,Guardian,Classifications,Enrollment Date,Status";
    const rows = students.map(s =>
      [esc(s.lrn), esc(s.name), esc(s.grade_level), esc(s.sex),
       esc(s.section_name), esc(s.program), esc(s.track_code),
       esc(s.guardian), esc(s.classifications), esc(formatDate(s.enrollment_date)),
       esc(s.enrollment_status)].join(",")
    );

    sendCSV(res, `lis-enrolled-list-${sy.label}.csv`, [header, ...rows].join("\n"));
  } catch (error) {
    console.error("LIS enrolled list error:", error);
    res.status(500).json({ error: "Failed to generate enrolled list CSV." });
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
