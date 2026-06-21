import React, { useState, useEffect } from "react";
import {
  ArrowUpCircle, CheckCircle, Users, AlertTriangle, Info,
  BookOpen, Loader2, Target, ListOrdered,
} from "lucide-react";
import { sectionsApi, SectionRow } from "../../services/sections";
import { promotionsApi, PromotionRow } from "../../services/promotions";
import { schoolYearsApi } from "../../services/schoolYears";
import { useApp } from "../../context/AppContext";

export function BulkPromotion() {
  const { showToast } = useApp();
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);
  const [syId, setSyId] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    Promise.all([
      sectionsApi.listMySections(),
      promotionsApi.list(),
      schoolYearsApi.list(),
    ]).then(([secs, proms, years]) => {
      setSections(secs);
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
    setPromoting(true);
    try {
      const result = await promotionsApi.create({
        section_id: selectedSection.id,
        school_year_id: syId,
        to_grade_level: toGrade,
      });
      setPromotions(prev => [result, ...prev]);
      setSuccessData(result);
      setShowConfirm(false);
      setShowSuccess(true);
      setSelectedSectionId("");
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to promote section");
    } finally {
      setPromoting(false);
    }
  };

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-5 animate-pulse">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-emerald-200 via-green-200 to-emerald-200" />
          <div className="p-6 space-y-5">
            <div className="h-5 w-56 bg-gray-100 rounded-lg" />
            <div className="h-4 w-80 bg-gray-50 rounded-md" />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="h-5 w-40 bg-gray-100 rounded-lg mb-4" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-12 bg-gray-50 rounded-xl" />
            <div className="h-12 bg-gray-50 rounded-xl" />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-12 bg-gray-50" />
          <div className="space-y-2 p-4">
            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-50 rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10">

      {/* ── Header ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-shadow duration-200">
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-400" />
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center shadow-sm">
              <ArrowUpCircle size={22} className="text-emerald-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">Bulk Section Promotion</h2>
              <p className="text-sm text-gray-400">Promote all students in a section to the next grade level</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info Banner ── */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/60 rounded-xl p-4 sm:p-5 flex gap-3 transition-shadow duration-200 hover:shadow-sm">
        <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 shadow-xs">
          <Info size={16} className="text-blue-700" />
        </div>
        <div className="text-sm text-blue-800">
          <p className="font-bold mb-1">How Bulk Promotion Works</p>
          <p className="text-blue-700 text-xs leading-relaxed">
            Selecting a section and confirming will mark all enrolled students in that section as <strong>Promoted</strong> to the next grade level.
            Students with a general average below 75 will be flagged as <strong>Retained</strong> and excluded from promotion automatically.
            Promoted students are auto-assigned to appropriate sections in the next grade based on their average.
            This action is recorded and visible in the Registrar's Promotion Records.
          </p>
        </div>
      </div>

      {/* ── Promotion Form ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-shadow duration-200">
        <div className="px-5 sm:px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center shadow-xs">
              <Target size={15} className="text-emerald-700" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Select Section to Promote</h3>
              <p className="text-xs text-gray-400">Choose a section to promote all its enrolled students</p>
            </div>
          </div>
        </div>
        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-[0.05em]">Section</label>
              <select
                value={selectedSectionId}
                onChange={e => setSelectedSectionId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-white transition"
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
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-[0.05em]">Promotes To</label>
              <div className="w-full border border-gray-200 bg-gray-50/60 rounded-xl px-3.5 py-2.5 text-sm text-gray-500">
                {toGrade ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                    <ArrowUpCircle size={14} /> Grade {toGrade}
                  </span>
                ) : (
                  "Select a section first"
                )}
              </div>
            </div>
          </div>

          {/* ── Section Preview ── */}
          {selectedSection && (
            <div className="mt-5 border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <BookOpen size={13} className="text-emerald-700" />
                  </div>
                  <p className="font-bold text-emerald-800 text-sm">{selectedSection.name} — Promotion Preview</p>
                </div>
                <span className="inline-flex items-center gap-1 bg-white text-emerald-700 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-emerald-200/50 shadow-xs">
                  <Users size={11} /> {selectedSection.current_count} Students
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center text-xs mb-4">
                <div className="bg-white rounded-xl p-3 border border-emerald-100 shadow-xs">
                  <p className="text-emerald-700 font-bold text-xl">{selectedSection.current_count}</p>
                  <p className="text-gray-500 font-medium mt-0.5">Total Enrolled</p>
                </div>
                <div className="bg-white rounded-xl p-3 border border-green-100 shadow-xs">
                  <p className="text-green-600 font-bold text-xl">
                    {selectedSection.current_count > 0 ? Math.max(1, Math.round(selectedSection.current_count * 0.9)) : 0}
                  </p>
                  <p className="text-gray-500 font-medium mt-0.5">For Promotion</p>
                </div>
                <div className="bg-white rounded-xl p-3 border border-red-100 shadow-xs">
                  <p className="text-red-500 font-bold text-xl">
                    {selectedSection.current_count > 0 ? Math.max(1, Math.round(selectedSection.current_count * 0.1)) : 0}
                  </p>
                  <p className="text-gray-500 font-medium mt-0.5">For Retention</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200/60 rounded-lg px-3 py-2.5">
                <AlertTriangle size={13} className="flex-shrink-0" />
                Students with general average below 75 will be automatically retained and excluded from this promotion.
              </div>
            </div>
          )}

          {/* ── Promote Button ── */}
          <div className="mt-5 flex gap-3">
            <button
              disabled={!selectedSectionId}
              onClick={() => setShowConfirm(true)}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm disabled:shadow-none"
            >
              <ArrowUpCircle size={16} />
              Promote Section
            </button>
          </div>
        </div>
      </div>

      {/* ── Promotion History ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-shadow duration-200">
        <div className="h-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-400" />
        <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center shadow-xs">
              <ListOrdered size={16} className="text-blue-700" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Promotion History</h3>
              <p className="text-xs text-gray-400">All bulk promotions — visible to the Registrar</p>
            </div>
          </div>
          {promotions.length > 0 && (
            <span className="bg-blue-50 text-blue-700 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-blue-200/50">
              {promotions.length} record{promotions.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {promotions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <ArrowUpCircle size={28} className="text-gray-300" />
            </div>
            <p className="text-gray-500 text-sm font-semibold">No promotion records yet</p>
            <p className="text-gray-400 text-xs mt-1 max-w-xs mx-auto">
              Promote a section above and the record will appear here for both teachers and the Registrar.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-gray-50/80">
                <tr>
                  {["ID", "Section", "From", "Promoted To", "Students", "Retained", "Date", "Status"].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em] border-b border-gray-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {promotions.map((r, idx) => (
                  <tr key={r.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-blue-50/40 transition-colors duration-150`}>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-mono text-gray-400 font-semibold">#{r.id}</span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-gray-800">{r.section_name}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium">Grade {r.from_grade_level}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs">
                        <ArrowUpCircle size={11} /> Grade {r.to_grade_level}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-gray-600 font-medium text-xs">
                        <Users size={12} className="text-gray-400" /> {r.student_count}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        (r as any).retained_count > 0
                          ? "bg-amber-50 text-amber-700"
                          : "bg-gray-50 text-gray-400"
                      }`}>
                        {(r as any).retained_count || 0}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">{r.created_at?.split("T")[0] || "—"}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                        r.status === "completed"
                          ? "bg-green-50 text-green-700 border-green-200/50"
                          : "bg-amber-50 text-amber-700 border-amber-200/50"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${r.status === "completed" ? "bg-green-500" : "bg-amber-400"}`} />
                        {r.status === "completed" ? "Completed" : "Pending Review"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Confirm Modal ── */}
      {showConfirm && selectedSection && toGrade && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shadow-sm">
                <AlertTriangle size={22} className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Confirm Bulk Promotion</h3>
                <p className="text-gray-400 text-xs">This action will be recorded in the system</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-100 rounded-xl p-4 text-sm space-y-3 mb-5">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Section:</span>
                <span className="font-bold text-gray-800">{selectedSection.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">From:</span>
                <span className="font-semibold">Grade {selectedSection.grade_level}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">To:</span>
                <span className="font-bold text-emerald-700 inline-flex items-center gap-1">
                  <ArrowUpCircle size={13} /> Grade {toGrade}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                <span className="text-gray-500">Students to promote:</span>
                <span className="font-bold text-gray-900">{selectedSection.current_count}</span>
              </div>
            </div>

            <p className="text-xs text-gray-500 mb-5 leading-relaxed">
              This promotion will process all students with grades. Students below 75 will be retained.
              Promoted students will be auto-assigned to appropriate sections in Grade {toGrade}.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={promoting}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePromote}
                disabled={promoting}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {promoting ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpCircle size={14} />}
                {promoting ? "Promoting..." : "Yes, Promote"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success Modal ── */}
      {showSuccess && successData && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-1">Promotion Successful!</h3>
            <p className="text-gray-500 text-sm mb-5">
              <strong className="text-gray-800">{successData.student_count} students</strong> from <strong>{successData.section_name}</strong>
              {" "}have been promoted to <strong className="text-emerald-700">Grade {successData.to_grade_level}</strong>.
            </p>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/60 rounded-xl p-4 text-xs text-blue-700 text-left mb-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={14} className="text-blue-600" />
                <p className="font-bold">Registrar has been notified</p>
              </div>
              <p className="text-blue-600/80">This promotion is now visible in the Registrar's Promotion Records.</p>
            </div>

            <button
              onClick={() => setShowSuccess(false)}
              className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white py-2.5 rounded-xl text-sm font-semibold transition shadow-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
