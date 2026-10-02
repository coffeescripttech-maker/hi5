import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  FileText, Filter, Users, CheckCircle, XCircle,
  Search, AlertTriangle, ClipboardList, School, ShieldCheck, Loader2
} from "lucide-react";
import { sectionsApi, SectionRow } from "../../services/sections";
import {
  enrollmentsApi, StudentWithRequirements, EnrollmentFlag,
  BatchRequirement,
} from "../../services/enrollments";
import { schoolYearsApi } from "../../services/schoolYears";
import { useApp } from "../../context/AppContext";

const REQUIREMENTS_LABELS: Record<string, string> = {
  psa_birth_cert: "PSA Birth Cert",
  previous_grade_card: "Previous Report Card",
  good_moral: "Good Moral Cert",
  id_photo: "2x2 ID Photo",
  medical_clearance: "Medical Clearance",
  parent_consent: "Parent Consent",
  transcript: "Transcript / Form 137",
  lrn_verification: "LRN Verification",
};

const REQUIREMENT_KEYS = Object.keys(REQUIREMENTS_LABELS);

export function DocumentCompletion() {
  const { showToast, role } = useApp();
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [students, setStudents] = useState<StudentWithRequirements[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [syId, setSyId] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [search, setSearch] = useState("");
  // Read-only duplicate-enrollment flags — students enrolled in more than one
  // section (or under different advisers) in the same school year.
  const [flags, setFlags] = useState<EnrollmentFlag[]>([]);
  const [flagsLoaded, setFlagsLoaded] = useState(false);
  // Document verification is an Enrollment Committee action: sighting a receipt
  // is a committee duty, so only those roles see the verify control.
  const canVerify = role === "enrollment_committee" || role === "admin";
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!selectedSectionId || !syId) return;
    setLoadingData(true);
    enrollmentsApi.batchRequirements(parseInt(selectedSectionId), syId)
      .then(setStudents)
      .catch(err => {
        showToast("error", "Failed to load requirements: " + (err.detail?.error || err.message));
      })
      .finally(() => setLoadingData(false));
  }, [selectedSectionId, syId, showToast]);

  const toggleVerified = async (
    student: StudentWithRequirements,
    req: BatchRequirement
  ) => {
    if (!canVerify || !req.enrollment_id || !req.is_submitted) return;
    const cellKey = `${student.student_id}:${req.requirement_key}`;
    const next = !req.is_verified;

    // Optimistic flip so the grid reacts immediately; reverted if the API refuses.
    setStudents(prev => prev.map(s => {
      if (s.student_id !== student.student_id) return s;
      return {
        ...s,
        requirements: s.requirements.map(r =>
          r.requirement_key === req.requirement_key ? { ...r, is_verified: next } : r
        ),
        verified_count: (s.verified_count ?? 0) + (next ? 1 : -1),
      };
    }));

    setSavingKey(cellKey);
    try {
      await enrollmentsApi.updateRequirements(req.enrollment_id, {
        requirements: [
          { requirement_key: req.requirement_key, is_submitted: req.is_submitted, is_verified: next },
        ],
      });
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to save verification.");
      reload();
    } finally {
      setSavingKey(null);
    }
  };

  useEffect(() => {
    Promise.all([
      sectionsApi.list(),
      schoolYearsApi.list(),
      enrollmentsApi.flags(),
    ]).then(([secs, years, flagsData]) => {
      setSections(secs);
      const current = years.find(y => y.is_current === 1);
      if (current) setSyId(current.id);
      setFlags(flagsData?.flags ?? []);
    }).catch(err => {
      showToast("error", "Failed to load data: " + (err.detail?.error || err.message));
    }).finally(() => {
      setLoading(false);
      setFlagsLoaded(true);
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(s =>
      s.student_name.toLowerCase().includes(q) ||
      s.display_id?.toLowerCase().includes(q)
    );
  }, [students, search]);

  const selectedSection = sections.find(s => s.id === parseInt(selectedSectionId));
  const totalSubmitted = students.reduce((sum, s) => sum + s.submitted_count, 0);
  const totalPossible = students.reduce((sum, s) => sum + s.total_count, 0);
  const totalVerified = students.reduce((sum, s) => sum + (s.verified_count ?? 0), 0);
  const verifiedPct = totalSubmitted > 0 ? Math.round((totalVerified / totalSubmitted) * 100) : 0;
  const overallPct = totalPossible > 0 ? Math.round((totalSubmitted / totalPossible) * 100) : 0;
  const completedStudents = students.filter(s => s.submitted_count === s.total_count).length;

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-10 px-3 sm:px-0">
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400" />
        <div className="p-5 sm:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-200 flex items-center justify-center flex-shrink-0">
            <ClipboardList size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">
              {canVerify ? "Document Verification" : "Enrollment Document Checklist"}
            </h2>
            <p className="text-gray-500 text-sm">
              {canVerify
                ? "Sight and verify each submitted document — no files are uploaded here"
                : "Verify and track each enrollee's submitted documents"}
            </p>
          </div>
        </div>
      </div>

      {/* ── VERIFICATION ROLE NOTE ── */}
      {canVerify && (
        <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl px-5 py-4">
          <div className="flex items-start gap-3">
            <ShieldCheck size={16} className="text-emerald-600 mt-0.5 shrink-0" />
            <p className="text-xs text-emerald-800 leading-relaxed">
              Click a submitted document to mark it <strong>verified</strong> (receipt sighted), or
              click again to clear. Verification is recorded against your account; documents can
              only be verified once they have been submitted.
            </p>
          </div>
        </div>
      )}

      {/* ── DUPLICATE ENROLLMENT FLAGS (read-only warning) ── */}
      {flagsLoaded && flags.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="flex items-start gap-3 px-5 py-4 border-b border-amber-100 bg-amber-50/60">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={16} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-amber-900">
                {flags.length} duplicate enrollment flag{flags.length === 1 ? "" : "s"} detected
              </h3>
              <p className="text-xs text-amber-700/90 mt-0.5">
                These students have more than one active enrollment in the same school year (multiple
                sections or different advisers). This is informational only — nothing is blocked.
              </p>
            </div>
          </div>
          <div className="p-4">
            <div className="space-y-2.5">
              {flags.map(f => (
                <div key={`${f.student_id}:${f.school_year_id}`} className="rounded-xl border border-amber-100 bg-amber-50/30 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm font-semibold text-gray-900">{f.student_name}</span>
                    <span className="text-[11px] font-mono text-gray-500">{f.lrn}</span>
                    <span className="text-[11px] font-medium text-gray-500">{f.sy_label}</span>
                    <span className="ml-auto text-[11px] font-bold text-amber-700">
                      {f.active_count} active / {f.distinct_sections} section{f.distinct_sections !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {f.sections.map((sec, i) => (
                      <li key={i} className="text-[11px] px-2 py-1 rounded-lg bg-white border border-gray-200 text-gray-600">
                        {sec.section_id != null ? sec.section_name : "Pending Section"}
                        {sec.adviser_name ? <span className="text-gray-400"> · Adv: {sec.adviser_name}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── FILTERS ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="min-w-[220px] flex-1">
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
              <School size={12} className="inline mr-1" /> Section
            </label>
            <select
              value={selectedSectionId}
              onChange={e => setSelectedSectionId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 bg-white transition appearance-none cursor-pointer"
            >
              <option value="">-- Select a section --</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>{s.name} (Grade {s.grade_level})</option>
              ))}
            </select>
          </div>
          {students.length > 0 && (
            <div className="min-w-[200px] flex-1">
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                <Search size={12} className="inline mr-1" /> Search Student
              </label>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Name or Student ID..."
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 bg-white transition"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── SUMMARY CARDS ── */}
      {students.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Students</span>
            <p className="text-2xl font-bold text-gray-900 mt-1">{students.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Fully Completed</span>
            <p className="text-2xl font-bold text-gray-900 mt-1">{completedStudents}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Completion Rate</span>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              <span className={overallPct >= 80 ? "text-emerald-600" : overallPct >= 50 ? "text-amber-500" : "text-red-500"}>
                {overallPct}%
              </span>
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">
              {selectedSection?.name || "Section"}
            </span>
            <p className="text-lg font-bold text-gray-900 mt-1 truncate">
              {selectedSection ? `Grade ${selectedSection.grade_level}` : "—"}
            </p>
          </div>
          {canVerify && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">
                Verified
              </span>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                <span className={verifiedPct >= 80 ? "text-emerald-600" : verifiedPct >= 50 ? "text-amber-500" : "text-sky-500"}>
                  {totalVerified}/{totalSubmitted}
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── LOADING ── */}
      {loadingData && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="animate-spin w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm font-medium">Loading student requirements...</p>
        </div>
      )}

      {/* ── EMPTY / NO SECTION SELECTED ── */}
      {!selectedSectionId && !loading && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <ClipboardList size={28} className="text-gray-300" />
          </div>
          <p className="text-gray-500 text-sm font-semibold">Select a section to view document completion</p>
          <p className="text-gray-400 text-xs mt-1">Choose a section above to see each student's enrollment requirements status.</p>
        </div>
      )}

      {/* ── TABLE ── */}
      {!loadingData && selectedSectionId && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-14 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={28} className="text-gray-300" />
              </div>
              <p className="text-gray-500 text-sm font-semibold">No students found</p>
              <p className="text-gray-400 text-xs mt-1">Try a different search or section.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="px-4 py-3.5 text-left text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">#</th>
                    <th className="px-4 py-3.5 text-left text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">Student Name</th>
                    <th className="px-4 py-3.5 text-left text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">ID</th>
                    {REQUIREMENT_KEYS.map(key => (
                      <th key={key} className="px-3 py-3.5 text-center text-gray-500 text-[10px] font-semibold uppercase tracking-[0.04em] max-w-[90px]">
                        <div className="truncate" title={REQUIREMENTS_LABELS[key]}>{REQUIREMENTS_LABELS[key]}</div>
                      </th>
                    ))}
                    <th className="px-4 py-3.5 text-center text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((student, idx) => {
                    const reqMap = new Map(student.requirements.map(r => [r.requirement_key, r]));
                    const pct = student.total_count > 0 ? Math.round((student.submitted_count / student.total_count) * 100) : 0;
                    return (
                      <tr key={student.student_id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-indigo-50/50 transition-colors duration-150`}>
                        <td className="px-4 py-3 text-xs text-gray-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-900 whitespace-nowrap">{student.student_name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-mono text-gray-500">{student.display_id || "—"}</span>
                        </td>
                        {REQUIREMENT_KEYS.map(key => {
                          const req = reqMap.get(key);
                          const submitted = req?.is_submitted ?? false;
                          return (
                            <td key={key} className="px-3 py-3 text-center">
                              {submitted ? (
                                canVerify ? (
                                  <button
                                    onClick={() => toggleVerified(student, req!)}
                                    disabled={savingKey === `${student.student_id}:${key}`}
                                    title={req?.is_verified ? "Verified (sighted receipt) — click to unverify" : "Submitted — click to verify (receipt sighted)"}
                                    className={`inline-flex items-center justify-center w-7 h-7 rounded-full transition ${
                                      req?.is_verified
                                        ? "bg-emerald-100 hover:bg-emerald-200"
                                        : "bg-sky-50 hover:bg-sky-100"
                                    } disabled:opacity-50`}
                                  >
                                    {savingKey === `${student.student_id}:${key}` ? (
                                      <Loader2 size={13} className="animate-spin text-sky-600" />
                                    ) : req?.is_verified ? (
                                      <CheckCircle size={14} className="text-emerald-600" />
                                    ) : (
                                      <ShieldCheck size={14} className="text-sky-500" />
                                    )}
                                  </button>
                                ) : req?.is_verified ? (
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100" title="Verified by committee">
                                    <CheckCircle size={14} className="text-emerald-600" />
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100" title="Submitted">
                                    <CheckCircle size={14} className="text-emerald-600" />
                                  </span>
                                )
                              ) : (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-50" title="Not submitted">
                                  <XCircle size={14} className="text-red-300" />
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-16 bg-gray-100 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${
                                pct === 100 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400"
                              }`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[11px] font-medium text-gray-500">{student.submitted_count}/{student.total_count}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <span>Showing <strong className="text-gray-600">{filtered.length}</strong> students</span>
            <span className="flex items-center gap-1"><CheckCircle size={12} className="text-emerald-500" /> Submitted <XCircle size={12} className="text-red-300 ml-2" /> Pending</span>
          </div>
        </div>
      )}
    </div>
  );
}
