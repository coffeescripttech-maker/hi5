import React, { useState, useEffect } from "react";
import {
  ArrowUpCircle, CheckCircle, Users, AlertTriangle, Info,
  BookOpen, Loader2, Target, ListOrdered, GraduationCap,
} from "lucide-react";
import { sectionsApi, SectionRow } from "../../services/sections";
import { promotionsApi, PromotionRow, PromotionPreview } from "../../services/promotions";
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
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<PromotionPreview | null>(null);

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
  const isCompleters = selectedSection?.grade_level === 12;

  // Outcome breakdown for the success screen — the promotion run records every
  // student, but only complete & passing students actually move to the next grade.
  const successOutcome = (() => {
    const students = successData?.students ?? [];
    const promoted = students.filter((s: any) => s.grade_complete !== false && !s.is_retained).length;
    const retained = students.filter((s: any) => s.is_retained).length;
    const incomplete = students.filter((s: any) => s.grade_complete === false).length;
    const total = students.length || successData?.student_count || 0;
    const breakdown = [
      ...(promoted > 0 ? [`${promoted} promoted`] : []),
      ...(retained > 0 ? [`${retained} retained`] : []),
      ...(incomplete > 0 ? [`${incomplete} incomplete`] : []),
    ].join(", ");
    return { promoted, retained, incomplete, total, breakdown };
  })();

  // Load a real promotion preview for the selected section — the counts shown in
  // the preview panel come from the backend's grade-completeness computation so
  // they match what the actual promotion run will do (no records are written).
  useEffect(() => {
    const sectionId = parseInt(selectedSectionId);
    if (!sectionId || !syId || isCompleters) return;
    setPreview(null);
    setPreviewLoading(true);
    promotionsApi.preview({ section_id: sectionId, school_year_id: syId })
      .then(setPreview)
      .catch(() => setPreview(null))
      .finally(() => setPreviewLoading(false));
  }, [selectedSectionId, syId, isCompleters]);

  const handlePromote = async () => {
    if (!selectedSection) return;
    if (!isCompleters && !toGrade) return;
    setPromoting(true);
    try {
      if (isCompleters) {
        const result = await promotionsApi.completeSection({
          section_id: selectedSection.id,
          school_year_id: syId,
        });
        const data = { ...result, section_name: selectedSection.name };
        setSuccessData(data);
      } else {
        const result = await promotionsApi.create({
          section_id: selectedSection.id,
          school_year_id: syId,
          to_grade_level: toGrade!,
        });
        setSuccessData(result);
      }
      setShowConfirm(false);
      setShowSuccess(true);
      setSelectedSectionId("");
    } catch (err: any) {
      showToast("error", err?.detail?.error || err?.message || "Failed to process section");
      // Refresh promotion history
      const updatedPromotions = await promotionsApi.list();
      setPromotions(updatedPromotions);
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
      <div className={`rounded-xl p-4 sm:p-5 flex gap-3 transition-shadow duration-200 hover:shadow-sm ${
        isCompleters
          ? "bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200/60"
          : "bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/60"
      }`}>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 shadow-xs ${
          isCompleters ? "bg-indigo-100" : "bg-blue-100"
        }`}>
          <Info size={16} className={isCompleters ? "text-indigo-700" : "text-blue-700"} />
        </div>
        <div className={`text-sm ${isCompleters ? "text-indigo-800" : "text-blue-800"}`}>
          <p className="font-bold mb-1">
            {isCompleters ? "How Grade 12 Completion Works" : "How Bulk Promotion Works"}
          </p>
          {isCompleters ? (
            <p className={`text-xs leading-relaxed ${isCompleters ? "text-indigo-700" : "text-blue-700"}`}>
              Marking a Grade 12 section as <strong>Completed</strong> will graduate all enrolled students.
              Their enrollment status will be updated to <strong>Completed</strong> and student records will reflect <strong>Graduated</strong> status.
              This action is recorded and visible in the Registrar's Promotion Records.
            </p>
          ) : (
            <p className={`text-xs leading-relaxed ${isCompleters ? "text-indigo-700" : "text-blue-700"}`}>
              Selecting a section and confirming will mark all enrolled students in that section as <strong>Promoted</strong> to the next grade level.
              Students with a general average below 75 will be flagged as <strong>Retained</strong> and excluded from promotion automatically.
              Promoted students are auto-assigned to appropriate sections in the next grade based on their average.
              This action is recorded and visible in the Registrar's Promotion Records.
            </p>
          )}
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
                {sections.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.current_count} students · Grade {s.grade_level})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-[0.05em]">Promotes To</label>
              <div className="w-full border border-gray-200 bg-gray-50/60 rounded-xl px-3.5 py-2.5 text-sm text-gray-500">
                {selectedSection && isCompleters ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-indigo-700">
                    <GraduationCap size={14} /> Completers
                  </span>
                ) : toGrade ? (
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
            <div className={`mt-5 border rounded-xl p-5 ${
              isCompleters
                ? "border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50"
                : "border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50"
            }`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    isCompleters ? "bg-indigo-100" : "bg-emerald-100"
                  }`}>
                    {isCompleters
                      ? <GraduationCap size={13} className="text-indigo-700" />
                      : <BookOpen size={13} className="text-emerald-700" />
                    }
                  </div>
                  <p className={`font-bold text-sm ${
                    isCompleters ? "text-indigo-800" : "text-emerald-800"
                  }`}>{selectedSection.name} — {isCompleters ? "Completion Preview" : "Promotion Preview"}</p>
                </div>
                <span className="inline-flex items-center gap-1 bg-white text-gray-700 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-gray-200/50 shadow-xs">
                  <Users size={11} /> {selectedSection.current_count} Students
                </span>
              </div>

              {isCompleters ? (
                <div className="grid grid-cols-1 gap-3 text-center text-xs mb-4">
                  <div className="bg-white rounded-xl p-3 border border-indigo-100 shadow-xs">
                    <p className="text-indigo-700 font-bold text-xl">{selectedSection.current_count}</p>
                    <p className="text-gray-500 font-medium mt-0.5">Total Graduating</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs mb-4">
                  <div className="bg-white rounded-xl p-3 border border-emerald-100 shadow-xs">
                    <p className="text-emerald-700 font-bold text-xl">{preview ? preview.total : selectedSection.current_count}</p>
                    <p className="text-gray-500 font-medium mt-0.5">Total Enrolled</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-green-100 shadow-xs">
                    <p className="text-green-600 font-bold text-xl">{previewLoading ? "…" : (preview?.promoted ?? 0)}</p>
                    <p className="text-gray-500 font-medium mt-0.5">For Promotion</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-red-100 shadow-xs">
                    <p className="text-red-500 font-bold text-xl">{previewLoading ? "…" : (preview?.retained ?? 0)}</p>
                    <p className="text-gray-500 font-medium mt-0.5">For Retention</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-amber-100 shadow-xs">
                    <p className="text-amber-600 font-bold text-xl">{previewLoading ? "…" : (preview?.incomplete ?? 0)}</p>
                    <p className="text-gray-500 font-medium mt-0.5">Incomplete</p>
                  </div>
                </div>
              )}

              {isCompleters ? (
                <div className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200/60 rounded-lg px-3 py-2.5">
                  <GraduationCap size={13} className="flex-shrink-0" />
                  All students in this section will be marked as completers/graduates. This cannot be undone easily.
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200/60 rounded-lg px-3 py-2.5">
                  <AlertTriangle size={13} className="flex-shrink-0" />
                  Students are promoted only if every subject has all 4 quarters of grades. An average below 75 means
                  retention; incomplete grades hold a student back until their record is complete.
                </div>
              )}
            </div>
          )}

          {/* ── Promote / Complete Button ── */}
          <div className="mt-5 flex gap-3">
            {isCompleters ? (
              <button
                disabled={!selectedSectionId}
                onClick={() => setShowConfirm(true)}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm disabled:shadow-none"
              >
                <GraduationCap size={16} />
                Mark as Completers
              </button>
            ) : (
              <button
                disabled={!selectedSectionId}
                onClick={() => setShowConfirm(true)}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm disabled:shadow-none"
              >
                <ArrowUpCircle size={16} />
                Promote Section
              </button>
            )}
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
      {showConfirm && selectedSection && (isCompleters || toGrade) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${isCompleters ? "bg-indigo-100" : "bg-amber-100"}`}>
                {isCompleters
                  ? <GraduationCap size={22} className="text-indigo-600" />
                  : <AlertTriangle size={22} className="text-amber-600" />
                }
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{isCompleters ? "Confirm Grade 12 Completion" : "Confirm Bulk Promotion"}</h3>
                <p className="text-gray-400 text-xs">This action will be recorded in the system</p>
              </div>
            </div>

            <div className={`bg-gradient-to-br from-gray-50 to-white border rounded-xl p-4 text-sm space-y-3 mb-5 ${isCompleters ? "border-indigo-100" : "border-gray-100"}`}>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Section:</span>
                <span className="font-bold text-gray-800">{selectedSection.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">From:</span>
                <span className="font-semibold">Grade {selectedSection.grade_level}</span>
              </div>
              {isCompleters ? (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Status:</span>
                  <span className="font-bold text-indigo-700 inline-flex items-center gap-1">
                    <GraduationCap size={13} /> Completers
                  </span>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">To:</span>
                  <span className="font-bold text-emerald-700 inline-flex items-center gap-1">
                    <ArrowUpCircle size={13} /> Grade {toGrade}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                <span className="text-gray-500">{isCompleters ? "Students graduating:" : "Students to promote:"}</span>
                <span className="font-bold text-gray-900">{isCompleters ? selectedSection.current_count : (preview?.promoted ?? selectedSection.current_count)}</span>
              </div>
            </div>

            {isCompleters ? (
              <p className="text-xs text-gray-500 mb-5 leading-relaxed">
                This will mark all enrolled students in this section as <strong>Completed / Graduated</strong>.
                Their enrollment status will be changed to <strong>Completed</strong> and their student records
                will reflect <strong>Graduated</strong>. The section count will also be adjusted.
              </p>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                  This promotion will process all students with grades. Students below 75 will be retained.
                  Promoted students will be auto-assigned to appropriate sections in Grade {toGrade}.
                </p>
                {preview && preview.incomplete > 0 && (
                  <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200/60 rounded-lg px-3 py-2.5 mb-5">
                    <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>{preview.incomplete}</strong> student{preview.incomplete !== 1 ? "s" : ""} with incomplete
                      grades will be held back and NOT promoted.
                    </span>
                  </div>
                )}
              </>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={promoting}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              {isCompleters ? (
                <button
                  onClick={handlePromote}
                  disabled={promoting}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {promoting ? <Loader2 size={14} className="animate-spin" /> : <GraduationCap size={14} />}
                  {promoting ? "Processing..." : "Yes, Mark as Completed"}
                </button>
              ) : (
                <button
                  onClick={handlePromote}
                  disabled={promoting}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {promoting ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpCircle size={14} />}
                  {promoting ? "Promoting..." : "Yes, Promote"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Success Modal ── */}
      {showSuccess && successData && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center animate-in zoom-in-95">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center mx-auto mb-4 shadow-sm ${
              isCompleters
                ? "from-indigo-100 to-purple-100"
                : successOutcome.promoted > 0
                  ? "from-green-100 to-emerald-100"
                  : "from-amber-100 to-yellow-100"
            }`}>
              {isCompleters || successOutcome.promoted > 0 ? (
                <CheckCircle size={32} className={isCompleters ? "text-indigo-600" : "text-green-600"} />
              ) : (
                <AlertTriangle size={32} className="text-amber-600" />
              )}
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-1">
              {isCompleters
                ? "Completers Marked Successfully!"
                : successOutcome.promoted === successOutcome.total && successOutcome.total > 0
                  ? "Promotion Successful!"
                  : successOutcome.promoted > 0
                    ? "Promotion Completed"
                    : "No Students Promoted"}
            </h3>
            {isCompleters ? (
              <p className="text-gray-500 text-sm mb-5">
                <strong className="text-gray-800">{successData.student_count} students</strong> from <strong>{successData.section_name}</strong>
                {" "}have been marked as <strong className="text-indigo-700">Completed / Graduated</strong>.
              </p>
            ) : (
              <>
                <p className="text-gray-500 text-sm mb-3">
                  <strong className="text-gray-800">{successOutcome.total} {successOutcome.total === 1 ? "student" : "students"}</strong>
                  {" "}from <strong>{successData.section_name || successData.from_section}</strong>
                  {successOutcome.promoted === successOutcome.total && successOutcome.total > 0 ? (
                    <>
                      {" "}have been promoted to <strong className="text-emerald-700">Grade {successData.to_grade_level || successData.to_grade}</strong>.
                    </>
                  ) : (
                    <>
                      {" "}{successOutcome.total === 1 ? "was" : "were"} evaluated for{" "}
                      <strong className="text-emerald-700">Grade {successData.to_grade_level || successData.to_grade}</strong>:
                      <strong className="text-gray-800"> {successOutcome.breakdown}.</strong>
                    </>
                  )}
                </p>
                <div className="flex flex-wrap justify-center gap-2 mb-5">
                  <span className={`px-2.5 py-1 rounded-full border text-xs font-semibold ${successOutcome.promoted > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}>
                    {successOutcome.promoted} Promoted
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 text-xs font-semibold">
                    {successOutcome.retained} Retained
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                    {successOutcome.incomplete} Incomplete
                  </span>
                </div>
                {successOutcome.promoted === 0 && successOutcome.incomplete > 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200/60 rounded-lg px-3 py-2 mb-5">
                    Incomplete students stay in their current grade until all 4 quarters of grades are entered.
                  </p>
                )}
              </>
            )}

            <div className={`rounded-xl p-4 text-xs text-left mb-5 ${
              isCompleters
                ? "bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200/60 text-indigo-700"
                : "bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/60 text-blue-700"
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={14} className={isCompleters ? "text-indigo-600" : "text-blue-600"} />
                <p className="font-bold">Registrar has been notified</p>
              </div>
              <p className={isCompleters ? "text-indigo-600/80" : "text-blue-600/80"}>
                {isCompleters
                  ? "This completion is now visible in the Registrar's Promotion Records."
                  : "This promotion is now visible in the Registrar's Promotion Records."
                }
              </p>
            </div>

            <button
              onClick={() => setShowSuccess(false)}
              className={`w-full bg-gradient-to-r text-white py-2.5 rounded-xl text-sm font-semibold transition shadow-sm ${
                isCompleters
                  ? "from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                  : "from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
              }`}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
