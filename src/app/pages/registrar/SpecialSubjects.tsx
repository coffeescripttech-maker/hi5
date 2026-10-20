import React, { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  Plus,
  Loader2,
  X,
  AlertTriangle,
  Info,
  Pencil,
  Check,
  Ban,
  Undo2,
  Trash2,
} from "lucide-react";
import { PageContainer } from "../../components/PageContainer";
import { useApp } from "../../context/AppContext";
import { useRoleAccent } from "../../utils/roleTheme";
import { subjectsApi, SubjectRow } from "../../services/subjects";
import { strandTracksApi, StrandTrackRow } from "../../services/strandTracks";
import { formatHoursPerWeek } from "../../utils/hours";

const GRADES = [7, 8, 9, 10, 11, 12] as const;

/** Curriculum programs a special subject can be scoped to ('' = shared). */
const PROGRAMS: { value: string; label: string }[] = [
  { value: "", label: "Shared — every program" },
  { value: "regular", label: "Regular (mainstream)" },
  { value: "ste", label: "STE" },
  { value: "spfl", label: "SPFL" },
  { value: "open_high", label: "Open High School" },
  { value: "als_shs", label: "ALS — SHS" },
  { value: "als_jhs", label: "ALS — JHS" },
];

const programLabel = (v?: string | null): string =>
  PROGRAMS.find(p => p.value === (v ?? ""))?.label ?? "Shared — every program";

interface Draft {
  name: string;
  grade_level: number;
  hours_per_week: string;
  program: string;
  strand_track_ids: number[];
}

const emptyDraft = (grade: number): Draft => ({
  name: "",
  grade_level: grade,
  hours_per_week: "1",
  program: "",
  strand_track_ids: [],
});

/**
 * SF9 special subject rows.
 *
 * A special subject is a real subject, not a layout-only row: teachers grade it
 * in Grade Management like anything else, and it then appears on SF9 and SF10
 * and counts toward the general average with no special-casing. This page only
 * manages which special subjects exist per grade level.
 */
export function SpecialSubjects() {
  const { showToast } = useApp();
  const accent = useRoleAccent();

  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [tracks, setTracks] = useState<StrandTrackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft(7));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft(7));
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [subs, trks] = await Promise.all([
        subjectsApi.listSpecial(undefined, includeInactive),
        strandTracksApi.list().catch(() => [] as StrandTrackRow[]),
      ]);
      setSubjects(subs);
      setTracks(trks);
    } catch (err: any) {
      showToast("error", "Failed to load special subjects: " + (err?.detail?.error || err?.message));
    } finally {
      setLoading(false);
    }
  }, [includeInactive, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  /** Active strand tracks that apply to a grade level (0 = all grades). */
  const tracksForGrade = (grade: number): StrandTrackRow[] =>
    tracks.filter(t => t.grade_level === 0 || t.grade_level === grade);

  const toggleTrack = (ids: number[], id: number): number[] =>
    ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];

  const validate = (d: Draft): Record<string, string> => {
    const e: Record<string, string> = {};
    const name = d.name.trim();
    if (!name) e.name = "Enter the subject name as it should appear on the report card.";
    else if (name.length < 2 || name.length > 100) e.name = "Name must be between 2 and 100 characters.";

    const hours = Number(d.hours_per_week);
    if (!d.hours_per_week.trim()) e.hours_per_week = "Enter hours per week.";
    else if (!Number.isFinite(hours) || hours <= 0 || hours > 40)
      e.hours_per_week = "Hours must be greater than 0 and at most 40.";

    if (!GRADES.includes(d.grade_level as (typeof GRADES)[number]))
      e.grade_level = "Choose a grade level from Grade 7 to Grade 12.";

    return e;
  };

  const openForm = () => {
    setDraft(emptyDraft(7));
    setErrors({});
    setShowForm(true);
  };

  const handleCreate = async () => {
    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const created = await subjectsApi.createSpecial({
        name: draft.name.trim(),
        grade_level: draft.grade_level,
        hours_per_week: Number(draft.hours_per_week),
        program: draft.program || null,
        strand_track_ids: draft.strand_track_ids,
      });
      showToast("success", `"${created.name}" added to Grade ${created.grade_level}.`);
      setShowForm(false);
      setErrors({});
      await load();
    } catch (err: any) {
      const msg = err?.detail?.error || err?.message || "Could not add the subject.";
      const problems = err?.detail?.problems;
      if (Array.isArray(problems) && problems.length > 0) {
        showToast("error", problems.join(" "));
      } else {
        setErrors({ name: msg });
        showToast("error", msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (s: SubjectRow) => {
    setEditingId(s.id);
    setEditDraft({
      name: s.name,
      grade_level: s.grade_level,
      hours_per_week: String(s.hours_per_week),
      program: s.program ?? "",
      strand_track_ids: s.strand_track_ids ?? [],
    });
    setErrors({});
  };

  const handleEdit = async (s: SubjectRow) => {
    const found = validate(editDraft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      await subjectsApi.updateSpecial(s.id, {
        name: editDraft.name.trim(),
        hours_per_week: Number(editDraft.hours_per_week),
        program: editDraft.program || null,
        strand_track_ids: editDraft.strand_track_ids,
      });
      showToast("success", `"${s.name}" updated.`);
      setEditingId(null);
      setErrors({});
      await load();
    } catch (err: any) {
      const msg = err?.detail?.error || err?.message || "Could not save the change.";
      setErrors({ name: msg });
      showToast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (s: SubjectRow, next: 0 | 1) => {
    setBusyId(s.id);
    try {
      await subjectsApi.updateSpecial(s.id, { is_active: next });
      showToast(
        "success",
        next === 0
          ? `"${s.name}" removed from report cards. Past grades are kept.`
          : `"${s.name}" is back on report cards.`
      );
      await load();
    } catch (err: any) {
      showToast("error", err?.detail?.error || err?.message || "Could not update the subject.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (s: SubjectRow) => {
    if (!window.confirm(`Delete "${s.name}" (Grade ${s.grade_level})?\n\nIf it has grades it will be deactivated instead, so past report cards keep working.`))
      return;

    setBusyId(s.id);
    try {
      const result = await subjectsApi.deleteSpecial(s.id);
      showToast(result.deactivated ? "info" : "success", result.message ?? `"${s.name}" deleted.`);
      await load();
    } catch (err: any) {
      showToast("error", err?.detail?.error || err?.message || "Could not delete the subject.");
    } finally {
      setBusyId(null);
    }
  };

  const byGrade = GRADES.map(g => ({
    grade: g,
    items: subjects.filter(s => s.grade_level === g),
  })).filter(g => g.items.length > 0);

  const activeCount = subjects.filter(s => s.is_active === 1).length;

  /* ── Render ───────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin mx-auto" />
        <p className="mt-3 text-sm text-gray-500">Loading special subjects…</p>
      </div>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-5 pb-10">
        {/* ── Header ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className={`h-1.5 bg-gradient-to-r ${accent.gradient}`} />
          <div className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${accent.tile} shadow-lg ${accent.tileShadow} flex items-center justify-center flex-shrink-0`}>
                  <Sparkles size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">
                    SF9 Special Subject Rows
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Add subjects that sit outside the standard template — special
                    programs, extra modules, or a local subject. They are graded
                    normally and appear on the SF9 and SF10 for that grade level.
                  </p>
                </div>
              </div>
              {!showForm && (
                <button
                  onClick={openForm}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors flex-shrink-0">
                  <Plus size={16} />
                  Add Subject
                </button>
              )}
            </div>

            <div className="mt-4 flex items-start gap-2 bg-violet-50 border border-violet-100 rounded-xl px-3.5 py-3">
              <Info size={15} className="text-violet-500 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-violet-700 leading-relaxed">
                A special subject is a real subject, so it behaves like one:
                teachers encode its grades in <strong>Grade Management</strong>,
                and it flows into SF9, SF10, LIS exports, and the{" "}
                <strong>general average</strong> automatically. It is reported as
                its own row and is not folded into TLE/EPP or TVL. Set a{" "}
                <strong>program</strong> (and optionally a strand/track) to limit
                it — e.g. STE-only — or leave it shared to show it to every
                learner at that grade level. Nothing here changes an
                already-generated report card — regenerate it to see the new row.
              </p>
            </div>
          </div>
        </div>

        {/* ── Add form ── */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-violet-200 shadow-sm overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-violet-500 to-fuchsia-500" />
            <div className="p-5 sm:p-6">
              <h3 className="text-sm font-bold text-gray-900 mb-4">New special subject</h3>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                    Subject name
                  </label>
                  <input
                    type="text"
                    value={draft.name}
                    maxLength={100}
                    onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                    placeholder="e.g. Special Program in the Arts"
                    className={`w-full border rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 ${
                      errors.name
                        ? "border-red-300 focus:ring-red-500/30"
                        : "border-gray-200 focus:ring-violet-500/30 focus:border-violet-400"
                    }`}
                  />
                  {errors.name && (
                    <p className="flex items-start gap-1 text-[11px] text-red-600 mt-1.5">
                      <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
                      {errors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                    Grade level
                  </label>
                  <select
                    value={draft.grade_level}
                    onChange={e => setDraft(d => ({ ...d, grade_level: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                  >
                    {GRADES.map(g => (
                      <option key={g} value={g}>
                        Grade {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                    Hours per week
                  </label>
                  <input
                    type="number"
                    min={0.5}
                    max={40}
                    step={0.5}
                    value={draft.hours_per_week}
                    onChange={e => setDraft(d => ({ ...d, hours_per_week: e.target.value }))}
                    className={`w-full border rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 ${
                      errors.hours_per_week
                        ? "border-red-300 focus:ring-red-500/30"
                        : "border-gray-200 focus:ring-violet-500/30 focus:border-violet-400"
                    }`}
                  />
                  {errors.hours_per_week && (
                    <p className="flex items-start gap-1 text-[11px] text-red-600 mt-1.5">
                      <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
                      {errors.hours_per_week}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                    Curriculum / program
                  </label>
                  <select
                    value={draft.program}
                    onChange={e => setDraft(d => ({ ...d, program: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400">
                    {PROGRAMS.map(p => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {tracksForGrade(draft.grade_level).length > 0 && (
                <div className="mt-4">
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                    Strand / track (optional)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {tracksForGrade(draft.grade_level).map(t => (
                      <label
                        key={t.id}
                        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium cursor-pointer transition-colors ${
                          draft.strand_track_ids.includes(t.id)
                            ? "border-violet-300 bg-violet-50 text-violet-700"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        }`}>
                        <input
                          type="checkbox"
                          checked={draft.strand_track_ids.includes(t.id)}
                          onChange={() =>
                            setDraft(d => ({
                              ...d,
                              strand_track_ids: toggleTrack(d.strand_track_ids, t.id),
                            }))
                          }
                          className="w-4 h-4 accent-violet-600 rounded cursor-pointer"
                        />
                        {t.name}
                      </label>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1.5">
                    Leave all unchecked to show this subject to every learner in the
                    chosen program.
                  </p>
                </div>
              )}

              <div className="mt-5 flex items-center gap-2">
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition-colors">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  Add Subject
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setErrors({});
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 hover:bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors">
                  <X size={16} />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Show retired toggle ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-gray-500">
            {activeCount === 0
              ? "No special subjects yet."
              : `${activeCount} active special subject${activeCount !== 1 ? "s" : ""} across the grade levels.`}
          </p>
          <label className="touch-target flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={e => setIncludeInactive(e.target.checked)}
              className="w-5 h-5 accent-violet-600 rounded cursor-pointer"
            />
            Show retired subjects
          </label>
        </div>

        {/* ── List ── */}
        {byGrade.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <Sparkles size={22} className="text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700">No special subjects</p>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              The SF9 for each grade level currently uses the standard template only.
              Add a subject above if your school runs one.
            </p>
          </div>
        ) : (
          byGrade.map(({ grade, items }) => (
            <div
              key={grade}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">Grade {grade}</h3>
                <span className="text-[11px] font-semibold text-gray-500">
                  {items.length} subject{items.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="divide-y divide-gray-100">
                {items.map(s => {
                  const isEditing = editingId === s.id;
                  const isActive = s.is_active === 1;
                  return (
                    <div key={s.id} className="px-5 py-3.5">
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="grid gap-3 sm:grid-cols-4">
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                                Name
                              </label>
                              <input
                                type="text"
                                value={editDraft.name}
                                maxLength={100}
                                onChange={e =>
                                  setEditDraft(d => ({ ...d, name: e.target.value }))
                                }
                                className={`w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 ${
                                  errors.name
                                    ? "border-red-300 focus:ring-red-500/30"
                                    : "border-gray-200 focus:ring-violet-500/30"
                                }`}
                              />
                              {errors.name && (
                                <p className="text-[11px] text-red-600 mt-1">{errors.name}</p>
                              )}
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                                Hours
                              </label>
                              <input
                                type="number"
                                min={0.5}
                                max={40}
                                step={0.5}
                                value={editDraft.hours_per_week}
                                onChange={e =>
                                  setEditDraft(d => ({ ...d, hours_per_week: e.target.value }))
                                }
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                                Program
                              </label>
                              <select
                                value={editDraft.program}
                                onChange={e =>
                                  setEditDraft(d => ({ ...d, program: e.target.value }))
                                }
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30">
                                {PROGRAMS.map(p => (
                                  <option key={p.value} value={p.value}>
                                    {p.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {tracksForGrade(s.grade_level).length > 0 && (
                            <div>
                              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                                Strand / track (optional)
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {tracksForGrade(s.grade_level).map(t => (
                                  <label
                                    key={t.id}
                                    className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium cursor-pointer transition-colors ${
                                      editDraft.strand_track_ids.includes(t.id)
                                        ? "border-violet-300 bg-violet-50 text-violet-700"
                                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                                    }`}>
                                    <input
                                      type="checkbox"
                                      checked={editDraft.strand_track_ids.includes(t.id)}
                                      onChange={() =>
                                        setEditDraft(d => ({
                                          ...d,
                                          strand_track_ids: toggleTrack(d.strand_track_ids, t.id),
                                        }))
                                      }
                                      className="w-4 h-4 accent-violet-600 rounded cursor-pointer"
                                    />
                                    {t.name}
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(s)}
                              disabled={saving}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-60 px-3 py-2 min-h-11 text-xs font-semibold text-white transition-colors">
                              {saving ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Check size={14} />
                              )}
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(null);
                                setErrors({});
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 px-3 py-2 min-h-11 text-xs font-semibold text-gray-700 transition-colors">
                              <X size={14} />
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold border ${
                                isActive
                                  ? "bg-violet-50 text-violet-700 border-violet-200"
                                  : "bg-gray-100 text-gray-500 border-gray-200"
                              }`}>
                              {isActive ? <Sparkles size={10} /> : <Ban size={10} />}
                              {isActive ? "On report card" : "Retired"}
                            </span>
                            <div className="min-w-0">
                              <p
                                className={`text-sm font-semibold truncate ${
                                  isActive ? "text-gray-900" : "text-gray-400 line-through"
                                }`}>
                                {s.name}
                              </p>
                              <p className="text-[11px] text-gray-500">
                                {formatHoursPerWeek(s.hours_per_week)} • Grade{" "}
                                {s.grade_level} •{" "}
                                <span
                                  className={
                                    s.program
                                      ? "text-violet-600 font-semibold"
                                      : undefined
                                  }>
                                  {programLabel(s.program)}
                                </span>
                                {s.strand_tracks && s.strand_tracks.length > 0 && (
                                  <> • {s.strand_tracks.map(t => t.name).join(", ")}</>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => startEdit(s)}
                              title="Rename or change hours"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 min-h-11 text-[11px] font-semibold text-gray-700 transition-colors">
                              <Pencil size={12} />
                              Edit
                            </button>
                            <button
                              onClick={() => setActive(s, isActive ? 0 : 1)}
                              disabled={busyId === s.id}
                              title={
                                isActive
                                  ? "Remove from report cards, keep past grades"
                                  : "Put back on report cards"
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-60 px-2.5 py-1.5 min-h-11 text-[11px] font-semibold text-gray-700 transition-colors">
                              {busyId === s.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : isActive ? (
                                <Ban size={12} />
                              ) : (
                                <Undo2 size={12} />
                              )}
                              {isActive ? "Retire" : "Restore"}
                            </button>
                            <button
                              onClick={() => remove(s)}
                              disabled={busyId === s.id}
                              title="Delete, or deactivate if it has grades"
                              className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-red-200 hover:bg-red-50 disabled:opacity-60 px-2.5 py-1.5 text-[11px] font-semibold text-red-700 transition-colors">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </PageContainer>
  );
}
