import React, { useState, useEffect } from "react";
import { ClipboardList, CheckCircle, Clock, AlertCircle, Lock, Users } from "lucide-react";
import { gradesApi, GradeSubmissionStatus, SectionGradeSubmission } from "../../services/grades";
import { useApp } from "../../context/AppContext";

function sectionStatus(s: SectionGradeSubmission): { label: string; badge: string; dot: string } {
  if (s.total_students > 0 && s.graded_students === s.total_students) {
    return { label: "Submitted", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" };
  }
  if (s.graded_students > 0) {
    return { label: "In Progress", badge: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500" };
  }
  return { label: "Pending", badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" };
}

export function GradeProgress() {
  const { showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<GradeSubmissionStatus | null>(null);

  useEffect(() => {
    gradesApi.submissionStatus()
      .then(setData)
      .catch(err => showToast("error", "Failed to load data: " + (err.detail?.error || err.message)))
      .finally(() => setLoading(false));
  }, [showToast]);

  const submittedSections = data?.submitted_sections ?? 0;
  const totalSections = data?.total_sections ?? 0;
  const overallPct = data?.overall_pct ?? 0;
  const byGrade = data?.by_grade ?? [];

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
          <p className="text-gray-400 text-sm font-medium">Loading grade progress data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto px-3 sm:px-0">
      {/* HEADER */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-purple-500 via-purple-600 to-purple-400" />
        <div className="p-5 sm:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-200 flex items-center justify-center flex-shrink-0">
            <ClipboardList size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">Grade Submission Progress</h2>
            <p className="text-gray-500 text-sm">Track grade submission status across all sections</p>
          </div>
        </div>
      </div>

      {/* OVERALL STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Submitted</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center"><CheckCircle size={14} className="text-emerald-600" /></div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 tracking-[-0.02em]">{submittedSections}</p>
          <p className="text-xs text-gray-400 mt-1">of {totalSections} sections</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Progress</span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center"><Clock size={14} className="text-purple-600" /></div>
          </div>
          <p className="text-2xl font-bold text-purple-600 tracking-[-0.02em]">{overallPct}%</p>
          <p className="text-xs text-gray-400 mt-1">overall completion</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Pending</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center"><AlertCircle size={14} className="text-amber-600" /></div>
          </div>
          <p className="text-2xl font-bold text-amber-600 tracking-[-0.02em]">{totalSections - submittedSections}</p>
          <p className="text-xs text-gray-400 mt-1">sections not yet submitted</p>
        </div>
      </div>

      {/* BY GRADE */}
      {byGrade.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-gray-400 text-sm font-medium">No sections found for this school year.</p>
        </div>
      )}
      {byGrade.map(g => (
        <div key={g.grade_level} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="bg-purple-50 text-purple-700 text-[11px] font-bold px-3 py-1 rounded-full border border-purple-100">Grade {g.grade_level}</span>
              <span className="text-xs text-gray-500">{g.sections.length} section{g.sections.length !== 1 && "s"}</span>
            </div>
            <span className="text-xs font-semibold text-purple-600">{g.pct}% complete</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80">
                <tr>
                  {["Section", "Adviser", "Students Graded", "Status"].map(h => (
                    <th key={h} className="text-left px-5 py-3.5">
                      <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">{h}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {g.sections.map((s, idx) => {
                  const st = sectionStatus(s);
                  const isLocked = s.grade_rows > 0 && s.locked_rows === s.grade_rows;
                  return (
                    <tr key={s.section_id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-purple-50/50 transition-colors`}>
                      <td className="px-5 py-3.5 font-medium text-gray-800">{s.section_name}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{s.adviser_name || "—"}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                          <Users size={12} className="text-gray-400" />
                          {s.graded_students} / {s.total_students}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${st.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                          </span>
                          {isLocked && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border bg-gray-50 text-gray-500 border-gray-200" title="Grades are locked and final">
                              <Lock size={10} /> Locked
                            </span>
                          )}
                        </div>
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
