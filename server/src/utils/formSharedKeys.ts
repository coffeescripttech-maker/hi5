/**
 * Cross-form Shared fields (docs/MAJOR_CHANGES_IN_FORMS.txt rule 8) and
 * school-year carry-over namespaces (rule 15).
 *
 * Field keys whose edits made on one school form must show on the others are
 * stored ONCE on the `SHARED` form ("saved once on the learner") under a
 * canonical key, then translated back into each requesting form's own
 * field_key namespace when read — the frontend sees exactly the keys it
 * already uses.
 *
 * Storage shape:
 *  - form-level  : form='SHARED', student_id NULL, field_key 'header:<k>'
 *  - learner-level: form='SHARED', student_id set, field_key 'shared:learner:<k>'
 */

/** Header identity keys that all four forms print identically. */
export const SHARED_HEADER_KEYS = new Set([
  "schoolId",
  "region",
  "division",
  "district",
  "schoolName",
]);

/** canonical shared learner field_key -> the key each form uses for it. */
export const SHARED_LEARNER_CANONICAL: Record<string, Record<string, string>> = {
  SF1: {
    "shared:learner:sex": "s:sex",
    "shared:learner:lrn": "s:lrn",
    "shared:learner:birthDate": "s:birthdate",
  },
  // SF5/SF9 do not edit learner identity fields; when requested they fall
  // back to the SF10 alias below so nothing shared is silently dropped —
  // SF9's cells are readonly, so this map is intentionally absent there.
  SF10: {
    "shared:learner:sex": "learner:sex",
    "shared:learner:lrn": "learner:lrn",
    "shared:learner:birthDate": "learner:birthDate",
  },
};

/** per-form field_key -> canonical shared key, when the field is shared. */
export const SHARED_LEARNER_ALIASES: Record<string, Record<string, string>> = {
  SF1: {
    "s:sex": "shared:learner:sex",
    "s:lrn": "shared:learner:lrn",
    "s:birthdate": "shared:learner:birthDate",
  },
  SF10: {
    "learner:sex": "shared:learner:sex",
    "learner:lrn": "shared:learner:lrn",
    "learner:birthDate": "shared:learner:birthDate",
  },
};

export type StorageEdit = { form: string; field_key: string; shared: boolean };

/**
 * Map a form-specific field key to its storage location. Header identity
 * edits and the shared learner identity fields go to 'SHARED'; everything
 * else stays on its own form.
 *
 * Returns null when the value cannot be stored as requested (a shared
 * learner field without a learner, or a shared header with one).
 */
export function normalizeForStorage(
  form: string,
  field_key: string
): StorageEdit | null {
  const m = /^header:([A-Za-z]+)$/.exec(field_key);
  if (m && SHARED_HEADER_KEYS.has(m[1])) {
    return { form: "SHARED", field_key, shared: true };
  }
  const alias = SHARED_LEARNER_ALIASES[form]?.[field_key];
  if (alias) {
    return { form: "SHARED", field_key: alias, shared: true };
  }
  return { form, field_key, shared: false };
}

/** true when a field_key is stored in the SHARED namespace. */
export function isSharedStorageKey(field_key: string): boolean {
  const m = /^header:([A-Za-z]+)$/.exec(field_key);
  return (!!m && SHARED_HEADER_KEYS.has(m[1])) || field_key.startsWith("shared:learner:");
}

/** Translate a SHARED row's canonical key into the requesting form's namespace. */
export function sharedKeyForForm(
  requestingForm: string,
  sharedFieldKey: string
): string | null {
  if (sharedFieldKey.startsWith("header:")) return sharedFieldKey;
  return SHARED_LEARNER_CANONICAL[requestingForm]?.[sharedFieldKey] ?? null;
}

export interface CarryRow {
  student_id: number | null;
  field_key: string;
  value: string;
  updated_at: string; // true-epoch ISO (converted from the DB wall clock)
  carried_from_sy: number;
}

/**
 * Rule 15 — which edit namespaces a new school year starts with. Quarterly
 * fields (SF9 attendance/parent signatures, grade tables) are intentionally
 * absent: they must start blank. `remarks` is excluded on SF1 because it is
 * derived from the years's own elective picks + legend.
 */
export const CARRY_OVER_KEYS: Record<string, string[]> = {
  // field_key LIKE pattern, or exact keys, per form:
  SF1: ["s:%"],
  SF10: ["learner:%", "elig:%"],
  SF5: [],
  SF9: [],
};

/** Learner fields excluded from carry-over (shared across SYs / per-SY derived). */
export const CARRY_OVER_EXCLUDED: Record<string, string[]> = {
  SF1: ["s:sex", "s:lrn", "s:birthdate", "s:remarks"],
  SF10: ["learner:sex", "learner:lrn", "learner:birthDate"],
  SF5: [],
  SF9: [],
};
