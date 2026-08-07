import React from "react";
import { Brain, Info, Zap } from "lucide-react";
import { StudentRiskList } from "../../components/StudentRiskList";

export function AtRiskDetection() {
  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-400" />
        <div className="p-5 sm:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-200 flex items-center justify-center flex-shrink-0">
            <Brain size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">AI-Powered Student At-Risk Detection</h2>
            <p className="text-gray-500 text-sm">Linear Regression model analyzing quarterly grade trajectories</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400 bg-emerald-50/80 px-3.5 py-2 rounded-xl border border-emerald-100">
            <Zap size={13} className="text-emerald-500" />
            <span className="font-semibold text-emerald-700">Live</span>
            <span className="text-gray-400">·</span>
            <span>auto-updates</span>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl px-5 py-4 flex gap-3">
        <Info size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-emerald-700 leading-relaxed">
          The system fits a <strong>least-squares linear regression</strong> to each student's quarterly general averages and
          projects their final grade. <strong className="text-red-600">At-Risk</strong> students are currently or projected below
          passing; <strong className="text-amber-600">Needs Monitoring</strong> are declining or projected below 80; the rest are{" "}
          <strong className="text-emerald-600">On Track</strong>. Classifications are computed live from the grades you encode —
          no manual "Run Prediction" is needed, and they're shared with the Registrar and Principal.
        </p>
      </div>

      {/* ── Live at-risk list ── */}
      <StudentRiskList />
    </div>
  );
}
