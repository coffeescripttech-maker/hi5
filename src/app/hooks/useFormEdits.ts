/**
 * Saved School Form Edits hook (docs/MAJOR_CHANGES_IN_FORMS.txt).
 *
 * Wraps the /forms/edits API so a school-form page can re-apply every saved
 * handwritten edit and save new ones with an explicit Save button:
 *
 *   const { get, setValue, save, isDirty, valuesRef, loading, saving, error } =
 *     useFormEdits({ form: 'SF9', schoolYearId: syId, studentId: sid });
 *
 * Semantics:
 * - `loaded` = values already saved on the server; `local` = unsaved edits;
 *   `carried` = the previous school year's learner-level prefill (rule 15).
 * - `get(studentIdOrNull, fieldKey)` = local ?? loaded ?? carried ?? undefined.
 *   An empty string is a meaningful "cleared on purpose" value (rule 7) and
 *   overrides anything below it; `undefined` means "never set".
 * - `setValue(...)` marks the field dirty (equal-to-saved values drop out).
 *   An optional current system value records the rule 11/12 baseline.
 * - `save()` PUTs only the dirty fields, sending `opened_at` so the server
 *   can refuse a concurrent edit with 409 (rule 13); resolve with
 *   `resolveConflict('overwrite')` or `resolveConflict('reload')`.
 * - `valuesRef.current` merges carried+loaded+local so plain render/build
 *   effects can apply saved values WITHOUT calling setValue (no self-dirty
 *   loop when re-deriving rows from fetched data).
 * - Rules 11/12 helpers: `setBase` records the freshly derived system value
 *   during the form's build effects; `isEdited` marks a cell whose effective
 *   value differs from the system value; `systemChangedItems` finds edits
 *   whose stored baseline (system value when the edit was made) no longer
 *   matches the current system value; `refreshBaseline` = "Keep";
 *   `resetEdits` = "Reset to system value" (rule 11).
 * - A `beforeunload` warning shows while there are unsaved edits (rule 3).
 * - Switching scope (form/SY/student/section) reloads and discards local
 *   edits; values typed before the fetch completes are preserved.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formsApi, FormEditRow } from '../services/forms';

export type FormName = 'SF1' | 'SF5' | 'SF9' | 'SF10';

export interface UseFormEditsOptions {
  form: FormName;
  /** null/0 disables loading until the page resolves its school year. */
  schoolYearId: number | null | undefined;
  /** Exactly one targeting mode per page: student, section, or id list. */
  studentId?: number | null;
  sectionId?: number | null;
  studentIds?: number[];
  /** Set false to keep the hook idle (e.g. before section is chosen). */
  enabled?: boolean;
  /** Human label for a learner in the Edited-fields menu (optional). */
  labelStudent?: (sid: number) => string;
}

export function editKey(studentId: number | null, fieldKey: string): string {
  return `${studentId ?? 0}|${fieldKey}`;
}

type ValueMap = Record<string, string>;

interface LoadedEntry {
  value: string;
  /** system value at the time the edit was saved (rule 12 baseline). */
  system_value: string | null;
  updated_at: string;
}

export interface EditedItem {
  sid: number | null;
  fieldKey: string;
  label: string;
  /** effective value shown on the form (.saved value or unsaved local edit). */
  value: string;
  unsaved: boolean;
  /** true when the underlying system value changed since the edit (rule 12). */
  sysChanged: boolean;
  currentSystem: string | null;
  /** when the edit was last saved (true epoch ISO); null for unsaved items. */
  updatedAt: string | null;
}

export interface UseFormEditsApi {
  /** local ?? loaded ?? carried (undefined = never set; '' = saved empty). */
  get: (studentId: number | null, fieldKey: string) => string | undefined;
  setValue: (
    studentId: number | null,
    fieldKey: string,
    value: string,
    /** optional current system value (rule 11/12 baseline). */
    systemValue?: string
  ) => void;
  save: (opts?: { force?: boolean }) => Promise<{ saved: number }>;
  reset: () => void;
  /** record the freshly derived system value of a field (build effects). */
  setBase: (studentId: number | null, fieldKey: string, systemValue: string) => void;
  /** rule 11 marker: effective value differs from the system value. */
  isEdited: (studentId: number | null, fieldKey: string) => boolean;
  /** every stored/unsaved edit, for the Edited-fields menu. */
  listEdits: () => EditedItem[];
  /** rule 11 — remove stored edits so the system value shows again. */
  resetEdits: (items: EditedItem[]) => Promise<number>;
  /** rule 12 "Keep" — accept the new system value as the edit's baseline. */
  refreshBaseline: (items: EditedItem[]) => Promise<number>;
  /** rule 13 — fields changed by someone else since the form was opened. */
  conflicts: { student_id: number | null; field_key: string; updated_at: string | null }[];
  hasConflict: boolean;
  resolveConflict: (mode: 'overwrite' | 'reload') => Promise<void>;
  isDirty: boolean;
  dirtyCount: number;
  loading: boolean;
  saving: boolean;
  error: string | null;
  /** Merged saved+unsaved+carried values, kept in sync for build effects. */
  valuesRef: React.MutableRefObject<ValueMap>;
}

export function useFormEdits(opts: UseFormEditsOptions): UseFormEditsApi {
  const { form, schoolYearId, studentId, sectionId, studentIds, enabled = true, labelStudent } = opts;

  const loadedRef = useRef<Record<string, LoadedEntry>>({});
  // Rule 15 — previous school year's learner-level details, returned by the
  // server separately and layered UNDER the current-SY saved values so a new
  // year starts carried over while every field remains over-writable.
  const carriedRef = useRef<ValueMap>({});
  // When each carried row was originally saved — surfaced in the Edited
  // fields menu next to a full "carried over" badge.
  const carriedAtRef = useRef<Record<string, string>>({});
  const localRef = useRef<ValueMap>({});
  // Rule 11/12 — freshly derived system values (from the form's build
  // effects) and the baseline recorded with each stored edit.
  const baseRef = useRef<ValueMap>({});
  const localSystemRef = useRef<ValueMap>({}); // baseline chosen while typing
  const [tick, setTick] = useState(0); // re-render trigger
  const [local, setLocalState] = useState<ValueMap>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<
    { student_id: number | null; field_key: string; updated_at: string | null }[]
  >([]);
  const hasConflict = conflicts.length > 0;
  const valuesRef = useRef<ValueMap>({});
  // The database-side clock stamp (`opened_at`) captured when the form
  // loaded — echoed back with every save so rule 13's `updated_at >
  // opened_at` check runs on ONE clock (the DB's), immune to client clock
  // skew and timezones. Empty means "conflict checks unavailable".
  const openedAtRef = useRef<string>('');

  const applyLocal = useCallback((next: ValueMap) => {
    localRef.current = next;
    setLocalState(next);
  }, []);

  const recomputeMerged = useCallback(() => {
    // Layering: carried (previous-SY prefill) is the base, current school
    // year saved values win over it, unsaved edits win over both.
    const merged: ValueMap = { ...carriedRef.current };
    for (const [k, v] of Object.entries(loadedRef.current)) merged[k] = v.value;
    for (const [k, v] of Object.entries(localRef.current)) merged[k] = v;
    valuesRef.current = merged;
  }, []);

  const setLoaded = useCallback(
    (entries: Record<string, LoadedEntry>) => {
      loadedRef.current = entries;
      recomputeMerged();
      setTick(t => t + 1);
    },
    [recomputeMerged]
  );

  // Rule 11/12 — record the freshly derived system value of a field from the
  // form's build effects, so isEdited can compare the effective value against
  // it and listEdits can detect baseline drift.
  const setBase = useCallback(
    (studentId2: number | null, fieldKey: string, systemValue: string) => {
      const key = editKey(studentId2, fieldKey);
      if (baseRef.current[key] === systemValue) return;
      baseRef.current[key] = systemValue;
      setTick(t => t + 1); // the Edited marker may have changed
    },
    []
  );

  // Scope fingerprint — only genuine targeting changes reload.
  const scopeKey = useMemo(
    () =>
      `${studentId ?? 0}|${sectionId ?? 0}|${(studentIds ?? [])
        .slice()
        .sort((a, b) => a - b)
        .join(',')}`,
    [studentId, sectionId, studentIds]
  );

  const buildScope = useCallback(
    () => ({
      ...(studentId ? { student_id: studentId } : {}),
      ...(sectionId ? { section_id: sectionId } : {}),
      ...(studentIds?.length ? { student_ids: studentIds } : {}),
    }),
    [studentId, sectionId, studentIds]
  );

  const fetchEdits = useCallback(() => {
    if (!enabled || !schoolYearId) {
      setLoaded({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    formsApi
      .formEdits(form, schoolYearId, buildScope())
      .then(res => {
        if (cancelled) return;
        const map: Record<string, LoadedEntry> = {};
        for (const r of res.edits)
          map[editKey(r.student_id, r.field_key)] = {
            value: r.value,
            system_value: r.system_value ?? null,
            updated_at: r.updated_at,
          };
        const carried: ValueMap = {};
        const carriedAt: Record<string, string> = {};
        for (const r of res.carried ?? []) {
          const k = editKey(r.student_id, r.field_key);
          carried[k] = r.value;
          carriedAt[k] = r.updated_at;
        }
        carriedRef.current = carried;
        carriedAtRef.current = carriedAt;
        openedAtRef.current = res.opened_at ?? '';
        setLoaded(map);
      })
      .catch(err => {
        if (cancelled) return;
        setError(
          err?.detail?.error ||
            err?.message ||
            'Failed to load saved form edits.'
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, schoolYearId, scopeKey, enabled, buildScope, setLoaded]);

  useEffect(() => {
    // New target → discard unsaved edits typed for the previous one, then
    // fetch (fetch completion itself never discards local — see fetchEdits).
    localRef.current = {};
    setLocalState({});
    const cancel = fetchEdits();
    return cancel ?? undefined;
  }, [fetchEdits]);

  const get = useCallback(
    (studentId2: number | null, fieldKey: string): string | undefined => {
      const key = editKey(studentId2, fieldKey);
      const l = localRef.current[key];
      if (l !== undefined) return l;
      const ld = loadedRef.current[key];
      if (ld !== undefined) return ld.value;
      // Rule 15 — carried-over previous-SY value is the last fallback.
      return carriedRef.current[key];
    },
    // re-render trigger so callers see fresh values
    [local, tick]
  );

  const setValue = useCallback(
    (
      studentId2: number | null,
      fieldKey: string,
      value: string,
      systemValue?: string
    ) => {
      const key = editKey(studentId2, fieldKey);
      const current = { ...localRef.current };
      if (current[key] === value) return;
      const savedVal = loadedRef.current[key]?.value;
      const carriedVal = carriedRef.current[key];
      // A field stops being dirty once it matches the value it would show
      // without local state — the saved edit, or the carried prefill when
      // this school year has never saved this field (rule 15).
      const neutralVal = savedVal !== undefined ? savedVal : carriedVal;
      if (value === neutralVal) {
        delete current[key];
        delete localSystemRef.current[key];
      } else {
        current[key] = value;
        if (systemValue !== undefined) localSystemRef.current[key] = systemValue;
      }
      applyLocal(current);
      if (systemValue !== undefined) setBase(studentId2, fieldKey, systemValue);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyLocal, setBase]
  );

  const isEdited = useCallback(
    (studentId2: number | null, fieldKey: string): boolean => {
      const key = editKey(studentId2, fieldKey);
      const eff = valuesRef.current[key];
      if (eff === undefined) return false;
      const base = baseRef.current[key];
      if (base === undefined) {
        // No derived system value known for this field — any hook-held value
        // (saved or unsaved) is a manual override.
        return localRef.current[key] !== undefined || loadedRef.current[key] !== undefined;
      }
      return eff !== base;
    },
    // re-render with the tick
    [tick, local]
  );

  const listEdits = useCallback((): EditedItem[] => {
    const items = new Map<string, EditedItem>();
    const label = (sid: number | null) =>
      sid == null
        ? 'form-level'
        : labelStudent
          ? labelStudent(sid)
          : `student ${sid}`;
    for (const [key, entry] of Object.entries(loadedRef.current)) {
      const pipe = key.indexOf('|');
      const sid = parseInt(key.slice(0, pipe), 10) || null;
      const fieldKey = key.slice(pipe + 1);
      const base = baseRef.current[key] ?? null;
      items.set(key, {
        sid,
        fieldKey,
        label: `${label(sid)} — ${fieldKey.replace(/:/g, ' · ')}`,
        value: entry.value,
        unsaved: false,
        sysChanged: entry.system_value !== null && base !== null && entry.system_value !== base,
        currentSystem: base,
        updatedAt: entry.updated_at,
      });
    }
    for (const [key, value] of Object.entries(localRef.current)) {
      const pipe = key.indexOf('|');
      const sid = parseInt(key.slice(0, pipe), 10) || null;
      const fieldKey = key.slice(pipe + 1);
      const base = baseRef.current[key] ?? null;
      const entry = loadedRef.current[key];
      items.set(key, {
        sid,
        fieldKey,
        label: `${label(sid)} — ${fieldKey.replace(/:/g, ' · ')}`,
        value,
        unsaved: true,
        sysChanged:
          !entry &&
          localSystemRef.current[key] !== undefined &&
          base !== null &&
          localSystemRef.current[key] !== base,
        currentSystem: base,
        updatedAt: null,
      });
    }
    for (const key of Object.keys(carriedRef.current)) {
      if (loadedRef.current[key] || localRef.current[key]) continue;
      const pipe = key.indexOf('|');
      const sid = parseInt(key.slice(0, pipe), 10) || null;
      const fieldKey = key.slice(pipe + 1);
      items.set(key, {
        sid,
        fieldKey,
        label: `${label(sid)} — ${fieldKey.replace(/:/g, ' · ')}`,
        value: carriedRef.current[key],
        unsaved: false,
        sysChanged: false,
        currentSystem: baseRef.current[key] ?? null,
        updatedAt: carriedAtRef.current[key] ?? null,
      });
    }
    // Newest first: unsaved edits (typing right now) on top, then stored
    // edits by their save time, oldest at the bottom.
    const rank = (i: EditedItem) =>
      i.unsaved
        ? Number.MAX_SAFE_INTEGER
        : i.updatedAt
          ? Date.parse(i.updatedAt)
          : Number.MIN_SAFE_INTEGER;
    return [...items.values()].sort(
      (a, b) => rank(b) - rank(a) || a.label.localeCompare(b.label)
    );
  }, [labelStudent, local, tick]);

  const resetEdits = useCallback(
    async (items: EditedItem[]): Promise<number> => {
      if (items.length === 0) return 0;
      const saved = items.filter(
        i => loadedRef.current[editKey(i.sid, i.fieldKey)] && !i.unsaved
      );
      // Anything the user had outstanding for those keys is discarded too.
      const nextLocal = { ...localRef.current };
      for (const i of items) delete nextLocal[editKey(i.sid, i.fieldKey)];
      const carriedOnly = items.filter(
        i =>
          !loadedRef.current[editKey(i.sid, i.fieldKey)] &&
          carriedRef.current[editKey(i.sid, i.fieldKey)] !== undefined
      );
      if (saved.length > 0 && schoolYearId) {
        await formsApi.resetFormEdits(
          form,
          schoolYearId,
          saved.map(i => ({ student_id: i.sid, field_key: i.fieldKey }))
        );
        const remaining = { ...loadedRef.current };
        for (const i of saved) delete remaining[editKey(i.sid, i.fieldKey)];
        loadedRef.current = remaining;
      }
      // Carried-only edits are hidden by saving an explicit empty edit;
      // mark dirty so the next Save persists the clear (rule 7).
      const next2 = { ...nextLocal };
      for (const i of carriedOnly) {
        const k = editKey(i.sid, i.fieldKey);
        next2[k] = '';
        localSystemRef.current[k] = '';
      }
      for (const i of items) {
        delete localSystemRef.current[editKey(i.sid, i.fieldKey)];
      }
      applyLocal(next2);
      setTick(t => t + 1);
      setConflicts([]);
      return saved.length;
    },
    [applyLocal, form, schoolYearId]
  );

  const refreshBaseline = useCallback(
    async (items: EditedItem[]): Promise<number> => {
      const actionable = items.filter(
        i => i.sysChanged && !i.unsaved && schoolYearId
      );
      if (actionable.length === 0 || !schoolYearId) return 0;
      await formsApi.saveFormEdits(
        form,
        schoolYearId,
        actionable.map(i => ({
          student_id: i.sid,
          field_key: i.fieldKey,
          value: i.value,
          system_value: i.currentSystem ?? '',
        }))
      );
      for (const i of actionable) {
        const k = editKey(i.sid, i.fieldKey);
        const entry = loadedRef.current[k];
        if (entry) loadedRef.current[k] = { ...entry, system_value: i.currentSystem };
        delete localSystemRef.current[k];
      }
      setTick(t => t + 1);
      return actionable.length;
    },
    [form, schoolYearId]
  );

  const save = useCallback(
    async (saveOpts?: { force?: boolean }): Promise<{ saved: number }> => {
      const entries = Object.entries(localRef.current);
      if (entries.length === 0) return { saved: 0 };
      setSaving(true);
      setError(null);
      try {
        const payload = entries.map(([key, value]) => {
          const i = key.indexOf('|');
          const sid = parseInt(key.slice(0, i), 10) || null;
          const fieldKey = key.slice(i + 1);
          return {
            student_id: sid,
            field_key: fieldKey,
            value,
            system_value: localSystemRef.current[key] ?? undefined,
          };
        });
        const putOpts: { opened_at?: string; force?: boolean } = {
          force: saveOpts?.force ?? false,
        };
        if (openedAtRef.current) putOpts.opened_at = openedAtRef.current;
        const savedRes = await formsApi.saveFormEdits(
          form,
          schoolYearId as number,
          payload,
          putOpts
        );
        // Merge saved values into loaded; drop them from local. Anything the
        // user typed *while* saving stays dirty and remains unsaved.
        const savedMap: Record<string, LoadedEntry> = {
          ...loadedRef.current,
        };
        for (const [key, value] of entries) {
          savedMap[key] = {
            value,
            system_value: localSystemRef.current[key] ?? null,
            updated_at: new Date().toISOString(),
          };
        }
        setLoaded(savedMap);
        const remaining: ValueMap = {};
        for (const [key, value] of Object.entries(localRef.current)) {
          if (!(key in savedMap) || savedMap[key].value !== value) {
            remaining[key] = value;
          }
        }
        for (const [key] of entries) delete localSystemRef.current[key];
        applyLocal(remaining);
        // Our own save refreshed the server state — take the fresh
        // database-side clock stamp for the next save's conflict check.
        openedAtRef.current = savedRes.opened_at || openedAtRef.current;
        setConflicts([]);
        return { saved: payload.length };
      } catch (err: any) {
        const conflictList: any[] | undefined = err?.detail?.conflicts;
        if (err?.status === 409 && Array.isArray(conflictList)) {
          setConflicts(conflictList);
          setError(
            err?.detail?.error ||
              'Changed by someone else since this form was opened.'
          );
          throw new Error('conflict');
        }
        const msg =
          err?.detail?.error || err?.message || 'Failed to save form edits.';
        setError(msg);
        throw new Error(msg);
      } finally {
        setSaving(false);
      }
    },
    [applyLocal, form, schoolYearId, setLoaded]
  );

  const resolveConflict = useCallback(
    async (mode: 'overwrite' | 'reload'): Promise<void> => {
      if (mode === 'overwrite') {
        setConflicts([]);
        await save({ force: true });
      } else {
        // Reload: discard unsaved edits and refetch what the others saved.
        setConflicts([]);
        localRef.current = {};
        setLocalState({});
        fetchEdits();
      }
    },
    [save, fetchEdits]
  );

  const reset = useCallback(() => {
    applyLocal({});
    setError(null);
    setConflicts([]);
    fetchEdits();
    // fetchEdits returns a cleanup fn — don't register it; just let it run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyLocal, fetchEdits]);

  // beforeunload warning while dirty (rule 3)
  const dirtyCount = Object.keys(local).length;
  const isDirty = dirtyCount > 0;
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  return {
    get,
    setValue,
    save,
    reset,
    setBase,
    isEdited,
    listEdits,
    resetEdits,
    refreshBaseline,
    conflicts,
    hasConflict,
    resolveConflict,
    isDirty,
    dirtyCount,
    loading,
    saving,
    error,
    valuesRef,
  };
}
