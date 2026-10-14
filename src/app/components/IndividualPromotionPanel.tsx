import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  GraduationCap,
  ArrowUpCircle,
  Loader2,
  AlertTriangle,
  Users,
  User,
  CheckCircle,
  ShieldAlert,
  Info
} from 'lucide-react';
import {
  promotionsApi,
  RosterResponse,
  RosterStudent
} from '../services/promotions';
import { sectionsApi, SectionRow } from '../services/sections';
import { SchoolYearRow } from '../services/schoolYears';
import { useApp } from '../context/AppContext';

interface Props {
  years: SchoolYearRow[];
  syId: number;
  /** Called after a successful individual action so the parent can refresh history. */
  onChanged: () => void;
}

type PendingAction = {
  student: RosterStudent;
  action: 'promote' | 'graduate';
};

export function IndividualPromotionPanel({ years, syId, onChanged }: Props) {
  const { role, showToast } = useApp();
  const isAdmin = role === 'admin';

  const [sections, setSections] = useState<SectionRow[]>([]);
  const [sectionId, setSectionId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [roster, setRoster] = useState<RosterResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [targetSectionId, setTargetSectionId] = useState<string>('');
  const [override, setOverride] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastResult, setLastResult] = useState<{
    name: string;
    action: 'promote' | 'graduate';
    to_grade?: number;
  } | null>(null);

  const selectedYear = years.find(y => y.id === syId);
  const passingMark = roster?.passing_mark ?? 75;

  // Sections the user may scope the roster to — teachers see only their own,
  // admins/registrars see every active section.
  useEffect(() => {
    const loader =
      role === 'teacher' ? sectionsApi.listMySections : sectionsApi.list;
    loader()
      .then(setSections)
      .catch(() => setSections([]));
  }, [role]);

  // Load the roster whenever the school year, section or search changes.
  useEffect(() => {
    if (!syId) return;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      promotionsApi
        .roster({
          school_year_id: syId,
          section_id: sectionId ? Number(sectionId) : undefined,
          search: search.trim() ? search.trim() : undefined
        })
        .then(r => {
          if (!cancelled) setRoster(r);
        })
        .catch((err: any) => {
          if (!cancelled) {
            showToast(
              'error',
              err?.detail?.error || err?.message || 'Failed to load students'
            );
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [syId, sectionId, search]);

  const students = roster?.students ?? [];

  // Sections eligible to receive a promoted student (next grade, active).
  const targetSections = useMemo(() => {
    if (!pending || pending.action !== 'promote') return [];
    const toGrade = pending.student.grade_level + 1;
    return sections
      .filter(s => s.grade_level === toGrade && s.is_active === 1)
      .sort((a, b) => b.min_average - a.min_average);
  }, [pending, sections]);

  const openConfirm = (student: RosterStudent) => {
    setPending({
      student,
      action: student.can_graduate ? 'graduate' : 'promote'
    });
    setTargetSectionId('');
    setOverride(false);
    setReason('');
  };

  const closeConfirm = () => {
    setPending(null);
    setTargetSectionId('');
    setOverride(false);
    setReason('');
  };

  const notEligible =
    !!pending &&
    (pending.action === 'graduate'
      ? !pending.student.can_graduate
      : !pending.student.can_promote);

  const handleConfirm = async () => {
    if (!pending) return;
    if (notEligible && override && !reason.trim()) {
      showToast('error', 'Please provide a reason for the override.');
      return;
    }
    setSaving(true);
    try {
      const res = await promotionsApi.promoteIndividual({
        student_id: pending.student.student_id,
        school_year_id: syId,
        action: pending.action,
        to_section_id:
          pending.action === 'promote' && targetSectionId
            ? Number(targetSectionId)
            : undefined,
        override: notEligible ? override : false,
        reason: override ? reason.trim() : undefined
      });
      showToast('success', res.message);
      setLastResult({
        name: res.name,
        action: res.action,
        to_grade: res.to_grade
      });
      closeConfirm();
      onChanged();
      // Refresh the roster so the row reflects the new state.
      const refreshed = await promotionsApi.roster({
        school_year_id: syId,
        section_id: sectionId ? Number(sectionId) : undefined,
        search: search.trim() ? search.trim() : undefined
      });
      setRoster(refreshed);
    } catch (err: any) {
      showToast(
        'error',
        err?.detail?.error || err?.message || 'Failed to process request'
      );
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (s: RosterStudent) => {
    if (s.can_graduate) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200/50">
          <GraduationCap size={11} /> Grade 12
        </span>
      );
    }
    if (s.can_promote) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200/50">
          <CheckCircle size={11} /> Eligible
        </span>
      );
    }
    if (s.is_retained) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200/50">
          <AlertTriangle size={11} /> Below passing
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-gray-50 text-gray-500 border-gray-200/50">
        <AlertTriangle size={11} /> Incomplete
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div className="rounded-xl p-4 sm:p-5 flex gap-3 bg-gradient-to-br from-blue-50 to-blue-50 border border-blue-200/60">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 shadow-xs bg-blue-100">
          <Info size={16} className="text-blue-700" />
        </div>
        <div className="text-sm text-blue-800">
          <p className="font-bold mb-1">How Individual Promotion Works</p>
          <p className="text-xs leading-relaxed text-blue-700">
            Pick a student and promote them to the next grade or mark them as
            graduated — only that student is affected. The standard rules apply
            (complete grades and a general average at or above{' '}
            <strong>{passingMark}</strong>); Grade 12 students are graduated, not
            promoted.
            {isAdmin && (
              <>
                {' '}
                As an administrator you may <strong>override</strong> the rules
                with a recorded reason.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-[0.05em]">
              School Year
            </label>
            <div className="w-full border border-gray-200 bg-gray-50/60 rounded-xl px-3.5 py-2.5 text-sm text-gray-600">
              {selectedYear?.sy_label || '—'}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-[0.05em]">
              Section
            </label>
            <select
              value={sectionId}
              onChange={e => setSectionId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-white transition">
              <option value="">All sections</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} (Grade {s.grade_level})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-[0.05em]">
              Search Student
            </label>
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Name, LRN or ID"
                className="w-full border border-gray-200 rounded-xl pl-9 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-white transition"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Roster */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-100 to-blue-100 flex items-center justify-center shadow-xs">
              <Users size={16} className="text-blue-700" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">
                Students
              </h3>
              <p className="text-xs text-gray-400">
                Promote or graduate a single student without touching the rest
              </p>
            </div>
          </div>
          <span className="bg-blue-50 text-blue-700 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-blue-200/50">
            {loading ? '…' : students.length} student
            {students.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-gray-400">
            <Loader2 size={20} className="animate-spin mx-auto mb-2" />
            Loading students…
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <User size={28} className="text-gray-300" />
            </div>
            <p className="text-gray-500 text-sm font-semibold">
              No students found
            </p>
            <p className="text-gray-400 text-xs mt-1 max-w-xs mx-auto">
              Try a different section or search term. Students appear here once
              they are enrolled for the selected school year.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-gray-50/80">
                <tr>
                  {['Student', 'Section', 'Grade', 'Gen. Ave.', 'Status', 'Action'].map(
                    h => (
                      <th
                        key={h}
                        className="text-left px-5 py-3.5 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em] border-b border-gray-100">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {students.map((s, idx) => (
                  <tr
                    key={s.student_id}
                    className={`${
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                    } hover:bg-emerald-50/40 transition-colors duration-150`}>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-gray-800">{s.name}</div>
                      <div className="text-[11px] text-gray-400 font-mono">
                        {s.student_code}
                        {s.lrn ? ` · ${s.lrn}` : ''}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs">
                      {s.section_name || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs">
                      Grade {s.grade_level}
                    </td>
                    <td className="px-5 py-3.5">
                      {s.general_average != null ? (
                        <span className="font-semibold text-gray-700">
                          {s.general_average.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">{statusBadge(s)}</td>
                    <td className="px-5 py-3.5">
                      {s.can_graduate ? (
                        <button
                          onClick={() => openConfirm(s)}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-600 hover:from-indigo-700 hover:to-indigo-700 px-3 py-1.5 rounded-full transition-colors shadow-sm">
                          <GraduationCap size={12} /> Graduate
                        </button>
                      ) : (
                        <button
                          onClick={() => openConfirm(s)}
                          disabled={!s.can_promote && !isAdmin}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-700 hover:to-emerald-700 disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 px-3 py-1.5 rounded-full transition-colors shadow-sm disabled:shadow-none">
                          <ArrowUpCircle size={12} /> Promote
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {pending && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-5">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${
                  pending.action === 'graduate' ? 'bg-indigo-100' : 'bg-emerald-100'
                }`}>
                {pending.action === 'graduate' ? (
                  <GraduationCap size={22} className="text-indigo-600" />
                ) : (
                  <ArrowUpCircle size={22} className="text-emerald-600" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-gray-900">
                  {pending.action === 'graduate'
                    ? 'Confirm Graduation'
                    : 'Confirm Promotion'}
                </h3>
                <p className="text-gray-400 text-xs">
                  Only this student will be affected
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-100 rounded-xl p-4 text-sm space-y-3 mb-5">
              <div className="flex justify-between items-center gap-3">
                <span className="text-gray-500">Student:</span>
                <span className="font-bold text-gray-800 text-right">
                  {pending.student.name}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Section:</span>
                <span className="font-semibold text-gray-700">
                  {pending.student.section_name || '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">General Average:</span>
                <span className="font-semibold text-gray-700">
                  {pending.student.general_average != null
                    ? pending.student.general_average.toFixed(2)
                    : 'No grades'}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                <span className="text-gray-500">
                  {pending.action === 'graduate' ? 'Result:' : 'Promote to:'}
                </span>
                <span
                  className={`font-bold inline-flex items-center gap-1 ${
                    pending.action === 'graduate'
                      ? 'text-indigo-700'
                      : 'text-emerald-700'
                  }`}>
                  {pending.action === 'graduate' ? (
                    <>
                      <GraduationCap size={13} /> Graduated
                    </>
                  ) : (
                    <>
                      <ArrowUpCircle size={13} /> Grade{' '}
                      {pending.student.grade_level + 1}
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Target section (promotion only) */}
            {pending.action === 'promote' && targetSections.length > 0 && (
              <div className="mb-4">
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-[0.05em]">
                  Target Section
                </label>
                <select
                  value={targetSectionId}
                  onChange={e => setTargetSectionId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-white transition">
                  <option value="">Auto-assign by average</option>
                  {targetSections.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.current_count}/{s.capacity})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {notEligible && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200/60 rounded-lg px-3 py-2.5 mb-4">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                <span>
                  {pending.action === 'graduate'
                    ? 'This student is not in Grade 12. Graduating now is an override of the standard rule.'
                    : pending.student.is_retained
                      ? `This student's general average is below the passing mark (${passingMark}).`
                      : 'This student has incomplete grades for some subjects.'}{' '}
                  {isAdmin
                    ? 'You can override this below.'
                    : 'Only an administrator can override this.'}
                </span>
              </div>
            )}

            {/* Admin override */}
            {notEligible && isAdmin && (
              <div className="mb-5 rounded-xl border border-amber-200/60 bg-amber-50/60 p-3.5">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={override}
                    onChange={e => setOverride(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="text-xs font-semibold text-amber-800 inline-flex items-center gap-1.5">
                    <ShieldAlert size={13} /> Override eligibility for this
                    student
                  </span>
                </label>
                {override && (
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={2}
                    placeholder="Reason for the override (required, recorded in the activity log)"
                    className="mt-2.5 w-full border border-amber-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400/40 bg-white"
                  />
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={closeConfirm}
                disabled={saving}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50">
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving || (notEligible && !override)}
                className={`flex-1 text-white py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 ${
                  pending.action === 'graduate'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-600 hover:from-indigo-700 hover:to-indigo-700'
                    : 'bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-700 hover:to-emerald-700'
                }`}>
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : pending.action === 'graduate' ? (
                  <GraduationCap size={14} />
                ) : (
                  <ArrowUpCircle size={14} />
                )}
                {saving
                  ? 'Processing…'
                  : pending.action === 'graduate'
                    ? 'Yes, Graduate'
                    : 'Yes, Promote'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success modal */}
      {lastResult && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center animate-in zoom-in-95">
            <div
              className={`w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center mx-auto mb-4 shadow-sm ${
                lastResult.action === 'graduate'
                  ? 'from-indigo-100 to-indigo-100'
                  : 'from-emerald-100 to-emerald-100'
              }`}>
              {lastResult.action === 'graduate' ? (
                <GraduationCap size={32} className="text-indigo-600" />
              ) : (
                <CheckCircle size={32} className="text-emerald-600" />
              )}
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-1">
              {lastResult.action === 'graduate'
                ? 'Student Graduated'
                : 'Student Promoted'}
            </h3>
            <p className="text-gray-500 text-sm mb-5">
              <strong className="text-gray-800">{lastResult.name}</strong>{' '}
              {lastResult.action === 'graduate'
                ? 'has been marked as graduated.'
                : `has been promoted to Grade ${lastResult.to_grade}.`}
            </p>
            <button
              onClick={() => setLastResult(null)}
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-700 hover:to-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold transition shadow-sm">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
