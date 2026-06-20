import React, { useState, useEffect } from "react";
import { BookOpen, Eye } from "lucide-react";
import { subjectsApi, SubjectRow } from "../../services/subjects";
import { useApp } from "../../context/AppContext";

const TYPE_COLORS: Record<string, string> = {
  core: "bg-blue-100 text-blue-700 border-blue-200",
  applied: "bg-emerald-100 text-emerald-700 border-emerald-200",
  specialized: "bg-violet-100 text-violet-700 border-violet-200",
};

const TYPE_LABEL: Record<string, string> = {
  core: "Core",
  applied: "Applied",
  specialized: "Specialized",
};

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
  const byGrade = [7, 8, 9, 10, 11, 12]
    .map(g => ({ grade: g, subjects: filtered.filter(s => s.grade_level === g) }))
    .filter(g => g.subjects.length > 0);

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-16 bg-gray-200 rounded-xl" />
        <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}</div>
        <div className="h-12 bg-gray-200 rounded-xl" />
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <BookOpen size={20} className="text-indigo-700" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800">Subject Directory</h2>
            <p className="text-gray-500 text-sm">View-only reference of subjects per grade level configured by the Administrator</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <Eye size={14} className="text-amber-600" />
          <span className="text-amber-700 text-xs font-semibold">View Only</span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-indigo-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Total Subjects</p>
          <p className="text-2xl font-bold text-indigo-700">{subjects.length}</p>
        </div>
        {["core", "applied", "specialized"].map(t => (
          <div key={t} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{TYPE_LABEL[t]}</p>
            <p className="text-2xl font-bold text-gray-700">{subjects.filter(s => s.subject_type === t).length}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-600 font-medium">Filter by Grade:</span>
        {(["All", 7, 8, 9, 10, 11, 12] as (number | "All")[]).map(g => (
          <button key={g} onClick={() => setFilterGrade(g)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterGrade === g ? "bg-indigo-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}>
            {g === "All" ? "All Grades" : `Grade ${g}`}
          </button>
        ))}
      </div>

      {/* Subject tables */}
      {byGrade.length > 0 ? byGrade.map(({ grade, subjects: gradeSubs }) => (
        <div key={grade} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full">Grade {grade}</span>
              <span className="text-xs text-gray-500">{gradeSubs.length} subject(s)</span>
            </div>
            <span className="text-xs text-gray-400">{gradeSubs.reduce((a, s) => a + s.hours_per_week, 0)} hrs/week total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Subject Name", "Type", "Hrs/Week"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {gradeSubs.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/60">
                    <td className="px-5 py-3 font-medium text-gray-800">{s.name}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${TYPE_COLORS[s.subject_type]}`}>{TYPE_LABEL[s.subject_type]}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{s.hours_per_week} hrs</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )) : (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <BookOpen size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No subjects found for the selected grade level.</p>
        </div>
      )}
    </div>
  );
}
