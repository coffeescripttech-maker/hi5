import { Request, Response } from "express";
import { query } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { RowDataPacket, ResultSetHeader } from "mysql2";

/**
 * POST /api/promotions — Promote a section to the next grade level
 * Body: { section_id, school_year_id }
 *
 * Algorithm:
 * 1. Fetch all enrolled students in the section
 * 2. Compute each student's general average
 * 3. Students with GA >= 75 promoted; < 75 retained
 * 4. Auto-assign promoted students to sections in next grade
 */
export async function promoteSection(req: Request, res: Response): Promise<void> {
  try {
    const { section_id, school_year_id } = req.body;

    if (!section_id || !school_year_id) {
      res.status(400).json({ error: "section_id and school_year_id are required." });
      return;
    }

    // Get source section
    const sections = await query<RowDataPacket[]>(
      "SELECT * FROM sections WHERE id = ?",
      [section_id]
    );
    if (sections.length === 0) {
      res.status(404).json({ error: "Section not found." });
      return;
    }

    const section = sections[0];
    const toGrade = section.grade_level + 1;

    if (toGrade > 12) {
      res.status(400).json({ error: "Grade 12 students cannot be promoted. They should be marked as graduated." });
      return;
    }

    // Get current school year
    const sy = await query<RowDataPacket[]>(
      "SELECT * FROM school_years WHERE id = ?",
      [school_year_id]
    );
    if (sy.length === 0) {
      res.status(404).json({ error: "School year not found." });
      return;
    }

    // Find next school year for new enrollments
    const nextSY = await query<RowDataPacket[]>(
      "SELECT id FROM school_years WHERE is_current = 1 AND id != ? ORDER BY id ASC LIMIT 1",
      [school_year_id]
    );
    const nextSchoolYearId = nextSY.length > 0 ? nextSY[0].id : school_year_id;

    // Get enrolled students with their averages
    const students = await query<RowDataPacket[]>(
      `SELECT e.id AS enrollment_id, e.student_id,
              ROUND(AVG(g.grade), 2) AS general_average
       FROM enrollments e
       JOIN grades g ON g.student_id = e.student_id AND g.school_year_id = e.school_year_id
       WHERE e.section_id = ? AND e.school_year_id = ? AND e.status = 'enrolled'
       GROUP BY e.id, e.student_id
       ORDER BY general_average DESC`,
      [section_id, school_year_id]
    );

    if (students.length === 0) {
      res.status(400).json({ error: "No enrolled students with grades found in this section." });
      return;
    }

    // Get section type configs for the next grade level
    const typeConfigs = await query<RowDataPacket[]>(
      `SELECT * FROM section_type_config WHERE grade_level = ? ORDER BY max_average DESC`,
      [toGrade]
    );

    // Get available sections for the next grade level
    const targetSections = await query<RowDataPacket[]>(
      `SELECT * FROM sections WHERE grade_level = ? AND is_active = 1 ORDER BY min_average DESC`,
      [toGrade]
    );

    if (targetSections.length === 0) {
      res.status(400).json({ error: `No active sections found for grade ${toGrade}. Create sections first.` });
      return;
    }

    // Create promotion record
    const promoResult = await query<ResultSetHeader>(
      `INSERT INTO promotions (section_id, to_grade_level, school_year_id, promoted_by, status)
       VALUES (?, ?, ?, ?, 'pending_review')`,
      [section_id, toGrade, school_year_id, req.user!.userId]
    );
    const promotionId = promoResult.insertId;

    // Process each student
    const results: any[] = [];
    for (const s of students) {
      const student = await query<RowDataPacket[]>(
        "SELECT id, name, grade_level FROM students WHERE id = ?",
        [s.student_id]
      );
      if (student.length === 0) continue;

      const avg = parseFloat(s.general_average || "0");
      const isRetained = avg < 75 ? 1 : 0;

      // Find target section based on average
      let targetSectionId: number | null = null;
      if (!isRetained) {
        // Find the highest section type their average qualifies for
        for (const tSec of targetSections) {
          if (avg >= parseFloat(tSec.min_average)) {
            // Check if section has capacity
            if (tSec.current_count < tSec.capacity) {
              targetSectionId = tSec.id;
              break;
            }
          }
        }

        // Fallback: find any section with capacity
        if (!targetSectionId) {
          for (const tSec of targetSections) {
            if (tSec.current_count < tSec.capacity) {
              targetSectionId = tSec.id;
              break;
            }
          }
        }
      }

      // Insert promotion_student record
      await query<ResultSetHeader>(
        `INSERT INTO promotion_students (promotion_id, student_id, from_section_id, to_section_id, general_average, is_retained)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [promotionId, s.student_id, section_id, targetSectionId, avg, isRetained]
      );

      // If assigned to a section, update student's grade level and create enrollment for next SY
      if (targetSectionId && !isRetained) {
        await query<ResultSetHeader>(
          "UPDATE students SET grade_level = ? WHERE id = ?",
          [toGrade, s.student_id]
        );

        // Update section counts
        await query<ResultSetHeader>(
          "UPDATE sections SET current_count = current_count + 1 WHERE id = ?",
          [targetSectionId]
        );

        // Check if already enrolled in next SY
        const existingEnroll = await query<RowDataPacket[]>(
          "SELECT id FROM enrollments WHERE student_id = ? AND school_year_id = ?",
          [s.student_id, nextSchoolYearId]
        );

        if (existingEnroll.length === 0) {
          await query<ResultSetHeader>(
            `INSERT INTO enrollments (student_id, section_id, school_year_id, enrollment_date, enrolled_by, status)
             VALUES (?, ?, ?, CURDATE(), ?, 'enrolled')`,
            [s.student_id, targetSectionId, nextSchoolYearId, req.user!.userId]
          );
        }
      }

      results.push({
        student_id: s.student_id,
        name: student[0].name,
        general_average: avg,
        is_retained: isRetained === 1,
        to_section_id: targetSectionId,
      });
    }

    // Mark promotion as completed
    await query<ResultSetHeader>(
      "UPDATE promotions SET status = 'completed' WHERE id = ?",
      [promotionId]
    );

    await logActivity(
      req.user!.userId,
      `Promoted section "${section.name}" (G${section.grade_level} → G${toGrade}): ${results.length} students`,
      "promotions",
      promotionId
    );

    res.status(201).json({
      message: `Promotion completed. ${results.length} students processed.`,
      promotion_id: promotionId,
      from_section: section.name,
      from_grade: section.grade_level,
      to_grade: toGrade,
      students: results,
    });
  } catch (error) {
    console.error("Promotion error:", error);
    res.status(500).json({ error: "Failed to process promotion." });
  }
}

/**
 * GET /api/promotions — List promotions
 */
export async function listPromotions(_req: Request, res: Response): Promise<void> {
  try {
    const promotions = await query<RowDataPacket[]>(
      `SELECT p.*, sec.name AS section_name, sec.grade_level, u.name AS promoted_by_name, sy.sy_label,
              (SELECT COUNT(*) FROM promotion_students WHERE promotion_id = p.id) AS student_count,
              (SELECT COUNT(*) FROM promotion_students WHERE promotion_id = p.id AND is_retained = 1) AS retained_count
       FROM promotions p
       JOIN sections sec ON p.section_id = sec.id
       JOIN users u ON p.promoted_by = u.id
       JOIN school_years sy ON p.school_year_id = sy.id
       ORDER BY p.created_at DESC`
    );
    res.json(promotions);
  } catch (error) {
    console.error("List promotions error:", error);
    res.status(500).json({ error: "Failed to fetch promotions." });
  }
}

/**
 * GET /api/promotions/:id — Get promotion details with student list
 */
export async function getPromotionById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const promo = await query<RowDataPacket[]>(
      `SELECT p.*, sec.name AS section_name, sec.grade_level, u.name AS promoted_by_name, sy.sy_label
       FROM promotions p
       JOIN sections sec ON p.section_id = sec.id
       JOIN users u ON p.promoted_by = u.id
       JOIN school_years sy ON p.school_year_id = sy.id
       WHERE p.id = ?`,
      [id]
    );

    if (promo.length === 0) {
      res.status(404).json({ error: "Promotion not found." });
      return;
    }

    const students = await query<RowDataPacket[]>(
      `SELECT ps.*, stu.name AS student_name, stu.student_id,
              fs.name AS from_section_name, ts.name AS to_section_name
       FROM promotion_students ps
       JOIN students stu ON ps.student_id = stu.id
       JOIN sections fs ON ps.from_section_id = fs.id
       LEFT JOIN sections ts ON ps.to_section_id = ts.id
       WHERE ps.promotion_id = ?
       ORDER BY stu.name ASC`,
      [id]
    );

    res.json({ ...promo[0], students });
  } catch (error) {
    console.error("Get promotion error:", error);
    res.status(500).json({ error: "Failed to fetch promotion." });
  }
}
