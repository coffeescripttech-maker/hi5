/**
 * Linear Regression risk model
 *
 * Fits a least-squares line through a student's per-quarter general averages
 * (x = quarter 1..n, y = average grade) and classifies the student's trend as
 * On Track / Needs Monitoring / At-Risk based on the slope and the projected
 * final grade. Pure functions — no I/O, no dependencies.
 */

export interface GradePoint {
  x: number; // quarter (1..4)
  y: number; // that quarter's general average
}

export interface RegressionResult {
  slope: number;
  intercept: number;
}

export type RiskLevel = "at_risk" | "needs_monitoring" | "on_track";
export type RiskTrend = "declining" | "stable" | "improving";

export interface StudentRisk {
  risk_level: RiskLevel | null; // null = no grade data yet
  trend: RiskTrend;
  current_average: number | null;
  slope: number | null;
  projected: number | null; // projected final grade (regression at quarter 4)
}

/** Passing grade (DepEd minimum). */
const PASSING = 75;
/** Above this, a stable/improving student is comfortably On Track. */
const MONITOR = 80;
/** Per-quarter slope considered a meaningful decline. */
const DECLINE = -1;
/** Per-quarter slope considered a meaningful improvement. */
const IMPROVE = 1;
/** The final grading period used for the projected grade. */
const FINAL_QUARTER = 4;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Least-squares linear regression: y = intercept + slope * x.
 * Returns slope 0 / intercept mean-y when all x are equal (degenerate fit).
 */
export function linearRegression(points: GradePoint[]): RegressionResult {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0 };

  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;

  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) * (p.x - meanX);
  }

  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  return { slope, intercept };
}

/**
 * Classify a student from their per-quarter general averages.
 *
 * `quarters` is indexed by quarter-1 (quarters[0] = Q1 … quarters[3] = Q4);
 * missing quarters are null.
 */
export function classifyStudent(
  quarters: (number | null)[]
): StudentRisk {
  const points: GradePoint[] = quarters
    .map((y, i) => ({ x: i + 1, y }))
    .filter((p): p is GradePoint => p.y !== null && !isNaN(p.y));

  const current_average =
    points.length === 0 ? null : round2(points.reduce((s, p) => s + p.y, 0) / points.length);

  // No grades yet — nothing to predict.
  if (points.length === 0) {
    return {
      risk_level: null,
      trend: "stable",
      current_average: null,
      slope: null,
      projected: null,
    };
  }

  // A single quarter gives no trend — fall back to the current average only.
  if (points.length === 1) {
    const avg = points[0].y;
    const risk_level: RiskLevel =
      avg < PASSING ? "at_risk" : avg < MONITOR ? "needs_monitoring" : "on_track";
    return { risk_level, trend: "stable", current_average, slope: null, projected: avg };
  }

  const { slope, intercept } = linearRegression(points);
  const projected = clamp(round2(intercept + slope * FINAL_QUARTER), 0, 100);

  let risk_level: RiskLevel;
  if (current_average! < PASSING || projected < PASSING) {
    risk_level = "at_risk";
  } else if (slope < DECLINE || projected < MONITOR) {
    risk_level = "needs_monitoring";
  } else {
    risk_level = "on_track";
  }

  const trend: RiskTrend =
    slope > IMPROVE ? "improving" : slope < DECLINE ? "declining" : "stable";

  return {
    risk_level,
    trend,
    current_average,
    slope: round2(slope),
    projected,
  };
}
