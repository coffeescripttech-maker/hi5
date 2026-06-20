import React, { useState, useEffect } from "react";
import { Lock, Save, CheckCircle, Info, BookOpen, MessageSquare, Send, X } from "lucide-react";
import { studentsApi, StudentRow } from "../../services/students";
import { gradesApi, GradeRow } from "../../services/grades";
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

const avg = (row: GradeEntry): string => {
  const vals = [row.q1, row.q2, row.q3, row.q4].filter(v => v !== "") as number[];
  if (vals.length === 0) return "—";
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
};

const allAvg = (rows: GradeEntry[]): string => {
  const avgs = rows.map(r => {
    const vals = [r.q1, r.q2, r.q3, r.q4].filter(v => v !== "") as number[];
    if (vals.length < 4) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
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

const SUBJECTS_BY_GRADE: Record<number, { id: number; name: string }[]> = {
  7: [
    { id: 1, name: "English" }, { id: 2, name: "Filipino" }, { id: 3, name: "Mathematics" },
    { id: 4, name: "Science" }, { id: 5, name: "Araling Panlipunan" }, { id: 6, name: "MAPEH" },
    { id: 7, name: "Edukasyon sa Pagpapakatao" }, { id: 8, name: "TLE" },
  ],
};

export function GradeManagement() {
  const { showToast } = useApp();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [locked, setLocked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionSubject, setCorrectionSubject] = useState("");
  const [correctionJustification, setCorrectionJustification] = useState("");
  const [correctionSubmitted, setCorrectionSubmitted] = useState(false);
  const [correctionHistory, setCorrectionHistory] = useState<{ subject: string; justification: string; date: string; status: string }[]>([]);
  const [schoolYearId, setSchoolYearId] = useState(1);

  // Fetch students
  useEffect(() => {
    studentsApi.list()
      .then(data => {
        setStudents(data);
        if (data.length > 0) setSelectedStudent(data[0]);
      })
      .catch(err => showToast("error", "Failed to load students: " + (err.detail?.error || err.message)))
      .finally(() => setLoading(false));
  }, []);

  // Fetch grades when student changes
  useEffect(() => {
    if (!selectedStudent) return;
    const subs = SUBJECTS_BY_GRADE[selectedStudent.grade_level] || SUBJECTS_BY_GRADE[7] || [];
    gradesApi.list({ student_id: selectedStudent.id, school_year_id: schoolYearId })
      .then(apiGrades => {
        const entries: GradeEntry[] = subs.map(sub => {
          const q1g = apiGrades.find(g => g.subject_id === sub.id && g.quarter === 1);
          const q2g = apiGrades.find(g => g.subject_id === sub.id && g.quarter === 2);
          const q3g = apiGrades.find(g => g.subject_id === sub.id && g.quarter === 3);
          const q4g = apiGrades.find(g => g.subject_id === sub.id && g.quarter === 4);
          return {
            subject: sub.name,
            subject_id: sub.id,
            q1: q1g?.grade ?? "",
            q2: q2g?.grade ?? "",
            q3: q3g?.grade ?? "",
            q4: q4g?.grade ?? "",
            grade_ids: [q1g?.id ?? null, q2g?.id ?? null, q3g?.id ?? null, q4g?.id ?? null],
          };
        });
        setGrades(entries);
        setLocked(apiGrades.some(g => g.is_locked === 1));
      })
      .catch(() => {
        // Initialize empty
        const entries: GradeEntry[] = subs.map(sub => ({
          subject: sub.name, subject_id: sub.id,
          q1: "", q2: "", q3: "", q4: "",
          grade_ids: [null, null, null, null],
        }));
        setGrades(entries);
      });
  }, [selectedStudent, schoolYearId]);

  const updateGrade = (idx: number, quarter: "q1" | "q2" | "q3" | "q4", value: string) => {
    if (locked) return;
    const num = value === "" ? "" : Math.min(100, Math.max(0, parseInt(value) || 0));
    setGrades(g => g.map((row, i) => i === idx ? { ...row, [quarter]: num } : row));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!selectedStudent) return;
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
    }
  };

  const handleLock = async () => {
    if (!selectedStudent) return;
    try {
      await gradesApi.lock({ student_id: selectedStudent.id, school_year_id: schoolYearId });
      setLocked(true);
      showToast("success", "Grades locked. Corrections can be requested individually.");
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to lock grades");
    }
  };

  const handleSubmitCorrection = async () => {
    if (!selectedStudent || !correctionSubject) return;
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
    }
  };

  const overallAvg = allAvg(grades);
  const descriptor = getDescriptor(overallAvg);

  if (loading) {
    return <div className="p-10 text-center text-gray-400 text-sm">Loading students...</div>;
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
          <BookOpen size={20} className="text-emerald-700" />
        </div>
        <div>
          <h2 className="font-bold text-gray-800">Grade Management</h2>
          <p className="text-gray-500 text-sm">Encode student grades per quarter.</p>
        </div>
      </div>

      {/* Student Selector + Overall Average */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Select Student</label>
          <select
            value={selectedStudent?.id ?? ""}
            onChange={e => setSelectedStudent(students.find(s => s.id === parseInt(e.target.value)) || null)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.lrn} — {s.name} (Grade {s.grade_level})</option>
            ))}
          </select>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col justify-center">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">General Average</p>
          <p className={`text-3xl font-extrabold ${descriptor.color}`}>{overallAvg}</p>
          <p className={`text-xs font-medium ${descriptor.color}`}>{descriptor.label}</p>
        </div>
      </div>

      {/* Grades Table */}
      {selectedStudent && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-800">{selectedStudent.name}</h3>
              <span className="text-xs text-gray-400">Grade {selectedStudent.grade_level}</span>
            </div>
            <div className="flex items-center gap-2">
              {locked && (
                <span className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full">
                  <Lock size={11} /> Locked
                </span>
              )}
              {saved && (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle size={12} /> Saved
                </span>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Subject</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Q1</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Q2</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Q3</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Q4</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Final</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {grades.map((row, idx) => {
                  const finalGrade = avg(row);
                  const desc = getDescriptor(finalGrade);
                  return (
                    <tr key={row.subject} className="hover:bg-gray-50/60">
                      <td className="px-5 py-3 font-medium text-gray-700">{row.subject}</td>
                      {(["q1", "q2", "q3", "q4"] as const).map(q => (
                        <td key={q} className="px-3 py-3 text-center">
                          <input
                            type="number" min="0" max="100"
                            value={row[q]} onChange={e => updateGrade(idx, q, e.target.value)}
                            disabled={locked}
                            className={`w-14 text-center border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                              locked ? "bg-gray-100 text-gray-400" : "border-gray-200"
                            }`}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-3 text-center font-bold text-gray-800">{finalGrade}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-xs font-semibold ${desc.color}`}>{desc.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-3">
            {!locked ? (
              <>
                <button onClick={handleSave} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
                  <Save size={15} /> Save Grades
                </button>
                <button onClick={handleLock} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
                  <Lock size={15} /> Lock & Finalize
                </button>
              </>
            ) : (
              <button onClick={() => { setShowCorrectionModal(true); setCorrectionSubject(""); setCorrectionJustification(""); setCorrectionSubmitted(false); }}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
                <MessageSquare size={15} /> Request Grade Correction
              </button>
            )}
          </div>
        </div>
      )}

      {/* Correction Request Modal */}
      {showCorrectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            {!correctionSubmitted ? (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold text-gray-800">Grade Correction Request</h3>
                  <button onClick={() => setShowCorrectionModal(false)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400"><X size={16} /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Subject</label>
                    <select value={correctionSubject} onChange={e => setCorrectionSubject(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select subject...</option>
                      {grades.map(g => <option key={g.subject}>{g.subject}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Justification</label>
                    <textarea value={correctionJustification} onChange={e => setCorrectionJustification(e.target.value)}
                      rows={4} placeholder="Explain why the grade needs to be corrected..."
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <button onClick={handleSubmitCorrection} disabled={!correctionSubject || !correctionJustification}
                    className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-200 disabled:text-gray-400 text-white py-2.5 rounded-xl text-sm font-semibold transition">
                    <Send size={14} /> Submit Correction Request
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle size={28} className="text-green-600" />
                </div>
                <h3 className="font-bold text-gray-800 mb-1">Request Submitted</h3>
                <p className="text-sm text-gray-500 mb-5">Your correction request has been forwarded to the Registrar for review.</p>
                <button onClick={() => setShowCorrectionModal(false)}
                  className="w-full bg-blue-700 hover:bg-blue-800 text-white py-2.5 rounded-xl text-sm font-semibold">Done</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
