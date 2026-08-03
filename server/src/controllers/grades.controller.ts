import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";

/**
 * GET /api/grades — Get grades with filters
 * Query: ?student_id=1&school_year_id=1&subject_id=1&section_id=1
 *
 * If no student_id, returns gradebook for a section (all students + subjects pivoted)
 */
export async function getGrades(req: Request, res: Response): Promise<void> {
  try {
    const { student_id, school_year_id, subject_id, section_id, quarter } = req.query;

    // Single student grades (pivoted by quarter)
    if (student_id) {
      const params: any[] = [student_id];
      let syFilter = "";
      if (school_year_id) {
        syFilter = " AND g.school_year_id = ?";
        params.push(school_year_id);
      }

      // Get student's strand track (if any) from their current enrollment
      const enrollmentInfo = await query<RowDataPacket[]>(
        `SELECT e.strand_track_id FROM enrollments e
         WHERE e.student_id = ?${school_year_id ? " AND e.school_year_id = ?" : " AND e.status = 'enrolled'"}
         ORDER BY e.school_year_id DESC LIMIT 1`,
        school_year_id ? [student_id, school_year_id] : [student_id]
      );
      const strandTrackId = (enrollmentInfo[0] as any)?.strand_track_id || null;

      // Build grade params — first two are for student_id in JOIN and ON clause
      const gradeParams: any[] = [student_id, student_id];
      if (school_year_id) {
        gradeParams.push(school_year_id);
      }

      // When student has a strand track, filter subjects by that track
      let trackWhere = "";
      if (strandTrackId) {
        trackWhere = ` AND (
          NOT EXISTS (SELECT 1 FROM subject_strand_tracks WHERE subject_id = s.id)
          OR s.id IN (SELECT subject_id FROM subject_strand_tracks WHERE strand_track_id = ?)
        )`;
        gradeParams.push(strandTrackId);
      }

      const grades = await query<RowDataPacket[]>(
        `SELECT s.id AS subject_id, s.name AS subject_name, s.subject_type,
                MAX(CASE WHEN g.quarter = 1 THEN g.grade END) AS q1,
                MAX(CASE WHEN g.quarter = 2 THEN g.grade END) AS q2,
                MAX(CASE WHEN g.quarter = 3 THEN g.grade END) AS q3,
                MAX(CASE WHEN g.quarter = 4 THEN g.grade END) AS q4,
                ROUND(AVG(g.grade), 2) AS final_average,
                MAX(g.is_locked) AS is_locked
         FROM subjects s
         JOIN students stu ON stu.id = ?
         LEFT JOIN grades g ON g.subject_id = s.id AND g.student_id = ?${syFilter}
         WHERE s.grade_level = stu.grade_level AND s.is_active = 1${trackWhere}
         GROUP BY s.id, s.name, s.subject_type
         ORDER BY s.name ASC`,
        gradeParams
      );

      // Get enrollment info
      const enrollments = await query<RowDataPacket[]>(
        `SELECT e.id AS enrollment_id, e.school_year_id, e.section_id, sec.name AS section_name, sy.sy_label
         FROM enrollments e
         JOIN sections sec ON e.section_id = sec.id
         JOIN school_years sy ON e.school_year_id = sy.id
         WHERE e.student_id = ?${school_year_id ? " AND e.school_year_id = ?" : ""}
         ORDER BY sy.is_current DESC
         LIMIT 1`,
        school_year_id ? [student_id, school_year_id] : [student_id]
      );

      res.json({
        student_id,
        enrollment: enrollments[0] || null,
        subjects: grades,
      });
      return;
    }

    // Gradebook for a section (all students × subjects)
    if (section_id && school_year_id) {
      const grades = await query<RowDataPacket[]>(
        `SELECT st.id AS student_id, st.name AS student_name, st.student_id,
                s.id AS subject_id, s.name AS subject_name,
                g.quarter, g.grade, g.is_locked
         FROM enrollments e
         JOIN students st ON e.student_id = st.id
         CROSS JOIN subjects s
         LEFT JOIN grades g ON g.student_id = st.id AND g.subject_id = s.id AND g.school_year_id = e.school_year_id
         WHERE e.section_id = ? AND e.school_year_id = ? AND e.status = 'enrolled'
           AND s.grade_level = st.grade_level
         ORDER BY st.name ASC, s.name ASC, g.quarter ASC`,
        [section_id, school_year_id]
      );

      res.json(grades);
      return;
    }

    // Raw grades list with filters
    let sql = `
      SELECT g.*, s.name AS student_name, s.student_id, sub.name AS subject_name
      FROM grades g
      JOIN students s ON g.student_id = s.id
      JOIN subjects sub ON g.subject_id = sub.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (school_year_id) { conditions.push("g.school_year_id = ?"); params.push(school_year_id); }
    if (subject_id) { conditions.push("g.subject_id = ?"); params.push(subject_id); }
    if (quarter) { conditions.push("g.quarter = ?"); params.push(quarter); }

    if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY g.school_year_id DESC, g.student_id ASC, g.subject_id ASC, g.quarter ASC";

    const result = await query<RowDataPacket[]>(sql, params);
    res.json(result);
    return;

  } catch (error) {
    console.error("Get grades error:", error);
    res.status(500).json({ error: "Failed to fetch grades." });
  }
}

/**
 * POST /api/grades — Create or update (upsert) a single grade
 * Body: { student_id, subject_id, school_year_id, quarter, grade }
 */
export async function upsertGrade(req: Request, res: Response): Promise<void> {
  try {
    const { student_id, subject_id, school_year_id, quarter, grade } = req.body;

    if (!student_id || !subject_id || !school_year_id || !quarter) {
      res.status(400).json({ error: "Missing required fields: student_id, subject_id, school_year_id, quarter." });
      return;
    }

    if (quarter < 1 || quarter > 4) {
      res.status(400).json({ error: "Quarter must be between 1 and 4." });
      return;
    }

    // Get enrollment_id for this student + school year
    const enrollments = await query<RowDataPacket[]>(
      "SELECT id FROM enrollments WHERE student_id = ? AND school_year_id = ? AND status = 'enrolled' LIMIT 1",
      [student_id, school_year_id]
    );
    if (enrollments.length === 0) {
      res.status(400).json({ error: "Student is not enrolled in this school year. Please enroll first." });
      return;
    }
    const enrollment_id = enrollments[0].id;

    // Check if grade is locked
    const lockedCheck = await query<RowDataPacket[]>(
      "SELECT id FROM grades WHERE student_id = ? AND subject_id = ? AND school_year_id = ? AND quarter = ? AND is_locked = 1",
      [student_id, subject_id, school_year_id, quarter]
    );
    if (lockedCheck.length > 0) {
      res.status(403).json({ error: "Grade is locked and cannot be modified." });
      return;
    }

    // Upsert
    await query<ResultSetHeader>(
      `INSERT INTO grades (student_id, subject_id, enrollment_id, school_year_id, quarter, grade)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE grade = VALUES(grade), updated_at = NOW()`,
      [student_id, subject_id, enrollment_id, school_year_id, quarter, grade ?? null]
    );

    await logActivity(
      req.user!.userId,
      `Updated grade for student ID ${student_id}, subject ID ${subject_id}, Q${quarter}`,
      "grades",
      null
    );

    res.json({ message: "Grade saved successfully." });
  } catch (error) {
    console.error("Upsert grade error:", error);
    res.status(500).json({ error: "Failed to save grade." });
  }
}

/**
 * POST /api/grades/batch — Upsert multiple grades at once
 * Body: { grades: [{ student_id, subject_id, school_year_id, quarter, grade }] }
 */
export async function batchUpsertGrades(req: Request, res: Response): Promise<void> {
  try {
    const { grades } = req.body;

    if (!grades || !Array.isArray(grades) || grades.length === 0) {
      res.status(400).json({ error: "Grades array is required." });
      return;
    }

    let updated = 0;
    for (const g of grades) {
      const { student_id, subject_id, school_year_id, quarter, grade } = g;

      if (!student_id || !subject_id || !school_year_id || !quarter) continue;
      if (quarter < 1 || quarter > 4) continue;

      // Get enrollment_id
      const enrolls = await query<RowDataPacket[]>(
        "SELECT id FROM enrollments WHERE student_id = ? AND school_year_id = ? AND status = 'enrolled' LIMIT 1",
        [student_id, school_year_id]
      );
      if (enrolls.length === 0) continue;
      const enrollment_id = enrolls[0].id;

      // Skip locked grades
      const locked = await query<RowDataPacket[]>(
        "SELECT id FROM grades WHERE student_id = ? AND subject_id = ? AND school_year_id = ? AND quarter = ? AND is_locked = 1",
        [student_id, subject_id, school_year_id, quarter]
      );
      if (locked.length > 0) continue;

      await query<ResultSetHeader>(
        `INSERT INTO grades (student_id, subject_id, enrollment_id, school_year_id, quarter, grade)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE grade = VALUES(grade), updated_at = NOW()`,
        [student_id, subject_id, enrollment_id, school_year_id, quarter, grade ?? null]
      );
      updated++;
    }

    await logActivity(req.user!.userId, `Batch imported ${updated} grades`, "grades", null);
    res.json({ message: `${updated} grades saved successfully.` });
  } catch (error) {
    console.error("Batch upsert error:", error);
    res.status(500).json({ error: "Failed to save grades." });
  }
}

/**
 * POST /api/grades/lock — Lock grades for a student/subject or whole section
 * Body: { student_id?, subject_id?, school_year_id, section_id?, quarter? }
 */
export async function lockGrades(req: Request, res: Response): Promise<void> {
  try {
    const { student_id, subject_id, school_year_id, section_id, quarter } = req.body;

    if (!school_year_id) {
      res.status(400).json({ error: "school_year_id is required." });
      return;
    }

    let sql = "UPDATE grades SET is_locked = 1, locked_at = NOW(), locked_by = ? WHERE school_year_id = ?";
    const params: any[] = [req.user!.userId, school_year_id];

    if (student_id) { sql += " AND student_id = ?"; params.push(student_id); }
    if (subject_id) { sql += " AND subject_id = ?"; params.push(subject_id); }
    if (section_id) {
      sql += " AND student_id IN (SELECT student_id FROM enrollments WHERE section_id = ? AND school_year_id = ?)";
      params.push(section_id, school_year_id);
    }
    if (quarter) { sql += " AND quarter = ?"; params.push(quarter); }

    const result = await query<ResultSetHeader>(sql, params);

    await logActivity(req.user!.userId, `Locked ${result.affectedRows} grade(s)`, "grades", null);
    res.json({ message: `${result.affectedRows} grade(s) locked.` });
  } catch (error) {
    console.error("Lock grades error:", error);
    res.status(500).json({ error: "Failed to lock grades." });
  }
}

/**
 * POST /api/grades/unlock — Unlock grades
 * Body: { student_id?, subject_id?, school_year_id, section_id?, quarter? }
 */
export async function unlockGrades(req: Request, res: Response): Promise<void> {
  try {
    const { student_id, subject_id, school_year_id, section_id, quarter } = req.body;

    if (!school_year_id) {
      res.status(400).json({ error: "school_year_id is required." });
      return;
    }

    let sql = "UPDATE grades SET is_locked = 0, locked_at = NULL, locked_by = NULL WHERE school_year_id = ?";
    const params: any[] = [school_year_id];

    if (student_id) { sql += " AND student_id = ?"; params.push(student_id); }
    if (subject_id) { sql += " AND subject_id = ?"; params.push(subject_id); }
    if (section_id) {
      sql += " AND student_id IN (SELECT student_id FROM enrollments WHERE section_id = ? AND school_year_id = ?)";
      params.push(section_id, school_year_id);
    }
    if (quarter) { sql += " AND quarter = ?"; params.push(quarter); }

    const result = await query<ResultSetHeader>(sql, params);

    await logActivity(req.user!.userId, `Unlocked ${result.affectedRows} grade(s)`, "grades", null);
    res.json({ message: `${result.affectedRows} grade(s) unlocked.` });
  } catch (error) {
    console.error("Unlock grades error:", error);
    res.status(500).json({ error: "Failed to unlock grades." });
  }
}

/**
 * GET /api/grades/compute/averages — Compute general average for a student
 * Query: ?student_id=1&school_year_id=1
 */
export async function computeAverages(req: Request, res: Response): Promise<void> {
  try {
    const { student_id, school_year_id } = req.query;

    if (!student_id || !school_year_id) {
      res.status(400).json({ error: "student_id and school_year_id are required." });
      return;
    }

    const averages = await query<RowDataPacket[]>(
      `SELECT s.id AS subject_id, s.name AS subject_name, s.subject_type,
              ROUND(AVG(g.grade), 2) AS subject_average
       FROM subjects s
       JOIN grades g ON g.subject_id = s.id
       WHERE g.student_id = ? AND g.school_year_id = ?
       GROUP BY s.id, s.name, s.subject_type
       ORDER BY s.name ASC`,
      [student_id, school_year_id]
    );

    // Group MAPEH components (Music, Arts, Physical Education, Health) into one subject
    const MAPEH_NAMES = ["Music", "Arts", "Physical Education", "Health"];
    const mapehComponents = averages.filter((a: any) => MAPEH_NAMES.includes(a.subject_name));
    const otherSubjects = averages.filter((a: any) => !MAPEH_NAMES.includes(a.subject_name));

    let subjectsForAverage = otherSubjects;
    if (mapehComponents.length > 0) {
      const mapehAvg = mapehComponents.reduce((sum: number, a: any) => sum + parseFloat(a.subject_average || 0), 0) / mapehComponents.length;
      subjectsForAverage = [
        ...otherSubjects,
        { subject_id: -1, subject_name: "MAPEH", subject_type: "core", subject_average: Math.round(mapehAvg * 100) / 100 },
      ];
    }

    const generalAverage = subjectsForAverage.length > 0
      ? Math.round(subjectsForAverage.reduce((sum: number, a: any) => sum + parseFloat(a.subject_average || 0), 0) / subjectsForAverage.length * 100) / 100
      : null;

    res.json({
      student_id: parseInt(student_id as string),
      school_year_id: parseInt(school_year_id as string),
      general_average: generalAverage,
      subject_averages: subjectsForAverage,
    });
  } catch (error) {
    console.error("Compute averages error:", error);
    res.status(500).json({ error: "Failed to compute averages." });
  }
}

/**
 * GET /api/grades/distribution — Grade distribution per subject
 * Query: ?school_year_id=1&grade_level=7&section_id=1
 *
 * Returns per-subject bucket counts: 90-100, 85-89, 80-84, 75-79, <75
 */
export async function getGradeDistribution(req: Request, res: Response): Promise<void> {
  try {
    const { school_year_id, grade_level, section_id } = req.query;

    // Get current school year if none specified
    let syId: number;
    if (school_year_id) {
      syId = parseInt(school_year_id as string);
    } else {
      const currentSY = await query<RowDataPacket[]>(
        "SELECT id FROM school_years WHERE is_current = 1 LIMIT 1"
      );
      syId = currentSY.length > 0 ? currentSY[0].id : 0;
    }

    if (!syId) {
      res.status(400).json({ error: "No school year found. Specify school_year_id or set one as current." });
      return;
    }

    // Build filter conditions
    const conditions: string[] = ["e.school_year_id = ?", "e.status = 'enrolled'"];
    const params: any[] = [syId];

    if (grade_level) {
      conditions.push("s.grade_level = ?");
      params.push(parseInt(grade_level as string));
    }
    if (section_id) {
      conditions.push("e.section_id = ?");
      params.push(parseInt(section_id as string));
    }

    const where = conditions.join(" AND ");

    // Get grade distribution per subject
    // Uses the MAPEH grouping pattern: CASE WHEN name IN ('Music','Arts','Physical Education','Health') THEN 'MAPEH' ELSE s.name END
    const distribution = await query<RowDataPacket[]>(
      `SELECT
         subject_group,
         subject_id,
         COUNT(DISTINCT student_id) AS total_students,
         SUM(CASE WHEN avg_grade >= 90 THEN 1 ELSE 0 END) AS bucket_90_100,
         SUM(CASE WHEN avg_grade >= 85 AND avg_grade < 90 THEN 1 ELSE 0 END) AS bucket_85_89,
         SUM(CASE WHEN avg_grade >= 80 AND avg_grade < 85 THEN 1 ELSE 0 END) AS bucket_80_84,
         SUM(CASE WHEN avg_grade >= 75 AND avg_grade < 80 THEN 1 ELSE 0 END) AS bucket_75_79,
         SUM(CASE WHEN avg_grade < 75 AND avg_grade IS NOT NULL THEN 1 ELSE 0 END) AS bucket_below_75,
         SUM(CASE WHEN avg_grade IS NULL THEN 1 ELSE 0 END) AS bucket_no_grade,
         ROUND(AVG(avg_grade), 2) AS mean_grade
       FROM (
         SELECT
           sub.id AS subject_id,
           CASE WHEN sub.name IN ('Music','Arts','Physical Education','Health') THEN 'MAPEH' ELSE sub.name END AS subject_group,
           e.student_id,
           ROUND(AVG(g.grade), 2) AS avg_grade
         FROM enrollments e
         JOIN students s ON e.student_id = s.id
         JOIN grades g ON g.student_id = e.student_id AND g.school_year_id = e.school_year_id
         JOIN subjects sub ON g.subject_id = sub.id
         WHERE ${where}
         GROUP BY
           CASE WHEN sub.name IN ('Music','Arts','Physical Education','Health') THEN 'MAPEH' ELSE sub.name END,
           sub.id,
           e.student_id
       ) student_subject_avgs
       GROUP BY subject_group, subject_id
       ORDER BY subject_group ASC`,
      params
    );

    // Aggregate MAPEH rows into one
    const MAPEH_NAMES = ["Music", "Arts", "Physical Education", "Health"];
    const mapehRows = distribution.filter((r: any) => MAPEH_NAMES.includes(r.subject_group));
    const otherRows = distribution.filter((r: any) => !MAPEH_NAMES.includes(r.subject_group));

    let subjects: any[] = [];
    if (mapehRows.length > 0) {
      const mapehAgg = {
        subject_id: -1,
        subject_name: "MAPEH",
        total: mapehRows[0].total_students, // same students
        bucket_90_100: Math.round(mapehRows.reduce((s: number, r: any) => s + r.bucket_90_100, 0) / mapehRows.length),
        bucket_85_89: Math.round(mapehRows.reduce((s: number, r: any) => s + r.bucket_85_89, 0) / mapehRows.length),
        bucket_80_84: Math.round(mapehRows.reduce((s: number, r: any) => s + r.bucket_80_84, 0) / mapehRows.length),
        bucket_75_79: Math.round(mapehRows.reduce((s: number, r: any) => s + r.bucket_75_79, 0) / mapehRows.length),
        bucket_below_75: Math.round(mapehRows.reduce((s: number, r: any) => s + r.bucket_below_75, 0) / mapehRows.length),
        bucket_no_grade: Math.round(mapehRows.reduce((s: number, r: any) => s + r.bucket_no_grade, 0) / mapehRows.length),
        mean_grade: Math.round(mapehRows.reduce((s: number, r: any) => s + parseFloat(r.mean_grade || "0"), 0) / mapehRows.length * 100) / 100,
      };
      subjects = [...otherRows.map(serializeSubject), mapehAgg];
    } else {
      subjects = otherRows.map(serializeSubject);
    }

    // Build bucket distribution for each subject
    subjects = subjects.map((s: any) => {
      const buckets = [
        { range: "90-100", count: s.bucket_90_100, color: "#22c55e" },
        { range: "85-89", count: s.bucket_85_89, color: "#3b82f6" },
        { range: "80-84", count: s.bucket_80_84, color: "#f59e0b" },
        { range: "75-79", count: s.bucket_75_79, color: "#f97316" },
        { range: "<75", count: s.bucket_below_75, color: "#ef4444" },
      ];
      const graded = buckets.reduce((sum: number, b: any) => sum + b.count, 0);
      const passCount = s.bucket_90_100 + s.bucket_85_89 + s.bucket_80_84 + s.bucket_75_79;
      return {
        subject_name: s.subject_name,
        total_students: s.total,
        mean_grade: s.mean_grade,
        pass_rate: s.total > 0 ? Math.round((passCount / s.total) * 100) : 0,
        buckets,
      };
    });

    // Overall stats
    const totalStudents = subjects.reduce((sum: number, s: any) => Math.max(sum, s.total_students), 0);
    const overallPassRate = subjects.length > 0
      ? Math.round(subjects.reduce((sum: number, s: any) => sum + s.pass_rate, 0) / subjects.length)
      : 0;

    res.json({
      school_year_id: syId,
      total_students: totalStudents,
      overall_pass_rate: overallPassRate,
      subjects,
    });
  } catch (error) {
    console.error("Grade distribution error:", error);
    res.status(500).json({ error: "Failed to fetch grade distribution." });
  }
}

function serializeSubject(r: any) {
  return {
    subject_id: r.subject_id,
    subject_name: r.subject_group,
    total: r.total_students,
    bucket_90_100: r.bucket_90_100,
    bucket_85_89: r.bucket_85_89,
    bucket_80_84: r.bucket_80_84,
    bucket_75_79: r.bucket_75_79,
    bucket_below_75: r.bucket_below_75,
    bucket_no_grade: r.bucket_no_grade,
    mean_grade: r.mean_grade,
  };
}
