/**
 * Shared formatting for a subject's weekly load.
 *
 * `subjects.hours_per_week` is a single DECIMAL(4,1) total (e.g. 12 = 12 hrs
 * per week). The school week is 4 teaching days, so show the total *and* the
 * per-day average the way users read it: "12 hrs/wk · 3 hrs/day · 4 days/wk".
 */
export const DAYS_PER_WEEK = 4;

/** Round to 1 decimal (floor at 100): 12 / 4 = 3 ; 10.5 / 4 = 2.6 */
function perDay(hours: number): number {
  return Math.max(1, Math.round((hours / DAYS_PER_WEEK) * 10) / 10);
}

/** "3 hrs/day · 4 days/wk (12 hrs/wk)" — per-day first, weekly total in parens. */
export function formatHoursPerWeek(hours: number): string {
  const d = perDay(hours);
  return `${d} hr${d === 1 ? "" : "s"}/day · ${DAYS_PER_WEEK} days/wk (${hours} hrs/wk)`;
}

/** Compact form for tight cells (cards, preview rows): "12h". */
export function hoursShort(hours: number): string {
  return `${hours}h`;
}