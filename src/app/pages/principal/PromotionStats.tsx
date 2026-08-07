import React, { useState, useEffect } from "react";
import { GraduationCap, TrendingUp, Users, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { promotionsApi, PromotionRow } from "../../services/promotions";
import { enrollmentsApi, EnrollmentRow } from "../../services/enrollments";
import { useApp } from "../../context/AppContext";

export function PromotionStats() {
  const { showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);

  useEffect(() => {
    Promise.all([
      promotionsApi.list(),
      enrollmentsApi.list(),
    ]).then(([prom, enr]) => {
      setPromotions(prom);
      setEnrollments(enr);
    }).catch(err => {
      showToast("error", "Failed to load data: " + (err.detail?.error || err.message));
    }).finally(() => setLoading(false));
  }, []);

  const totalPromoted = promotions.reduce((sum, p) => sum + p.student_count, 0);
  const totalEnrolled = enrollments.filter(e => e.status === "enrolled").length;
  const retentionRate = totalEnrolled > 0
    ? Math.round(((totalEnrolled - totalPromoted) / totalEnrolled) * 100)
    : 0;

  const promoByGrade = [7, 8, 9, 10, 11].map(g => ({
    grade: `G${g} → G${g + 1}`,
    promoted: promotions.filter(p => p.from_grade_level === g).reduce((sum, p) => sum + p.student_count, 0),
  }));

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
          <p className="text-gray-400 text-sm font-medium">Loading promotion data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* HEADER */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-purple-500 via-purple-600 to-purple-400" />
        <div className="p-5 sm:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-200 flex items-center justify-center flex-shrink-0">
            <GraduationCap size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">Promotion & Retention Statistics</h2>
            <p className="text-gray-500 text-sm">Track student promotion progress and retention rates</p>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Promoted</span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center"><TrendingUp size={14} className="text-purple-600" /></div>
          </div>
          <p className="text-2xl font-bold text-purple-600 tracking-[-0.02em]">{totalPromoted}</p>
          <p className="text-xs text-gray-400 mt-1">students promoted</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Retention Rate</span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center"><RefreshCw size={14} className="text-purple-600" /></div>
          </div>
          <p className="text-2xl font-bold text-purple-600 tracking-[-0.02em]">{retentionRate}%</p>
          <p className="text-xs text-gray-400 mt-1">retained students</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Enrolled</span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center"><Users size={14} className="text-purple-600" /></div>
          </div>
          <p className="text-2xl font-bold text-purple-600 tracking-[-0.02em]">{totalEnrolled}</p>
          <p className="text-xs text-gray-400 mt-1">currently enrolled</p>
        </div>
      </div>

      {/* CHART */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 text-sm mb-4">Students Promoted by Grade Level</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={promoByGrade}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="promoted" fill="#9333ea" radius={[6, 6, 0, 0]} name="Promoted" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* PROMOTION RECORDS TABLE */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-sm">Promotion Records</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80">
              <tr>
                {["School Year", "From", "To", "Students", "Status"].map(h => (
                  <th key={h} className="text-left px-5 py-3.5">
                    <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">{h}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {promotions.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-14 text-center text-gray-400 text-sm">No promotion records found.</td></tr>
              ) : promotions.map((p, idx) => (
                <tr key={p.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-purple-50/50 transition-colors`}>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{p.sy_label}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-800 font-medium">Grade {p.from_grade_level}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-800 font-medium">Grade {p.to_grade_level}</td>
                  <td className="px-5 py-3.5 font-semibold text-gray-900">{p.student_count}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                      p.status === "completed"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}>
                      {p.status === "completed" ? "Completed" : "Pending Review"}
                    </span>
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
