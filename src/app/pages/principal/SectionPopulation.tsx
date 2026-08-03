import React, { useState, useEffect } from "react";
import { Layers, PieChart, Users, School } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { sectionsApi, SectionRow } from "../../services/sections";
import { useApp } from "../../context/AppContext";

export function SectionPopulation() {
  const { showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<SectionRow[]>([]);

  useEffect(() => {
    sectionsApi.list()
      .then(setSections)
      .catch(err => showToast("error", "Failed to load sections: " + (err.detail?.error || err.message)))
      .finally(() => setLoading(false));
  }, []);

  const byGrade = [7, 8, 9, 10, 11, 12].map(g => {
    const gradeSections = sections.filter(s => s.grade_level === g);
    const totalCap = gradeSections.reduce((sum, s) => sum + s.capacity, 0);
    const totalCount = gradeSections.reduce((sum, s) => sum + s.current_count, 0);
    return {
      grade: `Grade ${g}`,
      sections: gradeSections.length,
      capacity: totalCap,
      enrolled: totalCount,
      utilization: totalCap > 0 ? Math.round((totalCount / totalCap) * 100) : 0,
    };
  }).filter(g => g.sections > 0);

  const totalCapacity = sections.reduce((sum, s) => sum + s.capacity, 0);
  const totalEnrolled = sections.reduce((sum, s) => sum + s.current_count, 0);
  const overallUtilization = totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;

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
          <p className="text-gray-400 text-sm font-medium">Loading section data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* HEADER */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-violet-500 via-violet-600 to-violet-400" />
        <div className="p-5 sm:p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 shadow-lg shadow-violet-200 flex items-center justify-center flex-shrink-0">
              <PieChart size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">Section Population</h2>
              <p className="text-gray-500 text-sm">Capacity utilization and student distribution across sections</p>
            </div>
          </div>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Total Sections</span>
            <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center"><Layers size={14} className="text-violet-600" /></div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">{sections.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Capacity</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center"><School size={14} className="text-blue-600" /></div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">{totalCapacity}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Enrolled</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center"><Users size={14} className="text-emerald-600" /></div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 tracking-[-0.02em]">{totalEnrolled}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Utilization</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center"><PieChart size={14} className="text-amber-600" /></div>
          </div>
          <p className="text-2xl font-bold text-amber-600 tracking-[-0.02em]">{overallUtilization}%</p>
        </div>
      </div>

      {/* BY GRADE CHART */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 text-sm mb-4">Capacity vs Enrollment by Grade Level</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={byGrade}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="capacity" fill="#e0e7ff" radius={[4, 4, 0, 0]} name="Capacity" />
            <Bar dataKey="enrolled" fill="#6366f1" radius={[4, 4, 0, 0]} name="Enrolled" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* SECTION TABLE */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-sm">All Sections</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80">
              <tr>
                {["Section", "Grade", "Adviser", "Capacity", "Enrolled", "Utilization"].map(h => (
                  <th key={h} className="text-left px-5 py-3.5">
                    <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">{h}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sections.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-14 text-center text-gray-400 text-sm">No sections found.</td></tr>
              ) : sections.map((s, idx) => {
                const pct = s.capacity > 0 ? Math.round((s.current_count / s.capacity) * 100) : 0;
                return (
                  <tr key={s.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-violet-50/50 transition-colors`}>
                    <td className="px-5 py-3.5 font-medium text-gray-800">{s.name}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{s.grade_level}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{s.adviser_name || "—"}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{s.capacity}</td>
                    <td className="px-5 py-3.5 font-semibold text-gray-900">{s.current_count}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-full max-w-[120px] bg-gray-100 rounded-full h-2">
                          <div className={`h-2 rounded-full ${pct > 90 ? "bg-red-500" : pct > 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
