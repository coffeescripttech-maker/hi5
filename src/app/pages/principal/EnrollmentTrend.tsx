import React, { useState, useEffect } from "react";
import { BarChart2, TrendingUp, Users } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { enrollmentsApi, EnrollmentRow } from "../../services/enrollments";
import { useApp } from "../../context/AppContext";

export function EnrollmentTrend() {
  const { showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);

  useEffect(() => {
    enrollmentsApi.list()
      .then(setEnrollments)
      .catch(err => showToast("error", "Failed to load enrollments: " + (err.detail?.error || err.message)))
      .finally(() => setLoading(false));
  }, []);

  const enrolled = enrollments.filter(e => e.status === "enrolled");
  const total = enrolled.length;

  // Group by grade level as a proxy for trend
  const trendData = [7, 8, 9, 10, 11, 12].map(g => ({
    grade: `G${g}`,
    students: enrolled.filter(e => e.grade_level === g).length,
  }));

  const statusCounts = [
    { name: "Enrolled", count: enrollments.filter(e => e.status === "enrolled").length, color: "#9333ea" },
    { name: "Dropped", count: enrollments.filter(e => e.status === "dropped").length, color: "#ef4444" },
    { name: "Transferred", count: enrollments.filter(e => e.status === "transferred").length, color: "#f59e0b" },
  ];

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
          <p className="text-gray-400 text-sm font-medium">Loading enrollment trends...</p>
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
              <BarChart2 size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">Enrollment Trend</h2>
              <p className="text-gray-500 text-sm">Real-time enrollment figures by grade level</p>
            </div>
          </div>
          <span className="bg-purple-100 text-purple-700 text-sm font-bold px-4 py-2 rounded-xl">{total} Active</span>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        {statusCounts.map(sc => (
          <div key={sc.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">{sc.name}</span>
              <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center">
                <Users size={14} className="text-purple-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">{sc.count}</p>
          </div>
        ))}
      </div>

      {/* CHART */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 text-sm mb-4">Enrollment by Grade Level</h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="students" stroke="#9333ea" strokeWidth={3} dot={{ fill: "#9333ea", r: 5 }} name="Students" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* BREAKDOWN TABLE */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-sm">Enrollment Status Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80">
              <tr>
                {["Grade", "Enrolled", "Dropped", "Transferred"].map(h => (
                  <th key={h} className="text-left px-5 py-3.5">
                    <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">{h}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[7, 8, 9, 10, 11, 12].map((g, idx) => (
                <tr key={g} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-purple-50/50 transition-colors`}>
                  <td className="px-5 py-3.5 font-medium text-gray-800">Grade {g}</td>
                  <td className="px-5 py-3.5 font-semibold text-emerald-600">{enrolled.filter(e => e.grade_level === g).length}</td>
                  <td className="px-5 py-3.5 text-red-600">{enrollments.filter(e => e.grade_level === g && e.status === "dropped").length}</td>
                  <td className="px-5 py-3.5 text-amber-600">{enrollments.filter(e => e.grade_level === g && e.status === "transferred").length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
