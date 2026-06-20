import { Request, Response } from "express";
import { query } from "../config/database";
import { RowDataPacket } from "mysql2";

/**
 * GET /api/forms/sf1 — School Register (list of all enrolled students)
 * Query: ?school_year_id=1&section_id=1&grade_level=7
 *
 * SF1 (School Form 1) is the school register showing all enrolled students
 * with their personal details, organized by section/grade.
 */
export async function getSF1(req: Request, res: Response): Promise<void> {
  try {
    const { school_year_id, section_id, grade_level } = req.query;

    let sql = `
      SELECT s.id AS student_id, s.student_id AS student_id_display, s.lrn,
             s.name, s.grade_level, s.sex, s.birthdate, s.address,
             s.guardian, s.contact, s.status AS student_status,
             sec.name AS section_name, sec.section_type,
             e.enrollment_date, e.status AS enrollment_status, e.remarks,
             sy.sy_label,
             u.name AS enrolled_by_name
      FROM enrollments e
      JOIN students s ON e.student_id = s.id
      JOIN sections sec ON e.section_id = sec.id
      JOIN school_years sy ON e.school_year_id = sy.id
      JOIN users u ON e.enrolled_by = u.id
      WHERE e.status = 'enrolled'
    `;
    const params: any[] = [];

    if (school_year_id) {
      sql += " AND e.school_year_id = ?";
      params.push(parseInt(school_year_id as string));
    }
    if (section_id) {
      sql += " AND e.section_id = ?";
      params.push(parseInt(section_id as string));
    }
    if (grade_level) {
      sql += " AND s.grade_level = ?";
      params.push(parseInt(grade_level as string));
    }

    sql += " ORDER BY s.grade_level ASC, sec.name ASC, s.name ASC";

    const students = await query<RowDataPacket[]>(sql, params);

    // Group by grade level then section
    const grouped: Record<string, any> = {};
    for (const s of students) {
      const key = `Grade ${s.grade_level}`;
      if (!grouped[key]) grouped[key] = { grade_level: s.grade_level, sections: {} };
      const secKey = s.section_name;
      if (!grouped[key].sections[secKey]) {
        grouped[key].sections[secKey] = {
          section_name: secKey,
          section_type: s.section_type,
          students: [],
        };
      }
      grouped[key].sections[secKey].students.push(s);
    }

    // Get school info
    const settings = await query<RowDataPacket[]>(
      "SELECT school_name, school_id, region, division, district FROM school_settings WHERE id = 1"
    );

    res.json({
      form: "SF1 — School Register",
      school: settings[0] || null,
      total_students: students.length,
      groupings: grouped,
    });
  } catch (error) {
    console.error("SF1 error:", error);
    res.status(500).json({ error: "Failed to generate SF1." });
  }
}

/**
 * GET /api/forms/sf5 — Promotion Report
 * Query: ?school_year_id=1&section_id=1
 *
 * SF5 is the Promotion and Learning Progress Report Card Summary.
 */
export async function getSF5(req: Request, res: Response): Promise<void> {
  try {
    const { school_year_id, section_id } = req.query;

    let sql = `
      SELECT s.id AS student_id, s.student_id AS student_id_display, s.lrn, s.name,
             s.grade_level, s.sex,
             sec.name AS section_name, sec.section_type,
             ROUND(AVG(g.grade), 2) AS general_average,
             CASE WHEN ROUND(AVG(g.grade), 2) >= 75 THEN 'PROMOTED' ELSE 'RETAINED' END AS promotion_status
      FROM enrollments e
      JOIN students s ON e.student_id = s.id
      JOIN sections sec ON e.section_id = sec.id
      JOIN grades g ON g.student_id = s.id AND g.school_year_id = e.school_year_id
      WHERE e.status = 'enrolled'
    `;
    const params: any[] = [];

    if (school_year_id) {
      sql += " AND e.school_year_id = ?";
      params.push(parseInt(school_year_id as string));
    }
    if (section_id) {
      sql += " AND e.section_id = ?";
      params.push(parseInt(section_id as string));
    }

    sql += ` GROUP BY s.id, s.student_id, s.lrn, s.name, s.grade_level, s.sex, sec.name, sec.section_type
             ORDER BY s.grade_level ASC, sec.name ASC, s.name ASC`;

    const students = await query<RowDataPacket[]>(sql, params);

    const total = students.length;
    const promoted = students.filter((s: any) => s.promotion_status === "PROMOTED").length;

    const settings = await query<RowDataPacket[]>(
      "SELECT school_name, school_id FROM school_settings WHERE id = 1"
    );

    res.json({
      form: "SF5 — Report on Promotion",
      school: settings[0] || null,
      total_students: total,
      promoted,
      retained: total - promoted,
      students,
    });
  } catch (error) {
    console.error("SF5 error:", error);
    res.status(500).json({ error: "Failed to generate SF5." });
  }
}

/**
 * GET /api/forms/sf9 — Progress Report Card
 * Query: ?student_id=1&school_year_id=1
 *
 * SF9 is the individual student's report card showing subject grades per quarter.
 */
export async function getSF9(req: Request, res: Response): Promise<void> {
  try {
    const { student_id, school_year_id } = req.query;

    if (!student_id) {
      res.status(400).json({ error: "student_id is required." });
      return;
    }

    const params: any[] = [student_id];
    let syFilter = "";
    if (school_year_id) {
      syFilter = " AND g.school_year_id = ?";
      params.push(school_year_id);
    }

    const student = await query<RowDataPacket[]>(
      "SELECT * FROM students WHERE id = ?",
      [student_id]
    );
    if (student.length === 0) {
      res.status(404).json({ error: "Student not found." });
      return;
    }

    const grades = await query<RowDataPacket[]>(
      `SELECT s.name AS subject_name, s.subject_type, s.hours_per_week,
              MAX(CASE WHEN g.quarter = 1 THEN g.grade END) AS q1,
              MAX(CASE WHEN g.quarter = 2 THEN g.grade END) AS q2,
              MAX(CASE WHEN g.quarter = 3 THEN g.grade END) AS q3,
              MAX(CASE WHEN g.quarter = 4 THEN g.grade END) AS q4,
              ROUND(AVG(g.grade), 2) AS final_average
       FROM subjects s
       LEFT JOIN grades g ON g.subject_id = s.id AND g.student_id = ?${syFilter}
       WHERE s.is_active = 1 AND s.grade_level = (SELECT grade_level FROM students WHERE id = ?)
       GROUP BY s.id, s.name, s.subject_type, s.hours_per_week
       ORDER BY s.name ASC`,
      [...params, student_id]
    );

    // Get enrollment info
    const enrollments = await query<RowDataPacket[]>(
      `SELECT e.*, sec.name AS section_name, sec.section_type, sy.sy_label
       FROM enrollments e
       JOIN sections sec ON e.section_id = sec.id
       JOIN school_years sy ON e.school_year_id = sy.id
       WHERE e.student_id = ?${school_year_id ? " AND e.school_year_id = ?" : ""}
       ORDER BY sy.is_current DESC LIMIT 1`,
      school_year_id ? [student_id, school_year_id] : [student_id]
    );

    const gradesWithValues = grades.filter((g: any) => g.final_average !== null);
    const generalAverage = gradesWithValues.length > 0
      ? Math.round(gradesWithValues.reduce((sum: number, g: any) => sum + parseFloat(g.final_average), 0) / gradesWithValues.length * 100) / 100
      : null;

    const settings = await query<RowDataPacket[]>(
      "SELECT school_name, school_id FROM school_settings WHERE id = 1"
    );

    res.json({
      form: "SF9 — Progress Report Card",
      school: settings[0] || null,
      student: student[0],
      enrollment: enrollments[0] || null,
      general_average: generalAverage,
      subjects: grades,
    });
  } catch (error) {
    console.error("SF9 error:", error);
    res.status(500).json({ error: "Failed to generate SF9." });
  }
}

/**
 * GET /api/forms/sf10 — Permanent Record
 * Query: ?student_id=1
 *
 * SF10 is the student's permanent record showing all historical grades.
 */
export async function getSF10(req: Request, res: Response): Promise<void> {
  try {
    const { student_id } = req.query;

    if (!student_id) {
      res.status(400).json({ error: "student_id is required." });
      return;
    }

    const student = await query<RowDataPacket[]>(
      "SELECT * FROM students WHERE id = ?",
      [student_id]
    );
    if (student.length === 0) {
      res.status(404).json({ error: "Student not found." });
      return;
    }

    // Get all enrollments across school years
    const enrollments = await query<RowDataPacket[]>(
      `SELECT e.school_year_id, sy.sy_label, sec.name AS section_name, sec.grade_level,
              e.enrollment_date, e.status AS enrollment_status
       FROM enrollments e
       JOIN sections sec ON e.section_id = sec.id
       JOIN school_years sy ON e.school_year_id = sy.id
       WHERE e.student_id = ?
       ORDER BY sy.sy_label ASC`,
      [student_id]
    );

    // Get grades grouped by school year
    const gradesBySY: Record<string, any> = {};
    for (const enroll of enrollments) {
      const syGrades = await query<RowDataPacket[]>(
        `SELECT sub.name AS subject_name, sub.subject_type,
                MAX(CASE WHEN g.quarter = 1 THEN g.grade END) AS q1,
                MAX(CASE WHEN g.quarter = 2 THEN g.grade END) AS q2,
                MAX(CASE WHEN g.quarter = 3 THEN g.grade END) AS q3,
                MAX(CASE WHEN g.quarter = 4 THEN g.grade END) AS q4,
                ROUND(AVG(g.grade), 2) AS final_average
         FROM grades g
         JOIN subjects sub ON g.subject_id = sub.id
         WHERE g.student_id = ? AND g.school_year_id = ?
         GROUP BY sub.id, sub.name, sub.subject_type
         ORDER BY sub.name ASC`,
        [student_id, enroll.school_year_id]
      );

      const genAvg = syGrades.length > 0
        ? (() => {
            const withValues = syGrades.filter((g: any) => g.final_average !== null);
            return withValues.length > 0
              ? Math.round(withValues.reduce((sum: number, g: any) => sum + parseFloat(g.final_average), 0) / withValues.length * 100) / 100
              : null;
          })()
        : null;

      gradesBySY[enroll.sy_label] = {
        grade_level: enroll.grade_level,
        section_name: enroll.section_name,
        sy_label: enroll.sy_label,
        general_average: genAvg,
        subjects: syGrades,
      };
    }

    const settings = await query<RowDataPacket[]>(
      "SELECT school_name, school_id FROM school_settings WHERE id = 1"
    );

    res.json({
      form: "SF10 — Permanent Record",
      school: settings[0] || null,
      student: student[0],
      school_years: gradesBySY,
    });
  } catch (error) {
    console.error("SF10 error:", error);
    res.status(500).json({ error: "Failed to generate SF10." });
  }
}
