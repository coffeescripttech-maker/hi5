/**
 * Transfer Management — Registrar view.
 *
 * The Registrar files Transfer-In / Transfer-Out requests and tracks their
 * status. Decisions are not available here: only the Enrollment Committee
 * approves or rejects a filed request, so this page stays deliberately
 * read-only apart from filing and withdrawing a still-pending request.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeftRight,
  Loader2,
  Plus,
  X,
  Clock,
  CheckCircle,
  XCircle,
  Ban,
  School,
  AlertTriangle
} from 'lucide-react';
import { PageContainer } from '../../components/PageContainer';
import { useApp } from '../../context/AppContext';
import { schoolYearsApi, SchoolYearRow } from '../../services/schoolYears';
import { sectionsApi, SectionRow } from '../../services/sections';
import { studentsApi, StudentRow } from '../../services/students';
import { enrollmentsApi, EnrollmentRow } from '../../services/enrollments';
import { SearchableStudentSelect } from '../../components/SearchableStudentSelect';
import {
  validate,
  newLearnerSchema,
  existingLearnerSchema,
  transferOutSchema,
  LRN_PATTERN
} from './transferValidation';
import {
  transfersApi,
  TransferRequest,
  TransferType,
  TransferStatus
} from '../../services/transfers';

const GRADES = [7, 8, 9, 10, 11, 12];

/** Inline validation message shown beneath a field. */
function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p className="flex items-start gap-1 text-[11px] text-red-600 mt-1.5">
      <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
      <span>{children}</span>
    </p>
  );
}

const STATUS_STYLES: Record<TransferStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200'
};

const STATUS_ICON: Record<TransferStatus, typeof Clock> = {
  pending: Clock,
  approved: CheckCircle,
  rejected: XCircle,
  cancelled: Ban
};

const TYPE_LABEL: Record<TransferType, string> = {
  transfer_in: 'Transfer-In',
  transfer_out: 'Transfer-Out'
};

function emptyForm() {
  return {
    transfer_type: 'transfer_in' as TransferType,
    student_id: '',
    lrn: '',
    student_name: '',
    sex: 'male' as 'male' | 'female',
    birthdate: '',
    grade_level: '7',
    section_id: '',
    previous_school: '',
    destination_school: '',
    reason: ''
  };
}

export function TransferManagement() {
  const { showToast } = useApp();
  const [rows, setRows] = useState<TransferRequest[]>([]);
  const [years, setYears] = useState<SchoolYearRow[]>([]);
  const [syId, setSyId] = useState<number>(0);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<TransferStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [existingStudent, setExistingStudent] = useState(true);
  /** Field-keyed validation messages, populated on submit or blur. */
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** Only show a message once the field has been interacted with. */
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  /** Active enrollments for the selected school year — drives the Transfer-Out picker. */
  const [activeEnrollments, setActiveEnrollments] = useState<EnrollmentRow[]>(
    []
  );

  useEffect(() => {
    Promise.all([schoolYearsApi.list(), sectionsApi.list(), studentsApi.list()])
      .then(([ys, secs, studs]) => {
        setYears(ys);
        setSections(secs);
        setStudents(studs);
        const current = ys.find(y => y.is_current === 1);
        if (current) setSyId(current.id);
      })
      .catch(err =>
        showToast(
          'error',
          'Failed to load data: ' + (err.detail?.error || err.message)
        )
      )
      .finally(() => setLoading(false));
  }, []);

  // The Transfer-Out candidate list must follow the school year, because a
  // learner with no *active* enrollment in the selected year has nothing to
  // transfer out — the server rejects that filing outright.
  useEffect(() => {
    if (!syId) {
      setActiveEnrollments([]);
      return;
    }
    let cancelled = false;
    enrollmentsApi
      .list()
      .then(rows => {
        if (cancelled) return;
        setActiveEnrollments(
          rows.filter(e => e.school_year_id === syId && e.status === 'enrolled')
        );
      })
      .catch(err => {
        if (cancelled) return;
        setActiveEnrollments([]);
        showToast(
          'error',
          'Failed to load active enrollments: ' +
            (err.detail?.error || err.message)
        );
      });
    return () => {
      cancelled = true;
    };
  }, [syId, showToast]);

  // Switching school year invalidates a chosen learner: the Transfer-Out candidate
  // set is year-scoped, so a stale selection would fail server-side on submit.
  useEffect(() => {
    setForm(f => (f.student_id ? { ...f, student_id: '' } : f));
  }, [syId]);

  const load = useCallback(() => {
    if (!syId) return;
    transfersApi
      .list({ school_year_id: syId, status: statusFilter || undefined })
      .then(setRows)
      .catch(err =>
        showToast(
          'error',
          'Failed to load transfer requests: ' +
            (err.detail?.error || err.message)
        )
      );
  }, [syId, statusFilter, showToast]);

  useEffect(load, [load]);

  const set = (key: keyof ReturnType<typeof emptyForm>, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    // Re-validate live once a field has been flagged, so the error clears as
    // soon as the registrar fixes it instead of waiting for another submit.
    setErrors(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const markTouched = (key: string) => setTouched(t => ({ ...t, [key]: true }));

  /** Show a field's error only after it has been touched or submit was attempted. */
  const fieldError = (key: string): string | undefined =>
    touched[key] ? errors[key] : undefined;

  const inputClass = (key: string) =>
    `w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition ${
      fieldError(key)
        ? 'border-red-300 bg-red-50/40 focus:ring-red-500/30 focus:border-red-400'
        : 'border-gray-200 focus:ring-indigo-500/30 focus:border-indigo-400'
    }`;

  const sectionsForGrade = useMemo(
    () => sections.filter(s => s.grade_level === parseInt(form.grade_level)),
    [sections, form.grade_level]
  );

  // Only learners holding an *active enrollment* in the selected school year can
  // be transferred out. Derived from enrollments, not students.status, because a
  // learner's overall status says nothing about a particular year.
  const transferOutCandidates = useMemo(
    () =>
      activeEnrollments
        .filter(e => e.section_id !== null)
        .map(e => ({
          id: e.student_id,
          name: e.student_name,
          lrn: e.lrn,
          student_id: e.student_display_id ?? String(e.student_id),
          grade_level: e.grade_level,
          sex: e.sex as 'male' | 'female' | undefined,
          context: e.section_name ?? undefined
        })),
    [activeEnrollments]
  );

  // Learners enrolled in the selected year but still awaiting a section have no
  // seat to return, so they are listed separately rather than silently missing.
  const unassignedInYear = useMemo(
    () => activeEnrollments.filter(e => e.section_id === null).length,
    [activeEnrollments]
  );

  // A returning Transfer-In learner is normally someone already on file, so the
  // full list is offered here (archived/graduated included — they may be coming
  // back for another year).
  const returningCandidates = useMemo(
    () =>
      students.map(s => ({
        id: s.id,
        name: s.name,
        lrn: s.lrn,
        student_id: s.student_id,
        grade_level: s.grade_level,
        sex: s.sex,
        context: s.status
      })),
    [students]
  );

  const openForm = () => {
    setForm(emptyForm());
    setExistingStudent(false);
    setErrors({});
    setTouched({});
    setShowForm(true);
  };

  /** Run the right schema for the visible branch and collect field errors. */
  const validateForm = (): Record<string, string> => {
    if (form.transfer_type === 'transfer_out') {
      if (!form.student_id) return { student_id: 'Select the learner transferring out.' };
      return validate(transferOutSchema, {
        reason: form.reason,
        destination_school: form.destination_school,
      });
    }
    if (existingStudent) {
      if (!form.student_id) return { student_id: 'Select the learner.' };
      return validate(existingLearnerSchema, { reason: form.reason });
    }
    return validate(newLearnerSchema, {
      student_name: form.student_name,
      lrn: form.lrn,
      sex: form.sex,
      birthdate: form.birthdate,
      grade_level: form.grade_level,
      previous_school: form.previous_school,
    });
  };

  const handleSubmit = async () => {
    if (!syId) {
      showToast('error', 'No school year selected.');
      return;
    }
    // Catch the mismatch client-side so the registrar gets an instant, specific
    // message instead of a round-trip 409. The server enforces this too.
    if (form.transfer_type === 'transfer_out' && form.student_id) {
      const stillValid = transferOutCandidates.some(
        c => c.id === Number(form.student_id)
      );
      if (!stillValid) {
        showToast(
          'error',
          'That learner has no active, section-assigned enrollment in the selected school year, so there is nothing to transfer out.'
        );
        return;
      }
    }
    if (form.transfer_type === 'transfer_in' && !existingStudent) {
      // A brand-new learner must not collide with a learner already on file —
      // filing under an existing LRN silently resolves to that learner instead.
      const lrn = form.lrn.trim();
      if (lrn && LRN_PATTERN.test(lrn)) {
        const clash = students.find(
          s => s.lrn.replace(/\s/g, '') === lrn
        );
        if (clash) {
          setErrors({
            lrn: `LRN ${lrn} already belongs to ${clash.name} (${clash.student_id}). Tick "already exists in our records" to file a transfer for them.`,
          });
          showToast('error', 'That LRN already belongs to a learner on file.');
          return;
        }
      }
    }

    const found = validateForm();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setTouched({
        student_id: true,
        student_name: true,
        lrn: true,
        birthdate: true,
        reason: true,
      });
      showToast('error', 'Please correct the highlighted fields.');
      return;
    }

    setSaving(true);
    try {
      await transfersApi.create({
        transfer_type: form.transfer_type,
        school_year_id: syId,
        student_id: form.student_id ? parseInt(form.student_id) : undefined,
        lrn: form.lrn.trim() || undefined,
        student_name: form.student_name.trim() || undefined,
        sex: form.sex,
        birthdate: form.birthdate || undefined,
        grade_level: parseInt(form.grade_level),
        section_id: form.section_id ? parseInt(form.section_id) : null,
        previous_school: form.previous_school.trim() || undefined,
        destination_school: form.destination_school.trim() || undefined,
        reason: form.reason.trim()
      });
      showToast(
        'success',
        'Transfer request filed and sent to the Enrollment Committee.'
      );
      setShowForm(false);
      load();
    } catch (err: any) {
      showToast(
        'error',
        err.detail?.error || err.message || 'Failed to file transfer request.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (row: TransferRequest) => {
    if (
      !window.confirm(
        `Withdraw the ${TYPE_LABEL[row.transfer_type]} request for ${row.student_name}?`
      )
    ) {
      return;
    }
    try {
      await transfersApi.cancel(row.id);
      showToast('success', 'Request withdrawn.');
      load();
    } catch (err: any) {
      showToast(
        'error',
        err.detail?.error || err.message || 'Failed to withdraw request.'
      );
    }
  };

  const pending = rows.filter(r => r.status === 'pending').length;
  const approved = rows.filter(r => r.status === 'approved').length;
  const rejected = rows.filter(r => r.status === 'rejected').length;

  if (loading) {
    return (
      <PageContainer>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <Loader2 size={28} className="mx-auto text-indigo-500 animate-spin" />
          <p className="text-gray-400 text-sm font-medium mt-3">
            Loading transfer requests...
          </p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400" />
        <div className="p-5 sm:p-6 flex flex-wrap items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-200 flex items-center justify-center flex-shrink-0">
            <ArrowLeftRight size={22} className="text-white" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">
              Transfer Management
            </h2>
            <p className="text-gray-500 text-sm">
              File and track Transfer-In / Transfer-Out requests
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={syId}
              onChange={e => setSyId(parseInt(e.target.value))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400">
              {years.map(y => (
                <option key={y.id} value={y.id}>
                  {y.sy_label}
                </option>
              ))}
            </select>
            <button
              onClick={openForm}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition">
              <Plus size={15} /> File Request
            </button>
          </div>
        </div>
      </div>

      {/* ── COMMITTEE DECISION NOTICE ── */}
      <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl px-5 py-4 flex items-start gap-3">
        <School size={16} className="text-indigo-600 mt-0.5 shrink-0" />
        <p className="text-xs text-indigo-800 leading-relaxed">
          A filed request starts as <strong>Pending</strong> and is decided by
          the Enrollment Committee. The Registrar cannot approve or reject a
          transfer, and approving a Transfer-In is what enrols the learner.
        </p>
      </div>

      {/* ── STATS ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">
            Pending
          </span>
          <p className="text-2xl font-bold text-amber-500 mt-1">{pending}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">
            Approved
          </span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{approved}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">
            Rejected
          </span>
          <p className="text-2xl font-bold text-red-500 mt-1">{rejected}</p>
        </div>
      </div>

      {/* ── LIST ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-gray-900">Requests</h3>
          <select
            value={statusFilter}
            onChange={e =>
              setStatusFilter(e.target.value as TransferStatus | '')
            }
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Withdrawn</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <div className="p-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <ArrowLeftRight size={28} className="text-gray-300" />
            </div>
            <p className="text-gray-500 text-sm font-semibold">
              No transfer requests
            </p>
            <p className="text-gray-400 text-xs mt-1">
              File a Transfer-In or Transfer-Out request to send it to the
              Enrollment Committee.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {rows.map(r => {
              const Icon = STATUS_ICON[r.status];
              return (
                <div
                  key={r.id}
                  className="px-5 py-4 hover:bg-indigo-50/30 transition-colors">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex-1 min-w-[220px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">
                          {r.student_name}
                        </span>
                        <span className="text-[11px] font-mono text-gray-400">
                          {r.student_code}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700">
                          {TYPE_LABEL[r.transfer_type]}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_STYLES[r.status]}`}>
                          <Icon size={11} />
                          {r.status === 'pending'
                            ? 'Pending'
                            : r.status === 'cancelled'
                              ? 'Withdrawn'
                              : r.status.charAt(0).toUpperCase() +
                                r.status.slice(1)}
                        </span>
                      </div>
                      <div className="mt-1.5 text-xs text-gray-500 space-y-0.5">
                        <p>
                          Grade {r.grade_level}
                          {r.requested_section_name
                            ? ` · Proposed: ${r.requested_section_name}`
                            : ''}
                          {r.enrolled_section_name
                            ? ` · Currently: ${r.enrolled_section_name}`
                            : ''}
                        </p>
                        {r.previous_school && <p>From: {r.previous_school}</p>}
                        {r.destination_school && (
                          <p>To: {r.destination_school}</p>
                        )}
                        {r.reason && (
                          <p className="text-gray-400 italic">“{r.reason}”</p>
                        )}
                      </div>
                      {r.review_remarks && (
                        <p className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                          <span className="font-semibold">Committee:</span>{' '}
                          {r.review_remarks}
                          {r.reviewed_by_name ? ` — ${r.reviewed_by_name}` : ''}
                        </p>
                      )}
                    </div>
                    {r.status === 'pending' && (
                      <button
                        onClick={() => handleCancel(r)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition">
                        <Ban size={13} /> Withdraw
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── FILE REQUEST MODAL ── */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  File Transfer Request
                </h3>
                <p className="text-xs text-gray-500">
                  Sent to the Enrollment Committee for approval
                </p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
                <X size={17} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {(['transfer_in', 'transfer_out'] as TransferType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => set('transfer_type', t)}
                    className={`rounded-xl border-2 px-4 py-3 text-left transition ${
                      form.transfer_type === t
                        ? 'border-indigo-500 bg-indigo-50/50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <span className="block text-sm font-semibold text-gray-900">
                      {TYPE_LABEL[t]}
                    </span>
                    <span className="block text-[11px] text-gray-500 mt-0.5">
                      {t === 'transfer_in'
                        ? 'New learner from another school'
                        : 'Learner leaving'}
                    </span>
                  </button>
                ))}
              </div>

              {form.transfer_type === 'transfer_out' ? (
                <div>
                  <SearchableStudentSelect
                    label={`Learner leaving — ${years.find(y => y.id === syId)?.sy_label ?? 'selected year'}`}
                    accent="indigo"
                    value={
                      form.student_id === '' ? '' : Number(form.student_id)
                    }
                    onChange={id =>
                      set('student_id', id === '' ? '' : String(id))
                    }
                    options={transferOutCandidates}
                    placeholder="Search the learner leaving by name, LRN, or ID…"
                    emptyMessage={
                      activeEnrollments.length === 0
                        ? 'No learner holds an active enrollment in this school year, so there is nobody to transfer out.'
                        : 'No learner matches your search.'
                    }
                  />
                  {unassignedInYear > 0 && (
                    <p className="text-[11px] text-amber-600 mt-1.5 flex items-start gap-1">
                      <AlertTriangle
                        size={11}
                        className="mt-0.5 flex-shrink-0"
                      />
                      {unassignedInYear} learner
                      {unassignedInYear !== 1 ? 's are' : ' is'} enrolled in
                      this year but still awaiting a section, so{' '}
                      {unassignedInYear !== 1 ? 'they have' : 'they has'} no
                      seat to return. Assign{' '}
                      {unassignedInYear !== 1 ? 'them' : 'them'} to a section
                      first.
                    </p>
                  )}
                  <FieldError>{fieldError('student_id')}</FieldError>
                </div>
              ) : (
                <>
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={existingStudent}
                      onChange={e => {
                        setExistingStudent(e.target.checked);
                        // Clearing student_id/lrn matters here: leaving a stale
                        // LRN behind would let a "new learner" filing silently
                        // collide with the learner just unchecked.
                        setForm(f => ({
                          ...f,
                          student_id: '',
                          student_name: '',
                          lrn: ''
                        }));
                        setErrors({});
                        setTouched({});
                      }}
                      className="rounded border-gray-300"
                    />
                    This learner already exists in our records (e.g. returning
                    from a previous school year)
                  </label>

                  {existingStudent ? (
                    <SearchableStudentSelect
                      label="Learner"
                      accent="indigo"
                      value={
                        form.student_id === '' ? '' : Number(form.student_id)
                      }
                      onChange={id =>
                        set('student_id', id === '' ? '' : String(id))
                      }
                      options={returningCandidates}
                      placeholder="Search returning learners by name, LRN, or ID…"
                    />
                  ) : null}
                  {form.transfer_type === 'transfer_in' && (
                    <FieldError>{fieldError('student_id')}</FieldError>
                  )}
                  {!existingStudent ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={form.student_name}
                          onChange={e => set('student_name', e.target.value)}
                          onBlur={() => markTouched('student_name')}
                          className={inputClass('student_name')}
                        />
                        {fieldError('student_name') && (
                          <FieldError>{fieldError('student_name')}</FieldError>
                        )}
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                          LRN
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={12}
                          value={form.lrn}
                          onChange={e =>
                            set('lrn', e.target.value.replace(/\D/g, ''))
                          }
                          onBlur={() => markTouched('lrn')}
                          placeholder="12-digit LRN"
                          className={inputClass('lrn')}
                        />
                        {fieldError('lrn') ? (
                          <FieldError>{fieldError('lrn')}</FieldError>
                        ) : (
                          <p className="text-[11px] text-gray-400 mt-1">
                            {form.lrn.length}/12 digits
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                          Sex
                        </label>
                        <select
                          value={form.sex}
                          onChange={e => set('sex', e.target.value)}
                          className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                        >
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                          Birthdate
                        </label>
                        <input
                          type="date"
                          value={form.birthdate}
                          max={new Date().toISOString().slice(0, 10)}
                          onChange={e => set('birthdate', e.target.value)}
                          onBlur={() => markTouched('birthdate')}
                          className={inputClass('birthdate')}
                        />
                        {fieldError('birthdate') && (
                          <FieldError>{fieldError('birthdate')}</FieldError>
                        )}
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                        Grade Level
                      </label>
                      <select
                        value={form.grade_level}
                        onChange={e => {
                          set('grade_level', e.target.value);
                          set('section_id', '');
                        }}
                        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400">
                        {GRADES.map(g => (
                          <option key={g} value={g}>
                            Grade {g}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                        Proposed Section (optional)
                      </label>
                      <select
                        value={form.section_id}
                        onChange={e => set('section_id', e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400">
                        <option value="">-- Let committee assign --</option>
                        {sectionsForGrade.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.current_count}/{s.capacity})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                      Previous School
                    </label>
                    <input
                      type="text"
                      value={form.previous_school}
                      onChange={e => set('previous_school', e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                    />
                  </div>
                </>
              )}

              {form.transfer_type === 'transfer_out' && (
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                    Destination School
                  </label>
                  <input
                    type="text"
                    value={form.destination_school}
                    onChange={e => set('destination_school', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.reason}
                  onChange={e => set('reason', e.target.value)}
                  onBlur={() => markTouched('reason')}
                  rows={3}
                  placeholder="Why is this learner transferring? This is shown to the Enrollment Committee."
                  className={inputClass('reason')}
                />
                {fieldError('reason') && (
                  <FieldError>{fieldError('reason')}</FieldError>
                )}
              </div>

              <div className="flex items-start gap-2 bg-gray-50 rounded-xl px-3.5 py-3">
                <AlertTriangle
                  size={14}
                  className="text-gray-400 mt-0.5 shrink-0"
                />
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Approving a Transfer-In enrols the learner and assigns the
                  section. If no section is proposed, the committee must choose
                  one at approval time.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition">
                {saving && <Loader2 size={15} className="animate-spin" />}
                File Request
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
