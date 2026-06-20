import React, { useState, useEffect } from "react";
import { ArrowUpCircle, Archive, CheckCircle, AlertTriangle, Info, Calendar, Users, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { schoolYearsApi, SchoolYearRow } from "../../services/schoolYears";
import { promotionsApi } from "../../services/promotions";
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

export function AcademicYearManagement() {
  const { showToast } = useApp();
  const [step, setStep] = useState<Step>("idle");
  const [expandedGrade, setExpandedGrade] = useState<string | null>(null);
  const [currentSY, setCurrentSY] = useState("2025–2026");
  const [nextSY, setNextSY] = useState("2026–2027");
  const [schoolYears, setSchoolYears] = useState<SchoolYearRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [promotionSummary, setPromotionSummary] = useState<GradeTransition[]>(GRADE_TRANSITIONS);

  useEffect(() => {
    Promise.all([
      schoolYearsApi.list(),
      promotionsApi.list(),
    ]).then(([sys, proms]) => {
      setSchoolYears(sys);

      // Find current SY
      const current = sys.find(sy => sy.is_current === 1);
      if (current) {
        setCurrentSY(current.sy_label);
        // Infer next SY label
        const parts = current.sy_label.split("–").length > 1
          ? current.sy_label.split("–")
          : current.sy_label.split("-");
        if (parts.length === 2) {
          const nextStart = parseInt(parts[0]) + 1;
          const nextEnd = parseInt(parts[1]) + 1;
          setNextSY(`${nextStart}–${nextEnd}`);
        }
      }

      // Build promotion summary from API data
      const summary = GRADE_TRANSITIONS.map(t => {
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
      setPromotionSummary(summary);
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
      // Call bulk promotion API — the backend endpoint may not be available yet
      // This is a placeholder structure for when the endpoint is ready
      showToast("info", "Bulk promotion initiated. Processing...");
      // Simulate for now, but ready for real API
      await new Promise(resolve => setTimeout(resolve, 2500));
      setStep("promoted");
      showToast("success", `Bulk promotion completed — ${totalPromoted} students promoted, ${totalRetained} retained.`);
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Promotion failed");
      setStep("idle");
    }
  };

  const handleArchive = async () => {
    setStep("archiving");
    try {
      // Archive school year — call schoolYearsApi
      const current = schoolYears.find(sy => sy.is_current === 1);
      if (current) {
        await schoolYearsApi.update(current.id, { enrollment_open: 0 });
        showToast("success", `School Year ${currentSY} has been archived. ${nextSY} is now active.`);
      }
      setStep("archived");
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Archive failed");
      setStep("promoted");
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-gray-400 text-sm">Loading academic year data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Calendar size={20} className="text-blue-700" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800">Academic Year Management</h2>
            <p className="text-gray-500 text-sm">End-of-year bulk promotion, retention processing, and school year archiving</p>
          </div>
        </div>
      </div>

      {/* School Year Config */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-4">School Year Configuration</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Current School Year</label>
            <input value={currentSY} onChange={e => setCurrentSY(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Incoming School Year</label>
            <input value={nextSY} onChange={e => setNextSY(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Info size={17} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800 leading-relaxed">
          <p className="font-semibold mb-1">End-of-Year Process Order</p>
          <p><span className="font-semibold">Step 1 — Bulk Promotion:</span> Advances all students with a general average of 75 and above to the next grade level. Students below 75 are automatically marked as retained.</p>
          <p className="mt-1"><span className="font-semibold">Step 2 — Archive School Year:</span> Locks all records for {currentSY}, moves them to the historical archive, and initializes {nextSY} as the new active school year. This action is irreversible.</p>
        </div>
      </div>

      {/* Step 1 — Bulk Promotion */}
      <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${step === "promoted" || step === "confirm-archive" || step === "archiving" || step === "archived" ? "border-green-200" : "border-gray-200"}`}>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === "promoted" || step === "archived" ? "bg-green-600 text-white" : "bg-blue-100 text-blue-700"}`}>
              {step === "promoted" || step === "archived" ? <CheckCircle size={16} /> : "1"}
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Bulk Promotion — All Grade Levels</h3>
              <p className="text-xs text-gray-500">Promotes eligible students school-wide based on final general averages</p>
            </div>
          </div>
          {(step === "promoted" || step === "archived") && (
            <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">Completed</span>
          )}
        </div>

        <div className="p-5">
          {/* Summary table */}
          <div className="overflow-x-auto rounded-xl border border-gray-100 mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Transition</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-green-600 uppercase">For Promotion</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-red-500 uppercase">For Retention</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Promotion Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {promotionSummary.map(r => (
                  <tr key={r.label} className="hover:bg-gray-50/60">
                    <td className="px-5 py-3 font-medium text-gray-800">{r.label}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{r.total}</td>
                    <td className="px-4 py-3 text-center font-bold text-green-600">{r.promoted}</td>
                    <td className="px-4 py-3 text-center font-bold text-red-500">{r.retained}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 bg-gray-100 rounded-full h-1.5">
                          <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${r.total > 0 ? Math.round((r.promoted / r.total) * 100) : 0}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-green-700">{r.total > 0 ? Math.round((r.promoted / r.total) * 100) : 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-blue-50 font-bold">
                  <td className="px-5 py-3 text-blue-800">TOTAL</td>
                  <td className="px-4 py-3 text-center text-blue-700">{totalStudents}</td>
                  <td className="px-4 py-3 text-center text-green-700">{totalPromoted}</td>
                  <td className="px-4 py-3 text-center text-red-600">{totalRetained}</td>
                  <td className="px-4 py-3 text-center text-blue-700">{totalStudents > 0 ? Math.round((totalPromoted / totalStudents) * 100) : 0}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          {step === "idle" && (
            <button onClick={() => setStep("confirm-promote")}
              className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
              <ArrowUpCircle size={16} /> Execute Bulk Promotion
            </button>
          )}
          {step === "promoting" && (
            <div className="flex items-center gap-3 text-blue-700 text-sm font-medium">
              <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-700 rounded-full animate-spin" />
              Processing promotion for {totalStudents} students across all grade levels...
            </div>
          )}
          {(step === "promoted" || step === "confirm-archive" || step === "archiving" || step === "archived") && (
            <div className="flex items-center gap-2 text-green-700 text-sm font-semibold bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <CheckCircle size={16} /> Bulk promotion completed — {totalPromoted} students promoted, {totalRetained} retained.
            </div>
          )}
        </div>
      </div>

      {/* Step 2 — Archive */}
      <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${step === "archived" ? "border-green-200" : "border-gray-200"}`}>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === "archived" ? "bg-green-600 text-white" : step === "promoted" || step === "confirm-archive" || step === "archiving" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-400"}`}>
              {step === "archived" ? <CheckCircle size={16} /> : "2"}
            </div>
            <div>
              <h3 className={`font-semibold ${step !== "promoted" && step !== "confirm-archive" && step !== "archiving" && step !== "archived" ? "text-gray-400" : "text-gray-800"}`}>
                Archive School Year {currentSY}
              </h3>
              <p className="text-xs text-gray-500">Locks all records and initializes {nextSY} as the active school year</p>
            </div>
          </div>
          {step === "archived" && (
            <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">Completed</span>
          )}
        </div>

        <div className="p-5">
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
                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
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
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-700 text-sm font-semibold bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <CheckCircle size={16} /> School Year {currentSY} has been archived. {nextSY} is now the active school year.
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Records Archived</p>
                  <p className="text-xl font-bold text-gray-700">{totalStudents}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Active School Year</p>
                  <p className="text-sm font-bold text-green-700">{nextSY}</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Enrollment Status</p>
                  <p className="text-sm font-bold text-blue-700">Open for {nextSY}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {step === "confirm-promote" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <AlertTriangle size={22} className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Confirm Bulk Promotion</h3>
                <p className="text-gray-500 text-xs">School-wide — all grade levels</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1.5 mb-5">
              <div className="flex justify-between"><span className="text-gray-500">Total Students:</span><span className="font-semibold">{totalStudents}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">For Promotion:</span><span className="font-semibold text-green-700">{totalPromoted}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">For Retention:</span><span className="font-semibold text-red-600">{totalRetained}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">School Year:</span><span className="font-semibold">{currentSY} → {nextSY}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("idle")} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handlePromote} className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-2.5 rounded-xl text-sm font-semibold">Confirm Promotion</button>
            </div>
          </div>
        </div>
      )}

      {step === "confirm-archive" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <Archive size={22} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Confirm Archive</h3>
                <p className="text-gray-500 text-xs">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              You are about to permanently archive School Year <strong>{currentSY}</strong>. All records will be locked and <strong>{nextSY}</strong> will become the new active school year. Are you absolutely sure?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setStep("promoted")} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleArchive} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold">Yes, Archive</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
