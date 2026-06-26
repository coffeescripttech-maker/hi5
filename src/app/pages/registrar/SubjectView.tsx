import React, { useState, useEffect } from "react";
import { BookOpen, BookMarked, GraduationCap, Clock, SlidersHorizontal, X } from "lucide-react";
import { subjectsApi, SubjectRow } from "../../services/subjects";
import { useApp } from "../../context/AppContext";

const TYPE_COLORS: Record<string, string> = {
  core: "bg-blue-50 text-blue-700 border-blue-200/50",
  applied: "bg-emerald-50 text-emerald-700 border-emerald-200/50",
  specialized: "bg-violet-50 text-violet-700 border-violet-200/50",
};

const TYPE_LABEL: Record<string, string> = {
  core: "Core",
  applied: "Applied",
  specialized: "Specialized",
};

const GRADES = [7, 8, 9, 10, 11, 12] as const;

export function SubjectView() {
  const { showToast } = useApp();
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterGrade, setFilterGrade] = useState<number | "All">("All");

  useEffect(() => {
    subjectsApi.list()
      .then(setSubjects)
      .catch(err => showToast("error", "Failed to load subjects: " + (err.detail?.error || err.message)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = subjects.filter(s => filterGrade === "All" || s.grade_level === filterGrade);
  const coreCount = subjects.filter(s => s.subject_type === "core").length;
  const appliedCount = subjects.filter(s => s.subject_type === "applied").length;
  const specializedCount = subjects.filter(s => s.subject_type === "specialized").length;

  const byGrade = GRADES
    .map(g => ({ grade: g, subjects: filtered.filter(s => s.grade_level === g) }))
    .filter(g => g.subjects.length > 0);

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
          <p className="text-gray-400 text-sm font-medium">Loading subject directory...</p>
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
            <BookOpen size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">Subject Directory</h2>
            <p className="text-gray-500 text-sm">View-only reference of subjects per grade level configured by the Administrator</p>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-xs text-gray-400 bg-gray-50/80 px-3.5 py-2 rounded-xl border border-gray-100">
            <GraduationCap size={14} className="text-indigo-500" />
            <span className="font-semibold text-gray-600">{subjects.length}</span> subjects
            <span className="text-gray-300">|</span>
            <span className="text-indigo-600 font-medium">{GRADES.filter(g => subjects.some(s => s.grade_level === g)).length}</span> grades
          </div>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Total Subjects</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
              <BookOpen size={14} className="text-indigo-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">{subjects.length}</p>
          <p className="text-xs text-gray-400 mt-1">Across all grades</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Core</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
              <BookMarked size={14} className="text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">{coreCount}</p>
          <p className="text-xs text-gray-400 mt-1">Required subjects</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Applied</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
              <BookMarked size={14} className="text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">{appliedCount}</p>
          <p className="text-xs text-gray-400 mt-1">Contextualized subjects</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Specialized</span>
            <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
              <BookMarked size={14} className="text-violet-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">{specializedCount}</p>
          <p className="text-xs text-gray-400 mt-1">Track-specific</p>
        </div>
      </div>

      {/* ── GRADE FILTER ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="border-t-0 px-5 sm:px-6 py-4">
          <div className="flex items-center gap-2 mb-3">
            <SlidersHorizontal size={13} className="text-gray-400" />
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.04em]">Filter by Grade</span>
            {filterGrade !== "All" && (
              <button
                onClick={() => setFilterGrade("All")}
                className="ml-auto text-[11px] font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded-lg transition flex items-center gap-1"
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["All", ...GRADES] as (number | "All")[]).map(g => (
              <button
                key={String(g)}
                onClick={() => setFilterGrade(g)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 border ${
                  filterGrade === g
                    ? "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                {g === "All" ? "All Grades" : `Grade ${g}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── SUBJECT TABLES ── */}
      {byGrade.length > 0 ? byGrade.map(({ grade, subjects: gradeSubs }) => (
        <div key={grade} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="bg-indigo-50 text-indigo-700 text-[11px] font-semibold px-3 py-1 rounded-full border border-indigo-100">
                Grade {grade}
              </span>
              <span className="text-xs text-gray-400 font-medium">
                {gradeSubs.length} subject{gradeSubs.length !== 1 && "s"}
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
              <Clock size={12} />
              {gradeSubs.reduce((a, s) => a + s.hours_per_week, 0)} hrs/week total
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="bg-gray-50/80">
                <tr>
                  {[
                    { key: "name", label: "Subject Name" },
                    { key: "type", label: "Type" },
                    { key: "hours", label: "Hours / Week" },
                  ].map(col => (
                    <th key={col.key} className="px-6 py-3.5 text-left">
                      <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">
                        {col.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {gradeSubs.map((s, idx) => (
                  <tr
                    key={s.id}
                    className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-indigo-50/50 transition-colors duration-150`}
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                          {s.name.charAt(0)}
                        </div>
                        <p className="text-sm font-semibold text-gray-900 tracking-[-0.01em]">{s.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-block text-[11px] px-2.5 py-1 rounded-full font-medium border ${TYPE_COLORS[s.subject_type]}`}>
                        {TYPE_LABEL[s.subject_type]}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Clock size={13} className="text-gray-300" />
                        <span className="text-sm text-gray-700 font-medium">{s.hours_per_week} hrs</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <BookOpen size={28} className="text-gray-300" />
          </div>
          <p className="text-gray-500 text-sm font-semibold">No subjects found</p>
          <p className="text-gray-400 text-xs mt-1">
            {filterGrade === "All"
              ? "No subject records available."
              : "No subjects configured for this grade level."}
          </p>
        </div>
      )}
    </div>
  );
}
