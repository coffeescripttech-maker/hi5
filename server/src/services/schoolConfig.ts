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

export interface ProgramEligibilityMinimums {
  /** General Average minimum (null = no General Average rule). */
  ga: number | null;
  science: number | null;
  math: number | null;
  english: number | null;
  filipino: number | null;
}

export interface SectioningThresholds {
  ste: ProgramEligibilityMinimums;
  spfl: ProgramEligibilityMinimums;
  spj: ProgramEligibilityMinimums;
  regular: Pick<ProgramEligibilityMinimums, "ga">;
}

/**
 * The school's own enrollment criteria (from the finalized Grade Thresholds
 * spec). STE/SPFL/SPJ also require exam/interview, but those are recorded per
 * enrollment, not configured here. Non-Reader has no grade criteria at all and
 * is reached only through a teacher's tag; ALS/Open High School students are
 * placed manually and are never auto-sectioned.
 */
export const DEFAULT_SECTIONING_THRESHOLDS: SectioningThresholds = {
  ste: { ga: 85, science: 85, math: 85, english: null, filipino: null },
  spfl: { ga: null, science: null, math: null, english: 85, filipino: 85 },
  spj: { ga: 85, science: null, math: null, english: 85, filipino: 85 },
  regular: { ga: 75 },
};

/** Load the configured program eligibility minimums from section_type_config. */
export async function getSectioningThresholds(): Promise<SectioningThresholds> {
  try {
    const rows = await query<RowDataPacket[]>(
      `SELECT MIN(min_general_average) AS ga, MIN(min_science) AS science,
              MIN(min_math) AS math, MIN(min_english) AS english,
              MIN(min_filipino) AS filipino, section_type
       FROM section_type_config
       WHERE section_type IN ('ste', 'spfl', 'spj', 'regular')
       GROUP BY section_type`
    );
    if (rows.length === 0) return DEFAULT_SECTIONING_THRESHOLDS;
    const byType = new Map<string, any>();
    rows.forEach((r: any) => byType.set(r.section_type, r));
    const num = (v: any): number | null => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : null;
    };
    const pick = (type: string): ProgramEligibilityMinimums | null => {
      const r = byType.get(type);
      if (!r) return null;
      return {
        ga: num(r.ga), science: num(r.science), math: num(r.math),
        english: num(r.english), filipino: num(r.filipino),
      };
    };
    const ste = pick("ste") ?? DEFAULT_SECTIONING_THRESHOLDS.ste;
    const spfl = pick("spfl") ?? DEFAULT_SECTIONING_THRESHOLDS.spfl;
    const spj = pick("spj") ?? DEFAULT_SECTIONING_THRESHOLDS.spj;
    const regular = (() => {
      const r = pick("regular");
      return { ga: r ? r.ga : DEFAULT_SECTIONING_THRESHOLDS.regular.ga };
    })();
    return { ste, spfl, spj, regular };
  } catch (error) {
    console.error("getSectioningThresholds error:", error);
    return DEFAULT_SECTIONING_THRESHOLDS;
  }
}

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