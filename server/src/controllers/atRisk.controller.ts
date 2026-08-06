import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { classifyStudent, StudentRisk } from "../utils/linearRegression";
import { getAiProvider, predictWithPython } from "../services/aiService";
import { RowDataPacket, ResultSetHeader } from "mysql2";

/**
 * GET /api/at-risk/trends — Live linear-regression classification of enrolled
 * students (always fresh — computed on-the-fly, no storage required).
 * Query: ?school_year_id=3&section_id=2&grade_level=7
 */
export async function getStudentRiskTrends(req: Request, res: Response): Promise<void> {
  try {
    const { section_id, grade_level } = req.query;

    // Resolve school year — default to the current one.
    let schoolYearId = req.query.school_year_id
      ? parseInt(req.query.school_year_id as string, 10)
      : null;
    if (!schoolYearId) {
      const rows = await query<RowDataPacket[]>(
        "SELECT id FROM school_years WHERE is_current = 1 LIMIT 1"
      );
      schoolYearId = rows[0]?.id ?? null;
    }
    if (!schoolYearId) {
      res.status(400).json({ error: "No school year selected and none is current." });
      return;
    }

    const params: any[] = [schoolYearId];
    const filters: string[] = ["e.status = 'enrolled'", "e.school_year_id = ?"];
    if (section_id) {
      filters.push("e.section_id = ?");
      params.push(parseInt(section_id as string, 10));
    }
    if (grade_level) {
      filters.push("s.grade_level = ?");
      params.push(parseInt(grade_level as string, 10));
    }

    const students = await query<RowDataPacket[]>(
      `SELECT e.student_id, s.name AS student_name, s.lrn, s.grade_level,
              e.section_id, sec.name AS section_name
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       LEFT JOIN sections sec ON sec.id = e.section_id
       WHERE ${filters.join(" AND ")}
       ORDER BY s.name ASC`,
      params
    );

    const emptySummary = {
      total: 0,
      at_risk: 0,
      needs_monitoring: 0,
      on_track: 0,
      no_data: 0,
    };

    if (students.length === 0) {
      res.json({ school_year_id: schoolYearId, summary: emptySummary, students: [] });
      return;
    }

    // Per-quarter general averages for every student in scope, one query.
    const idList = students.map((s: any) => s.student_id);
    const placeholders = idList.map(() => "?").join(",");
    const gradeRows = await query<RowDataPacket[]>(
      `SELECT g.student_id, g.quarter, ROUND(AVG(g.grade), 2) AS avg_grade
       FROM grades g
       WHERE g.school_year_id = ? AND g.student_id IN (${placeholders})
       GROUP BY g.student_id, g.quarter
       ORDER BY g.student_id ASC, g.quarter ASC`,
      [schoolYearId, ...idList]
    );

    const quartersByStudent: Record<number, (number | null)[]> = {};
    for (const g of gradeRows as any[]) {
      if (!quartersByStudent[g.student_id]) {
        quartersByStudent[g.student_id] = [null, null, null, null];
      }
      quartersByStudent[g.student_id][g.quarter - 1] = Number(g.avg_grade);
    }

    // Classification provider — 'python' uses the FastAPI/scikit-learn service
    // (with fallback to the built-in regression if it's unreachable).
    const aiProvider = getAiProvider();

    const result: any[] = [];
    for (const st of students as any[]) {
      const quarters = quartersByStudent[st.student_id] ?? [null, null, null, null];

      let classification: StudentRisk;
      if (aiProvider === "python") {
        try {
          classification = await predictWithPython(st.student_id, quarters);
        } catch (error) {
          console.warn("AI service unavailable — falling back to local regression.", error);
          classification = classifyStudent(quarters);
        }
      } else {
        classification = classifyStudent(quarters);
      }

      result.push({
        student_id: st.student_id,
        student_name: st.student_name,
        lrn: st.lrn,
        grade_level: st.grade_level,
        section_id: st.section_id,
        section_name: st.section_name,
        ...classification,
      });
    }

    // Order: at-risk → needs-monitoring → on-track → no-data; within a level,
    // lowest current average first.
    const levelOrder: Record<string, number> = {
      at_risk: 0,
      needs_monitoring: 1,
      on_track: 2,
      "": 3,
    };
    result.sort((a, b) => {
      const ao = levelOrder[a.risk_level ?? ""];
      const bo = levelOrder[b.risk_level ?? ""];
      if (ao !== bo) return ao - bo;
      return (a.current_average ?? 100) - (b.current_average ?? 100);
    });

    const summary = {
      total: result.length,
      at_risk: result.filter((r: any) => r.risk_level === "at_risk").length,
      needs_monitoring: result.filter((r: any) => r.risk_level === "needs_monitoring").length,
      on_track: result.filter((r: any) => r.risk_level === "on_track").length,
      no_data: result.filter((r: any) => r.risk_level === null).length,
    };

    res.json({ school_year_id: schoolYearId, summary, students: result });
  } catch (error) {
    console.error("Student risk trends error:", error);
    res.status(500).json({ error: "Failed to compute student risk trends." });
  }
}

/**
 * GET /api/at-risk — List predictions with filters
 * Query: ?risk_level=at_risk&school_year_id=1&section_id=1
 */
export async function listPredictions(req: Request, res: Response): Promise<void> {
  try {
    const { risk_level, school_year_id, section_id, grade_level } = req.query;

    let sql = `
      SELECT ar.*, s.name AS student_name, s.student_id, s.grade_level, s.lrn,
             u.name AS predicted_by_name
      FROM at_risk_predictions ar
      JOIN students s ON ar.student_id = s.id
      JOIN users u ON ar.predicted_by = u.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (risk_level) { conditions.push("ar.risk_level = ?"); params.push(risk_level); }
    if (school_year_id) { conditions.push("ar.school_year_id = ?"); params.push(parseInt(school_year_id as string)); }
    if (grade_level) { conditions.push("s.grade_level = ?"); params.push(parseInt(grade_level as string)); }
    if (section_id) {
      sql += ` JOIN enrollments e ON e.student_id = ar.student_id AND e.school_year_id = ar.school_year_id`;
      conditions.push("e.section_id = ?"); params.push(parseInt(section_id as string));
    }

    if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY ar.risk_score DESC, s.name ASC";

    const predictions = await query<RowDataPacket[]>(sql, params);
    res.json(predictions);
  } catch (error) {
    console.error("List predictions error:", error);
    res.status(500).json({ error: "Failed to fetch predictions." });
  }
}

/**
 * POST /api/at-risk/predict — Run prediction for a student or section
 * Body: { student_id?, school_year_id, section_id? }
 */
export async function runPrediction(req: Request, res: Response): Promise<void> {
  try {
    const { student_id, school_year_id, section_id } = req.body;

    if (!school_year_id) {
      res.status(400).json({ error: "school_year_id is required." });
      return;
    }

    // Get students to evaluate
    let students: RowDataPacket[];

    if (student_id) {
      students = await query<RowDataPacket[]>(
        "SELECT id, name, student_id, grade_level FROM students WHERE id = ?",
        [student_id]
      );
    } else if (section_id) {
      students = await query<RowDataPacket[]>(
        `SELECT st.id, st.name, st.student_id, st.grade_level FROM students st
         JOIN enrollments e ON e.student_id = st.id
         WHERE e.section_id = ? AND e.school_year_id = ? AND e.status = 'enrolled'`,
        [section_id, school_year_id]
      );
    } else {
      // All enrolled students this school year
      students = await query<RowDataPacket[]>(
        `SELECT DISTINCT s.id, s.name, s.student_id, s.grade_level FROM students s
         JOIN enrollments e ON e.student_id = s.id
         WHERE e.school_year_id = ? AND e.status = 'enrolled'`,
        [school_year_id]
      );
    }

    if (students.length === 0) {
      res.status(400).json({ error: "No students found to evaluate." });
      return;
    }

    const results: any[] = [];

    for (const student of students) {
      // Get quarterly averages
      const averages = await query<RowDataPacket[]>(
        `SELECT g.quarter, ROUND(AVG(g.grade), 2) AS avg_grade
         FROM grades g
         WHERE g.student_id = ? AND g.school_year_id = ?
         GROUP BY g.quarter
         ORDER BY g.quarter ASC`,
        [student.id, school_year_id]
      );

      if (averages.length === 0) continue;

      const q1Avg = averages.find((a: any) => a.quarter === 1)?.avg_grade ?? null;
      const q2Avg = averages.find((a: any) => a.quarter === 2)?.avg_grade ?? null;
      const q3Avg = averages.find((a: any) => a.quarter === 3)?.avg_grade ?? null;

      // Calculate trend based on available quarters
      const availableAvgs = [q1Avg, q2Avg, q3Avg].filter((v: number | null) => v !== null);
      let trend: "declining" | "stable" | "improving" = "stable";

      if (availableAvgs.length >= 2) {
        const first = availableAvgs[0] as number;
        const last = availableAvgs[availableAvgs.length - 1] as number;
        const diff = last - first;
        if (diff < -2) trend = "declining";
        else if (diff > 2) trend = "improving";
        else trend = "stable";
      }

      // Calculate risk score (0-100)
      // Higher risk: declining trend, low averages
      let riskScore = 0;
      const latestAvg = availableAvgs[availableAvgs.length - 1] as number || 0;

      // Base risk from latest average (0-60 points)
      if (latestAvg < 75) riskScore += 60;
      else if (latestAvg < 80) riskScore += 40;
      else if (latestAvg < 85) riskScore += 20;
      else if (latestAvg >= 90) riskScore -= 10;

      // Trend impact (0-30 points)
      if (trend === "declining") riskScore += 30;
      else if (trend === "stable") riskScore += 10;
      else if (trend === "improving") riskScore -= 10;

      // Quarter count impact (0-10 points) — fewer quarters = less data = slightly risky
      if (availableAvgs.length <= 1) riskScore += 10;

      riskScore = Math.max(0, Math.min(100, riskScore));

      // Determine risk level
      let riskLevel: "at_risk" | "needs_monitoring" | "on_track";
      if (riskScore >= 50) riskLevel = "at_risk";
      else if (riskScore >= 25) riskLevel = "needs_monitoring";
      else riskLevel = "on_track";

      // Upsert prediction
      await query<ResultSetHeader>(
        `INSERT INTO at_risk_predictions (student_id, school_year_id, q1_average, q2_average, q3_average, risk_score, risk_level, trend, predicted_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           q1_average = VALUES(q1_average), q2_average = VALUES(q2_average), q3_average = VALUES(q3_average),
           risk_score = VALUES(risk_score), risk_level = VALUES(risk_level), trend = VALUES(trend),
           predicted_by = VALUES(predicted_by)`,
        [student.id, school_year_id, q1Avg, q2Avg, q3Avg, riskScore, riskLevel, trend, req.user!.userId]
      );

      results.push({
        student_id: student.id,
        name: student.name,
        student_id_display: student.student_id,
        grade_level: student.grade_level,
        q1_average: q1Avg,
        q2_average: q2Avg,
        q3_average: q3Avg,
        risk_score: riskScore,
        risk_level: riskLevel,
        trend,
      });
    }

    await logActivity(
      req.user!.userId,
      `Ran at-risk prediction: ${results.length} student(s) evaluated`,
      "at_risk_predictions",
      null
    );

    // Summary counts
    const atRisk = results.filter(r => r.risk_level === "at_risk").length;
    const monitoring = results.filter(r => r.risk_level === "needs_monitoring").length;
    const onTrack = results.filter(r => r.risk_level === "on_track").length;

    res.json({
      message: `Prediction complete. ${results.length} student(s) evaluated.`,
      summary: { total: results.length, at_risk: atRisk, needs_monitoring: monitoring, on_track: onTrack },
      results,
    });
  } catch (error) {
    console.error("Prediction error:", error);
    res.status(500).json({ error: "Failed to run prediction." });
  }
}
