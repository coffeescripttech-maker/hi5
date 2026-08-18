import React, { useState, useEffect } from "react";
import { TrendingUp, Users, School } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { enrollmentsApi, EnrollmentRow } from "../../services/enrollments";
import { useApp } from "../../context/AppContext";

const PROGRAMS = [
  { key: "regular", label: "Regular" },
  { key: "ste", label: "STE" },
  { key: "spfl", label: "SPFL" },
  { key: "open_high", label: "Open High" },
  { key: "als_shs", label: "ALS-SHS" },
];

const gradeLevels = [7, 8, 9, 10, 11, 12];

export function EnrollmentFigures() {
  const { showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [activeProgram, setActiveProgram] = useState<string>("all");

  useEffect(() => {
    enrollmentsApi.list()
      .then(setEnrollments)
      .catch(err => showToast("error", "Failed to load enrollments: " + (err.detail?.error || err.message)))
      .finally(() => setLoading(false));
  }, []);

  const enrolled = enrollments.filter(e => e.status === "enrolled");
  const total = enrolled.length;

  const filtered = activeProgram === "all"
    ? enrolled
    : enrolled.filter(e => e.program === activeProgram);

  const byGrade = gradeLevels.map(g => ({
    grade: `Grade ${g}`,
    count: filtered.filter(e => e.grade_level === g).length,
  }));

  const byProgram = PROGRAMS.map(p => ({
    name: p.label,
    count: enrolled.filter(e => e.program === p.key).length,
  })).filter(p => p.count > 0);

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
          <p className="text-gray-400 text-sm font-medium">Loading enrollment data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto px-3 sm:px-0">
      {/* HEADER */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-purple-500 via-purple-600 to-purple-400" />
        <div className="p-5 sm:p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-200 flex items-center justify-center flex-shrink-0">
              <TrendingUp size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">Enrollment Figures</h2>
              <p className="text-gray-500 text-sm">Per-grade and per-program enrollment breakdown</p>
            </div>
          </div>
          <span className="bg-purple-100 text-purple-700 text-sm font-bold px-4 py-2 rounded-xl">{total} Total Enrolled</span>
        </div>
      </div>

      {/* PROGRAM FILTERS */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-2 flex-wrap">
        <School size={13} className="text-gray-400" />
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.06em] mr-1">Program:</span>
        <button onClick={() => setActiveProgram("all")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeProgram === "all" ? "bg-purple-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>All</button>
        {PROGRAMS.map(p => (
          <button key={p.key} onClick={() => setActiveProgram(p.key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeProgram === p.key ? "bg-purple-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{p.label}</button>
        ))}
      </div>

      {/* BY GRADE */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 text-sm mb-4">Students per Grade Level</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={byGrade}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#9333ea" radius={[6, 6, 0, 0]} name="Students" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* BY PROGRAM */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-sm">Enrollment by Program</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80">
              <tr>
                {["Program", "Students", "Percentage"].map(h => (
                  <th key={h} className="text-left px-5 py-3.5">
                    <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">{h}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {byProgram.map((p, idx) => (
                <tr key={p.name} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-purple-50/50 transition-colors`}>
                  <td className="px-5 py-3.5 font-medium text-gray-800">{p.name}</td>
                  <td className="px-5 py-3.5 font-semibold text-gray-900">{p.count}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-full max-w-[200px] bg-gray-100 rounded-full h-2">
                        <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${total > 0 ? (p.count / total) * 100 : 0}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{total > 0 ? Math.round((p.count / total) * 100) : 0}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
