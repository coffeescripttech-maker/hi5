import React, { useState, useEffect } from "react";
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { atRiskApi, RiskTrendResponse } from "../services/atRisk";

const RISK_CONFIG: Record<string, { chip: string; text: string; bar: string; dot: string }> = {
  on_track: {
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
    text: "text-emerald-700",
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
  },
  needs_monitoring: {
    chip: "bg-amber-50 text-amber-700 border-amber-200/60",
    text: "text-amber-700",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
  },
  at_risk: {
    chip: "bg-red-50 text-red-700 border-red-200/60",
    text: "text-red-700",
    bar: "bg-red-500",
    dot: "bg-red-500",
  },
  no_data: {
    chip: "bg-gray-50 text-gray-500 border-gray-200/60",
    text: "text-gray-500",
    bar: "bg-gray-300",
    dot: "bg-gray-400",
  },
};

const RISK_LABEL: Record<string, string> = {
  on_track: "On Track",
  needs_monitoring: "Needs Monitoring",
  at_risk: "At-Risk",
  no_data: "No Data",
};

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "improving") return <TrendingUp size={12} className="text-emerald-500" />;
  if (trend === "declining") return <TrendingDown size={12} className="text-red-500" />;
  return <Minus size={12} className="text-gray-400" />;
}

/**
 * Student Risk Overview panel — color-coded counts + top students needing
 * attention, from the live linear-regression classification
 * (GET /api/at-risk/trends). Shared by the Registrar and Principal dashboards.
 */
export function StudentRiskOverview({ schoolYearId }: { schoolYearId?: number }) {
  const [data, setData] = useState<RiskTrendResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    atRiskApi
      .trends(schoolYearId ? { school_year_id: schoolYearId } : undefined)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [schoolYearId]);

  const summary = data?.summary;
  const topRisk =
    data?.students.filter(
      s => s.risk_level === "at_risk" || s.risk_level === "needs_monitoring"
    ).slice(0, 8) ?? [];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
          <Activity size={14} className="text-indigo-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-800">Student Risk Overview</h3>
          <p className="text-[11px] text-gray-400">Linear regression on quarterly grade trends</p>
        </div>
      </div>

      {loading ? (
        <div className="h-24 flex items-center justify-center">
          <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      ) : !summary ? (
        <p className="text-sm text-gray-400 py-8 text-center">No data available.</p>
      ) : (
        <>
          {/* Count cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { key: "on_track", count: summary.on_track },
              { key: "needs_monitoring", count: summary.needs_monitoring },
              { key: "at_risk", count: summary.at_risk },
              { key: "no_data", count: summary.no_data },
            ].map(c => (
              <div key={c.key} className="rounded-xl border border-gray-100 bg-gray-50/40 p-3.5">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
                  {RISK_LABEL[c.key]}
                </p>
                <p className={`text-2xl font-bold ${RISK_CONFIG[c.key].text}`}>{c.count}</p>
                <div className="h-1 rounded-full bg-gray-200 mt-2 overflow-hidden">
                  <div className={`h-full w-full rounded-full ${RISK_CONFIG[c.key].bar}`} />
                </div>
              </div>
            ))}
          </div>

          {/* Top at-risk students */}
          {topRisk.length > 0 && (
            <div className="mt-5">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em] mb-2">
                Students Needing Attention
              </p>
              <div className="divide-y divide-gray-50">
                {topRisk.map(s => (
                  <div key={s.student_id} className="py-2.5 flex items-center gap-3">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${RISK_CONFIG[s.risk_level ?? "no_data"].dot}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{s.student_name}</p>
                      <p className="text-[11px] text-gray-400 truncate">
                        <span className="font-mono">{s.lrn}</span> · {s.section_name || "No section"} · Gr{" "}
                        {s.grade_level}
                      </p>
                    </div>
                    <TrendIcon trend={s.trend} />
                    <span className="text-sm font-semibold text-gray-700 w-10 text-right">
                      {s.current_average != null ? s.current_average.toFixed(2) : "—"}
                    </span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${RISK_CONFIG[s.risk_level ?? "no_data"].chip}`}
                    >
                      {RISK_LABEL[s.risk_level ?? "no_data"]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
