/**
 * Shared name formatter (client mirror of server/src/utils/nameFormatter.ts —
 * keep the two identical). Single source of truth for splitting, joining, and
 * comparing learner names across every form: SF9/SF10 headers, LIS matching,
 * and the student-details edit feature.
 */

export interface NameParts {
  last: string;
  first: string;
  middle: string;
  ext: string;
}

const EXTS = ['JR', 'JR.', 'SR', 'SR.', 'II', 'III', 'IV', 'V', 'VI'];

/** Split a stored full name into parts ("Last, First Middle Ext" or natural). */
export function parseName(name: string): NameParts {
  const raw = String(name ?? '');
  const comma = raw.indexOf(',');
  if (comma >= 0) {
    const lastPart = raw.substring(0, comma).trim();
    const rest = raw
      .substring(comma + 1)
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    let ext = '';
    if (rest.length > 1 && EXTS.includes(rest[rest.length - 1].toUpperCase())) {
      ext = rest.pop() as string;
    }
    const first = rest[0] || '';
    const middle = rest.slice(1).join(' ') || '';
    return { last: lastPart, first, middle, ext };
  }
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { last: '', first: '', middle: '', ext: '' };
  if (parts.length === 1) return { last: parts[0], first: '', middle: '', ext: '' };
  let ext = '';
  if (parts.length >= 3 && EXTS.includes(parts[parts.length - 1].toUpperCase())) {
    ext = parts.pop() as string;
  }
  if (parts.length === 1) return { last: parts[0], first: '', middle: '', ext };
  if (parts.length === 2) return { last: parts[1], first: parts[0], middle: '', ext };
  return {
    last: parts[parts.length - 1],
    first: parts[0],
    middle: parts.slice(1, -1).join(' '),
    ext
  };
}

/** "Last, First Middle Ext" — the printed layout the forms use. */
export function formatName(parts: Partial<NameParts>): string {
  const p = {
    last: String(parts.last ?? '').trim(),
    first: String(parts.first ?? '').trim(),
    middle: String(parts.middle ?? '').trim(),
    ext: String(parts.ext ?? '').trim()
  };
  const given = [p.first, p.middle].filter(Boolean).join(' ');
  const name = p.last ? `${p.last}, ${given}`.trim().replace(/,$/, '') : given;
  return p.ext ? `${name} ${p.ext}`.trim() : name;
}

/**
 * Client doc §B: "Sorting remains based on Last Name only."
 * Compares two learner rows by surname, then given names; the suffix is
 * ignored for ordering. Rows with explicit name parts (last_name/first_name
 * from the LIS Phase-1 columns) use them directly; anything else falls back
 * to parsing the display name, so multi-word surnames like "Dela Cruz"
 * sort correctly.
 */
export function compareByLastName<
  T extends {
    name?: string;
    student_name?: string;
    last_name?: string | null;
    first_name?: string | null;
    middle_name?: string | null;
  }
>(a: T, b: T): number {
  const resolve = (r: T) => {
    const display = String(r.name ?? r.student_name ?? '');
    return r.last_name || r.first_name
      ? {
          last: String(r.last_name ?? ''),
          first: String(r.first_name ?? ''),
          middle: String(r.middle_name ?? '')
        }
      : parseName(display);
  };
  const pa = resolve(a);
  const pb = resolve(b);
  return (
    pa.last.localeCompare(pb.last) ||
    pa.first.localeCompare(pb.first) ||
    pa.middle.localeCompare(pb.middle)
  );
}

const normalizeExt = (ext: string): string =>
  String(ext ?? '').replace(/\./g, '').trim().toUpperCase();

/** Compare two names part-by-part (suffix-insensitive) for mismatch checks. */
export function namesMatch(a: string, b: string): boolean {
  const pa = parseName(a);
  const pb = parseName(b);
  const eq = (x: string, y: string) =>
    x.trim().toLowerCase() === y.trim().toLowerCase();
  return (
    eq(pa.last, pb.last) &&
    eq(pa.first, pb.first) &&
    eq(pa.middle, pb.middle) &&
    normalizeExt(pa.ext) === normalizeExt(pb.ext)
  );
}
