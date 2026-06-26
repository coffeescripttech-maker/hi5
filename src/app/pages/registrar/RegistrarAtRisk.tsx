import React, { useState, useEffect } from "react";
import { Brain, AlertTriangle, CheckCircle, Clock, TrendingDown, TrendingUp, Info, GraduationCap } from "lucide-react";
import { atRiskApi, AtRiskStudentRow } from "../../services/atRisk";
import { useApp } from "../../context/AppContext";

const RISK_CONFIG: Record<string, { color: string; dot: string }> = {
  at_risk: { color: "bg-red-50 text-red-700 border-red-200/50", dot: "bg-red-500" },
  needs_monitoring: { color: "bg-amber-50 text-amber-700 border-amber-200/50", dot: "bg-amber-500" },
  on_track: { color: "bg-emerald-50 text-emerald-700 border-emerald-200/50", dot: "bg-emerald-500" },
};

const RISK_LABEL: Record<string, string> = {
  at_risk: "At-Risk",
  needs_monitoring: "Needs Monitoring",
  on_track: "On Track",
};

const FILTER_CHIPS: { key: "All" | "at_risk" | "needs_monitoring" | "on_track"; label: string }[] = [
  { key: "All", label: "All" },
  { key: "at_risk", label: "At-Risk" },
  { key: "needs_monitoring", label: "Needs Monitoring" },
  { key: "on_track", label: "On Track" },
];

type RiskFilter = "All" | "at_risk" | "needs_monitoring" | "on_track";

export function RegistrarAtRisk() {
  const { showToast } = useApp();
  const [predictions, setPredictions] = useState<AtRiskStudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RiskFilter>("All");

  useEffect(() => {
    atRiskApi.list()
      .then(setPredictions)
      .catch(err => showToast("error", "Failed to load at-risk data: " + (err.detail?.error || err.message)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "All" ? predictions : predictions.filter(s => s.risk_level === filter);
  const atRiskCount = predictions.filter(s => s.risk_level === "at_risk").length;
  const monitorCount = predictions.filter(s => s.risk_level === "needs_monitoring").length;
  const onTrackCount = predictions.filter(s => s.risk_level === "on_track").length;

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
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400" />
        <div className="p-5 sm:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-200 flex items-center justify-center flex-shrink-0">
            <Brain size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">At-Risk Students — System-Wide View</h2>
            <p className="text-gray-500 text-sm">AI-generated risk classifications across all grade levels and sections</p>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-xs text-gray-400 bg-gray-50/80 px-3.5 py-2 rounded-xl border border-gray-100">
            <GraduationCap size={14} className="text-indigo-500" />
            <span className="font-semibold text-gray-600">{predictions.length}</span> students
            <span className="text-gray-300">|</span>
            <span className="text-red-600 font-medium">{atRiskCount}</span> at-risk
          </div>
        </div>
      </div>

      {/* ── Info Banner ── */}
      <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl px-5 py-4 flex gap-3">
        <Info size={18} className="text-indigo-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-indigo-700 leading-relaxed">
          This panel shows the <strong>AI-generated at-risk classifications</strong> for all students across all sections, as computed by the Linear Regression predictive model.
          Classifications are updated each time a teacher runs the prediction model from their portal. Red badges indicate students requiring immediate attention.
        </p>
      </div>

      {/* ── Summary Cards ── */}
      {predictions.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">At-Risk</span>
              <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertTriangle size={14} className="text-red-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">{atRiskCount}</p>
            <p className="text-xs text-gray-400 mt-1">Requires immediate action</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Needs Monitoring</span>
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock size={14} className="text-amber-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">{monitorCount}</p>
            <p className="text-xs text-gray-400 mt-1">Declining trend</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">On Track</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle size={14} className="text-emerald-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">{onTrackCount}</p>
            <p className="text-xs text-gray-400 mt-1">Performing well</p>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      {predictions.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Filter chips */}
          <div className="px-6 pt-4 pb-3 border-b border-gray-100 flex flex-wrap gap-1.5">
            {FILTER_CHIPS.map(chip => (
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
                          : "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-gray-50/80">
                <tr>
                  {[
                    { label: "Student", key: "student" },
                    { label: "Section", key: "section" },
                    { label: "LRN", key: "lrn" },
                    { label: "Q1", key: "q1" },
                    { label: "Q2", key: "q2" },
                    { label: "Q3", key: "q3" },
                    { label: "Trend", key: "trend" },
                    { label: "Risk Score", key: "score" },
                    { label: "Classification", key: "class" },
                  ].map(col => (
                    <th key={col.key} className="px-4 py-3.5 text-left">
                      <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">{col.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((s, idx) => {
                  const cfg = RISK_CONFIG[s.risk_level] || RISK_CONFIG.on_track;
                  const trendIcon = s.trend === "declining" ? "down" : s.trend === "improving" ? "up" : "stable";
                  return (
                    <tr key={s.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-indigo-50/50 transition-colors duration-150`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-700 text-xs font-bold flex-shrink-0 shadow-sm">
                            {(s.student_name || "?").charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-gray-900 tracking-[-0.01em]">{s.student_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{s.section_name}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">{s.lrn}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-mono text-gray-600">{s.q1_average ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-mono text-gray-600">{s.q2_average ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-mono text-gray-600">{s.q3_average ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {trendIcon === "down" ? (
                          <TrendingDown size={15} className="text-red-500 mx-auto" />
                        ) : trendIcon === "up" ? (
                          <TrendingUp size={15} className="text-emerald-500 mx-auto" />
                        ) : (
                          <span className="text-gray-400 text-xs font-medium">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-gray-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all ${s.risk_score >= 85 ? "bg-emerald-500" : s.risk_score >= 70 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${s.risk_score}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-gray-700">{s.risk_score}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${cfg.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {RISK_LABEL[s.risk_level]}
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
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <Brain size={28} className="text-gray-300" />
          </div>
          <p className="text-gray-500 text-sm font-semibold">No predictions available yet</p>
          <p className="text-gray-400 text-xs mt-1">Ask teachers to run the prediction model from their portal first.</p>
        </div>
      )}
    </div>
  );
}
