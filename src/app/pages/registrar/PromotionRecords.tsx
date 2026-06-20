import React, { useState, useEffect } from "react";
import { ArrowUpCircle, Users, CheckCircle, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { promotionsApi, PromotionRow } from "../../services/promotions";
import { useApp } from "../../context/AppContext";

export function PromotionRecords() {
  const { showToast } = useApp();
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    promotionsApi.list()
      .then(setPromotions)
      .catch(err => showToast("error", "Failed to load promotions: " + (err.detail?.error || err.message)))
      .finally(() => setLoading(false));
  }, []);

  const total = promotions.reduce((a, r) => a + r.student_count, 0);
  const completed = promotions.filter(r => r.status === "completed").length;

  if (loading) {
    return <div className="p-10 text-center text-gray-400 text-sm">Loading promotion records...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <ArrowUpCircle size={20} className="text-purple-700" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800">Promotion Records</h2>
            <p className="text-gray-500 text-sm">All bulk section promotions submitted by teachers — updated in real time</p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-purple-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total Promotions</p>
          <p className="text-2xl font-bold text-purple-700 mt-0.5">{promotions.length}</p>
          <p className="text-xs text-gray-400 mt-1">Sections promoted</p>
        </div>
        <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Students Promoted</p>
          <p className="text-2xl font-bold text-green-700 mt-0.5">{total}</p>
          <p className="text-xs text-gray-400 mt-1">Across all sections</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Completed</p>
          <p className="text-2xl font-bold text-emerald-700 mt-0.5">{completed}</p>
          <p className="text-xs text-gray-400 mt-1">Out of {promotions.length} records</p>
        </div>
      </div>

      {/* Records list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">All Promotion Records</h3>
          <span className="text-xs bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full font-medium">
            {promotions.length} records
          </span>
        </div>

        {promotions.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <ArrowUpCircle size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No promotion records yet.</p>
            <p className="text-xs mt-1">Records will appear here when teachers submit bulk promotions.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {promotions.map(r => (
              <div key={r.id}>
                {/* Row */}
                <div
                  className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/60 cursor-pointer transition"
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <ArrowUpCircle size={16} className="text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{r.section_name} → Grade {r.to_grade_level}</p>
                      <p className="text-xs text-gray-400">By {r.promoted_by_name} · {r.created_at?.split("T")[0] || "—"} · Record #{r.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Users size={12} /> {r.student_count} students
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {r.status === "completed" ? "Completed" : "Pending Review"}
                    </span>
                    {expanded === r.id
                      ? <ChevronUp size={14} className="text-gray-400" />
                      : <ChevronDown size={14} className="text-gray-400" />}
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded === r.id && (
                  <div className="px-5 pb-4 bg-purple-50/40 border-t border-purple-100">
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Promotion Details</p>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between"><span className="text-gray-500">Record ID:</span><span className="font-mono text-xs font-medium">#{r.id}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">From Section:</span><span className="font-medium">{r.section_name}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Promoted to:</span><span className="font-medium text-purple-700">Grade {r.to_grade_level}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Total Students:</span><span className="font-medium">{r.student_count}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Submitted by:</span><span className="font-medium">{r.promoted_by_name}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Date:</span><span className="font-medium">{r.created_at?.split("T")[0] || "—"}</span></div>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">School Year</p>
                        <p className="text-xs text-gray-600">{r.sy_label || `SY #${r.school_year_id}`}</p>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-2 mt-4">
                      <button className="flex items-center gap-1.5 text-xs bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition">
                        <FileText size={11} /> View Full Report
                      </button>
                      <button className="flex items-center gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg transition">
                        <ArrowUpCircle size={11} /> Export Record
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
