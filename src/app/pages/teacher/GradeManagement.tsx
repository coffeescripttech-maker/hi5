import { useState, useEffect, useRef } from "react";
import {
  BookOpen, Lock, Save, CheckCircle, Info, MessageSquare, Send, X, AlertTriangle,
  Users, GraduationCap, Loader2, UserCheck, Search,
} from "lucide-react";
import { studentsApi, StudentRow } from "../../services/students";
import { gradesApi } from "../../services/grades";
import { subjectsApi, SubjectRow } from "../../services/subjects";
import { useApp } from "../../context/AppContext";

type GradeEntry = {
  subject: string;
  subject_id: number;
  q1: number | "";
  q2: number | "";
  q3: number | "";
  q4: number | "";
  grade_ids: (number | null)[];
};

const toNum = (v: number | ""): number => (v === "" ? 0 : Number(v));

const avg = (row: GradeEntry): string => {
  const vals = [row.q1, row.q2, row.q3, row.q4].filter(v => v !== "");
  if (vals.length === 0) return "—";
  const sum = vals.reduce((a, b) => toNum(a) + toNum(b), 0);
  return (sum / vals.length).toFixed(2);
};

const allAvg = (rows: GradeEntry[]): string => {
  const avgs = rows.map(r => {
    const vals = [r.q1, r.q2, r.q3, r.q4].filter(v => v !== "");
    if (vals.length === 0) return null;
    const sum = vals.reduce((a, b) => toNum(a) + toNum(b), 0);
    return sum / vals.length;
  }).filter(Boolean) as number[];
  if (avgs.length === 0) return "—";
  return (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(2);
};

const getDescriptor = (val: string): { label: string; color: string } => {
  const n = parseFloat(val);
  if (isNaN(n)) return { label: "—", color: "text-gray-400" };
  if (n >= 90) return { label: "Outstanding", color: "text-green-600" };
  if (n >= 85) return { label: "Very Satisfactory", color: "text-blue-600" };
  if (n >= 80) return { label: "Satisfactory", color: "text-teal-600" };
  if (n >= 75) return { label: "Fairly Satisfactory", color: "text-yellow-600" };
  return { label: "Did Not Meet Expectations", color: "text-red-500" };
};

export function GradeManagement() {
  const { showToast } = useApp();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [locked, setLocked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionSubject, setCorrectionSubject] = useState("");
  const [correctionJustification, setCorrectionJustification] = useState("");
  const [correctionSubmitted, setCorrectionSubmitted] = useState(false);
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const [schoolYearId, setSchoolYearId] = useState(1);

  // Fetch teacher-scoped students + subjects + SY
  useEffect(() => {
    Promise.all([
      studentsApi.listMyStudents(),
      subjectsApi.list(),
      (async () => {
        try {
          const { schoolYearsApi } = await import("../../services/schoolYears");
          const years = await schoolYearsApi.list();
          const current = years.find(y => y.is_current === 1);
          return current?.id || 1;
        } catch { return 1; }
      })(),
    ]).then(([studs, subs, sy]) => {
      setStudents(studs);
      setSubjects(subs);
      setSchoolYearId(sy);
      if (studs.length > 0) setSelectedStudent(studs[0]);
    }).catch(err => {
      showToast("error", "Failed to load data: " + (err.detail?.error || err.message));
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  // ── Autosearch: filter suggestions as user types ──
  const searchRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = searchQuery.length >= 1
    ? students.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.lrn.includes(searchQuery) ||
        s.student_id.includes(searchQuery)
      ).slice(0, 6)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectStudent = (s: StudentRow) => {
    setSelectedStudent(s);
    setSearchQuery(s.lrn + " — " + s.name);
    setShowSuggestions(false);
  };

  // Fetch grades when student changes
  useEffect(() => {
    if (!selectedStudent) return;
    setLoadingGrades(true);
    const subs = subjects.filter(s => s.grade_level === selectedStudent.grade_level);
    gradesApi.list({ student_id: selectedStudent.id, school_year_id: schoolYearId })
      .then((apiGrades: any) => {
        // Backend returns pivoted format when student_id is provided:
        // { student_id, enrollment, subjects: [{ subject_id, subject_name, q1, q2, q3, q4, is_locked }] }
        // Handle both the pivoted object format and the flat array format
        const subjectsData = apiGrades?.subjects ?? apiGrades;
        const isPivoted = !Array.isArray(apiGrades) && apiGrades?.subjects;

        const entries: GradeEntry[] = subs.map(sub => {
          if (isPivoted) {
            const found = subjectsData.find((s: any) => s.subject_id === sub.id);
            return {
              subject: sub.name,
              subject_id: sub.id,
              q1: found?.q1 != null ? Number(found.q1) : "",
              q2: found?.q2 != null ? Number(found.q2) : "",
              q3: found?.q3 != null ? Number(found.q3) : "",
              q4: found?.q4 != null ? Number(found.q4) : "",
              grade_ids: [null, null, null, null],
            };
          }
          // Flat array format: find individual quarter records
          const q1g = subjectsData.find((g: any) => g.subject_id === sub.id && g.quarter === 1);
          const q2g = subjectsData.find((g: any) => g.subject_id === sub.id && g.quarter === 2);
          const q3g = subjectsData.find((g: any) => g.subject_id === sub.id && g.quarter === 3);
          const q4g = subjectsData.find((g: any) => g.subject_id === sub.id && g.quarter === 4);
          return {
            subject: sub.name,
            subject_id: sub.id,
            q1: q1g?.grade != null ? Number(q1g.grade) : "",
            q2: q2g?.grade != null ? Number(q2g.grade) : "",
            q3: q3g?.grade != null ? Number(q3g.grade) : "",
            q4: q4g?.grade != null ? Number(q4g.grade) : "",
            grade_ids: [q1g?.id ?? null, q2g?.id ?? null, q3g?.id ?? null, q4g?.id ?? null],
          };
        });
        setGrades(entries);
        // Determine locked state from either format
        if (isPivoted) {
          setLocked(subjectsData.some((s: any) => s.is_locked === 1));
        } else {
          setLocked(subjectsData.some((g: any) => g.is_locked === 1));
        }
      })
      .catch(() => {
        // Initialize empty
        const entries: GradeEntry[] = subs.map(sub => ({
          subject: sub.name, subject_id: sub.id,
          q1: "", q2: "", q3: "", q4: "",
          grade_ids: [null, null, null, null],
        }));
        setGrades(entries);
        setLocked(false);
      })
      .finally(() => setLoadingGrades(false));
  }, [selectedStudent, schoolYearId]);

  const updateGrade = (idx: number, quarter: "q1" | "q2" | "q3" | "q4", value: string) => {
    if (locked) return;
    const parsed = parseFloat(value);
    const num = value === "" ? "" : Math.min(100, Math.max(0, isNaN(parsed) ? 0 : parsed));
    setGrades(g => g.map((row, i) => i === idx ? { ...row, [quarter]: num } : row));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!selectedStudent) return;
    setSaving(true);
    try {
      for (const entry of grades) {
        const quarters: ("q1" | "q2" | "q3" | "q4")[] = ["q1", "q2", "q3", "q4"];
        for (const q of quarters) {
          const qi = quarters.indexOf(q) + 1;
          const val = entry[q];
          if (val !== "") {
            await gradesApi.upsert({
              student_id: selectedStudent.id,
              subject_id: entry.subject_id,
              school_year_id: schoolYearId,
              quarter: qi,
              grade: val as number,
            });
          }
        }
      }
      showToast("success", "Grades saved successfully.");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to save grades");
    } finally {
      setSaving(false);
    }
  };

  const handleLock = async () => {
    if (!selectedStudent) return;
    setLocking(true);
    try {
      await gradesApi.lock({ student_id: selectedStudent.id, school_year_id: schoolYearId });
      setLocked(true);
      setShowLockModal(false);
      showToast("success", "Grades locked. Corrections can be requested individually.");
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to lock grades");
    } finally {
      setLocking(false);
    }
  };

  const handleSubmitCorrection = async () => {
    if (!selectedStudent || !correctionSubject) return;
    setSubmittingCorrection(true);
    try {
      const sub = grades.find(g => g.subject === correctionSubject);
      await gradesApi.requestCorrection({
        student_id: selectedStudent.id,
        subject_id: sub?.subject_id || 0,
        school_year_id: schoolYearId,
        quarter: 1,
        justification: correctionJustification,
      });
      setCorrectionSubmitted(true);
      showToast("success", "Correction request submitted for review.");
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to submit correction");
    } finally {
      setSubmittingCorrection(false);
    }
  };

  const overallAvg = allAvg(grades);
  const descriptor = getDescriptor(overallAvg);

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-5 animate-pulse">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-emerald-200 via-green-200 to-emerald-200" />
          <div className="p-6 space-y-5">
            <div className="h-5 w-56 bg-gray-100 rounded-lg" />
            <div className="h-4 w-80 bg-gray-50 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-16 bg-white rounded-2xl border border-gray-100 shadow-sm" />
          <div className="h-16 bg-white rounded-2xl border border-gray-100 shadow-sm" />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-12 bg-gray-50" />
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-gray-50 rounded-lg" />)}
          </div>
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
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center shadow-sm">
              <BookOpen size={22} className="text-emerald-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">Grade Management</h2>
              <p className="text-sm text-gray-400">Encode and manage student grades per subject and quarter</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info Banner ── */}
      {!students.length ? (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 rounded-xl p-4 sm:p-5 flex gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 shadow-xs">
            <AlertTriangle size={16} className="text-amber-700" />
          </div>
          <div className="text-sm text-amber-800">
            <p className="font-bold mb-1">No Students Assigned</p>
            <p className="text-amber-700 text-xs leading-relaxed">
              You don't have any students assigned to your sections yet. Students appear here once they are enrolled in sections where you are the adviser.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/60 rounded-xl p-4 sm:p-5 flex gap-3 transition-shadow duration-200 hover:shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 shadow-xs">
            <Info size={16} className="text-blue-700" />
          </div>
          <div className="text-sm text-blue-800">
            <p className="font-bold mb-1">How to Encode Grades</p>
            <p className="text-blue-700 text-xs leading-relaxed">
              Select a student from the dropdown, enter grades (0–100) for each subject and quarter. When complete, <strong>Lock & Finalize</strong> to prevent further changes.
              Locked grades can only be corrected via a <strong>Correction Request</strong> approved by the Registrar.
            </p>
          </div>
        </div>
      )}

      {/* ── Student Selector + General Average ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm transition-shadow duration-200 relative z-10">
          <div className="h-0.5 bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-400" />
          <div className="p-4 sm:p-5">
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-[0.05em]">Select Student</label>
            <div className="relative" ref={searchRef}>
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                onFocus={() => { if (searchQuery.length >= 1) setShowSuggestions(true); }}
                placeholder="Search by name, LRN, or Student ID..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-white transition"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); setSelectedStudent(null); setShowSuggestions(false); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                >
                  <X size={14} />
                </button>
              )}

              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  {suggestions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => selectStudent(s)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-emerald-50/60 transition border-b border-gray-50 last:border-0"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center flex-shrink-0">
                        <UserCheck size={14} className="text-emerald-700" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-800 truncate">{s.name}</p>
                        <p className="text-xs text-gray-400">
                          {s.lrn} · Grade {s.grade_level} · {s.sex === "male" ? "Male" : "Female"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected student badge */}
            {selectedStudent && !showSuggestions && (
              <div className="mt-3 flex items-center gap-2.5 bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200/60 rounded-xl px-4 py-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0 shadow-xs">
                  <UserCheck size={14} className="text-emerald-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-800 truncate">{selectedStudent.name}</p>
                  <p className="text-[11px] text-gray-500">{selectedStudent.lrn} · Grade {selectedStudent.grade_level} · {selectedStudent.sex === "male" ? "Male" : "Female"}</p>
                </div>
                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">Selected</span>
              </div>
            )}

            <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
              <Users size={11} /> {students.length} student{students.length !== 1 ? "s" : ""} under your advisorship
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-shadow duration-200">
          <div className="h-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-400" />
          <div className="p-4 sm:p-5 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center shadow-xs">
                <GraduationCap size={13} className="text-blue-700" />
              </div>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-[0.04em]">General Average</p>
            </div>
            <p className={`text-3xl font-extrabold tracking-tight ${descriptor.color}`}>
              {loadingGrades ? "..." : overallAvg}
            </p>
            <p className={`text-xs font-semibold ${descriptor.color} mt-0.5`}>
              {loadingGrades ? "Calculating..." : descriptor.label}
            </p>
          </div>
        </div>
      </div>

      {/* ── Grades Table ── */}
      {selectedStudent && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-shadow duration-200">
          <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center shadow-xs">
                <UserCheck size={16} className="text-emerald-700" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  {selectedStudent.name}
                  <span className="bg-gray-100 text-gray-500 text-[10px] font-semibold px-2 py-0.5 rounded-md">Grade {selectedStudent.grade_level}</span>
                </h3>
                <p className="text-[11px] text-gray-400">LRN: {selectedStudent.lrn}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {locked && (
                <span className="inline-flex items-center gap-1.5 text-[11px] bg-gray-100 text-gray-500 px-2.5 py-1.5 rounded-full font-semibold">
                  <Lock size={11} /> Locked
                </span>
              )}
              {saved && (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                  <CheckCircle size={12} /> Saved
                </span>
              )}
            </div>
          </div>

          {loadingGrades ? (
            <div className="p-12 text-center">
              <Loader2 size={24} className="animate-spin text-emerald-500 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Loading grades...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="bg-gradient-to-r from-emerald-50/80 via-green-50/80 to-emerald-50/50 border-b border-emerald-100">
                      {["Subject", "Q1", "Q2", "Q3", "Q4", "Final", "Remarks"].map(h => (
                        <th key={h} className={`${h === "Subject" ? "text-left pl-5" : "text-center px-3"} py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-[0.06em]`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {grades.map((row, idx) => {
                      const finalGrade = avg(row);
                      const desc = getDescriptor(finalGrade);
                      return (
                        <tr key={row.subject} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-emerald-50/40 transition-colors duration-150`}>
                          <td className="pl-5 pr-3 py-3 font-semibold text-gray-700 text-sm">{row.subject}</td>
                          {(["q1", "q2", "q3", "q4"] as const).map(q => (
                            <td key={q} className="px-3 py-2.5 text-center">
                              <input
                                type="number" min="0" max="100" step="0.01"
                                value={row[q]}
                                onChange={e => updateGrade(idx, q, e.target.value)}
                                disabled={locked}
                                className={`w-20 text-center border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition ${
                                  locked ? "bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed" : "border-gray-200 bg-white"
                                }`}
                              />
                            </td>
                          ))}
                          <td className="px-3 py-3 text-center font-extrabold text-gray-800 text-base">{finalGrade}</td>
                          <td className="px-3 py-3 text-center">
                            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                              desc.label === "Outstanding" ? "bg-green-50 text-green-700" :
                              desc.label === "Very Satisfactory" ? "bg-blue-50 text-blue-700" :
                              desc.label === "Satisfactory" ? "bg-teal-50 text-teal-700" :
                              desc.label === "Fairly Satisfactory" ? "bg-yellow-50 text-yellow-700" :
                              desc.label === "Did Not Meet Expectations" ? "bg-red-50 text-red-700" :
                              "bg-gray-50 text-gray-400"
                            }`}>{desc.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {grades.length === 0 && (
                <div className="p-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                    <BookOpen size={28} className="text-gray-300" />
                  </div>
                  <p className="text-gray-500 text-sm font-semibold">No subjects configured</p>
                  <p className="text-gray-400 text-xs mt-1">No subjects found for Grade {selectedStudent.grade_level}.</p>
                </div>
              )}

              {/* ── Actions ── */}
              <div className="px-5 sm:px-6 py-4 border-t border-gray-100 flex items-center gap-3 flex-wrap">
                {!locked ? (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm disabled:shadow-none"
                    >
                      {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                      {saving ? "Saving..." : "Save Grades"}
                    </button>
                    <button
                      onClick={() => setShowLockModal(true)}
                      disabled={saving}
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm disabled:shadow-none"
                    >
                      <Lock size={15} /> Lock & Finalize
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setShowCorrectionModal(true); setCorrectionSubject(""); setCorrectionJustification(""); setCorrectionSubmitted(false); }}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm"
                  >
                    <MessageSquare size={15} /> Request Grade Correction
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Lock Confirmation Modal ── */}
      {showLockModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shadow-sm">
                <AlertTriangle size={22} className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Lock & Finalize Grades</h3>
                <p className="text-gray-400 text-xs">This action will prevent further edits</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-100 rounded-xl p-4 text-sm space-y-3 mb-5">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Student:</span>
                <span className="font-bold text-gray-800">{selectedStudent.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Grade Level:</span>
                <span className="font-semibold">Grade {selectedStudent.grade_level}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                <span className="text-gray-500">General Average:</span>
                <span className={`font-bold text-lg ${descriptor.color}`}>{overallAvg}</span>
              </div>
            </div>

            <p className="text-xs text-gray-500 mb-5 leading-relaxed">
              Once locked, grades cannot be edited directly. If changes are needed, you must submit a <strong>Correction Request</strong> to the Registrar for approval.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowLockModal(false)}
                disabled={locking}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleLock}
                disabled={locking}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {locking ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                {locking ? "Locking..." : "Yes, Lock Grades"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Correction Request Modal ── */}
      {showCorrectionModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            {!correctionSubmitted ? (
              <>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shadow-sm">
                      <MessageSquare size={18} className="text-blue-700" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Grade Correction Request</h3>
                      <p className="text-xs text-gray-400">Submit for Registrar approval</p>
                    </div>
                  </div>
                  <button onClick={() => setShowCorrectionModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition">
                    <X size={16} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.05em] mb-1.5">Subject</label>
                    <select
                      value={correctionSubject}
                      onChange={e => setCorrectionSubject(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white transition"
                    >
                      <option value="">Select subject...</option>
                      {grades.map(g => <option key={g.subject}>{g.subject}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.05em] mb-1.5">Justification</label>
                    <textarea
                      value={correctionJustification}
                      onChange={e => setCorrectionJustification(e.target.value)}
                      rows={4} placeholder="Explain why the grade needs to be corrected..."
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white transition resize-none"
                    />
                  </div>
                  <button
                    onClick={handleSubmitCorrection}
                    disabled={!correctionSubject || !correctionJustification || submittingCorrection}
                    className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 text-white py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm disabled:shadow-none"
                  >
                    {submittingCorrection ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {submittingCorrection ? "Submitting..." : "Submit Correction Request"}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <CheckCircle size={32} className="text-green-600" />
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-1">Request Submitted</h3>
                <p className="text-sm text-gray-500 mb-5">Your correction request has been forwarded to the Registrar for review.</p>
                <button
                  onClick={() => setShowCorrectionModal(false)}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-2.5 rounded-xl text-sm font-semibold transition shadow-sm"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
