import { useState, useEffect } from "react";
import { ArrowUpCircle, Archive, CheckCircle, AlertTriangle, Info, Calendar, Users, Lock, Plus, Star } from "lucide-react";
import { schoolYearsApi, SchoolYearRow } from "../../services/schoolYears";
import { promotionsApi, PromotionRow } from "../../services/promotions";
import { useApp } from "../../context/AppContext";

type Step = "idle" | "confirm-promote" | "promoting" | "promoted" | "confirm-archive" | "archiving" | "archived";

interface GradeTransition {
  fromGrade: number;
  toGrade: number;
  label: string;
  total: number;
  promoted: number;
  retained: number;
}

const GRADE_TRANSITIONS: GradeTransition[] = [
  { fromGrade: 7, toGrade: 8, label: "Grade 7 → Grade 8", total: 0, promoted: 0, retained: 0 },
  { fromGrade: 8, toGrade: 9, label: "Grade 8 → Grade 9", total: 0, promoted: 0, retained: 0 },
  { fromGrade: 9, toGrade: 10, label: "Grade 9 → Grade 10", total: 0, promoted: 0, retained: 0 },
  { fromGrade: 10, toGrade: 11, label: "Grade 10 → Grade 11", total: 0, promoted: 0, retained: 0 },
  { fromGrade: 11, toGrade: 12, label: "Grade 11 → Grade 12", total: 0, promoted: 0, retained: 0 },
  { fromGrade: 12, toGrade: 13, label: "Grade 12 → Graduated", total: 0, promoted: 0, retained: 0 },
];

/** Derive the per-transition summary from the promotions list */
const deriveSummary = (proms: PromotionRow[]): GradeTransition[] =>
  GRADE_TRANSITIONS.map(t => {
    const matching = proms.filter(p => p.to_grade_level === t.toGrade);
    const total = matching.reduce((a, p) => a + p.student_count, 0);
    const completed = matching.filter(p => p.status === "completed");
    const promotedCount = completed.reduce((a, p) => a + p.student_count, 0);
    return {
      ...t,
      total,
      promoted: promotedCount,
      retained: total - promotedCount,
    };
  });

export function AcademicYearManagement() {
  const { showToast, refreshSchoolInfo } = useApp();
  const [step, setStep] = useState<Step>("idle");
  const [expandedGrade, setExpandedGrade] = useState<string | null>(null);
  const [currentSY, setCurrentSY] = useState("2025–2026");
  const [nextSY, setNextSY] = useState("2026–2027");
  const [schoolYears, setSchoolYears] = useState<SchoolYearRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [promotionSummary, setPromotionSummary] = useState<GradeTransition[]>(GRADE_TRANSITIONS);
  const [newSYLabel, setNewSYLabel] = useState("");
  const [creating, setCreating] = useState(false);

  // Sort school years ascending by label (2025-2026 before 2026-2027)
  const sortYears = (years: SchoolYearRow[]) =>
    [...years].sort((a, b) => a.sy_label.localeCompare(b.sy_label));

  useEffect(() => {
    Promise.all([
      schoolYearsApi.list(),
      promotionsApi.list(),
    ]).then(([sys, proms]) => {
      setSchoolYears(sortYears(sys));

      const current = sys.find(sy => sy.is_current === 1);
      if (current) {
        setCurrentSY(current.sy_label);
        const parts = current.sy_label.split("–").length > 1
          ? current.sy_label.split("–")
          : current.sy_label.split("-");
        if (parts.length === 2) {
          const nextStart = parseInt(parts[0]) + 1;
          const nextEnd = parseInt(parts[1]) + 1;
          setNextSY(`${nextStart}–${nextEnd}`);
        }
      }

      setPromotionSummary(deriveSummary(proms));
    }).catch(err => {
      showToast("error", "Failed to load academic year data: " + (err.detail?.error || err.message));
    }).finally(() => setLoading(false));
  }, []);

  const totalPromoted = promotionSummary.reduce((a, r) => a + r.promoted, 0);
  const totalRetained = promotionSummary.reduce((a, r) => a + r.retained, 0);
  const totalStudents = promotionSummary.reduce((a, r) => a + r.total, 0);

  const handlePromote = async () => {
    setStep("promoting");
    try {
      showToast("info", "Bulk promotion initiated. Processing...");
      const res = await promotionsApi.bulkPromote();

      // Map the live backend summary onto the transition table
      const byGrade = new Map(res.summary.map(s => [s.to_grade_level, s]));
      setPromotionSummary(GRADE_TRANSITIONS.map(t => {
        const m = byGrade.get(t.toGrade);
        if (!m) return { ...t, total: 0, promoted: 0, retained: 0 };
        if (t.toGrade === 13) {
          // Grade 12 → Graduated (completers)
          return { ...t, total: m.students_processed, promoted: m.completed, retained: 0 };
        }
        return { ...t, total: m.students_processed, promoted: m.promoted, retained: m.retained };
      }));

      if (res.failures && res.failures.length > 0) {
        showToast("warning", `${res.failures.length} section(s) encountered errors during promotion. Review the grade data for those sections and try again.`);
      }
      showToast("success", res.message || "Bulk promotion completed.");
      setStep("promoted");
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Promotion failed");
      setStep("idle");
    }
  };

  const handleArchive = async () => {
    setStep("archiving");
    try {
      const current = schoolYears.find(sy => sy.is_current === 1);
      if (!current) throw new Error("No current school year found.");

      const res = await schoolYearsApi.archive(current.id);

      // Refresh the school year list so the new active year shows as current
      const sys = await schoolYearsApi.list();
      setSchoolYears(sortYears(sys));
      const cur = sys.find(s => s.is_current === 1);
      if (cur) setCurrentSY(cur.sy_label);

      refreshSchoolInfo();
      showToast("success", res.message || `School Year ${currentSY} archived. ${nextSY} is now active.`);
      setStep("archived");
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Archive failed");
      setStep("promoted");
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center max-w-6xl mx-auto">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <svg className="animate-spin w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <p className="text-gray-400 text-sm font-medium">Loading academic year data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400" />
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-200 flex items-center justify-center flex-shrink-0">
              <Calendar size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">Academic Year Management</h2>
              <p className="text-gray-500 text-sm">End-of-year bulk promotion, retention processing, and school year archiving</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── SCHOOL YEARS LIST ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar size={18} className="text-indigo-600" />
            <div>
              <h3 className="font-semibold text-gray-800">School Years</h3>
              <p className="text-gray-400 text-xs">Manage school years — create new ones, set current, adjust enrollment</p>
            </div>
          </div>
          {/* Create new SY form */}
          <div className="flex items-center gap-2">
            <input
              value={newSYLabel}
              onChange={e => setNewSYLabel(e.target.value)}
              placeholder="e.g. 2031-2032"
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 w-28"
              onKeyDown={async e => {
                if (e.key === "Enter" && newSYLabel.trim()) {
                  setCreating(true);
                  try {
                    await schoolYearsApi.create({ sy_label: newSYLabel.trim() });
                    showToast("success", `School year "${newSYLabel.trim()}" created.`);
                    setNewSYLabel("");
                    const sys = await schoolYearsApi.list();
                    setSchoolYears(sortYears(sys));
                  } catch (err: any) {
                    showToast("error", err.detail?.error || err.message || "Failed to create.");
                  } finally {
                    setCreating(false);
                  }
                }
              }}
            />
            <button
              onClick={async () => {
                if (!newSYLabel.trim()) return;
                setCreating(true);
                try {
                  await schoolYearsApi.create({ sy_label: newSYLabel.trim() });
                  showToast("success", `School year "${newSYLabel.trim()}" created.`);
                  setNewSYLabel("");
                  const sys = await schoolYearsApi.list();
                  setSchoolYears(sortYears(sys));
                } catch (err: any) {
                  showToast("error", err.detail?.error || err.message || "Failed to create.");
                } finally {
                  setCreating(false);
                }
              }}
              disabled={creating || !newSYLabel.trim()}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition"
            >
              <Plus size={13} /> {creating ? "..." : "Create"}
            </button>
          </div>
        </div>
        <div className="p-5">
          {schoolYears.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No school years yet. Create one above.</p>
          ) : (
            <div className="relative">
              <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-gradient-to-b from-indigo-300 via-indigo-200 to-indigo-100 rounded-full" />
              <div className="space-y-3">
                {schoolYears.map((sy, idx) => {
                  const isCurrent = sy.is_current === 1;
                  const yearNum = parseInt(sy.sy_label.split(/[–-]/)[0]) || 0;
                  return (
                    <div key={sy.id} className="group relative pl-10">
                      <div className={`absolute left-0 top-5 w-[23px] h-[23px] rounded-full border-2 flex items-center justify-center text-[10px] font-bold z-10 transition ${
                        isCurrent
                          ? "border-indigo-500 bg-indigo-500 text-white shadow-md shadow-indigo-200"
                          : "border-gray-300 bg-white text-gray-400 group-hover:border-indigo-300 group-hover:text-indigo-500"
                      }`}>
                        {isCurrent ? <Star size={12} /> : <span>{idx + 1}</span>}
                      </div>
                      <div className={`rounded-xl border p-4 transition ${
                        isCurrent
                          ? "border-indigo-300 bg-indigo-50 shadow-sm ring-1 ring-indigo-200"
                          : "border-gray-200 bg-white hover:border-indigo-200 hover:shadow-sm"
                      }`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                              isCurrent
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "bg-gray-100 text-gray-500 group-hover:bg-indigo-100 group-hover:text-indigo-600"
                            }`}>
                              {yearNum}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className={`font-bold text-sm ${isCurrent ? "text-indigo-800" : "text-gray-700"}`}>
                                  {sy.sy_label}
                                </p>
                                {isCurrent && (
                                  <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                                    <Star size={9} /> Current
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`inline-block w-2 h-2 rounded-full ${sy.enrollment_open === 1 ? "bg-emerald-500" : "bg-red-400"}`} />
                                  <span className="text-[11px] text-gray-500">{sy.enrollment_open === 1 ? "Enrollment Open" : "Closed"}</span>
                                </div>
                                {sy.enrollment_start_date && (
                                  <span className="text-[11px] text-gray-400">
                                    {sy.enrollment_start_date} – {sy.enrollment_end_date || "?"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            {!isCurrent ? (
                              <button
                                onClick={async () => {
                                  try {
                                    await schoolYearsApi.setCurrent(sy.id);
                                    showToast("success", `"${sy.sy_label}" is now the current school year.`);
                                    const sys = await schoolYearsApi.list();
                                    setSchoolYears(sortYears(sys));
                                    const current = sys.find(s => s.is_current === 1);
                                    if (current) {
                                      setCurrentSY(current.sy_label);
                                      const parts = current.sy_label.split(/[–-]/);
                                      if (parts.length === 2) {
                                        setNextSY(`${parseInt(parts[0]) + 1}–${parseInt(parts[1]) + 1}`);
                                      }
                                    }
                                    refreshSchoolInfo();
                                  } catch (err: any) {
                                    showToast("error", err.detail?.error || err.message || "Failed to set current.");
                                  }
                                }}
                                className="text-[11px] font-medium text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 hover:border-indigo-300 transition"
                              >
                                Set as Current
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setCurrentSY(sy.sy_label);
                                  const parts = sy.sy_label.split(/[–-]/);
                                  if (parts.length === 2) {
                                    setNextSY(`${parseInt(parts[0]) + 1}–${parseInt(parts[1]) + 1}`);
                                  }
                                }}
                                className="text-[11px] font-medium text-gray-500 hover:bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 transition"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── INFO BANNER ── */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex gap-3">
        <Info size={17} className="text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-800 leading-relaxed">
          <p className="font-semibold mb-1">End-of-Year Process Order</p>
          <p><span className="font-semibold">Step 1 — Bulk Promotion:</span> Advances all students with a general average of 75 and above to the next grade level. Students below 75 are automatically marked as retained.</p>
          <p className="mt-1"><span className="font-semibold">Step 2 — Archive School Year:</span> Locks all records for {currentSY}, moves them to the historical archive, and initializes {nextSY} as the new active school year. This action is irreversible.</p>
        </div>
      </div>

      {/* ── STEP 1 — BULK PROMOTION ── */}
      <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${step === "promoted" || step === "confirm-archive" || step === "archiving" || step === "archived" ? "border-emerald-200" : "border-gray-100"}`}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${
              step === "promoted" || step === "archived"
                ? "bg-emerald-600 text-white"
                : "bg-indigo-100 text-indigo-700"
            }`}>
              {step === "promoted" || step === "archived" ? <CheckCircle size={16} /> : "1"}
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Bulk Promotion — All Grade Levels</h3>
              <p className="text-xs text-gray-500">Promotes eligible students school-wide based on final general averages</p>
            </div>
          </div>
          {(step === "promoted" || step === "archived") && (
            <span className="bg-emerald-100 text-emerald-700 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-emerald-200">Completed</span>
          )}
        </div>

        <div className="p-5 sm:p-6">
          {/* Summary table */}
          <div className="overflow-x-auto rounded-xl border border-gray-100 mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  {["Transition", "Total", "For Promotion", "For Retention", "Promotion Rate"].map(h => (
                    <th key={h} className={`px-5 py-3 ${h === "Transition" ? "text-left" : "text-center"}`}>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">{h}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {promotionSummary.map((r, idx) => (
                  <tr key={r.label} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-indigo-50/50 transition-colors duration-150`}>
                    <td className="px-5 py-3 font-medium text-gray-800 text-sm">{r.label}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{r.total}</td>
                    <td className="px-4 py-3 text-center text-sm font-bold text-emerald-600">{r.promoted}</td>
                    <td className="px-4 py-3 text-center text-sm font-bold text-red-500">{r.retained}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 bg-gray-100 rounded-full h-1.5">
                          <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${r.total > 0 ? Math.round((r.promoted / r.total) * 100) : 0}%` }} />
                        </div>
                        <span className="text-[11px] font-bold text-emerald-700">{r.total > 0 ? Math.round((r.promoted / r.total) * 100) : 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-indigo-50/80 font-bold">
                  <td className="px-5 py-3 text-indigo-800 text-sm">TOTAL</td>
                  <td className="px-4 py-3 text-center text-indigo-700 text-sm">{totalStudents}</td>
                  <td className="px-4 py-3 text-center text-emerald-700 text-sm">{totalPromoted}</td>
                  <td className="px-4 py-3 text-center text-red-600 text-sm">{totalRetained}</td>
                  <td className="px-4 py-3 text-center text-indigo-700 text-sm">{totalStudents > 0 ? Math.round((totalPromoted / totalStudents) * 100) : 0}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          {step === "idle" && (
            <button onClick={() => setStep("confirm-promote")}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all">
              <ArrowUpCircle size={16} /> Execute Bulk Promotion
            </button>
          )}
          {step === "promoting" && (
            <div className="flex items-center gap-3 text-indigo-700 text-sm font-medium">
              <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-700 rounded-full animate-spin" />
              Processing promotion for {totalStudents} students across all grade levels...
            </div>
          )}
          {(step === "promoted" || step === "confirm-archive" || step === "archiving" || step === "archived") && (
            <div className="flex items-center gap-2 text-emerald-700 text-sm font-semibold bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <CheckCircle size={16} /> Bulk promotion completed — {totalPromoted} students promoted, {totalRetained} retained.
            </div>
          )}
        </div>
      </div>

      {/* ── STEP 2 — ARCHIVE ── */}
      <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${step === "archived" ? "border-emerald-200" : "border-gray-100"}`}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${
              step === "archived"
                ? "bg-emerald-600 text-white"
                : step === "promoted" || step === "confirm-archive" || step === "archiving"
                  ? "bg-orange-100 text-orange-700"
                  : "bg-gray-100 text-gray-400"
            }`}>
              {step === "archived" ? <CheckCircle size={16} /> : "2"}
            </div>
            <div>
              <h3 className={`font-bold text-sm ${step !== "promoted" && step !== "confirm-archive" && step !== "archiving" && step !== "archived" ? "text-gray-400" : "text-gray-800"}`}>
                Archive School Year {currentSY}
              </h3>
              <p className="text-xs text-gray-500">Locks all records and initializes {nextSY} as the active school year</p>
            </div>
          </div>
          {step === "archived" && (
            <span className="bg-emerald-100 text-emerald-700 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-emerald-200">Completed</span>
          )}
        </div>

        <div className="p-5 sm:p-6">
          {(step === "idle" || step === "confirm-promote" || step === "promoting") && (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Lock size={14} /> Complete Step 1 first to enable archiving.
            </div>
          )}
          {step === "promoted" && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  <strong>This action is irreversible.</strong> Archiving will lock all {currentSY} records, prevent further modifications, and set {nextSY} as the new active school year. All student statuses will be reset for fresh enrollment.
                </p>
              </div>
              <button onClick={() => setStep("confirm-archive")}
                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all">
                <Archive size={16} /> Archive School Year {currentSY}
              </button>
            </div>
          )}
          {step === "archiving" && (
            <div className="flex items-center gap-3 text-orange-700 text-sm font-medium">
              <div className="w-4 h-4 border-2 border-orange-300 border-t-orange-700 rounded-full animate-spin" />
              Archiving {currentSY} records and initializing {nextSY}...
            </div>
          )}
          {step === "archived" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-700 text-sm font-semibold bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <CheckCircle size={16} /> School Year {currentSY} has been archived. {nextSY} is now the active school year.
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center">
                  <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-[0.06em] mb-1">Records Archived</p>
                  <p className="text-2xl font-bold text-gray-700">{totalStudents}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
                  <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-[0.06em] mb-1">Active School Year</p>
                  <p className="text-lg font-bold text-emerald-700">{nextSY}</p>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-center">
                  <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-[0.06em] mb-1">Enrollment Status</p>
                  <p className="text-lg font-bold text-indigo-700">Open for {nextSY}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Confirm Promotion Modal ── */}
      {step === "confirm-promote" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <AlertTriangle size={22} className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Confirm Bulk Promotion</h3>
                <p className="text-gray-500 text-xs">School-wide — all grade levels</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1.5 mb-5">
              <div className="flex justify-between"><span className="text-gray-500">Total Students:</span><span className="font-semibold">{totalStudents}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">For Promotion:</span><span className="font-semibold text-emerald-700">{totalPromoted}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">For Retention:</span><span className="font-semibold text-red-600">{totalRetained}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">School Year:</span><span className="font-semibold">{currentSY} → {nextSY}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("idle")}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handlePromote}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all">Confirm Promotion</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Archive Modal ── */}
      {step === "confirm-archive" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <Archive size={22} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Confirm Archive</h3>
                <p className="text-gray-500 text-xs">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              You are about to permanently archive School Year <strong>{currentSY}</strong>. All records will be locked and <strong>{nextSY}</strong> will become the new active school year. Are you absolutely sure?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setStep("promoted")}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleArchive}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all">Yes, Archive</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
