/**
 * Transfer Approvals — Enrollment Committee view.
 *
 * This is the decision point for the transfer workflow: approving a Transfer-In
 * is what enrols the learner (and assigns their section), so the committee
 * review here is the actual authority, not a rubber stamp on the registrar.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeftRight,
  Loader2,
  CheckCircle,
  XCircle,
  School,
  AlertTriangle,
  Inbox,
  ShieldCheck,
} from 'lucide-react';
import { PageContainer } from '../../components/PageContainer';
import { useApp } from '../../context/AppContext';
import { schoolYearsApi, SchoolYearRow } from '../../services/schoolYears';
import { sectionsApi, SectionRow } from '../../services/sections';
import {
  transfersApi,
  TransferRequest,
  TransferType,
  TransferStatus,
} from '../../services/transfers';

const STATUS_STYLES: Record<TransferStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
};

const TYPE_LABEL: Record<TransferType, string> = {
  transfer_in: 'Transfer-In',
  transfer_out: 'Transfer-Out',
};

export function TransferApprovals() {
  const { showToast } = useApp();
  const [rows, setRows] = useState<TransferRequest[]>([]);
  const [years, setYears] = useState<SchoolYearRow[]>([]);
  const [syId, setSyId] = useState<number>(0);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [typeFilter, setTypeFilter] = useState<TransferType | ''>('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Per-request review state
  const [remarks, setRemarks] = useState<Record<number, string>>({});
  const [sectionChoice, setSectionChoice] = useState<Record<number, string>>({});

  useEffect(() => {
    Promise.all([schoolYearsApi.list(), sectionsApi.list()])
      .then(([ys, secs]) => {
        setYears(ys);
        setSections(secs);
        const current = ys.find(y => y.is_current === 1);
        if (current) setSyId(current.id);
      })
      .catch(err =>
        showToast('error', 'Failed to load data: ' + (err.detail?.error || err.message))
      )
      .finally(() => setLoading(false));
  }, []);

  const load = useCallback(() => {
    if (!syId) return;
    transfersApi
      .list({
        school_year_id: syId,
        status: 'pending',
        transfer_type: typeFilter || undefined,
      })
      .then(setRows)
      .catch(err =>
        showToast('error', 'Failed to load requests: ' + (err.detail?.error || err.message))
      );
  }, [syId, typeFilter, showToast]);

  useEffect(load, [load]);

  const sectionsById = useMemo(
    () => new Map(sections.map(s => [s.id, s])),
    [sections]
  );

  const decide = async (row: TransferRequest, decision: 'approved' | 'rejected') => {
    if (decision === 'rejected' && !(remarks[row.id] || '').trim()) {
      showToast('error', 'Give a reason when rejecting a request.');
      return;
    }
    if (decision === 'approved' && row.transfer_type === 'transfer_in') {
      const chosen = sectionChoice[row.id] !== undefined
        ? sectionChoice[row.id]
        : row.requested_section_id != null
          ? String(row.requested_section_id)
          : '';
      if (!chosen) {
        showToast('error', 'Choose the section this learner will be assigned to.');
        return;
      }
      const sec = sectionsById.get(parseInt(chosen));
      if (sec && sec.current_count >= sec.capacity) {
        showToast('error', `Section "${sec.name}" is at full capacity.`);
        return;
      }
    }

    setBusyId(row.id);
    try {
      const chosen = sectionChoice[row.id] !== undefined
        ? sectionChoice[row.id]
        : row.requested_section_id != null
          ? String(row.requested_section_id)
          : '';
      await transfersApi.review(row.id, {
        decision,
        remarks: (remarks[row.id] || '').trim() || undefined,
        section_id: chosen ? parseInt(chosen) : null,
      });
      showToast(
        'success',
        decision === 'approved'
          ? row.transfer_type === 'transfer_in'
            ? 'Transfer-In approved — learner enrolled.'
            : 'Transfer-Out approved.'
          : 'Request rejected.'
      );
      load();
    } catch (err: any) {
      showToast('error', err.detail?.error || err.message || 'Failed to record decision.');
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = rows.length;
  const transferIns = rows.filter(r => r.transfer_type === 'transfer_in').length;

  if (loading) {
    return (
      <PageContainer>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <Loader2 size={28} className="mx-auto text-emerald-500 animate-spin" />
          <p className="text-gray-400 text-sm font-medium mt-3">Loading transfer requests...</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-400" />
        <div className="p-5 sm:p-6 flex flex-wrap items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-200 flex items-center justify-center flex-shrink-0">
            <ArrowLeftRight size={22} className="text-white" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">
              Transfer Approvals
            </h2>
            <p className="text-gray-500 text-sm">
              Pending requests awaiting committee decision
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as TransferType | '')}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
            >
              <option value="">All types</option>
              <option value="transfer_in">Transfer-In</option>
              <option value="transfer_out">Transfer-Out</option>
            </select>
            <select
              value={syId}
              onChange={e => setSyId(parseInt(e.target.value))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
            >
              {years.map(y => (
                <option key={y.id} value={y.id}>
                  {y.sy_label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── AUTHORITY NOTE ── */}
      <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl px-5 py-4 flex items-start gap-3">
        <ShieldCheck size={16} className="text-emerald-600 mt-0.5 shrink-0" />
        <p className="text-xs text-emerald-800 leading-relaxed">
          <strong>Committee decision.</strong> The Registrar files the request; approving it here
          completes the enrollment. A request you filed yourself must be decided by another
          committee member.
        </p>
      </div>

      {/* ── STATS ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">
            Pending Review
          </span>
          <p className="text-2xl font-bold text-amber-500 mt-1">{pendingCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">
            Transfer-In
          </span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{transferIns}</p>
        </div>
      </div>

      {/* ── QUEUE ── */}
      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <Inbox size={28} className="text-gray-300" />
          </div>
          <p className="text-gray-500 text-sm font-semibold">No pending requests</p>
          <p className="text-gray-400 text-xs mt-1">
            Filed transfer requests will appear here for review.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map(r => {
            const gradeSections = sections.filter(s => s.grade_level === r.grade_level);
            const chosen = sectionChoice[r.id] !== undefined
              ? sectionChoice[r.id]
              : r.requested_section_id != null
                ? String(r.requested_section_id)
                : '';
            const chosenSection = chosen ? sectionsById.get(parseInt(chosen)) : undefined;
            return (
              <div
                key={r.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <div className="px-5 py-4 border-b border-gray-50 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{r.student_name}</span>
                  <span className="text-[11px] font-mono text-gray-400">{r.student_code}</span>
                  {r.lrn && <span className="text-[11px] font-mono text-gray-400">LRN {r.lrn}</span>}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700">
                    {TYPE_LABEL[r.transfer_type]}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_STYLES[r.status]}`}
                  >
                    Pending
                  </span>
                </div>

                <div className="px-5 py-4 grid gap-4 lg:grid-cols-2">
                  {/* details */}
                  <div className="text-xs text-gray-600 space-y-1">
                    <p className="text-sm font-medium text-gray-900">
                      Grade {r.grade_level}
                      {r.active_section_name && (
                        <span className="text-gray-500 font-normal">
                          {' '}· currently {r.active_section_name} ({r.sy_label})
                        </span>
                      )}
                    </p>
                    {r.is_approvable === 0 && (
                      <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
                        <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Cannot be approved.</strong> This learner has no active enrollment for
                          {r.sy_label}, so there is nothing to transfer out. Reject this request, or ask
                          the Registrar to refile it against the correct school year.
                        </span>
                      </div>
                    )}
                    {r.previous_school && (
                      <p className="flex items-center gap-1.5">
                        <School size={12} className="text-gray-400" /> From: {r.previous_school}
                      </p>
                    )}
                    {r.destination_school && (
                      <p className="flex items-center gap-1.5">
                        <School size={12} className="text-gray-400" /> To: {r.destination_school}
                      </p>
                    )}
                    {r.reason && <p className="italic text-gray-500">“{r.reason}”</p>}
                    <p className="text-[11px] text-gray-400 pt-1">
                      Filed by {r.requested_by_name} · {new Date(r.created_at).toLocaleString()}
                    </p>
                  </div>

                  {/* decision */}
                  <div className="space-y-3">
                    {r.transfer_type === 'transfer_in' && (
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                          Assign Section <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={chosen}
                          onChange={e =>
                            setSectionChoice(p => ({ ...p, [r.id]: e.target.value }))
                          }
                          className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                        >
                          <option value="">-- Select section --</option>
                          {gradeSections.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.current_count}/{s.capacity})
                              {s.current_count >= s.capacity ? ' — FULL' : ''}
                            </option>
                          ))}
                        </select>
                        {chosenSection && chosenSection.current_count >= chosenSection.capacity && (
                          <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1">
                            <AlertTriangle size={11} /> This section is at full capacity.
                          </p>
                        )}
                        {r.requested_section_name && (
                          <p className="mt-1 text-[11px] text-gray-400">
                            Registrar proposed: {r.requested_section_name}
                          </p>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                        Remarks
                        {r.transfer_type === 'transfer_out' && (
                          <span className="text-red-500"> (required to reject)</span>
                        )}
                      </label>
                      <textarea
                        value={remarks[r.id] || ''}
                        onChange={e => setRemarks(p => ({ ...p, [r.id]: e.target.value }))}
                        rows={2}
                        placeholder="Notes for the record / reason for rejection..."
                        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => decide(r, 'approved')}
                        disabled={busyId === r.id || r.is_approvable === 0}
                        title={
                          r.is_approvable === 0
                            ? 'No active enrollment for this school year — nothing to transfer out'
                            : undefined
                        }
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        {busyId === r.id ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <CheckCircle size={15} />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => decide(r, 'rejected')}
                        disabled={busyId === r.id}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition"
                      >
                        <XCircle size={15} />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}