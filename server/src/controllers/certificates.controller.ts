import { Request, Response } from "express";
import pool from "../config/database";
import { RowDataPacket } from "mysql2";

interface SchoolInfo {
  school_name: string;
  school_id: string;
  region: string;
  division: string;
  district: string | null;
  principal_name: string | null;
  registrar_name: string | null;
}

async function getSchoolInfo(): Promise<SchoolInfo | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT school_name, school_id, region, division, district, principal_name, registrar_name FROM school_settings WHERE id = 1 LIMIT 1"
  );
  return rows.length > 0 ? (rows[0] as SchoolInfo) : null;
}

/* ─────────────── Certificate of Enrollment ─────────────── */

export const getCertificateOfEnrollment = async (req: Request, res: Response) => {
  try {
    const studentId = req.query.student_id ? Number(req.query.student_id) : null;
    const schoolYearId = req.query.school_year_id ? Number(req.query.school_year_id) : undefined;

    if (!studentId) {
      return res.status(400).json({ error: "student_id query parameter is required" });
    }

    // Get student info
    const [studentRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, lrn, name, grade_level, sex, birthdate, address, guardian
       FROM students WHERE id = ?`,
      [studentId]
    );
    if (studentRows.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }
    const student = studentRows[0];

    // Get current school year
    let syId = schoolYearId;
    if (!syId) {
      const [syRows] = await pool.query<RowDataPacket[]>(
        "SELECT id, sy_label FROM school_years WHERE is_current = 1 LIMIT 1"
      );
      if (syRows.length === 0) {
        return res.status(404).json({ error: "No current school year set" });
      }
      syId = syRows[0].id;
    }

    // Get enrollment record
    const [enrRows] = await pool.query<RowDataPacket[]>(
      `SELECT e.id, e.enrollment_date, e.status, e.remarks,
              s.id AS section_id, s.name AS section_name, s.grade_level,
              u.name AS adviser_name
       FROM enrollments e
       JOIN sections s ON e.section_id = s.id
       LEFT JOIN users u ON s.adviser_id = u.id
       WHERE e.student_id = ? AND e.school_year_id = ?
       LIMIT 1`,
      [studentId, syId]
    );

    // Get school year label
    const [syRows] = await pool.query<RowDataPacket[]>(
      "SELECT sy_label FROM school_years WHERE id = ?",
      [syId]
    );

    const school = await getSchoolInfo();

    return res.json({
      form: "Certificate of Enrollment",
      school,
      student: {
        id: student.id,
        lrn: student.lrn,
        name: student.name,
        grade_level: student.grade_level,
        sex: student.sex,
        birthdate: student.birthdate,
        address: student.address,
        guardian: student.guardian,
      },
      enrollment: enrRows.length > 0 ? {
        id: enrRows[0].id,
        enrollment_date: enrRows[0].enrollment_date,
        status: enrRows[0].status,
        remarks: enrRows[0].remarks,
        section_name: enrRows[0].section_name,
        adviser_name: enrRows[0].adviser_name,
      } : null,
      school_year: syRows.length > 0 ? syRows[0].sy_label : null,
    });
  } catch (err: any) {
    console.error("getCertificateOfEnrollment error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
};

/* ─────────────── Good Moral Certificate ─────────────── */

export const getGoodMoralCertificate = async (req: Request, res: Response) => {
  try {
    const studentId = req.query.student_id ? Number(req.query.student_id) : null;
    const schoolYearId = req.query.school_year_id ? Number(req.query.school_year_id) : undefined;

    if (!studentId) {
      return res.status(400).json({ error: "student_id query parameter is required" });
    }

    // Get student info
    const [studentRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, lrn, name, grade_level, sex, birthdate, address, guardian
       FROM students WHERE id = ?`,
      [studentId]
    );
    if (studentRows.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }
    const student = studentRows[0];

    // Get current school year
    let syId = schoolYearId;
    if (!syId) {
      const [syRows] = await pool.query<RowDataPacket[]>(
        "SELECT id, sy_label FROM school_years WHERE is_current = 1 LIMIT 1"
      );
      if (syRows.length === 0) {
        return res.status(404).json({ error: "No current school year set" });
      }
      syId = syRows[0].id;
    }

    // Get section & enrollment info
    const [enrRows] = await pool.query<RowDataPacket[]>(
      `SELECT e.id, e.enrollment_date, e.status,
              s.name AS section_name, s.grade_level,
              u.name AS adviser_name
       FROM enrollments e
       JOIN sections s ON e.section_id = s.id
       LEFT JOIN users u ON s.adviser_id = u.id
       WHERE e.student_id = ? AND e.school_year_id = ?
       LIMIT 1`,
      [studentId, syId]
    );

    // Get school year label
    const [syRows] = await pool.query<RowDataPacket[]>(
      "SELECT sy_label FROM school_years WHERE id = ?",
      [syId]
    );

    const school = await getSchoolInfo();

    return res.json({
      form: "Certificate of Good Moral Character",
      school,
      student: {
        id: student.id,
        lrn: student.lrn,
        name: student.name,
        grade_level: student.grade_level,
        sex: student.sex,
        birthdate: student.birthdate,
        address: student.address,
        guardian: student.guardian,
      },
      enrollment: enrRows.length > 0 ? {
        id: enrRows[0].id,
        enrollment_date: enrRows[0].enrollment_date,
        status: enrRows[0].status,
        section_name: enrRows[0].section_name,
        adviser_name: enrRows[0].adviser_name,
      } : null,
      school_year: syRows.length > 0 ? syRows[0].sy_label : null,
    });
  } catch (err: any) {
    console.error("getGoodMoralCertificate error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
};
