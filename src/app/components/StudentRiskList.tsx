import React, { useState, useEffect, useMemo } from "react";
import { AlertTriangle, CheckCircle, Clock, Minus, Search, TrendingDown, TrendingUp, Brain } from "lucide-react";
import { atRiskApi, RiskTrendResponse } from "../services/atRisk";
import { useApp } from "../context/AppContext";

const RISK_CONFIG: Record<string, { chip: string; dot: string; count: string }> = {
  at_risk: {
    chip: "bg-red-50 text-red-700 border-red-200/50",
    dot: "bg-red-500",
    count: "text-red-600",
  },
  needs_monitoring: {
    chip: "bg-amber-50 text-amber-700 border-amber-200/50",
    dot: "bg-amber-500",
    count: "text-amber-600",
  },
  on_track: {
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200/50",
    dot: "bg-emerald-500",
    count: "text-emerald-600",
  },
  no_data: {
    chip: "bg-gray-50 text-gray-500 border-gray-200/50",
    dot: "bg-gray-400",
    count: "text-gray-500",
  },
};

const RISK_LABEL: Record<string, string> = {
  at_risk: "At-Risk",
  needs_monitoring: "Needs Monitoring",
  on_track: "On Track",
  no_data: "No Data",
};

const FILTERS: { key: "All" | "at_risk" | "needs_monitoring" | "on_track" | "no_data"; label: string }[] = [
  { key: "All", label: "All" },
  { key: "at_risk", label: "At-Risk" },
  { key: "needs_monitoring", label: "Needs Monitoring" },
  { key: "on_track", label: "On Track" },
  { key: "no_data", label: "No Data" },
];

type RiskFilter = (typeof FILTERS)[number]["key"];

function TrendCell({ trend }: { trend: string }) {
  if (trend === "declining")
    return (
      <span className="inline-flex items-center gap-1.5 text-red-600">
        <TrendingDown size={13} /> <span className="text-xs font-medium">Declining</span>
      </span>
    );
  if (trend === "improving")
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-600">
        <TrendingUp size={13} /> <span className="text-xs font-medium">Improving</span>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-gray-400">
      <Minus size={13} /> <span className="text-xs font-medium">Stable</span>
    </span>
  );
}

/**
 * Live linear-regression at-risk list (GET /api/at-risk/trends), shared by the
 * Registrar, Teacher, and Principal at-risk pages. Always fresh — recomputed
 * on-the-fly from quarterly general averages, no manual "run" needed.
 */
export function StudentRiskList({ schoolYearId }: { schoolYearId?: number }) {
  const { showToast } = useApp();
  const [data, setData] = useState<RiskTrendResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RiskFilter>("All");
  const [query, setQuery] = useState("");

  useEffect(() => {
    setLoading(true);
    atRiskApi
      .trends(schoolYearId ? { school_year_id: schoolYearId } : undefined)
      .then(setData)
      .catch(err => showToast("error", "Failed to load at-risk data: " + (err.detail?.error || err.message)))
      .finally(() => setLoading(false));
  }, [schoolYearId]);

  const students = data?.students ?? [];
  const summary = data?.summary;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter(s => {
      const matchRisk = filter === "All" || (s.risk_level ?? "no_data") === filter;
      const matchQuery =
        q === "" || s.student_name.toLowerCase().includes(q) || (s.lrn ?? "").toLowerCase().includes(q);
      return matchRisk && matchQuery;
    });
  }, [students, filter, query]);

  const cards = [
    { key: "at_risk", label: "At-Risk", icon: AlertTriangle, iconBg: "bg-red-100", iconColor: "text-red-600", count: summary?.at_risk ?? 0, sub: "Immediate attention" },
    { key: "needs_monitoring", label: "Needs Monitoring", icon: Clock, iconBg: "bg-amber-100", iconColor: "text-amber-600", count: summary?.needs_monitoring ?? 0, sub: "Declining trend" },
    { key: "on_track", label: "On Track", icon: CheckCircle, iconBg: "bg-emerald-100", iconColor: "text-emerald-600", count: summary?.on_track ?? 0, sub: "Performing well" },
    { key: "no_data", label: "No Data", icon: Minus, iconBg: "bg-gray-100", iconColor: "text-gray-500", count: summary?.no_data ?? 0, sub: "No grades encoded" },
  ];

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <svg className="animate-spin w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <p className="text-gray-400 text-sm font-medium">Loading at-risk data...</p>
      </div>
    );
  }

  if (!summary || students.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
          <Brain size={28} className="text-gray-300" />
        </div>
        <p className="text-gray-500 text-sm font-semibold">No at-risk data available</p>
        <p className="text-gray-400 text-xs mt-1">
          Classifications appear automatically once quarterly grades are encoded for enrolled students.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.key} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">{c.label}</span>
              <div className={`w-8 h-8 rounded-xl ${c.iconBg} flex items-center justify-center`}>
                <c.icon size={14} className={c.iconColor} />
              </div>
            </div>
            <p className={`text-2xl font-bold tracking-[-0.02em] ${RISK_CONFIG[c.key].count}`}>{c.count}</p>
            <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Search + filter */}
        <div className="px-6 pt-4 pb-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" placeholder="Search by name or LRN..."
              value={query} onChange={e => setQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400 bg-white"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map(chip => (
              <button
                key={chip.key}
                onClick={() => setFilter(chip.key)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 border ${
                  filter === chip.key
                    ? chip.key === "at_risk"
                      ? "bg-red-50 text-red-700 border-red-200 shadow-sm"
                      : chip.key === "needs_monitoring"
                        ? "bg-amber-50 text-amber-700 border-amber-200 shadow-sm"
                        : chip.key === "on_track"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm"
                          : chip.key === "no_data"
                            ? "bg-gray-100 text-gray-600 border-gray-200 shadow-sm"
                            : "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
          <span className="ml-auto text-[11px] text-gray-400 hidden lg:inline">Live — recomputed from quarterly averages</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead className="bg-gray-50/80">
              <tr>
                {["Student", "Grade", "Section", "LRN", "Current Avg", "Slope", "Projected", "Trend", "Classification"].map(h => (
                  <th key={h} className="px-4 py-3.5 text-left">
                    <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">{h}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((s, idx) => {
                const riskKey = s.risk_level ?? "no_data";
                const cfg = RISK_CONFIG[riskKey];
                return (
                  <tr key={s.student_id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-indigo-50/50 transition-colors duration-150`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-700 text-xs font-bold flex-shrink-0 shadow-sm">
                          {s.student_name.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-gray-900 tracking-[-0.01em]">{s.student_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">Grade {s.grade_level}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{s.section_name || "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{s.lrn}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs font-mono text-gray-600">{s.current_average != null ? s.current_average.toFixed(2) : "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.slope != null ? (
                        <span className={`text-xs font-mono font-semibold ${s.slope < 0 ? "text-red-500" : s.slope > 0 ? "text-emerald-600" : "text-gray-400"}`}>
                          {s.slope > 0 ? "+" : ""}{s.slope.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs font-mono text-gray-600">{s.projected != null ? s.projected.toFixed(2) : "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <TrendCell trend={s.trend} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${cfg.chip}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {RISK_LABEL[riskKey]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="p-10 text-center text-gray-400 text-sm">No students match the selected filter.</div>
        )}
      </div>
    </div>
  );
}
