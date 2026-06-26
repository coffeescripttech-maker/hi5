import React, { useState, useEffect, useCallback } from "react";
import {
  Play, RotateCcw, CheckCircle, Info, Users, AlertTriangle,
  GraduationCap, BarChart2, Shield, Activity, Zap,
  BookOpen, Target, Save, AlertCircle, Loader2,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { sectioningApi, SectioningStudent, SectioningSection, SectioningData } from "../../services/sectioning";

// ── Section threshold config (used as fallback when sections lack min_average) ──
const THRESHOLD_RANGES = [
  { min: 90, max: 100, label: "Star", icon: "⭐", key: "Star Section" },
  { min: 85, max: 89, label: "Gold", icon: "🥇", key: "Gold Section" },
  { min: 80, max: 84, label: "Silver", icon: "🥈", key: "Silver Section" },
  { min: 75, max: 79, label: "Regular", icon: "📚", key: "Regular Section" },
  { min: 0, max: 74, label: "Non-Reader", icon: "📖", key: "Non-Reader Section" },
];

const SECTION_TYPE_COLORS: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  ste: { color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-300", dot: "bg-amber-400" },
  regular: { color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-300", dot: "bg-blue-400" },
  spfl: { color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-300", dot: "bg-yellow-400" },
  spj: { color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-300", dot: "bg-slate-400" },
  non_reader: { color: "text-red-600", bg: "bg-red-50", border: "border-red-300", dot: "bg-red-400" },
};

interface Assignment {
  studentId: number;
  sectionId: number;
  sectionName: string;
  reason: string;
  icon: string;
  sectionType: string;
}

export function AutoSectioning() {
  const { showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SectioningData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sectioning state
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<number, Assignment>>({});
  const [assigned, setAssigned] = useState<Record<number, boolean>>({});
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showLogic, setShowLogic] = useState(false);

  // ── Fetch data ──
  useEffect(() => {
    sectioningApi.getPending()
      .then(setData)
      .catch(err => setError(err.detail?.error || err.message || "Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  // ── Find matching section for a student ──
  const findSection = useCallback((student: SectioningStudent): Assignment | null => {
    if (!data) return null;

    const ga = student.general_average;
    const classifications = student.classifications;
    const isNonReader = classifications.includes("non_reader");

    // Get sections matching the student's grade level, sorted by min_average DESC
    const gradeSections = data.sections
      .filter(s => s.grade_level === student.grade_level)
      .sort((a, b) => b.min_average - a.min_average);

    if (gradeSections.length === 0) return null;

    // Non-Reader override
    if (isNonReader) {
      const nrSection = gradeSections.find(s => s.section_type === "non_reader");
      if (nrSection) {
        return {
          studentId: student.id,
          sectionId: nrSection.id,
          sectionName: nrSection.name,
          sectionType: nrSection.section_type,
          icon: "📖",
          reason: "Non-Reader classification",
        };
      }
    }

    // No GA — can't place
    if (ga === null) return null;

    // Find section where ga >= min_average, highest tier first
    let best = gradeSections.find(s => s.section_type !== "non_reader" && ga >= s.min_average);

    // If no section meets the threshold, assign to the lowest tier (non_reader or regular)
    if (!best) {
      best = gradeSections.find(s => s.section_type === "non_reader")
        || gradeSections[gradeSections.length - 1]; // fallback to last (lowest)
    }

    if (best) {
      const style = SECTION_TYPE_COLORS[best.section_type] || SECTION_TYPE_COLORS.regular;
      const iconMap: Record<string, string> = { ste: "🔬", spfl: "🌐", spj: "📰", regular: "📚", non_reader: "📖" };
      const extras: string[] = [];
      if (classifications.includes("pwd")) extras.push("PWD flagged");
      if (classifications.includes("4ps")) extras.push("4Ps beneficiary");

      return {
        studentId: student.id,
        sectionId: best.id,
        sectionName: best.name,
        sectionType: best.section_type,
        icon: iconMap[best.section_type] || "📚",
        reason: `GA: ${ga} (≥ ${best.min_average})` + (extras.length ? " · " + extras.join(" · ") : ""),
      };
    }

    return null;
  }, [data]);

  // ── Run sectioning (frontend algorithm) ──
  const runSectioning = () => {
    if (!data || data.students.length === 0) return;

    setRunning(true);
    setResults({});
    setAssigned({});
    setDone(false);
    setSaved(false);

    const sorted = [...data.students].sort((a, b) => (b.general_average ?? 0) - (a.general_average ?? 0));
    const allAssignments: Record<number, Assignment> = {};

    sorted.forEach(student => {
      const assignment = findSection(student);
      if (assignment) allAssignments[student.id] = assignment;
    });

    // Animate one by one
    const entries = Object.entries(allAssignments);
    entries.forEach(([sid], i) => {
      setTimeout(() => {
        setResults(prev => ({ ...prev, [parseInt(sid)]: allAssignments[parseInt(sid)] }));
        setAssigned(prev => ({ ...prev, [parseInt(sid)]: true }));
        if (i === entries.length - 1) {
          setTimeout(() => {
            setRunning(false);
            setDone(true);
            showToast("success", `Auto-Sectioning complete! ${entries.length} students assigned.`);
          }, 500);
        }
      }, (i + 1) * 400);
    });
  };

  // ── Save assignments to DB ──
  const saveAssignments = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const assignments = Object.values(results).map(r => ({
        student_id: r.studentId,
        section_id: r.sectionId,
      }));
      const result = await sectioningApi.assign({
        school_year_id: data.school_year.id,
        assignments,
      });
      setSaved(true);
      showToast("success", result.message);
    } catch (err: any) {
      showToast("error", "Failed to save: " + (err.detail?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  // ── Reset ──
  const reset = () => {
    setAssigned({});
    setResults({});
    setDone(false);
    setSaved(false);
  };

  const students = data?.students || [];
  const sections = data?.sections || [];

  // Section summary
  const assignmentsList = Object.values(results);
  const sectionSummary = done ? assignmentsList.reduce((acc, a) => {
    acc[a.sectionName] = (acc[a.sectionName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) : {};

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-5 pb-10 animate-pulse">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-emerald-200 via-green-200 to-emerald-200" />
          <div className="p-6 space-y-5">
            <div className="h-5 w-64 bg-gray-100 rounded-lg" />
            <div className="h-4 w-96 bg-gray-50 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-28 bg-white rounded-xl border border-gray-100" />)}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b">
            <div className="h-5 w-40 bg-gray-100 rounded-lg" />
          </div>
          <div className="p-6 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-50 rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-red-300" />
          </div>
          <p className="text-gray-500 text-base font-semibold">Failed to load sectioning data</p>
          <p className="text-gray-400 text-sm mt-1">{error}</p>
          <button
            onClick={() => { setError(null); setLoading(true); sectioningApi.getPending().then(setData).catch(err => setError(err.detail?.error || err.message)).finally(() => setLoading(false)); }}
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition"
          >
            <RotateCcw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-10">

      {/* ── Header ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-shadow duration-200">
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-400" />
        <div className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center shadow-sm">
                <Zap size={22} className="text-emerald-700" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 tracking-tight">Automatic Sectioning System</h2>
                <p className="text-sm text-gray-400">
                  {data
                    ? `${students.length} pending students · SY ${data.school_year.sy_label}`
                    : "GA-based assignment with classification awareness"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogic(!showLogic)}
                className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-500 px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition shadow-xs"
              >
                <Info size={14} /> {showLogic ? "Hide" : "How it works"}
              </button>
              {done && !saved && (
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-1.5 border border-gray-300 text-gray-600 px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition shadow-xs"
                >
                  <RotateCcw size={14} /> Reset
                </button>
              )}
              {students.length === 0 ? (
                <span className="inline-flex items-center gap-2 bg-gray-100 text-gray-400 px-5 py-2 rounded-lg text-sm font-medium cursor-default">
                  <CheckCircle size={14} /> No pending students
                </span>
              ) : saved ? (
                <span className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-5 py-2 rounded-lg text-sm font-medium border border-emerald-200/50">
                  <CheckCircle size={14} /> Saved to database
                </span>
              ) : done ? (
                <button
                  onClick={saveAssignments} disabled={saving}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition shadow-sm"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {saving ? "Saving..." : "Save Assignments"}
                </button>
              ) : (
                <button
                  onClick={runSectioning} disabled={running}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-medium transition shadow-sm"
                >
                  {running ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing...</>
                  ) : (
                    <><Play size={14} />Run Auto-Sectioning</>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Logic panel */}
          {showLogic && (
            <div className="mt-5 bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200/60 rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-emerald-200/50 flex items-center justify-center">
                  <Target size={13} className="text-emerald-700" />
                </div>
                <p className="text-sm font-bold text-emerald-800">Sectioning Logic</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-emerald-700">
                {[
                  { step: "1", title: "General Average (GA)", desc: "Primary basis — computed from all subject grades. Students without grades appear as N/A." },
                  { step: "2", title: "Section Thresholds", desc: `Each section has a min_average threshold. Student GA must meet or exceed it.` },
                  { step: "3", title: "Non-Reader Override", desc: "Students classified as Non-Reader are placed directly into the Non-Reader section." },
                  { step: "4", title: "PWD & 4Ps Flags", desc: "Special classifications are recorded for teacher awareness and reporting." },
                ].map(item => (
                  <div key={item.step} className="flex items-start gap-2.5 bg-white/60 rounded-lg p-3 border border-emerald-100/50">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{item.step}</span>
                    <div>
                      <p className="font-bold text-emerald-800">{item.title}</p>
                      <p className="text-emerald-600 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Threshold cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {THRESHOLD_RANGES.map(t => {
          const count = Object.entries(sectionSummary).find(([name]) => name.toLowerCase().includes(t.label.toLowerCase()));
          const countVal = count ? count[1] : undefined;
          const keyName = t.key;
          const sec = sections.find(s => s.section_type === t.label.toLowerCase());
          const style = SECTION_TYPE_COLORS[sec?.section_type || ""] || SECTION_TYPE_COLORS.regular;
          return (
            <div key={t.label} className={`${style.bg} ${style.border} border-2 rounded-xl p-4 text-center transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-default`}>
              <p className="text-2xl mb-1">{t.icon}</p>
              <p className="font-bold text-sm">{t.label}</p>
              <p className="text-xs opacity-75">GA: {t.min}–{t.max}</p>
              {countVal !== undefined ? (
                <div className={`mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${style.bg} ${style.border} border`}>
                  {countVal} student{countVal !== 1 ? "s" : ""}
                </div>
              ) : done ? (
                <div className="mt-2 text-xs text-gray-400">0 students</div>
              ) : (
                <div className="mt-2 text-xs text-gray-400">Pending</div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Student Assignment Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-shadow duration-200">
        <div className="h-0.5 bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-400" />
        <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center shadow-xs">
              <Users size={16} className="text-emerald-700" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Pending Students</h3>
              <p className="text-xs text-gray-400">{students.length} student{students.length !== 1 ? "s" : ""} awaiting assignment</p>
            </div>
          </div>
          {saved && (
            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-3 py-1.5 rounded-full border border-emerald-200/50 shadow-xs">
              <CheckCircle size={12} /> Saved to database
            </span>
          )}
          {done && !saved && (
            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-3 py-1.5 rounded-full border border-emerald-200/50 shadow-xs">
              <CheckCircle size={12} /> {assignmentsList.length} assigned
            </span>
          )}
          {running && (
            <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-[11px] font-semibold px-3 py-1.5 rounded-full border border-amber-200/50 shadow-xs animate-pulse">
              <Activity size={12} /> Processing...
            </span>
          )}
        </div>

        {students.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={28} className="text-emerald-300" />
            </div>
            <p className="text-gray-500 text-sm font-semibold">No pending students</p>
            <p className="text-gray-400 text-xs mt-1 max-w-sm mx-auto">
              All students have been assigned to sections. New students with "pending" status will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px]">
              <thead className="bg-gray-50/80">
                <tr>
                  {["Student", "LRN", "Grade", "GA", "Sex", "Classification", "Assigned Section", "Basis"].map(h => (
                    <th key={h} className="text-left px-4 py-3.5 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em] border-b border-gray-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {students.map(s => {
                  const assignment = results[s.id];
                  const isAssigned = assigned[s.id];

                  return (
                    <tr key={s.id} className={`transition-all duration-500 ${
                      isAssigned ? "bg-white opacity-100" : running ? "bg-gray-50/50 opacity-60" : "bg-white"
                    }`}>
                      {/* Student */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shadow-xs flex-shrink-0 ${
                            isAssigned ? "bg-gradient-to-br from-emerald-100 to-green-100 text-emerald-700" : "bg-gray-100 text-gray-400"
                          }`}>
                            {s.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                            <p className="text-[11px] text-gray-400 font-mono">{s.student_id}</p>
                          </div>
                        </div>
                      </td>

                      {/* LRN */}
                      <td className="px-4 py-3.5 text-xs text-gray-500 font-mono">{s.lrn}</td>

                      {/* Grade */}
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-semibold bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200/50">
                          Gr. {s.grade_level}
                        </span>
                      </td>

                      {/* GA */}
                      <td className="px-4 py-3.5">
                        {s.general_average !== null ? (
                          <span className={`inline-flex items-center gap-1 text-sm font-bold ${
                            s.general_average >= 75 ? "text-emerald-600" : "text-red-500"
                          }`}>
                            <BarChart2 size={12} className="opacity-60" />
                            {s.general_average}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300 italic">N/A</span>
                        )}
                      </td>

                      {/* Sex */}
                      <td className="px-4 py-3.5">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          s.sex === "male" ? "bg-blue-50 text-blue-700" : "bg-pink-50 text-pink-700"
                        }`}>
                          {s.sex === "male" ? "Male" : "Female"}
                        </span>
                      </td>

                      {/* Classification */}
                      <td className="px-4 py-3.5">
                        {s.classifications.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {s.classifications.map(c => (
                              <span key={c} className="text-[11px] font-semibold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200/50 capitalize">
                                {c === "4ps" ? "4Ps" : c === "pwd" ? "PWD" : c === "non_reader" ? "Non-Reader" : c}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* Assigned Section */}
                      <td className="px-4 py-3.5">
                        {isAssigned && assignment ? (
                          (() => {
                            const style = SECTION_TYPE_COLORS[assignment.sectionType] || SECTION_TYPE_COLORS.regular;
                            return (
                              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold shadow-xs ${style.bg} ${style.border} ${style.color}`}>
                                {assignment.icon} {assignment.sectionName}
                              </div>
                            );
                          })()
                        ) : running ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-3.5 h-3.5 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
                            <span className="text-xs text-gray-400">Processing...</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300 italic">Awaiting run</span>
                        )}
                      </td>

                      {/* Basis */}
                      <td className="px-4 py-3.5">
                        {isAssigned && assignment ? (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Shield size={10} className="text-gray-400" />
                            {assignment.reason}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-200">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Gender Distribution Summary ── */}
      {done && assignmentsList.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-shadow duration-200">
          <div className="h-0.5 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-400" />
          <div className="px-5 sm:px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center shadow-xs">
                <Users size={16} className="text-purple-700" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Gender Distribution Summary</h3>
                <p className="text-xs text-gray-400">Male / Female balance across all section tiers</p>
              </div>
            </div>
          </div>
          <div className="p-5 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {THRESHOLD_RANGES.map(t => {
                const sectionName = Object.keys(sectionSummary).find(n => n.toLowerCase().includes(t.label.toLowerCase()));
                if (!sectionName) return null;
                const inSec = students.filter(s => results[s.id]?.sectionName === sectionName);
                const male = inSec.filter(s => s.sex === "male").length;
                const female = inSec.filter(s => s.sex === "female").length;
                const mPct = inSec.length > 0 ? Math.round((male / inSec.length) * 100) : 0;
                const style = SECTION_TYPE_COLORS[t.label.toLowerCase()] || SECTION_TYPE_COLORS.regular;
                return (
                  <div key={t.key} className={`${style.bg} rounded-xl p-4 border ${style.border}`}>
                    <div className="flex items-center gap-1.5 mb-3">
                      <span>{t.icon}</span>
                      <p className="text-xs font-bold">{t.label}</p>
                    </div>
                    <div className="space-y-2.5">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-blue-600 font-medium">♂ Male</span>
                          <span className="font-bold">{male}</span>
                        </div>
                        <div className="w-full bg-white/70 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-blue-400 h-full rounded-full transition-all" style={{ width: `${mPct}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-pink-600 font-medium">♀ Female</span>
                          <span className="font-bold">{female}</span>
                        </div>
                        <div className="w-full bg-white/70 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-pink-400 h-full rounded-full transition-all" style={{ width: `${100 - mPct}%` }} />
                        </div>
                      </div>
                      <div className="flex justify-between text-xs border-t border-white/60 pt-2 mt-2">
                        <span className="text-gray-500 font-medium">Total</span>
                        <span className="font-bold">{inSec.length}</span>
                      </div>
                    </div>
                  </div>
                );
              }).filter(Boolean)}
            </div>
          </div>
        </div>
      )}

      {/* ── Section capacity summary (post-save) ── */}
      {saved && assignmentsList.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-shadow duration-200">
          <div className="h-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-400" />
          <div className="px-5 sm:px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center shadow-xs">
                <BookOpen size={16} className="text-blue-700" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Section Capacity Status</h3>
                <p className="text-xs text-gray-400">Current enrollment across all sections</p>
              </div>
            </div>
          </div>
          <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sections.map(sec => {
              const pct = Math.round((sec.current_count / sec.capacity) * 100);
              const pctColor = pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-emerald-500";
              return (
                <div key={sec.id} className="bg-gray-50/50 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-gray-800">{sec.name}</p>
                    <span className="text-xs text-gray-400">Gr. {sec.grade_level}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                    <span>{sec.current_count} / {sec.capacity}</span>
                    <span className={`font-bold ${pct >= 90 ? "text-red-500" : pct >= 75 ? "text-amber-500" : "text-emerald-500"}`}>{pct}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div className={`${pctColor} h-full rounded-full transition-all duration-500`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
