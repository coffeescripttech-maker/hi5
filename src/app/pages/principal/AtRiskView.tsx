import React from "react";
import { AlertTriangle, Info } from "lucide-react";
import { StudentRiskList } from "../../components/StudentRiskList";

export function AtRiskView() {
  return (
    <div className="space-y-5 max-w-6xl mx-auto px-3 sm:px-0">
      {/* HEADER */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-purple-500 via-purple-600 to-purple-400" />
        <div className="p-5 sm:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-200 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">At-Risk Students</h2>
            <p className="text-gray-500 text-sm">Read-only view of live linear-regression risk classifications</p>
          </div>
        </div>
      </div>

      {/* INFO */}
      <div className="bg-purple-50/60 border border-purple-100 rounded-2xl px-5 py-4 flex gap-3">
        <Info size={18} className="text-purple-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-purple-700 leading-relaxed">
          Classifications are recomputed live from each student's quarterly general averages using least-squares
          linear regression — they update automatically as teachers encode grades.
        </p>
      </div>

      {/* LIVE AT-RISK LIST */}
      <StudentRiskList />
    </div>
  );
}
