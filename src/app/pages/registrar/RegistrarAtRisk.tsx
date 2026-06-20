import React, { useState, useEffect } from "react";
import { Brain, AlertTriangle, CheckCircle, Clock, TrendingDown, TrendingUp, Info } from "lucide-react";
import { atRiskApi, AtRiskStudentRow } from "../../services/atRisk";
import { useApp } from "../../context/AppContext";

const RISK_CONFIG: Record<string, { color: string; dot: string }> = {
  at_risk: { color: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" },
  needs_monitoring: { color: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  on_track: { color: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500" },
};

const RISK_LABEL: Record<string, string> = {
  at_risk: "At-Risk",
  needs_monitoring: "Needs Monitoring",
  on_track: "On Track",
};

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
      <div className="space-y-5 animate-pulse">
        <div className="h-16 bg-gray-200 rounded-xl" />
        <div className="h-12 bg-gray-200 rounded-xl" />
        <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}</div>
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <Brain size={20} className="text-violet-700" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800">At-Risk Students — System-Wide View</h2>
            <p className="text-gray-500 text-sm">AI-generated risk classifications across all grade levels and sections</p>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex gap-3">
        <Info size={17} className="text-violet-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-violet-700 leading-relaxed">
          This panel shows the <strong>AI-generated at-risk classifications</strong> for all students across all sections, as computed by the Linear Regression predictive model.
          Classifications are updated each time a teacher runs the prediction model from their portal. Red badges indicate students requiring immediate attention.
        </p>
      </div>

      {/* Summary cards */}
      {predictions.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-red-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1"><p className="text-xs text-gray-500">At-Risk</p><AlertTriangle size={14} className="text-red-500" /></div>
            <p className="text-2xl font-bold text-red-600">{atRiskCount}</p>
            <p className="text-xs text-red-400 mt-1">Requires immediate action</p>
          </div>
          <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1"><p className="text-xs text-gray-500">Needs Monitoring</p><Clock size={14} className="text-amber-500" /></div>
            <p className="text-2xl font-bold text-amber-600">{monitorCount}</p>
            <p className="text-xs text-amber-400 mt-1">Declining trend</p>
          </div>
          <div className="bg-white rounded-xl border border-green-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1"><p className="text-xs text-gray-500">On Track</p><CheckCircle size={14} className="text-green-500" /></div>
            <p className="text-2xl font-bold text-green-600">{onTrackCount}</p>
            <p className="text-xs text-green-400 mt-1">Performing well</p>
          </div>
        </div>
      )}

      {/* Table */}
      {predictions.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-100 px-5 pt-4 gap-2">
            {(["All", "at_risk", "needs_monitoring", "on_track"] as RiskFilter[]).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition mb-3 ${filter === f ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {f === "All" ? "All" : RISK_LABEL[f]}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Section</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">LRN</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Q1</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Q2</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Q3</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Trend</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Risk Score</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Classification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(s => {
                  const cfg = RISK_CONFIG[s.risk_level] || RISK_CONFIG.on_track;
                  const trendIcon = s.trend === "declining" ? "down" : s.trend === "improving" ? "up" : "stable";
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/60">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                          <span className="font-medium text-gray-700">{s.student_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{s.section_name}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs font-mono">{s.lrn}</td>
                      <td className="px-4 py-3 text-center text-xs font-mono">{s.q1_average ?? "—"}</td>
                      <td className="px-4 py-3 text-center text-xs font-mono">{s.q2_average ?? "—"}</td>
                      <td className="px-4 py-3 text-center text-xs font-mono">{s.q3_average ?? "—"}</td>
                      <td className="px-4 py-3 text-center">
                        {trendIcon === "down" ? <TrendingDown size={14} className="text-red-500 mx-auto" />
                          : trendIcon === "up" ? <TrendingUp size={14} className="text-green-500 mx-auto" />
                          : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-16 bg-gray-100 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${s.risk_score >= 85 ? "bg-green-500" : s.risk_score >= 70 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${s.risk_score}%` }} />
                          </div>
                          <span className="text-xs font-bold text-gray-700">{s.risk_score}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>{RISK_LABEL[s.risk_level]}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">No students match the selected filter.</div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Brain size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No predictions available yet.</p>
          <p className="text-gray-400 text-sm mt-1">Ask teachers to run the prediction model from their portal first.</p>
        </div>
      )}
    </div>
  );
}
