/**
 * Enrollment Committee dashboard.
 *
 * Landing page for the committee's four duties: document verification, transfer
 * approvals, section assignment, and enrollment. Each tile links to the duty and
 * surfaces the queue count so the committee can see what is waiting.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Users,
  Layers,
  FileCheck2,
  ArrowLeftRight,
  ClipboardList,
  ArrowUpRight,
  Loader2,
  AlertTriangle,
  HeartHandshake,
  ShieldCheck,
} from 'lucide-react';
import { enrollmentsApi, EnrollmentFlagsResponse } from '../../services/enrollments';
import { sectioningApi } from '../../services/sectioning';
import { transfersApi } from '../../services/transfers';
import { useApp } from '../../context/AppContext';
import { PageContainer } from '../../components/PageContainer';

interface DutyCard {
  key: string;
  title: string;
  description: string;
  path: string;
  icon: typeof Users;
  accent: string;
  shadow: string;
  value: number | null;
  valueLabel: string;
}

export function CommitteeDashboard() {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [pendingTransfers, setPendingTransfers] = useState<number | null>(null);
  const [queueCount, setQueueCount] = useState<number | null>(null);
  const [flagCount, setFlagCount] = useState<number | null>(null);
  const [enrolledCount, setEnrolledCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Each tile is independent: a failing duty must not blank the whole page.
    Promise.allSettled([
      transfersApi.list({ status: 'pending' }).then(r => {
        if (!cancelled) setPendingTransfers(r.length);
      }),
      sectioningApi.getPendingQueue().then(d => {
        if (!cancelled) setQueueCount(d.total_pending);
      }),
      enrollmentsApi.flags().then((f: EnrollmentFlagsResponse) => {
        if (!cancelled) setFlagCount(f.flags?.length ?? 0);
      }),
      enrollmentsApi.list().then(rows => {
        if (!cancelled) setEnrolledCount(rows.filter(e => e.status === 'enrolled').length);
      }),
    ])
      .then(results => {
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed > 0 && !cancelled) {
          showToast('warning', `${failed} dashboard tile(s) could not be loaded.`);
        }
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const duties: DutyCard[] = [
    {
      key: 'transfers',
      title: 'Transfer Approvals',
      description:
        'Decide on filed Transfer-In / Transfer-Out requests. Approving a Transfer-In enrols the learner.',
      path: '/committee/transfers',
      icon: ArrowLeftRight,
      accent: 'from-indigo-400 to-indigo-600',
      shadow: 'shadow-indigo-200/60',
      value: pendingTransfers,
      valueLabel: 'awaiting decision',
    },
    {
      key: 'sectioning',
      title: 'Section Assignment',
      description:
        'Place enrolled learners awaiting a section. Non-Readers are tagged manually, never placed by grade threshold.',
      path: '/committee/section-assignment',
      icon: Layers,
      accent: 'from-emerald-400 to-emerald-600',
      shadow: 'shadow-emerald-200/60',
      value: queueCount,
      valueLabel: 'in pending queue',
    },
    {
      key: 'documents',
      title: 'Document Verification',
      description:
        'Sight and verify submitted requirements, and flag duplicate enrollments before they harden.',
      path: '/committee/documents',
      icon: FileCheck2,
      accent: 'from-sky-400 to-sky-600',
      shadow: 'shadow-sky-200/60',
      value: flagCount,
      valueLabel: 'duplicate flags',
    },
    {
      key: 'enrollment',
      title: 'Enrollment',
      description: 'Enroll learners, manage sections and maintain student records for the school year.',
      path: '/committee/enrollment',
      icon: ClipboardList,
      accent: 'from-violet-400 to-violet-600',
      shadow: 'shadow-violet-200/60',
      value: enrolledCount,
      valueLabel: 'learners enrolled',
    },
  ];

  if (loading) {
    return (
      <PageContainer>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <Loader2 size={28} className="mx-auto text-emerald-500 animate-spin" />
          <p className="text-gray-400 text-sm font-medium mt-3">Loading committee dashboard...</p>
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
            <HeartHandshake size={22} className="text-white" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">
              Enrollment Committee
            </h2>
            <p className="text-gray-500 text-sm">
              Document verification, transfer approvals, sectioning and enrollment
            </p>
          </div>
        </div>
      </div>

      {/* ── DUTY CARDS ── */}
      <div className="grid gap-3 sm:grid-cols-2">
        {duties.map(d => {
          const Icon = d.icon;
          return (
            <button
              key={d.key}
              onClick={() => navigate(d.path)}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-left hover:border-emerald-200 hover:shadow-md transition-all group"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-11 h-11 rounded-xl bg-gradient-to-br ${d.accent} ${d.shadow} shadow-lg flex items-center justify-center flex-shrink-0`}
                >
                  <Icon size={19} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-gray-900">{d.title}</h3>
                    <ArrowUpRight
                      size={14}
                      className="text-gray-300 group-hover:text-emerald-500 transition-colors"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{d.description}</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-50 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">
                  {d.value === null ? '—' : d.value}
                </span>
                <span className="text-[11px] text-gray-400">{d.valueLabel}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── COMMITTEE PRINCIPLES ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <ShieldCheck size={15} className="text-emerald-600" /> Committee Scope
        </h3>
        <ul className="space-y-2 text-xs text-gray-600">
          <li className="flex items-start gap-2">
            <span className="text-emerald-500 mt-0.5">•</span>
            <span>
              Section placement, document verification, transfer decisions and enrollment records are
              committee responsibilities; the Registrar prepares the paperwork.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-500 mt-0.5">•</span>
            <span>
              A request you filed yourself must be decided by another committee member.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">
              <AlertTriangle size={12} className="mt-0.5" />
            </span>
            <span>
              The Non-Reader tag requires a recorded reading assessment and is never inferred from
              grades.
            </span>
          </li>
        </ul>
      </div>
    </PageContainer>
  );
}