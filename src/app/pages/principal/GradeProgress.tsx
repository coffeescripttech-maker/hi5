import React, { useState, useEffect } from "react";
import { ClipboardList, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { sectionsApi, SectionRow } from "../../services/sections";
import { useApp } from "../../context/AppContext";

export function GradeProgress() {
  const { showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<SectionRow[]>([]);

  useEffect(() => {
    sectionsApi.list()
      .then(setSections)
      .catch(err => showToast("error", "Failed to load data: " + (err.detail?.error || err.message)))
      .finally(() => setLoading(false));
  }, []);

  // Simulated grade submission status based on section data
  // In production, this would come from a dedicated endpoint
  const byGrade = [7, 8, 9, 10, 11, 12].map(g => {
    const gradeSections = sections.filter(s => s.grade_level === g);
    const submitted = gradeSections.filter(_ => Math.random() > 0.3).length; // Placeholder
    const total = gradeSections.length;
    return {
      grade: `Grade ${g}`,
      sections: gradeSections,
      submitted,
      total,
      pct: total > 0 ? Math.round((submitted / total) * 100) : 0,
    };
  }).filter(g => g.total > 0);

  const totalSections = sections.length;
  const submittedSections = byGrade.reduce((a, g) => a + g.submitted, 0);
  const overallPct = totalSections > 0 ? Math.round((submittedSections / totalSections) * 100) : 0;

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
          <p className="text-gray-400 text-sm font-medium">Loading grade progress data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* HEADER */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-violet-500 via-violet-600 to-violet-400" />
        <div className="p-5 sm:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 shadow-lg shadow-violet-200 flex items-center justify-center flex-shrink-0">
            <ClipboardList size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">Grade Submission Progress</h2>
            <p className="text-gray-500 text-sm">Track grade submission status across all sections</p>
          </div>
        </div>
      </div>

      {/* OVERALL STATS */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Submitted</span>
            <CheckCircle size={14} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 tracking-[-0.02em]">{submittedSections}</p>
          <p className="text-xs text-gray-400 mt-1">of {totalSections} sections</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Progress</span>
            <Clock size={14} className="text-violet-500" />
          </div>
          <p className="text-2xl font-bold text-violet-600 tracking-[-0.02em]">{overallPct}%</p>
          <p className="text-xs text-gray-400 mt-1">overall completion</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Pending</span>
            <AlertCircle size={14} className="text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600 tracking-[-0.02em]">{totalSections - submittedSections}</p>
          <p className="text-xs text-gray-400 mt-1">sections not yet submitted</p>
        </div>
      </div>

      {/* BY GRADE */}
      {byGrade.map(g => (
        <div key={g.grade} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="bg-violet-50 text-violet-700 text-[11px] font-bold px-3 py-1 rounded-full border border-violet-100">{g.grade}</span>
              <span className="text-xs text-gray-500">{g.sections.length} section{g.sections.length !== 1 && "s"}</span>
            </div>
            <span className="text-xs font-semibold text-violet-600">{g.pct}% complete</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80">
                <tr>
                  {["Section", "Adviser", "Status"].map(h => (
                    <th key={h} className="text-left px-5 py-3.5">
                      <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">{h}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {g.sections.map((s, idx) => {
                  const isSubmitted = Math.random() > 0.3; // Placeholder
                  return (
                    <tr key={s.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-violet-50/50 transition-colors`}>
                      <td className="px-5 py-3.5 font-medium text-gray-800">{s.name}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{s.adviser_name || "—"}</td>
                      <td className="px-5 py-3.5">
                        {isSubmitted ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                            <CheckCircle size={11} /> Submitted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-amber-50 text-amber-700 border-amber-200">
                            <Clock size={11} /> Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
