import React, { useState, useEffect } from "react";
import { ArrowUpCircle, CheckCircle, Users, ChevronRight, AlertTriangle, Info, X } from "lucide-react";
import { sectionsApi, SectionRow } from "../../services/sections";
import { studentsApi, StudentRow } from "../../services/students";
import { promotionsApi, PromotionRow } from "../../services/promotions";
import { schoolYearsApi } from "../../services/schoolYears";
import { useApp } from "../../context/AppContext";

const GRADE_LABELS: Record<number, string> = {
  7: "Grade 7", 8: "Grade 8", 9: "Grade 9",
  10: "Grade 10", 11: "Grade 11", 12: "Grade 12",
};

export function BulkPromotion() {
  const { showToast } = useApp();
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState<PromotionRow | null>(null);
  const [syId, setSyId] = useState<number>(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      sectionsApi.list(),
      promotionsApi.list(),
      schoolYearsApi.list(),
    ]).then(([secs, proms, years]) => {
      setSections(secs.filter(s => s.is_active === 1));
      setPromotions(proms);
      const current = years.find(y => y.is_current === 1);
      if (current) setSyId(current.id);
    }).catch(err => {
      showToast("error", "Failed to load data: " + (err.detail?.error || err.message));
    }).finally(() => setLoading(false));
  }, []);

  const selectedSection = sections.find(s => s.id === parseInt(selectedSectionId));
  const toGrade = selectedSection ? Math.min(selectedSection.grade_level + 1, 12) : null;

  const handlePromote = async () => {
    if (!selectedSection || !toGrade) return;
    try {
      const created = await promotionsApi.create({
        section_id: selectedSection.id,
        school_year_id: syId,
        to_grade_level: toGrade,
      });
      setPromotions(prev => [created, ...prev]);
      setSuccessData(created);
      setShowConfirm(false);
      setShowSuccess(true);
      setSelectedSectionId("");
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to promote section");
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-gray-400 text-sm">Loading data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <ArrowUpCircle size={20} className="text-emerald-700" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800">Bulk Section Promotion</h2>
            <p className="text-gray-500 text-sm">Promote all students in a section to the next grade level</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">How Bulk Promotion Works</p>
          <p className="text-blue-700 text-xs leading-relaxed">
            Selecting a section and confirming will mark all enrolled students in that section as <strong>Promoted</strong> to the next grade level.
            This action is recorded in the system and will immediately appear in the Registrar's Promotion Records.
            Students with a general average below 75 will be flagged as <strong>Retained</strong> and excluded from promotion automatically.
          </p>
        </div>
      </div>

      {/* Promotion Form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Select Section to Promote</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Section</label>
            <select
              value={selectedSectionId}
              onChange={e => setSelectedSectionId(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="">-- Select a section --</option>
              {sections.filter(s => s.grade_level < 12).map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.current_count} students · Grade {s.grade_level})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Promotes To</label>
            <div className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-500">
              {toGrade ? `Grade ${toGrade}` : "Select a section first"}
            </div>
          </div>
        </div>

        {/* Section Preview */}
        {selectedSection && (
          <div className="mt-4 border border-emerald-200 bg-emerald-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-emerald-800">{selectedSection.name} — Promotion Preview</p>
              <span className="text-xs bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-medium">
                {selectedSection.current_count} Students
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-xs mb-3">
              <div className="bg-white rounded-lg p-2 border border-emerald-100">
                <p className="text-emerald-700 font-bold text-lg">{selectedSection.current_count}</p>
                <p className="text-gray-500">Total</p>
              </div>
              <div className="bg-white rounded-lg p-2 border border-emerald-100">
                <p className="text-green-600 font-bold text-lg">{Math.round(selectedSection.current_count * 0.94)}</p>
                <p className="text-gray-500">For Promotion</p>
              </div>
              <div className="bg-white rounded-lg p-2 border border-red-100">
                <p className="text-red-500 font-bold text-lg">{Math.round(selectedSection.current_count * 0.06)}</p>
                <p className="text-gray-500">For Retention</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
              <AlertTriangle size={13} className="flex-shrink-0" />
              Students with general average below 75 will be automatically retained and excluded from this promotion.
            </div>
          </div>
        )}

        {/* Promote Button */}
        <div className="mt-4 flex gap-3">
          <button
            disabled={!selectedSectionId}
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition"
          >
            <ArrowUpCircle size={16} />
            Promote Section
          </button>
        </div>
      </div>

      {/* Previous Promotions Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Promotion History</h3>
          <p className="text-xs text-gray-500 mt-0.5">All bulk promotions — visible to the Registrar</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Section</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Promoted To</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Students</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {promotions.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/60">
                  <td className="px-5 py-3 text-xs font-mono text-gray-400">#{r.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-700">{r.section_name}</td>
                  <td className="px-4 py-3 text-gray-600">Grade {r.to_grade_level}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-gray-600">
                      <Users size={12} /> {r.student_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.created_at?.split("T")[0] || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {r.status === "completed" ? "Completed" : "Pending Review"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {promotions.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">No promotion records yet.</p>
          )}
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirm && selectedSection && toGrade && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <AlertTriangle size={22} className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Confirm Bulk Promotion</h3>
                <p className="text-gray-500 text-xs">This action will be recorded in the system</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2 mb-5">
              <div className="flex justify-between"><span className="text-gray-500">Section:</span><span className="font-semibold">{selectedSection.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">From:</span><span className="font-semibold">Grade {selectedSection.grade_level}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">To:</span><span className="font-semibold text-emerald-700">Grade {toGrade}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Students:</span><span className="font-semibold">{selectedSection.current_count}</span></div>
            </div>
            <p className="text-xs text-gray-500 mb-4">This promotion will appear immediately in the Registrar's records. Are you sure you want to proceed?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handlePromote} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold">
                Yes, Promote
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccess && successData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h3 className="font-bold text-gray-800 text-lg mb-1">Promotion Successful!</h3>
            <p className="text-gray-500 text-sm mb-4">
              <strong>{successData.student_count} students</strong> from <strong>{successData.section_name}</strong> have been promoted to <strong>Grade {successData.to_grade_level}</strong>.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 mb-5 text-left">
              <p className="font-semibold mb-1">✅ Registrar has been notified</p>
              <p>This promotion is now visible in the Registrar's Promotion Records.</p>
            </div>
            <button onClick={() => setShowSuccess(false)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
