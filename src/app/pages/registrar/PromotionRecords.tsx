import React, { useState, useEffect } from "react";
import {
  ArrowUpCircle, Users, CheckCircle, ChevronDown,
  FileText, GraduationCap, BarChart3, Download, X,
  RefreshCw, AlertTriangle, TrendingUp
} from "lucide-react";
import { promotionsApi, PromotionRow, PromotionStudentRow } from "../../services/promotions";
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
  const [details, setDetails] = useState<Record<
    number,
    { loading: boolean; data?: PromotionRow & { students: PromotionStudentRow[] }; error?: string }
  >>({});
  const fetchedRef = React.useRef<Set<number>>(new Set());

  useEffect(() => {
    promotionsApi.list()
      .then(setPromotions)
      .catch(err => showToast("error", "Failed to load promotions: " + (err.detail?.error || err.message)))
      .finally(() => setLoading(false));
  }, []);

  const toggleDetails = (id: number) => {
    setExpanded(prev => (prev === id ? null : id));
    if (!fetchedRef.current.has(id)) {
      fetchedRef.current.add(id);
      setDetails(prev => ({ ...prev, [id]: { loading: true } }));
      promotionsApi.get(id)
        .then(data => setDetails(prev => ({ ...prev, [id]: { loading: false, data } })))
        .catch(err => setDetails(prev => ({ ...prev, [id]: { loading: false, error: err.detail?.error || err.message } })));
    }
  };

  // Close the details modal with the Escape key
  useEffect(() => {
    if (expanded === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const exportStudents = (d: PromotionRow & { students: PromotionStudentRow[] }) => {
    const csv = [
      ["Student Name", "LRN", "From Section", "To Section", "General Average", "Result"].join(","),
      ...d.students.map(st =>
        [
          `"${st.student_name}"`,
          st.lrn,
          `"${st.from_section_name}"`,
          st.to_section_name ? `"${st.to_section_name}"` : "—",
          st.general_average != null ? parseFloat(String(st.general_average)).toFixed(2) : "—",
          st.is_retained ? "Retained" : d.is_completers ? "Graduated" : st.to_section_name ? "Promoted" : "—",
        ].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `promotion-${d.id}-${d.section_name.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const total = promotions.reduce((a, r) => a + r.student_count, 0);
  const completedCount = promotions.filter(r => r.status === "completed").length;
  const pendingCount = promotions.length - completedCount;

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-3 sm:px-0">
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
    <div className="space-y-5 max-w-6xl mx-auto px-3 sm:px-0">
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
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
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
                      <tr key={r.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}${isOpen ? " bg-indigo-50/40" : ""}`}>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                              <GraduationCap size={15} className="text-indigo-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 tracking-[-0.01em] truncate">{r.section_name}</p>
                              <p className="text-xs text-gray-400">By {r.promoted_by_name} · {r.created_at?.split("T")[0] || "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                            <Users size={14} className="text-gray-400" />
                            {r.student_count}
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-100">
                            <ArrowUpCircle size={12} />
                            Gr. {r.to_grade_level}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-medium border ${badge.bg}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <button
                            onClick={() => toggleDetails(r.id)}
                            className="inline-flex items-center gap-1.5 text-xs bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all font-medium"
                          >
                            Details
                            <ChevronDown size={14} className="text-gray-400" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Promotion details modal */}
            {expanded !== null && (() => {
              const r = promotions.find(p => p.id === expanded);
              if (!r) return null;
              const detail = details[expanded];
              return (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div
                    className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
                    onClick={() => setExpanded(null)}
                  />
                  <div className="relative w-full max-w-3xl max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50/50 to-indigo-50/50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center flex-shrink-0">
                          <GraduationCap size={18} className="text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 tracking-[-0.01em] truncate">
                            Promotion Record Details
                          </p>
                          <p className="text-xs text-gray-400">
                            {r.section_name} → Grade {r.to_grade_level}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setExpanded(null)}
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label="Close details"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Body */}
                    <div className="app-scroll overflow-y-auto flex-1 px-5 py-4">
                      {detail?.loading ? (
                        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-16">
                          <svg className="animate-spin w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Loading complete record details...
                        </div>
                      ) : detail?.error ? (
                        <div className="text-sm text-red-500 py-12 text-center">{detail.error}</div>
                      ) : detail?.data ? (() => {
                        const current = detail!.data!;
                        const graded = (v: unknown) =>
                          v != null ? parseFloat(String(v)).toFixed(2) : "—";
                        const rows = current.students.map(st => {
                          const incomplete = st.grade_complete != null && st.grade_complete === 0;
                          const result = st.is_retained
                            ? { label: "Retained", cls: "bg-amber-50 text-amber-700 border-amber-200" }
                            : r.is_completers
                              ? { label: "Graduated", cls: "bg-purple-50 text-purple-700 border-purple-200" }
                              : st.to_section_name
                                ? { label: "Promoted", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" }
                                : { label: "—", cls: "bg-gray-50 text-gray-500 border-gray-200" };
                          return { st, incomplete, result };
                        });
                        const total = rows.length;
                        const promoted = rows.filter(x => x.result.label === "Promoted").length;
                        const graduated = rows.filter(x => x.result.label === "Graduated").length;
                        const retained = rows.filter(x => x.st.is_retained).length;
                        const incompleteCount = rows.filter(x => x.incomplete).length;
                        const passRate = total > 0 ? Math.round(((promoted + graduated) / total) * 100) : 0;

                        return (
                          <>
                            {/* Record summary */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                              {[
                                ["Record ID", `#${r.id}`],
                                ["From Section", r.section_name],
                                ["To Grade", `Grade ${r.to_grade_level}`],
                                ["Total Students", String(total)],
                                ["Submitted by", r.promoted_by_name],
                                ["School Year", r.sy_label || `SY #${r.school_year_id}`],
                                ["Status", (STATUS_BADGE[r.status]?.label ?? r.status)],
                                ["Date", r.created_at?.split("T")[0] || "—"],
                              ].map(([label, value]) => (
                                <div key={label as string} className="bg-gray-50/80 rounded-xl border border-gray-100 px-3 py-2.5">
                                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
                                  <p className="text-sm font-medium text-gray-800 mt-0.5 break-words">{value}</p>
                                </div>
                              ))}
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-4">
                              {[
                                { icon: <CheckCircle size={13} />, label: "Promoted", value: promoted, cls: "text-emerald-700 bg-emerald-50 border-emerald-100" },
                                { icon: <GraduationCap size={13} />, label: "Graduated", value: graduated, cls: "text-purple-700 bg-purple-50 border-purple-100" },
                                { icon: <RefreshCw size={13} />, label: "Retained", value: retained, cls: "text-amber-700 bg-amber-50 border-amber-100" },
                                { icon: <AlertTriangle size={13} />, label: "Incomplete", value: incompleteCount, cls: "text-gray-600 bg-gray-50 border-gray-100" },
                                { icon: <TrendingUp size={13} />, label: "Pass Rate", value: `${passRate}%`, cls: "text-indigo-700 bg-indigo-50 border-indigo-100" },
                              ].map(s => (
                                <div key={s.label} className={`rounded-xl border px-3 py-2.5 ${s.cls}`}>
                                  <div className="flex items-center gap-1.5 mb-1">
                                    {s.icon}
                                    <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{s.label}</p>
                                  </div>
                                  <p className="text-lg font-bold leading-tight">{s.value}</p>
                                </div>
                              ))}
                            </div>

                            {/* Students table */}
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.06em] mt-5 mb-2.5">
                              Students ({total})
                            </p>
                            {rows.length === 0 ? (
                              <div className="bg-gray-50/70 rounded-xl border border-gray-100 p-8 text-center text-sm text-gray-400">
                                No student records attached to this promotion.
                              </div>
                            ) : (
                              <div className="app-scroll overflow-x-auto bg-white rounded-xl border border-gray-100">
                                <table className="w-full min-w-[880px] text-sm">
                                  <thead className="bg-gray-50/80">
                                    <tr>
                                      {["Student", "LRN", "From Section", "To Section", "Result", "General Average"].map(h => (
                                        <th key={h} className="px-4 py-3 text-left">
                                          <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">{h}</span>
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-50">
                                    {rows.map(({ st, incomplete: isInc, result }, i) => (
                                      <tr key={st.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}>
                                        <td className="px-4 py-3">
                                          <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-700 text-[11px] font-bold flex-shrink-0">
                                              {st.student_name.charAt(0)}
                                            </div>
                                            <span className="font-medium text-gray-900">{st.student_name}</span>
                                          </div>
                                        </td>
                                        <td className="px-4 py-3"><span className="font-mono text-xs text-gray-500">{st.lrn}</span></td>
                                        <td className="px-4 py-3 text-gray-600">{st.from_section_name || "—"}</td>
                                        <td className="px-4 py-3 text-gray-600">{st.to_section_name || "—"}</td>
                                        <td className="px-4 py-3">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border ${result.cls}`}>
                                              {result.label}
                                            </span>
                                            {isInc && (
                                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border bg-gray-100 text-gray-500 border-gray-200">
                                                Incomplete
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3">
                                          <span className="text-xs font-mono text-gray-600">{graded(st.general_average)}</span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </>
                        );
                      })() : null}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-gray-100 bg-gray-50/60">
                      <button
                        onClick={() => setExpanded(null)}
                        className="inline-flex items-center gap-1.5 text-xs bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all font-medium"
                      >
                        Close
                      </button>
                      {detail?.data && (
                        <button
                          onClick={() => exportStudents(detail!.data!)}
                          className="inline-flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-sm hover:shadow transition-all font-medium"
                        >
                          <Download size={13} /> Export Students (CSV)
                        </button>
                      )}
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
