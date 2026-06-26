import React, { useState, useEffect } from "react";
import {
  ArrowUpCircle, Users, CheckCircle, ChevronDown, ChevronUp,
  FileText, GraduationCap, BarChart3
} from "lucide-react";
import { promotionsApi, PromotionRow } from "../../services/promotions";
import { useApp } from "../../context/AppContext";

const STATUS_BADGE: Record<string, { bg: string; label: string }> = {
  completed: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200/50", label: "Completed" },
  pending: { bg: "bg-amber-50 text-amber-700 border-amber-200/50", label: "Pending Review" },
};

export function PromotionRecords() {
  const { showToast } = useApp();
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    promotionsApi.list()
      .then(setPromotions)
      .catch(err => showToast("error", "Failed to load promotions: " + (err.detail?.error || err.message)))
      .finally(() => setLoading(false));
  }, []);

  const total = promotions.reduce((a, r) => a + r.student_count, 0);
  const completedCount = promotions.filter(r => r.status === "completed").length;
  const pendingCount = promotions.length - completedCount;

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="animate-spin w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm font-medium">Loading promotion records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400" />
        <div className="p-5 sm:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-200 flex items-center justify-center flex-shrink-0">
            <GraduationCap size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">Promotion Records</h2>
            <p className="text-gray-500 text-sm">All bulk section promotions submitted by teachers — updated in real time</p>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-xs text-gray-400 bg-gray-50/80 px-3.5 py-2 rounded-xl border border-gray-100">
            <ArrowUpCircle size={14} className="text-indigo-500" />
            <span className="font-semibold text-gray-600">{promotions.length}</span> records
            <span className="text-gray-300">|</span>
            <span className="text-emerald-600 font-medium">{completedCount}</span> completed
          </div>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Total Promotions</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
              <BarChart3 size={14} className="text-indigo-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">{promotions.length}</p>
          <p className="text-xs text-gray-400 mt-1">Sections promoted</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Students Promoted</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Users size={14} className="text-indigo-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">{total}</p>
          <p className="text-xs text-gray-400 mt-1">Across all sections</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Completed</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle size={14} className="text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">{completedCount}</p>
          <p className="text-xs text-gray-400 mt-1">
            {pendingCount > 0 ? `${pendingCount} pending review` : "All records finalized"}
          </p>
        </div>
      </div>

      {/* ── RECORDS TABLE ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-gray-900">All Promotion Records</h3>
            <span className="bg-indigo-50 text-indigo-700 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-indigo-100">
              {promotions.length} record{promotions.length !== 1 && "s"}
            </span>
          </div>
        </div>

        {promotions.length === 0 ? (
          <div className="p-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <ArrowUpCircle size={28} className="text-gray-300" />
            </div>
            <p className="text-gray-500 text-sm font-semibold">No promotion records yet</p>
            <p className="text-gray-400 text-xs mt-1">Records will appear here when teachers submit bulk promotions.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-gray-50/80">
                  <tr>
                    {[
                      { key: "section", label: "Section" },
                      { key: "students", label: "Students" },
                      { key: "grade", label: "To Grade" },
                      { key: "status", label: "Status" },
                    ].map(col => (
                      <th key={col.key} className="px-6 py-3.5 text-left">
                        <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">
                          {col.label}
                        </span>
                      </th>
                    ))}
                    <th className="px-6 py-3.5 text-right">
                      <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {promotions.map((r, idx) => {
                    const isOpen = expanded === r.id;
                    const badge = STATUS_BADGE[r.status] || { bg: "bg-gray-50 text-gray-500 border-gray-200/50", label: r.status };
                    return (
                      <tr key={r.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                        <td className="px-6 py-3.5" colSpan={5}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                                <GraduationCap size={15} className="text-indigo-600" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-gray-900 tracking-[-0.01em]">{r.section_name}</p>
                                <p className="text-xs text-gray-400">By {r.promoted_by_name} · {r.created_at?.split("T")[0] || "—"}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-6 flex-shrink-0">
                              <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                                <Users size={14} className="text-gray-400" />
                                {r.student_count}
                              </div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-100">
                                <ArrowUpCircle size={12} />
                                Gr. {r.to_grade_level}
                              </span>
                              <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-medium border ${badge.bg}`}>
                                {badge.label}
                              </span>
                              <button
                                onClick={() => setExpanded(isOpen ? null : r.id)}
                                className="p-1 rounded-lg hover:bg-gray-100 transition"
                              >
                                {isOpen
                                  ? <ChevronUp size={16} className="text-indigo-500" />
                                  : <ChevronDown size={16} className="text-gray-400" />}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Expanded details */}
            {expanded !== null && (() => {
              const r = promotions.find(p => p.id === expanded);
              if (!r) return null;
              return (
                <div className="border-t border-gray-100 bg-indigo-50/30 px-6 py-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.06em] mb-3">Promotion Details</p>
                      <div className="space-y-2">
                        {[
                          ["Record ID", `#${r.id}`],
                          ["From Section", r.section_name],
                          ["Promoted to", `Grade ${r.to_grade_level}`],
                          ["Total Students", String(r.student_count)],
                          ["Submitted by", r.promoted_by_name],
                          ["Date", r.created_at?.split("T")[0] || "—"],
                        ].map(([label, value]) => (
                          <div key={label} className="flex justify-between text-sm py-1.5 border-b border-indigo-100/60 last:border-0">
                            <span className="text-gray-500">{label}</span>
                            <span className="font-medium text-gray-800">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.06em] mb-3">School Year</p>
                      <div className="bg-white rounded-xl border border-gray-100 p-4 text-sm mb-4">
                        <p className="text-gray-600">{r.sy_label || `SY #${r.school_year_id}`}</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all font-medium">
                          <FileText size={12} /> View Full Report
                        </button>
                        <button className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg shadow-sm hover:shadow transition-all font-medium">
                          <ArrowUpCircle size={12} /> Export Record
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
