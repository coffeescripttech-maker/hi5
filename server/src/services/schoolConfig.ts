/**
 * Shared school-config service: loads the configurable academic thresholds
 * from school_settings so every consumer (promotion, LIS/forms export, at-risk
 * model, sectioning) reads the same values. Falls back to the DepEd-standard
 * defaults when the columns are absent or unset.
 */
import { query } from "../config/database";
import { RowDataPacket } from "mysql2";

export interface AcademicThresholds {
  passing_grade: number;
  monitor_threshold: number;
}

export const DEFAULT_THRESHOLDS: AcademicThresholds = {
  passing_grade: 75,
  monitor_threshold: 80,
};

export async function getAcademicThresholds(): Promise<AcademicThresholds> {
  try {
    const rows = await query<RowDataPacket[]>(
      `SELECT passing_grade, monitor_threshold FROM school_settings WHERE id = 1 LIMIT 1`
    );
    if (rows.length === 0) return DEFAULT_THRESHOLDS;
    const passing = parseFloat(rows[0].passing_grade as string);
    const monitor = parseFloat(rows[0].monitor_threshold as string);
    return {
      passing_grade: Number.isFinite(passing) ? passing : DEFAULT_THRESHOLDS.passing_grade,
      monitor_threshold: Number.isFinite(monitor) ? monitor : DEFAULT_THRESHOLDS.monitor_threshold,
    };
  } catch (error) {
    console.error("getAcademicThresholds error:", error);
    return DEFAULT_THRESHOLDS;
  }
}