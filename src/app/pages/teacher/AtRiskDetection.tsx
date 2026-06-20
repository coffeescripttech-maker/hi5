import React, { useState, useEffect } from "react";
import { Brain, AlertTriangle, CheckCircle, Clock, TrendingDown, TrendingUp, Info, Zap } from "lucide-react";
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

export function AtRiskDetection() {
  const { showToast } = useApp();
  const [predictions, setPredictions] = useState<AtRiskStudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RiskFilter>("All");
  const [selected, setSelected] = useState<AtRiskStudentRow | null>(null);
  const [running, setRunning] = useState(false);
  const [schoolYearId, setSchoolYearId] = useState<number>(0);

  useEffect(() => {
    atRiskApi.list()
      .then(data => setPredictions(data))
      .catch(() => {})
      .finally(() => setLoading(false));

    // Try to get current school year for predictions
    import("../../services/schoolYears").then(({ schoolYearsApi }) =>
      schoolYearsApi.list().then(sys => {
        const current = sys.find(sy => sy.is_current === 1);
        if (current) setSchoolYearId(current.id);
      })
    ).catch(() => {});
  }, []);

  const filtered = filter === "All" ? predictions : predictions.filter(s => s.risk_level === filter);

  const atRiskCount = predictions.filter(s => s.risk_level === "at_risk").length;
  const monitorCount = predictions.filter(s => s.risk_level === "needs_monitoring").length;
  const onTrackCount = predictions.filter(s => s.risk_level === "on_track").length;

  const handleRunModel = async () => {
    if (!schoolYearId) {
      showToast("error", "No active school year found. Cannot run prediction.");
      return;
    }
    setRunning(true);
    try {
      await atRiskApi.predict({ school_year_id: schoolYearId });
      showToast("success", "Prediction model ran successfully.");
      const updated = await atRiskApi.list();
      setPredictions(updated);
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Prediction failed");
    } finally {
      setRunning(false);
    }
  };

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <Brain size={20} className="text-violet-700" />
            </div>
            <div>
              <h2 className="font-bold text-gray-800">AI-Powered Student At-Risk Detection</h2>
              <p className="text-gray-500 text-sm">Linear Regression model analyzing Q1–Q3 grade trajectories</p>
            </div>
          </div>
          <button onClick={handleRunModel} disabled={running}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white px-4 py-2 rounded-xl text-sm font-semibold transition">
            {running ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Running...</> : <><Zap size={14} /> Run Prediction</>}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex gap-3">
        <Info size={17} className="text-violet-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-violet-800 mb-1">How the AI Model Works</p>
          <p className="text-violet-700 text-xs leading-relaxed">
            The system uses a <strong>Linear Regression model</strong> trained on historical quarterly grade data stored in the database.
            It analyzes each student's Q1, Q2, and Q3 grade trajectory to project their Q4 outcome and compute a <strong>Risk Score (0–100)</strong>.
            Scores below 70 are flagged as <strong className="text-red-600">At-Risk</strong>, 70–84 as <strong className="text-amber-600">Needs Monitoring</strong>, and 85+ as <strong className="text-green-600">On Track</strong>.
            Results are also visible in the Registrar's dashboard.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      {predictions.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-red-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1"><p className="text-xs text-gray-500">At-Risk</p><AlertTriangle size={14} className="text-red-500" /></div>
            <p className="text-2xl font-bold text-red-600">{atRiskCount}</p>
            <p className="text-xs text-red-400 mt-1">Immediate intervention needed</p>
          </div>
          <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1"><p className="text-xs text-gray-500">Needs Monitoring</p><Clock size={14} className="text-amber-500" /></div>
            <p className="text-2xl font-bold text-amber-600">{monitorCount}</p>
            <p className="text-xs text-amber-400 mt-1">Declining trend detected</p>
          </div>
          <div className="bg-white rounded-xl border border-green-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1"><p className="text-xs text-gray-500">On Track</p><CheckCircle size={14} className="text-green-500" /></div>
            <p className="text-2xl font-bold text-green-600">{onTrackCount}</p>
            <p className="text-xs text-green-400 mt-1">Performing as expected</p>
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
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Q1</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Q2</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Q3</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Trend</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Risk Score</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Classification</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Detail</th>
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
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => setSelected(s)}
                          className="text-xs bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 px-2.5 py-1 rounded-lg transition">
                          View
                        </button>
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
          <p className="text-gray-400 text-sm mt-1">Click "Run Prediction" to analyze student grade trajectories.</p>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className={`p-5 ${selected.risk_level === "at_risk" ? "bg-red-600" : selected.risk_level === "needs_monitoring" ? "bg-amber-500" : "bg-green-600"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-white text-lg">{selected.student_name}</p>
                  <p className="text-white/80 text-xs">{selected.section_name} · Risk Score: {selected.risk_score}/100</p>
                </div>
                <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">{RISK_LABEL[selected.risk_level]}</span>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Grade Trajectory</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Q1", selected.q1_average],
                    ["Q2", selected.q2_average],
                    ["Q3", selected.q3_average],
                  ].map(([q, v]) => (
                    <div key={String(q)} className="bg-gray-50 rounded-lg p-2">
                      <p className="text-xs text-gray-400">{q}</p>
                      <p className="text-xl font-bold text-gray-800">{v ?? "—"}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-violet-800 mb-1">AI Model Recommendation</p>
                <p className="text-xs text-violet-700">
                  {selected.risk_level === "at_risk"
                    ? "Significant declining trend detected. Immediate academic intervention and parent notification are strongly recommended."
                    : selected.risk_level === "needs_monitoring"
                    ? "Gradual decline detected. Targeted remedial support in flagged subjects is recommended."
                    : "Student is performing well. Continue regular monitoring to maintain current trajectory."}
                </p>
              </div>
              <button onClick={() => setSelected(null)}
                className="w-full bg-gray-800 hover:bg-gray-900 text-white py-2.5 rounded-xl text-sm font-semibold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
