import React, { useState, useEffect } from "react";
import { AlertTriangle, Filter, Search } from "lucide-react";
import { atRiskApi, AtRiskStudentRow } from "../../services/atRisk";
import { useApp } from "../../context/AppContext";

const RISK_BADGES: Record<string, string> = {
  at_risk: "bg-red-100 text-red-700 border-red-200",
  needs_monitoring: "bg-amber-100 text-amber-700 border-amber-200",
  on_track: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const RISK_LABELS: Record<string, string> = {
  at_risk: "At-Risk",
  needs_monitoring: "Needs Monitoring",
  on_track: "On Track",
};

export function AtRiskView() {
  const { showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<AtRiskStudentRow[]>([]);
  const [filterRisk, setFilterRisk] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    atRiskApi.list()
      .then(setStudents)
      .catch(err => showToast("error", "Failed to load data: " + (err.detail?.error || err.message)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter(s => {
    const matchSearch = s.student_name.toLowerCase().includes(searchQuery.toLowerCase()) || s.lrn.includes(searchQuery);
    const matchRisk = filterRisk === "all" || s.risk_level === filterRisk;
    return matchSearch && matchRisk;
  });

  const counts = {
    at_risk: students.filter(s => s.risk_level === "at_risk").length,
    needs_monitoring: students.filter(s => s.risk_level === "needs_monitoring").length,
    on_track: students.filter(s => s.risk_level === "on_track").length,
  };

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
          <p className="text-gray-400 text-sm font-medium">Loading at-risk data...</p>
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
            <AlertTriangle size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">At-Risk Students</h2>
            <p className="text-gray-500 text-sm">Read-only view of AI-detected at-risk classifications</p>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-red-600 uppercase tracking-[0.06em]">At-Risk</span>
            <span className="w-3 h-3 rounded-full bg-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-700">{counts.at_risk}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-[0.06em]">Needs Monitoring</span>
            <span className="w-3 h-3 rounded-full bg-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-700">{counts.needs_monitoring}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-[0.06em]">On Track</span>
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-700">{counts.on_track}</p>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by name or LRN..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-3 focus:ring-violet-100 focus:border-violet-400 bg-white" />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={13} className="text-gray-400" />
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.06em]">Risk Level:</span>
          {["all", "at_risk", "needs_monitoring", "on_track"].map(r => (
            <button key={r} onClick={() => setFilterRisk(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterRisk === r ? "bg-violet-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {r === "all" ? "All" : RISK_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80">
              <tr>
                {["Student", "LRN", "Grade", "Section", "Risk Level", "Trend"].map(h => (
                  <th key={h} className="text-left px-5 py-3.5">
                    <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">{h}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-14 text-center text-gray-400 text-sm">No students found.</td></tr>
              ) : filtered.map((s, idx) => (
                <tr key={s.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-violet-50/50 transition-colors`}>
                  <td className="px-5 py-3.5 font-medium text-gray-800">{s.student_name}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-gray-500">{s.lrn}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{s.grade_level}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{s.section_name}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${RISK_BADGES[s.risk_level]}`}>
                      {RISK_LABELS[s.risk_level]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm">
                    <span className={`font-semibold ${s.trend === "declining" ? "text-red-600" : s.trend === "stable" ? "text-amber-600" : "text-emerald-600"}`}>
                      {s.trend.charAt(0).toUpperCase() + s.trend.slice(1)}
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
