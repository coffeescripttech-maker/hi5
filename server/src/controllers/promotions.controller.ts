import { Request, Response } from "express";
import { getConnection, query } from "../config/database";
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

    // Find the next school year to enroll promoted students into. Promotion must
    // target the NEXT school year — never the same one. Falling back to the same
    // school year would move students into a higher-grade section within the year
    // they were supposed to complete, which corrupts their academic record (the
    // enrollment form then shows the wrong "Previous Grade"). So the next school
    // year must already exist; otherwise tell the user what to do first.
    const nextSY = await query<RowDataPacket[]>(
      "SELECT id FROM school_years WHERE id > ? ORDER BY id ASC LIMIT 1",
      [school_year_id]
    );
    if (nextSY.length === 0) {
      const parts = String(sy[0].sy_label || "").split(/[-–]/);
      const nextLabel =
        parts.length === 2 &&
        !Number.isNaN(parseInt(parts[0])) &&
        !Number.isNaN(parseInt(parts[1]))
          ? `${parseInt(parts[0]) + 1}-${parseInt(parts[1]) + 1}`
          : null;
      res.status(400).json({
        error: `Cannot promote yet — no next school year exists${
          nextLabel ? ` (e.g. ${nextLabel})` : ""
        }. Create and activate the next school year in School Year management first, then promote again.`,
      });
      return;
    }
    const nextSchoolYearId = nextSY[0].id;

    const { promotionId, results, toGrade: processedGrade } = await promoteSectionCore(
      req.user!.userId,
      section,
      school_year_id,
      nextSchoolYearId,
      { enrollRetained: false }
    );

    await logActivity(
      req.user!.userId,
      `Promoted section "${section.name}" (G${section.grade_level} → G${processedGrade}): ${results.length} students`,
      "promotions",
      promotionId
    );

    const promotedCount = results.filter(r => r.to_section_id != null).length;
    const retainedCount = results.filter(r => r.is_retained).length;
    const incompleteCount = results.filter(r => !r.grade_complete).length;
    const plural = (n: number) => (n === 1 ? "student" : "students");

    res.status(201).json({
      message:
        promotedCount === results.length && results.length > 0
          ? `Promotion completed. ${results.length} ${plural(results.length)} promoted to Grade ${processedGrade}.`
          : `Promotion processed ${results.length} ${plural(results.length)}: ${promotedCount} promoted, ${retainedCount} retained, ${incompleteCount} incomplete (grades not complete).`,
      promotion_id: promotionId,
      from_section: section.name,
      from_grade: section.grade_level,
      to_grade: processedGrade,
      students: results,
    });
  } catch (error) {
    console.error("Promotion error:", error);
    res.status(500).json({ error: (error as Error).message || "Failed to process promotion." });
  }
}

/**
 * GET /api/promotions/preview?section_id=&school_year_id=
 * Read-only preview of how a section's students would be classified by the
 * promotion algorithm (promoted / retained / incomplete) — no records written.
 * Mirrors promoteSectionCore's grade-completeness computation so the preview
 * matches the actual run.
 */
export async function previewSection(req: Request, res: Response): Promise<void> {
  try {
    const sectionId = parseInt(req.query.section_id as string);
    const schoolYearId = parseInt(req.query.school_year_id as string);

    if (!sectionId || !schoolYearId) {
      res.status(400).json({ error: "section_id and school_year_id are required." });
      return;
    }

    const sections = await query<RowDataPacket[]>(
      "SELECT id, name, grade_level, current_count FROM sections WHERE id = ?",
      [sectionId]
    );
    if (sections.length === 0) {
      res.status(404).json({ error: "Section not found." });
      return;
    }
    const section = sections[0];

    const students = await query<RowDataPacket[]>(
      `SELECT e.id AS enrollment_id, e.student_id, st.name,
              COALESCE(ROUND(AVG(ss.subject_avg), 2), NULL) AS general_average,
              COUNT(ss.subject_key) AS subject_count,
              COALESCE(MIN(ss.quarters_present), 0) AS min_quarters
       FROM enrollments e
       JOIN students st ON st.id = e.student_id
       LEFT JOIN (
         SELECT g.student_id, g.school_year_id,
                CASE WHEN s.name IN ('Music','Arts','Physical Education','Health')
                     THEN 'MAPEH' ELSE s.name END AS subject_key,
                ROUND(AVG(g.grade), 2) AS subject_avg,
                COUNT(DISTINCT CASE WHEN g.grade IS NOT NULL THEN g.quarter END) AS quarters_present
         FROM grades g
         JOIN subjects s ON g.subject_id = s.id
         WHERE g.school_year_id = ?
         GROUP BY g.student_id, g.school_year_id, subject_key
       ) ss ON ss.student_id = e.student_id AND ss.school_year_id = e.school_year_id
       WHERE e.section_id = ? AND e.school_year_id = ? AND e.status = 'enrolled'
       GROUP BY e.id, e.student_id
       ORDER BY general_average DESC`,
      [schoolYearId, sectionId, schoolYearId]
    );

    const results = students.map(s => {
      const subjectCount = parseInt(s.subject_count || "0", 10);
      const minQuarters = parseInt(s.min_quarters || "0", 10);
      const gradeComplete = subjectCount > 0 && minQuarters >= 4;
      const avg = s.general_average != null ? parseFloat(s.general_average) : NaN;
      const isRetained = gradeComplete && !isNaN(avg) && avg < 75;
      return {
        student_id: s.student_id,
        name: s.name,
        general_average: gradeComplete ? s.general_average : null,
        grade_complete: gradeComplete,
        is_retained: isRetained,
        promoted: gradeComplete && !isRetained,
      };
    });

    res.json({
      section_id: section.id,
      section_name: section.name,
      grade_level: section.grade_level,
      school_year_id: schoolYearId,
      total: results.length,
      promoted: results.filter(r => r.promoted).length,
      retained: results.filter(r => r.is_retained).length,
      incomplete: results.filter(r => !r.grade_complete).length,
      students: results,
    });
  } catch (error) {
    console.error("Promotion preview error:", error);
    res.status(500).json({ error: "Failed to load promotion preview." });
  }
}

/**
 * Shared per-section promotion logic. Extracted so both the single-section
 * endpoint and the year-end bulk promotion can reuse the same algorithm.
 * Throws on failure so the caller decides how to surface it.
 */
async function promoteSectionCore(
  userId: number,
  section: RowDataPacket,
  schoolYearId: number,
  nextSchoolYearId: number,
  opts: { enrollRetained: boolean } = { enrollRetained: false }
): Promise<{ promotionId: number; toGrade: number; results: any[] }> {
  const toGrade = section.grade_level + 1;

  // Safety guard: promoted students are enrolled into the NEXT school year. If the
  // caller ever passes the same school year (e.g. the next year does not exist), refuse —
  // otherwise students would be moved into a higher-grade section within the year they
  // were supposed to complete, corrupting their academic record.
  if (nextSchoolYearId === schoolYearId) {
    throw new Error(
      "Cannot promote into the same school year. Create the next school year first before promoting."
    );
  }

  // Get enrolled students with their averages + grade completeness.
  // grade_complete = every subject has all 4 quarters of grades entered.
  const students = await query<RowDataPacket[]>(
    `SELECT e.id AS enrollment_id, e.student_id,
            COALESCE(ROUND(AVG(ss.subject_avg), 2), NULL) AS general_average,
            COUNT(ss.subject_key) AS subject_count,
            COALESCE(MIN(ss.quarters_present), 0) AS min_quarters
     FROM enrollments e
     LEFT JOIN (
       SELECT g.student_id, g.school_year_id,
              CASE WHEN s.name IN ('Music','Arts','Physical Education','Health')
                   THEN 'MAPEH' ELSE s.name END AS subject_key,
              ROUND(AVG(g.grade), 2) AS subject_avg,
              COUNT(DISTINCT CASE WHEN g.grade IS NOT NULL THEN g.quarter END) AS quarters_present
       FROM grades g
       JOIN subjects s ON g.subject_id = s.id
       WHERE g.school_year_id = ?
       GROUP BY g.student_id, g.school_year_id, subject_key
     ) ss ON ss.student_id = e.student_id AND ss.school_year_id = e.school_year_id
     WHERE e.section_id = ? AND e.school_year_id = ? AND e.status = 'enrolled'
     GROUP BY e.id, e.student_id
     ORDER BY general_average DESC`,
    [schoolYearId, section.id, schoolYearId]
  );

  if (students.length === 0) {
    throw new Error(`No enrolled students found in section "${section.name}".`);
  }

  // Get available sections for the next grade level
  const targetSections = await query<RowDataPacket[]>(
    `SELECT * FROM sections WHERE grade_level = ? AND is_active = 1 ORDER BY min_average DESC`,
    [toGrade]
  );

  if (targetSections.length === 0) {
    throw new Error(`No active sections found for grade ${toGrade}. Create sections first.`);
  }

  // Create promotion record
  const promoResult = await query<ResultSetHeader>(
    `INSERT INTO promotions (section_id, to_grade_level, school_year_id, promoted_by, status)
     VALUES (?, ?, ?, ?, 'pending_review')`,
    [section.id, toGrade, schoolYearId, userId]
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
    const subjectCount = parseInt(s.subject_count || "0", 10);
    const minQuarters = parseInt(s.min_quarters || "0", 10);
    const gradeComplete = subjectCount > 0 && minQuarters >= 4;
    const isIncomplete = !gradeComplete;
    // Only students with complete grades are judged by their average
    const isRetained = isIncomplete ? 0 : (avg < 75 ? 1 : 0);

    // Find target section based on average (only for complete, non-retained students)
    let targetSectionId: number | null = null;
    if (gradeComplete && !isRetained) {
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
      `INSERT INTO promotion_students (promotion_id, student_id, from_section_id, to_section_id, general_average, is_retained, grade_complete)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [promotionId, s.student_id, section.id, targetSectionId, gradeComplete ? avg : null, isRetained, gradeComplete ? 1 : 0]
    );

    // Promoted: move to next grade and enroll in the next SY
    if (targetSectionId) {
      await query<ResultSetHeader>(
        "UPDATE students SET grade_level = ? WHERE id = ?",
        [toGrade, s.student_id]
      );

      // Check if already enrolled in the target school year. In the normal
      // year-end flow this is a fresh (next) school year with no enrollment,
      // so a new one is created. When promotion runs against a school year the
      // student is already enrolled in (e.g. no next SY exists yet), the
      // existing enrollment must be MOVED into the promoted section — otherwise
      // grade_level and the enrollment's section fall out of sync (student
      // shows as Grade 11 while still listed under a Grade 10 section).
      const existingEnroll = await query<RowDataPacket[]>(
        "SELECT id, section_id FROM enrollments WHERE student_id = ? AND school_year_id = ?",
        [s.student_id, nextSchoolYearId]
      );

      if (existingEnroll.length === 0) {
        await query<ResultSetHeader>(
          `INSERT INTO enrollments (student_id, section_id, school_year_id, enrollment_date, enrolled_by, status)
           VALUES (?, ?, ?, CURDATE(), ?, 'enrolled')`,
          [s.student_id, targetSectionId, nextSchoolYearId, userId]
        );
        // Update section counts
        await query<ResultSetHeader>(
          "UPDATE sections SET current_count = current_count + 1 WHERE id = ?",
          [targetSectionId]
        );
      } else if (existingEnroll[0].section_id !== targetSectionId) {
        // Move the existing enrollment into the promoted section and rebalance
        // both sections' stored counts (the target was not counted yet).
        await query<ResultSetHeader>(
          "UPDATE enrollments SET section_id = ?, status = 'enrolled' WHERE id = ?",
          [targetSectionId, existingEnroll[0].id]
        );
        if (existingEnroll[0].section_id != null) {
          await query<ResultSetHeader>(
            "UPDATE sections SET current_count = GREATEST(current_count - 1, 0) WHERE id = ?",
            [existingEnroll[0].section_id]
          );
        }
        await query<ResultSetHeader>(
          "UPDATE sections SET current_count = current_count + 1 WHERE id = ?",
          [targetSectionId]
        );
      }
      // else: already enrolled in the target section — section and counts are
      // already correct, so nothing further to do.
    } else if (opts.enrollRetained && (isRetained || isIncomplete)) {
      // Retained or incomplete students stay in the SAME section for the next school year
      const existingEnroll = await query<RowDataPacket[]>(
        "SELECT id FROM enrollments WHERE student_id = ? AND school_year_id = ?",
        [s.student_id, nextSchoolYearId]
      );
      if (existingEnroll.length === 0) {
        await query<ResultSetHeader>(
          `INSERT INTO enrollments (student_id, section_id, school_year_id, enrollment_date, enrolled_by, status)
           VALUES (?, ?, ?, CURDATE(), ?, 'enrolled')`,
          [s.student_id, section.id, nextSchoolYearId, userId]
        );
      }
    }

    results.push({
      student_id: s.student_id,
      name: student[0].name,
      general_average: gradeComplete ? avg : null,
      is_retained: isRetained === 1,
      grade_complete: gradeComplete,
      to_section_id: targetSectionId,
    });
  }

  // Mark promotion as completed
  await query<ResultSetHeader>(
    "UPDATE promotions SET status = 'completed' WHERE id = ?",
    [promotionId]
  );

  return { promotionId, toGrade, results };
}

/**
 * POST /api/promotions/bulk-promote — Year-end bulk promotion
 * Body: { school_year_id? } (defaults to the current school year)
 *
 * Promotes every grade 7-11 section (GA >= 75 promoted, < 75 retained) and
 * marks grade 12 sections as completers. Creates/uses the next school year
 * for the new enrollments. Individual section failures are collected and
 * reported rather than aborting the whole run.
 */
export async function bulkPromote(req: Request, res: Response): Promise<void> {
  try {
    // Resolve school year
    let schoolYearId: number;
    if (req.body?.school_year_id) {
      schoolYearId = parseInt(req.body.school_year_id);
    } else {
      const cur = await query<RowDataPacket[]>(
        "SELECT id FROM school_years WHERE is_current = 1 LIMIT 1"
      );
      if (cur.length === 0) {
        res.status(400).json({ error: "No current school year set." });
        return;
      }
      schoolYearId = cur[0].id;
    }

    const sy = await query<RowDataPacket[]>(
      "SELECT * FROM school_years WHERE id = ?",
      [schoolYearId]
    );
    if (sy.length === 0) {
      res.status(404).json({ error: "School year not found." });
      return;
    }
    const currentSY = sy[0];

    // Determine (and create if needed) the next school year for new enrollments
    const parts = String(currentSY.sy_label).split(/[-–]/);
    let nextLabel: string | null = null;
    if (parts.length === 2 && !Number.isNaN(parseInt(parts[0])) && !Number.isNaN(parseInt(parts[1]))) {
      nextLabel = `${parseInt(parts[0]) + 1}-${parseInt(parts[1]) + 1}`;
    }

    let nextSchoolYearId = schoolYearId;
    if (nextLabel) {
      const existing = await query<RowDataPacket[]>(
        "SELECT id FROM school_years WHERE sy_label = ?",
        [nextLabel]
      );
      if (existing.length > 0) {
        nextSchoolYearId = existing[0].id;
      } else {
        const ins = await query<ResultSetHeader>(
          "INSERT INTO school_years (sy_label, enrollment_open) VALUES (?, 1)",
          [nextLabel]
        );
        nextSchoolYearId = ins.insertId;
      }
    }

    // Sections with enrolled students in the current school year
    const sections = await query<RowDataPacket[]>(
      `SELECT DISTINCT sec.*
       FROM sections sec
       JOIN enrollments e ON e.section_id = sec.id AND e.school_year_id = ? AND e.status = 'enrolled'
       WHERE sec.is_active = 1
       ORDER BY sec.grade_level ASC, sec.name ASC`,
      [schoolYearId]
    );

    if (sections.length === 0) {
      res.status(400).json({ error: "No sections with enrolled students found for this school year." });
      return;
    }

    // Run promotion per section, tolerating individual failures
    const byGrade: Record<number, {
      grade_level: number;
      to_grade_level: number;
      label: string;
      sections: number;
      students_processed: number;
      promoted: number;
      retained: number;
      incomplete: number;
      completed: number;
    }> = {};
    const failures: { section_name: string; grade_level: number; error: string }[] = [];

    for (const section of sections) {
      const g = section.grade_level;
      if (!byGrade[g]) {
        byGrade[g] = {
          grade_level: g,
          to_grade_level: g === 12 ? 13 : g + 1,
          label: g === 12 ? "Grade 12 → Graduated" : `Grade ${g} → Grade ${g + 1}`,
          sections: 0,
          students_processed: 0,
          promoted: 0,
          retained: 0,
          incomplete: 0,
          completed: 0,
        };
      }

      try {
        if (g === 12) {
          const { results } = await completeSectionCore(req.user!.userId, section, schoolYearId);
          byGrade[g].students_processed += results.length;
          byGrade[g].completed += results.length;
        } else if (g >= 7 && g <= 11) {
          const { results } = await promoteSectionCore(
            req.user!.userId,
            section,
            schoolYearId,
            nextSchoolYearId,
            { enrollRetained: true }
          );
          byGrade[g].students_processed += results.length;
          for (const r of results) {
            if (r.is_retained) byGrade[g].retained += 1;
            else if (!r.grade_complete) byGrade[g].incomplete += 1;
            else byGrade[g].promoted += 1;
          }
        }
        byGrade[g].sections += 1;
      } catch (err) {
        failures.push({
          section_name: section.name,
          grade_level: g,
          error: (err as Error).message || String(err),
        });
      }
    }

    const summary = Object.values(byGrade);

    await logActivity(
      req.user!.userId,
      `Bulk year-end promotion executed across ${sections.length} sections (${sections.length - failures.length} succeeded, ${failures.length} failed)`,
      "promotions",
      null
    );

    res.json({
      message: `Bulk promotion completed. ${sections.length} sections processed (${sections.length - failures.length} succeeded).`,
      school_year_id: schoolYearId,
      next_school_year_id: nextSchoolYearId,
      next_sy_label: nextLabel,
      summary,
      failures,
    });
  } catch (error) {
    console.error("Bulk promotion error:", error);
    res.status(500).json({ error: (error as Error).message || "Failed to process bulk promotion." });
  }
}

/**
 * GET /api/promotions — List promotions
 */
export async function listPromotions(_req: Request, res: Response): Promise<void> {
  try {
    const promotions = await query<RowDataPacket[]>(
      `SELECT p.*, sec.name AS section_name, sec.grade_level AS from_grade_level,
              u.name AS promoted_by_name, sy.sy_label,
              (sec.grade_level = 12 AND p.to_grade_level = 12) AS is_completers,
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

/**
 * POST /api/promotions/complete — Mark a Grade 12 section as completers
 * Body: { section_id, school_year_id }
 *
 * Algorithm:
 * 1. Fetch all enrolled students in the Grade 12 section
 * 2. Mark each student's enrollment as 'completed'
 * 3. Update each student's status to 'graduated'
 * 4. Record a promotion record for audit trail
 */
export async function completeSection(req: Request, res: Response): Promise<void> {
  try {
    const { section_id, school_year_id } = req.body;

    if (!section_id || !school_year_id) {
      res.status(400).json({ error: "section_id and school_year_id are required." });
      return;
    }

    // Get source section — must be Grade 12
    const sections = await query<RowDataPacket[]>(
      "SELECT * FROM sections WHERE id = ?",
      [section_id]
    );
    if (sections.length === 0) {
      res.status(404).json({ error: "Section not found." });
      return;
    }

    const section = sections[0];
    if (section.grade_level !== 12) {
      res.status(400).json({ error: "Only Grade 12 sections can be marked as completers." });
      return;
    }

    const { promotionId, results } = await completeSectionCore(req.user!.userId, section, school_year_id);

    await logActivity(
      req.user!.userId,
      `Marked section "${section.name}" (Grade 12) as completers: ${results.length} students`,
      "promotions",
      promotionId
    );

    res.status(201).json({
      message: `${results.length} students marked as completers.`,
      promotion_id: promotionId,
      section_name: section.name,
      student_count: results.length,
      students: results,
    });
  } catch (error) {
    console.error("Complete section error:", error);
    res.status(500).json({ error: "Failed to complete section." });
  }
}

/**
 * Shared Grade 12 completion logic. Extracted so both the single-section
 * endpoint and the year-end bulk promotion can reuse the same code.
 * Throws on failure so the caller decides how to surface it.
 */
async function completeSectionCore(
  userId: number,
  section: RowDataPacket,
  schoolYearId: number
): Promise<{ promotionId: number; results: any[] }> {
  // Get enrolled students in this section for this school year
  const students = await query<RowDataPacket[]>(
    `SELECT e.id AS enrollment_id, e.student_id, s.name, s.student_id AS display_id
     FROM enrollments e
     JOIN students s ON e.student_id = s.id
     WHERE e.section_id = ? AND e.school_year_id = ? AND e.status = 'enrolled'`,
    [section.id, schoolYearId]
  );

  if (students.length === 0) {
    // Distinguish "already graduated" from "no students yet" so the user
    // knows which action to take next instead of getting a dead-end error.
    const completed = await query<RowDataPacket[]>(
      `SELECT e.id
       FROM enrollments e
       WHERE e.section_id = ? AND e.school_year_id = ? AND e.status = 'completed'`,
      [section.id, schoolYearId]
    );

    if (completed.length > 0) {
      throw new Error(
        `Section "${section.name}" has already been marked as completers (${completed.length} student${completed.length === 1 ? "" : "s"}). This is a completed record and cannot be marked again.`
      );
    }

    throw new Error(
      `No enrolled students found in section "${section.name}". Enroll students in this section first, then mark them as completers.`
    );
  }

  // Create a promotion-like record for audit trail
  const promoResult = await query<ResultSetHeader>(
    `INSERT INTO promotions (section_id, to_grade_level, school_year_id, promoted_by, status)
     VALUES (?, 12, ?, ?, 'completed')`,
    [section.id, schoolYearId, userId]
  );
  const promotionId = promoResult.insertId;

  // Process each student
  const results: any[] = [];
  for (const s of students) {
    // Mark enrollment as completed
    await query<ResultSetHeader>(
      "UPDATE enrollments SET status = 'completed', remarks = 'Grade 12 completed' WHERE id = ?",
      [s.enrollment_id]
    );

    // Update student status to graduated
    await query<ResultSetHeader>(
      "UPDATE students SET status = 'graduated' WHERE id = ?",
      [s.student_id]
    );

    // Insert promotion_student record for audit
    await query<ResultSetHeader>(
      `INSERT INTO promotion_students (promotion_id, student_id, from_section_id, to_section_id, general_average, is_retained)
       VALUES (?, ?, ?, NULL, NULL, 0)`,
      [promotionId, s.student_id, section.id]
    );

    results.push({
      student_id: s.student_id,
      name: s.name,
    });
  }

  // Decrement section counts since students have left
  await query<ResultSetHeader>(
    "UPDATE sections SET current_count = GREATEST(current_count - ?, 0) WHERE id = ?",
    [students.length, section.id]
  );

  return { promotionId, results };
}

/**
 * POST /api/promotions/:id/rollback — Undo a Grade 12 completion
 *
 * Reverses what completeSection did, so a section can be completed again:
 * 1. Students return to 'enrolled' (their student status AND their enrollment
 *    in the completed section/school year are restored).
 * 2. The section's current-school-year count is recomputed from real data.
 * 3. The completion promotion + its promotion_students + its audit log are
 *    removed, so the section reappears in the promote dropdown.
 * Only completion records (Grade 12 section, status 'completed') can be
 * rolled back — regular promotions are permanent.
 */
export async function rollbackCompletion(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(String(req.params.id));
    if (!id || Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid promotion id." });
      return;
    }

    const promo = await query<RowDataPacket[]>(
      `SELECT p.*, sec.name AS section_name, sec.grade_level
       FROM promotions p JOIN sections sec ON p.section_id = sec.id
       WHERE p.id = ?`,
      [id]
    );
    if (promo.length === 0) {
      res.status(404).json({ error: "Promotion not found." });
      return;
    }
    const promotion = promo[0];

    if (
      promotion.status !== "completed" ||
      promotion.to_grade_level !== 12 ||
      promotion.grade_level !== 12
    ) {
      res.status(400).json({ error: "Only Grade 12 completion records can be rolled back." });
      return;
    }

    const students = await query<RowDataPacket[]>(
      "SELECT student_id FROM promotion_students WHERE promotion_id = ?",
      [id]
    );
    if (students.length === 0) {
      res.status(400).json({ error: "This completion record has no students and cannot be rolled back." });
      return;
    }

    const studentIds = students.map((s: any) => s.student_id);
    const placeholders = studentIds.map(() => "?").join(",");

    const connection = await getConnection();
    try {
      await connection.beginTransaction();

      // Revert each student's enrollment in the completed section/school year
      // back to 'enrolled' (only touches enrollments this completion changed).
      await connection.query(
        `UPDATE enrollments SET status = 'enrolled', remarks = NULL
         WHERE student_id IN (${placeholders}) AND section_id = ? AND school_year_id = ? AND status = 'completed'`,
        [...studentIds, promotion.section_id, promotion.school_year_id]
      );

      // Revert student status — only students this completion graduated.
      await connection.query(
        `UPDATE students SET status = 'enrolled'
         WHERE status = 'graduated' AND id IN (${placeholders})`,
        studentIds
      );

      // Recompute the section's count from the current school year's real enrollments.
      await connection.query(
        `UPDATE sections SET current_count =
           (SELECT COUNT(*) FROM enrollments e JOIN school_years sy ON sy.id = e.school_year_id
            WHERE e.section_id = ? AND sy.is_current = 1)
         WHERE id = ?`,
        [promotion.section_id, promotion.section_id]
      );

      // Remove the completion record + its students + its audit log so the
      // section can be completed again from a clean state.
      await connection.query("DELETE FROM promotion_students WHERE promotion_id = ?", [id]);
      await connection.query(
        "DELETE FROM activity_logs WHERE entity_type = 'promotions' AND entity_id = ?",
        [String(id)]
      );
      await connection.query("DELETE FROM promotions WHERE id = ?", [id]);

      await connection.commit();

      // Audit the rollback itself (logActivity never throws).
      await logActivity(
        req.user!.userId,
        `Rolled back completion of section "${promotion.section_name}" (Grade 12): ${students.length} student${students.length === 1 ? "" : "s"} returned to enrolled`,
        "promotions",
        null
      );

      res.status(200).json({
        message: `Rolled back completion of "${promotion.section_name}". ${students.length} student${students.length === 1 ? "" : "s"} returned to enrolled.`,
        section_id: promotion.section_id,
        section_name: promotion.section_name,
        student_count: students.length,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Rollback completion error:", error);
    res.status(500).json({ error: (error as Error).message || "Failed to roll back completion." });
  }
}
