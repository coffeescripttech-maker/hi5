import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";

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
