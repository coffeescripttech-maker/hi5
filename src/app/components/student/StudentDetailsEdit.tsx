/**
 * Student Details Edit panel + Change History tab
 * (client revision: Hi5_Portal_Student_Details_Edit_Expected_Behavior.md).
 *
 * EditDetailsPanel — inline modal on the learner profile: routine fields edit
 * freely, identity fields require a reason, changed rows are highlighted with
 * the old → new values, a confirmation dialog lists the effects, and the save
 * is one transaction on the server (update + history + SF-edit resets).
 *
 * ChangeHistoryTab — the learner's History tab backed by
 * GET /api/students/:id/history (student_field_history).
 */
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  History as HistoryIcon,
  Loader2,
  Pencil,
  X
} from 'lucide-react';
import {
  studentsApi,
  StudentDetail,
  StudentHistoryRow,
  DetailChange
} from '../../services/students';
import {
  EDIT_REASONS,
  IDENTITY_FIELDS,
  ROUTINE_FIELDS,
  fieldLabel
} from './editDetailsFields';
import { formatName } from '../../utils/nameFormatter';

type FieldValues = Record<string, string>;

interface FieldRow {
  def: (typeof ROUTINE_FIELDS)[number];
  value: string;
}

const asString = (v: unknown): string =>
  v === null || v === undefined ? '' : String(v);

/* ── one labeled input row ─────────────────────────────────────────── */
function FieldRow({
  def,
  value,
  changed,
  onChange
}: {
  def: (typeof ROUTINE_FIELDS)[number] | (typeof IDENTITY_FIELDS)[number];
  value: string;
  changed: boolean;
  onChange: (key: string, value: string) => void;
}) {
  const inputCls = `w-full rounded-xl border ${
    changed ? 'border-amber-300 bg-amber-50/50' : 'border-gray-200 bg-white'
  } px-3 py-2 text-sm text-gray-800 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100`;
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em]">
        {def.label}
        {changed && (
          <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 normal-case tracking-normal">
            changed
          </span>
        )}
      </span>
      {def.type === 'select' && def.options ? (
        <select
          value={value}
          onChange={e => onChange(def.key, e.target.value)}
          className={inputCls}>
          <option value="">— None —</option>
          {def.options.map(opt => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : def.type === 'date' ? (
        <input
          type="date"
          value={value}
          onChange={e => onChange(def.key, e.target.value)}
          className={inputCls}
        />
      ) : (
        <input
          type={def.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={e => onChange(def.key, e.target.value)}
          className={inputCls}
        />
      )}
    </label>
  );
}

/* ── EditDetailsPanel ──────────────────────────────────────────────── */
export function EditDetailsPanel({
  student,
  canEditIdentity,
  onClose,
  onSaved,
  showToast
}: {
  student: StudentDetail;
  /** false = identity inputs are locked (closed SY / graduated / archived). */
  canEditIdentity: boolean;
  onClose: () => void;
  onSaved: (learner: StudentDetail) => void;
  showToast: (type: 'success' | 'error' | 'info' | 'warning', msg: string) => void;
}) {
  const initial: FieldValues = useMemo(() => {
    const v: FieldValues = {};
    for (const def of [...ROUTINE_FIELDS, ...IDENTITY_FIELDS]) {
      v[def.key] = asString((student as unknown as Record<string, unknown>)[def.key]);
    }
    return v;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id]);

  const [values, setValues] = useState<FieldValues>(initial);
  const [openedAt] = useState(() => student.updated_at || '');
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonNote, setReasonNote] = useState('');
  const [localError, setLocalError] = useState('');

  // identity lock: non-admin roles cannot change identity fields on
  // graduated learners / closed school years (mirrors the server rule).
  const identityLocked =
    !canEditIdentity &&
    (student.status === 'graduated' || student.is_archived === 1);

  const changes: DetailChange[] = useMemo(() => {
    const out: DetailChange[] = [];
    for (const def of [...ROUTINE_FIELDS, ...IDENTITY_FIELDS]) {
      const before = initial[def.key] ?? '';
      const after = values[def.key] ?? '';
      if (before !== after) {
        out.push({
          field: def.key,
          label: def.label,
          group: IDENTITY_FIELDS.some(i => i.key === def.key)
            ? 'identity'
            : 'routine',
          old: before,
          new: after
        });
      }
    }
    return out;
  }, [values, initial]);

  const identityChanges = changes.filter(c => c.group === 'identity');
  const dirty = changes.length > 0;

  const setValue = (key: string, value: string) =>
    setValues(v => ({ ...v, [key]: value }));

  const buildPayload = () => ({
    fields: Object.fromEntries(changes.map(c => [c.field, values[c.field]])),
    reason: identityChanges.length > 0 ? reason : undefined,
    reason_note: reason === 'Other' ? reasonNote : undefined,
    opened_at: openedAt
  });

  const handleConfirmSave = async () => {
    setConfirmOpen(false);
    setSaving(true);
    setLocalError('');
    try {
      const resp = await studentsApi.updateDetails(student.id, buildPayload());
      showToast(
        'success',
        resp.duplicate_warning
          ? `Details saved — note: ${resp.duplicate_warning}`
          : 'Learner details saved.'
      );
      onSaved(resp.learner as StudentDetail);
      onClose();
    } catch (err: any) {
      if (err.status === 409 && err.detail?.learner) {
        // Optimistic conflict — show the latest values.
        setValues(prev => {
          const next: FieldValues = { ...prev };
          for (const def of [...ROUTINE_FIELDS, ...IDENTITY_FIELDS]) {
            next[def.key] = asString(
              (err.detail.learner as Record<string, unknown>)[def.key]
            );
          }
          return next;
        });
        setLocalError(
          'This record was changed by someone else while you were editing. The latest values are now shown — review and save again.'
        );
      } else {
        setLocalError(err.detail?.error || err.message || 'Failed to save.');
      }
    } finally {
      setSaving(false);
    }
  };

  const preConfirm = () => {
    setLocalError('');
    if (identityChanges.length > 0) {
      if (!reason) {
        setLocalError('Select a reason for the identity change.');
        return;
      }
      if (reason === 'Other' && !reasonNote.trim()) {
        setLocalError("Describe the reason when selecting 'Other'.");
        return;
      }
    }
    setConfirmOpen(true);
  };

  const panelInput = (
    def: (typeof ROUTINE_FIELDS)[number] | (typeof IDENTITY_FIELDS)[number]
  ) => {
    const changed = changes.some(c => c.field === def.key);
    const locked = def.key === 'name_ext' && values[def.key] === 'Other';
    if (def.type === 'select' && def.key === 'name_ext') {
      // suffix: dropdown + inline "Other" text input
      return (
        <div className="space-y-2">
          <select
            value={locked ? 'Other' : values[def.key]}
            disabled={!canEditIdentity}
            onChange={e => setValue(def.key, e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-emerald-400 focus:outline-none">
            <option value="">— None —</option>
            {def.options!.map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {locked && (
            <input
              type="text"
              value={values[def.key]}
              onChange={e => setValue(def.key, e.target.value)}
              maxLength={12}
              placeholder="Specify suffix (e.g. Jr. III)"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-emerald-400 focus:outline-none"
            />
          )}
        </div>
      );
    }
    if (def.type === 'select' && def.key === 'sex') {
      return (
        <select
          value={values[def.key]}
          disabled={!canEditIdentity}
          onChange={e => setValue(def.key, e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-emerald-400 focus:outline-none">
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      );
    }
    return (
      <FieldRow
        def={def}
        value={values[def.key]}
        changed={changed}
        onChange={setValue}
      />
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <Pencil size={18} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">Edit learner details</h3>
              <p className="text-[11px] text-emerald-100">
                {formatName({
                  last: student.last_name || '',
                  first: student.first_name || '',
                  middle: student.middle_name || '',
                  ext: student.name_ext || ''
                }) || student.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-white/80 transition hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {identityLocked && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
              Identity fields are locked for this learner (closed school year /
              already promoted) — only the Administrator can change them.
            </div>
          )}
          {localError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {localError}
            </div>
          )}

          {/* Identity group */}
          <div>
            <p className="mb-2 text-[11px] font-bold text-gray-500 uppercase tracking-[0.05em]">
              Identity — a reason is required for every change
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {IDENTITY_FIELDS.map(def => {
                const locked = identityLocked;
                const child = locked ? (
                  <input
                    type="text"
                    value={values[def.key]}
                    disabled
                    className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-400"
                  />
                ) : (
                  panelInput(def)
                );
                return (
                  <label key={def.key} className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em]">
                      {def.label}
                    </span>
                    {child}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Routine group */}
          <div>
            <p className="mb-2 text-[11px] font-bold text-gray-500 uppercase tracking-[0.05em]">
              Personal &amp; contact details
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ROUTINE_FIELDS.map(def => (
                <div
                  key={def.key}
                  className={def.type === 'checkbox' ? 'sm:col-span-2' : ''}>
                  {def.type === 'checkbox' ? (
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={values[def.key] === '1'}
                        onChange={e =>
                          setValue(def.key, e.target.checked ? '1' : '')
                        }
                        className="h-4 w-4 accent-emerald-600"
                      />
                      {def.label}
                    </label>
                  ) : (
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em]">
                        {def.label}
                      </span>
                      {panelInput(def)}
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* reason for identity changes */}
          {identityChanges.length > 0 && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
              <p className="text-xs font-semibold text-amber-800">
                An identity field is changing — a reason is required and the
                change is recorded permanently.
              </p>
              <div>
                <span className="mb-1 block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em]">
                  Reason *
                </span>
                <select
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none">
                  <option value="">Select a reason…</option>
                  {EDIT_REASONS.map(r => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              {reason === 'Other' && (
                <div>
                  <span className="mb-1 block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em]">
                    Describe the reason *
                  </span>
                  <textarea
                    value={reasonNote}
                    onChange={e => setReasonNote(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* changed rows */}
          {dirty && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
              <p className="mb-2 text-xs font-bold text-indigo-700">
                {changes.length} field{changes.length !== 1 ? 's' : ''} changed
              </p>
              <ul className="space-y-1.5 text-xs">
                {changes.map(c => (
                  <li key={c.field} className="text-gray-700">
                    <span className="font-semibold">{c.label}:</span>{' '}
                    <span className="text-gray-400">
                      {c.old ? `"${c.old}"` : '(empty)'}
                    </span>{' '}
                    →{' '}
                    <span className="font-semibold text-indigo-700">
                      {c.new ? `"${c.new}"` : '(empty)'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex gap-3 border-t border-gray-100 bg-gray-50/50 px-6 py-4">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={preConfirm}
            disabled={!dirty || saving}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <CheckCircle size={14} />
            )}
            Save Changes
          </button>
        </div>

        {/* confirmation dialog */}
        {confirmOpen && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                  <AlertTriangle size={18} className="text-amber-600" />
                </div>
                <h4 className="font-bold text-gray-900">
                  Confirm the changes
                </h4>
              </div>
              <ul className="mb-4 space-y-1.5 text-xs text-gray-700">
                {changes.map(c => (
                  <li key={c.field}>
                    <span className="font-semibold">{c.label}:</span>{' '}
                    {c.old ? `"${c.old}"` : '(empty)'} →{' '}
                    <span className="font-semibold">
                      {c.new ? `"${c.new}"` : '(empty)'}
                    </span>
                  </li>
                ))}
              </ul>
              {identityChanges.length > 0 && (
                <div className="mb-4 space-y-1.5 rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-[11px] text-amber-800">
                  <p className="font-semibold">Effects of this change:</p>
                  <p>
                    • Saved School Form edits for the changed fields in the
                    open school year will be reset (recorded in history).
                  </p>
                  {identityChanges.some(c => c.field === 'lrn') && (
                    <p>
                      • The LRN changed — previously downloaded grade templates
                      must be re-downloaded.
                    </p>
                  )}
                  <p>
                    • Issued documents already printed keep the old value.
                  </p>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmOpen(false)}
                  className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                  Back
                </button>
                <button
                  onClick={handleConfirmSave}
                  disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                  {saving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle size={14} />
                  )}
                  Confirm &amp; Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Change History tab ────────────────────────────────────────────── */
export function ChangeHistoryTab({
  studentId,
  accent
}: {
  studentId: number;
  accent: ReturnType<typeof import('../../utils/roleTheme').useRoleAccent>;
}) {
  const [rows, setRows] = useState<StudentHistoryRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const list = rows ?? [];

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    studentsApi
      .history(studentId)
      .then(r => {
        if (!cancelled) setRows(r);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  return (
    <div className="rounded-xl border border-gray-100 bg-white">
      <div className="flex items-center gap-2.5 border-b border-gray-100 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
          <HistoryIcon size={14} className="text-gray-600" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-gray-800">Change History</h4>
          <p className="text-[10px] text-gray-400">
            Permanent record of every learner detail change — never purged
          </p>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center gap-3 px-5 py-10 text-sm text-gray-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
          Loading history…
        </div>
      ) : list.length === 0 ? (
        <p className="px-5 py-10 text-center text-xs text-gray-400">
          No changes recorded yet.
        </p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {list.map(h => (
            <li key={h.id} className="px-5 py-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-gray-800">
                  {fieldLabel(h.field)}
                </span>
                {h.old_value && (
                  <span className="text-gray-400 line-through">
                    {h.old_value}
                  </span>
                )}
                {h.old_value && <span className="text-gray-300">→</span>}
                <span className="font-semibold text-emerald-700">
                  {h.new_value || '(empty)'}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-[10px] text-gray-400">
                <span className="inline-flex items-center gap-1">
                  <Clock size={9} />
                  {new Date(h.created_at).toLocaleString()}
                </span>
                <span>by {h.changed_by_name || `user ${h.changed_by}`}</span>
                <span className="rounded bg-gray-50 px-1.5 py-0.5">
                  {h.reason}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
