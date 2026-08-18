import React from "react";
import { Brain, Info, GraduationCap } from "lucide-react";
import { StudentRiskList } from "../../components/StudentRiskList";

export function RegistrarAtRisk() {
  return (
    <div className="space-y-5 max-w-6xl mx-auto px-3 sm:px-0">
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400" />
        <div className="p-5 sm:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-200 flex items-center justify-center flex-shrink-0">
            <Brain size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">At-Risk Students — System-Wide View</h2>
            <p className="text-gray-500 text-sm">Live linear-regression classifications across all grade levels and sections</p>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-xs text-gray-400 bg-gray-50/80 px-3.5 py-2 rounded-xl border border-gray-100">
            <GraduationCap size={14} className="text-indigo-500" />
            <span className="font-semibold text-gray-600">Live</span>
            <span className="text-gray-300">|</span>
            <span className="text-indigo-600 font-medium">updates as grades are encoded</span>
          </div>
        </div>
      </div>

      {/* ── Info Banner ── */}
      <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl px-5 py-4 flex gap-3">
        <Info size={18} className="text-indigo-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-indigo-700 leading-relaxed">
          Each student's quarterly general averages are fitted with a <strong>least-squares linear regression</strong> to
          project their final grade. Students are classified <strong className="text-red-600">At-Risk</strong> (current or projected
          below passing), <strong className="text-amber-600">Needs Monitoring</strong> (declining or projected below 80), or{" "}
          <strong className="text-emerald-600">On Track</strong>. Classifications are computed live — no manual run is needed.
        </p>
      </div>

      {/* ── Live at-risk list ── */}
      <StudentRiskList />
    </div>
  );
}
