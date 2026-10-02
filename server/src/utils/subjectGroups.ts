/**
 * Subject-group collapsing for grade aggregation.
 *
 * Some learning areas are taught as several subjects but reported (and counted in
 * the general average) as one:
 *   - MAPEH  — Music, Arts, Physical Education, Health collapse into "MAPEH"
 *   - TLE    — TLE/EPP plus every specialization (Home Economics, ICT,
 *              Agri-Fishery, Industrial Arts, Entrepreneurship …) collapse into the
 *              main TLE subject, so a specialization never double-weights TLE.
 *
 * Subjects sharing a non-null `subject_group` are collapsed under the group's main
 * subject (the row named after the group's canonical heading, else the first row).
 * The listed numeric fields are averaged across the group.
 */

/** MAPEH components, collapsed by name (pre-dates subjects.subject_group). */
export const MAPEH_COMPONENTS = ["Music", "Arts", "Physical Education", "Health"];

/** Canonical heading each collapsed group reports under. */
const GROUP_HEADINGS: Record<string, string> = {
  tle: "TLE/EPP",
  tvl: "TVL",
};

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function mean(values: (number | null | undefined)[]): number | null {
  const present = values
    .map((v) => (typeof v === "string" ? parseFloat(v) : v))
    .filter((v): v is number => typeof v === "number" && !isNaN(v));
  return present.length > 0 ? round2(present.reduce((a, b) => a + b, 0) / present.length) : null;
}

/**
 * Collapse grouped learning areas into single rows.
 *
 * @param rows      subject rows (any object; `subject_name` + `subject_group` drive grouping)
 * @param avgFields numeric fields to average across a group (default: ["subject_average"])
 */
export function collapseSubjectGroups<T extends Record<string, any>>(
  rows: T[],
  avgFields: string[] = ["subject_average"]
): T[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const isMapeh = (r: T) => MAPEH_COMPONENTS.includes(String(r.subject_name));
  const groupKey = (r: T) => (r.subject_group ? String(r.subject_group) : null);

  const out: T[] = [];
  const consumed = new Set<T>();

  // ── MAPEH by name ──
  const mapehRows = rows.filter(isMapeh);
  if (mapehRows.length > 0) {
    mapehRows.forEach((r) => consumed.add(r));
    const collapsed: Record<string, any> = {
      ...mapehRows[0],
      subject_id: -1,
      subject_name: "MAPEH",
      subject_group: null,
    };
    for (const f of avgFields) collapsed[f] = mean(mapehRows.map((r) => r[f]));
    out.push(collapsed as T);
  }

  // ── Groups by subject_group (only when a group actually has >1 member) ──
  const groupKeys = Array.from(new Set(rows.map(groupKey).filter((k): k is string => k !== null)));
  for (const key of groupKeys) {
    const members = rows.filter((r) => groupKey(r) === key && !consumed.has(r));
    if (members.length === 0) continue;

    if (members.length === 1) {
      out.push({ ...members[0], subject_group: key });
      members.forEach((r) => consumed.add(r));
      continue;
    }

    members.forEach((r) => consumed.add(r));
    const heading = GROUP_HEADINGS[key];
    const main = (heading && members.find((r) => String(r.subject_name) === heading)) || members[0];
    const collapsed: Record<string, any> = {
      ...main,
      subject_name: main.subject_name,
      subject_group: key,
    };
    for (const f of avgFields) collapsed[f] = mean(members.map((r) => r[f]));
    out.push(collapsed as T);
  }

  // ── Everything else passes through untouched ──
  for (const r of rows) {
    if (!consumed.has(r) && !isMapeh(r)) out.push(r);
  }

  return out.sort((a, b) => String(a.subject_name).localeCompare(String(b.subject_name)));
}