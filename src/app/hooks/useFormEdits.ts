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
 * - `loaded` = values already saved on the server; `local` = unsaved edits.
 * - `get(studentIdOrNull, fieldKey)` = local ?? loaded ?? undefined. An empty
 *   string is a meaningful "cleared on purpose" value (rule 7) and overrides
 *   the loaded value; `undefined` means "never set".
 * - `setValue(...)` marks the field dirty (equal-to-saved values drop out).
 * - `save()` PUTs only the dirty fields; failures keep local state intact.
 * - `valuesRef.current` always merges loaded+local so plain render/build
 *   effects can apply saved values WITHOUT calling setValue (no self-dirty
 *   loop when re-deriving rows from fetched data).
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
}

export function editKey(studentId: number | null, fieldKey: string): string {
  return `${studentId ?? 0}|${fieldKey}`;
}

type ValueMap = Record<string, string>;

export interface UseFormEditsApi {
  /** local ?? loaded (undefined = never set; '' = saved empty). */
  get: (studentId: number | null, fieldKey: string) => string | undefined;
  setValue: (studentId: number | null, fieldKey: string, value: string) => void;
  save: () => Promise<{ saved: number }>;
  reset: () => void;
  isDirty: boolean;
  dirtyCount: number;
  loading: boolean;
  saving: boolean;
  error: string | null;
  /** Merged saved+unsaved values, kept in sync for build effects. */
  valuesRef: React.MutableRefObject<ValueMap>;
}

export function useFormEdits(opts: UseFormEditsOptions): UseFormEditsApi {
  const { form, schoolYearId, studentId, sectionId, studentIds, enabled = true } = opts;

  const loadedRef = useRef<ValueMap>({});
  // Rule 15 — previous school year's learner-level details, returned by the
  // server separately and layered UNDER the current-SY saved values so a new
  // year starts carried over while every field remains over-writable.
  const carriedRef = useRef<ValueMap>({});
  const localRef = useRef<ValueMap>({});
  const [loadedTick, setLoadedTick] = useState(0); // re-render triggers
  const [local, setLocalState] = useState<ValueMap>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valuesRef = useRef<ValueMap>({});

  const applyLocal = useCallback((next: ValueMap) => {
    localRef.current = next;
    setLocalState(next);
  }, []);

  const recomputeMerged = useCallback(() => {
    // Layering (rule 15): carried (previous-SY prefill) is the base, current
    // school-year saved values win over it, unsaved edits win over both.
    valuesRef.current = { ...carriedRef.current, ...loadedRef.current, ...localRef.current };
  }, []);

  const setLoaded = useCallback((next: ValueMap) => {
    loadedRef.current = next;
    recomputeMerged();
    setLoadedTick(t => t + 1);
  }, [recomputeMerged]);

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
        const map: ValueMap = {};
        for (const r of res.edits) map[editKey(r.student_id, r.field_key)] = r.value;
        setLoaded(map);
        const cMap: ValueMap = {};
        for (const r of (res as { carried?: FormEditRow[] }).carried ?? [])
          cMap[editKey(r.student_id, r.field_key)] = r.value;
        carriedRef.current = cMap;
        recomputeMerged();
        setLoadedTick(t => t + 1);
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
  }, [form, schoolYearId, scopeKey, enabled, buildScope, setLoaded, recomputeMerged]);

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
      if (ld !== undefined) return ld;
      // Rule 15 — carried-over previous-SY value is the last fallback.
      return carriedRef.current[key];
    },
    // re-render trigger so callers see fresh values
    [local, loadedTick]
  );

  const setValue = useCallback(
    (studentId2: number | null, fieldKey: string, value: string) => {
      const key = editKey(studentId2, fieldKey);
      const current = { ...localRef.current };
      if (current[key] === value) return;
      if (value === (loadedRef.current[key] ?? undefined)) {
        // Back to the saved (or never-set) state — no longer dirty.
        delete current[key];
      } else {
        current[key] = value;
      }
      applyLocal(current);
    },
    [applyLocal]
  );

  const save = useCallback(async (): Promise<{ saved: number }> => {
    const entries = Object.entries(localRef.current);
    if (entries.length === 0) return { saved: 0 };
    setSaving(true);
    setError(null);
    try {
      const payload = entries.map(([key, value]) => {
        const i = key.indexOf('|');
        const sid = parseInt(key.slice(0, i), 10) || null;
        return { student_id: sid, field_key: key.slice(i + 1), value };
      });
      await formsApi.saveFormEdits(form, schoolYearId as number, payload);
      // Merge saved values into loaded; drop them from local. Anything the
      // user typed *while* saving stays dirty and remains unsaved.
      const savedMap: ValueMap = {};
      for (const [key, value] of entries) savedMap[key] = value;
      setLoaded({ ...loadedRef.current, ...savedMap });
      const remaining: ValueMap = {};
      for (const [key, value] of Object.entries(localRef.current)) {
        if (!(key in savedMap) || savedMap[key] !== value) {
          remaining[key] = value;
        }
      }
      applyLocal(remaining);
      return { saved: payload.length };
    } catch (err: any) {
      const msg =
        err?.detail?.error || err?.message || 'Failed to save form edits.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setSaving(false);
    }
  }, [applyLocal, form, schoolYearId, setLoaded]);

  const reset = useCallback(() => {
    applyLocal({});
    setError(null);
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
    isDirty,
    dirtyCount,
    loading,
    saving,
    error,
    valuesRef,
  };
}
