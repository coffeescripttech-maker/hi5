import React, { useEffect, useState, useCallback } from "react";
import {
  RefreshCw, Check, AlertTriangle, Loader2, Users,
  X, Shuffle, Sparkles, ArrowRight, UserPlus, BookOpen,
  GraduationCap, Layers, Filter, BarChart3, SlidersHorizontal
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import {
  sectioningApi,
  PendingQueueStudent,
  SectioningSection,
  CarryOverProposal
} from "../../services/sectioning";

/* ──────────────────────────────────────────
   Types
   ────────────────────────────────────────── */
type WorkflowTab = "random" | "placement" | "carryover" | "manual";

interface PendingCount {
  grade_level: number;
  count: number;
}

interface PreviewAssignment {
  student_id: number;
  enrollment_id?: number;
  name: string;
  lrn: string;
  student_display_id: string;
  grade_level: number;
  program: string;
  current_section_id: number | null;
  current_section_name: string | null;
  general_average: number | null;
  classifications: string[];
}

/* ──────────────────────────────────────────
   Helpers
   ────────────────────────────────────────── */
const GRADE_LABELS: Record<number, string> = {
  7: "G7", 8: "G8", 9: "G9", 10: "G10", 11: "G11", 12: "G12",
};
const PROGRAM_LABELS: Record<string, string> = {
  regular: "Regular", ste: "STE", spfl: "SPFL", open_high: "Open HS", als_shs: "ALS-SHS",
};
const SECTION_TYPE_BADGES: Record<string, string> = {
  star: "bg-amber-100 text-amber-800",
  gold: "bg-yellow-100 text-yellow-800",
  silver: "bg-gray-100 text-gray-800",
  regular: "bg-blue-100 text-blue-800",
  non_reader: "bg-red-100 text-red-800",
};

function clsx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ──────────────────────────────────────────
   Main Component
   ────────────────────────────────────────── */
export function SectionAssignment() {
  const { role } = useApp();

  // ── Data state ──
  const [queue, setQueue] = useState<PendingQueueStudent[]>([]);
  const [sections, setSections] = useState<SectioningSection[]>([]);
  const [schoolYear, setSchoolYear] = useState<{ id: number; sy_label: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Carry-over state ──
  const [carryOverProposals, setCarryOverProposals] = useState<CarryOverProposal[]>([]);
  const [carryOverSections, setCarryOverSections] = useState<SectioningSection[]>([]);
  const [carryOverGrade, setCarryOverGrade] = useState(12);

  // ── UI state ──
  const [activeTab, setActiveTab] = useState<WorkflowTab>("random");
  const [filterGrade, setFilterGrade] = useState<number | "">("");
  const [filterProgram, setFilterProgram] = useState<string>("");
  const [committing, setCommitting] = useState(false);
  const [commitMsg, setCommitMsg] = useState<string | null>(null);
  const [commitResults, setCommitResults] = useState<any[] | null>(null);
  const [generating, setGenerating] = useState(false);

  // ── Preview assignments (built client-side before confirm) ──
  const [preview, setPreview] = useState<PreviewAssignment[]>([]);

  // ── Tabs config ──
  const TABS: { key: WorkflowTab; label: string; icon: React.ElementType; desc: string }[] = [
    { key: "random", label: "Random Distribution", icon: Shuffle, desc: "Distribute JHS Regular students evenly by GA" },
    { key: "placement", label: "Placement Assistance", icon: Sparkles, desc: "Assign STE, SPFL students based on classifications" },
    { key: "carryover", label: "Carry-Over (G11→G12)", icon: GraduationCap, desc: "Carry G11 students to their matching G12 section" },
    { key: "manual", label: "Manual Assignment", icon: UserPlus, desc: "Assign ALS-SHS and Open HS students manually" },
  ];

  /* ── Load Pending Queue ── */
  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await sectioningApi.getPendingQueue({
        grade_level: filterGrade || undefined,
        program: filterProgram || undefined,
      });
      setQueue(data.queue);
      setSections(data.sections);
      setSchoolYear(data.school_year);
    } catch (err: any) {
      setError(err.detail?.error || err.message || "Failed to load pending queue.");
    } finally {
      setLoading(false);
    }
  }, [filterGrade, filterProgram]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  /* ── Pending queue counts per grade ── */
  const gradeCounts: PendingCount[] = React.useMemo(() => {
    const map = new Map<number, number>();
    queue.forEach(s => map.set(s.grade_level, (map.get(s.grade_level) || 0) + 1));
    return Array.from(map.entries())
      .map(([grade_level, count]) => ({ grade_level, count }))
      .sort((a, b) => a.grade_level - b.grade_level);
  }, [queue]);

  const availableSections = React.useMemo(
    () => sections.filter(s => s.current_count < s.capacity),
    [sections]
  );

  /* ── Build preview: Random Distribution ── */
  const generateRandomPreview = () => {
    setGenerating(true);
    // Filter JHS regular students
    const candidates = queue.filter(
      s => s.grade_level >= 7 && s.grade_level <= 10 && s.program === "regular"
    );
    if (candidates.length === 0) {
      setGenerating(false);
      setCommitMsg("No eligible students for random distribution.");
      return;
    }

    // Build section pools per grade level
    const previewList: PreviewAssignment[] = [];
    const sectionsByGrade = new Map<number, SectioningSection[]>();
    availableSections
      .filter(s => s.grade_level >= 7 && s.grade_level <= 10)
      .forEach(s => {
        const list = sectionsByGrade.get(s.grade_level) || [];
        list.push(s);
        sectionsByGrade.set(s.grade_level, list);
      });

    // Sort students by GA descending within each grade
    const sorted = [...candidates].sort(
      (a, b) => (b.general_average ?? 0) - (a.general_average ?? 0)
    );

    // Track running counts per section (initial + newly assigned)
    const runningCounts = new Map<number, number>();

    // Round-robin across sections per grade, respecting capacity
    for (const student of sorted) {
      const gradeSections = sectionsByGrade.get(student.grade_level) || [];

      // Filter to sections that still have room
      const openSections = gradeSections.filter(s => {
        const assigned = runningCounts.get(s.id) ?? 0;
        return s.current_count + assigned < s.capacity;
      });

      if (openSections.length === 0) {
        previewList.push({
          student_id: student.student_id,
          enrollment_id: student.enrollment_id,
          name: student.name,
          lrn: student.lrn,
          student_display_id: student.student_display_id,
          grade_level: student.grade_level,
          program: student.program,
          current_section_id: null,
          current_section_name: null,
          general_average: student.general_average,
          classifications: student.classifications,
        });
        continue;
      }

      // Pick the section with fewest total students (initial + assigned)
      openSections.sort((a, b) => {
        const ca = a.current_count + (runningCounts.get(a.id) ?? 0);
        const cb = b.current_count + (runningCounts.get(b.id) ?? 0);
        return ca - cb;
      });

      const target = openSections[0];
      runningCounts.set(target.id, (runningCounts.get(target.id) ?? 0) + 1);

      previewList.push({
        student_id: student.student_id,
        enrollment_id: student.enrollment_id,
        name: student.name,
        lrn: student.lrn,
        student_display_id: student.student_display_id,
        grade_level: student.grade_level,
        program: student.program,
        current_section_id: target.id,
        current_section_name: target.name,
        general_average: student.general_average,
        classifications: student.classifications,
      });
    }

    setPreview(previewList);
    setGenerating(false);
  };

  /* ── Placement Assistance Preview (STE/SPFL) with capacity tracking ── */
  const generatePlacementPreview = () => {
    setGenerating(true);
    const candidates = queue.filter(
      s => s.program === "ste" || s.program === "spfl"
    );

    if (candidates.length === 0) {
      setGenerating(false);
      setCommitMsg("No STE or SPFL students in the pending queue.");
      return;
    }

    const previewList: PreviewAssignment[] = [];
    const runningCounts = new Map<number, number>();

    const hasRoom = (s: SectioningSection) => {
      const assigned = runningCounts.get(s.id) ?? 0;
      return s.current_count + assigned < s.capacity;
    };

    for (const student of candidates) {
      let matchedSection = sections.find(
        s =>
          s.grade_level === student.grade_level &&
          s.is_active === 1 &&
          hasRoom(s) &&
          (student.classifications.some(c =>
            s.section_type.toLowerCase().includes(c.toLowerCase())
          ) || s.name.toLowerCase().includes(student.program))
      );
      // Fallback: any open section for the grade
      if (!matchedSection) {
        matchedSection = sections.find(
          s => s.grade_level === student.grade_level && s.is_active === 1 && hasRoom(s)
        );
      }

      if (matchedSection) {
        runningCounts.set(matchedSection.id, (runningCounts.get(matchedSection.id) ?? 0) + 1);
      }

      previewList.push({
        student_id: student.student_id,
        enrollment_id: student.enrollment_id,
        name: student.name,
        lrn: student.lrn,
        student_display_id: student.student_display_id,
        grade_level: student.grade_level,
        program: student.program,
        current_section_id: matchedSection?.id ?? null,
        current_section_name: matchedSection?.name ?? null,
        general_average: student.general_average,
        classifications: student.classifications,
      });
    }

    setPreview(previewList);
    setGenerating(false);
  };

  /* ── Carry-Over Preview with capacity tracking ── */
  const loadCarryOverPreview = useCallback(async () => {
    setGenerating(true);
    try {
      const data = await sectioningApi.getCarryOverPreview(carryOverGrade);
      setCarryOverProposals(data.proposals);
      setCarryOverSections(data.current_sections);

      // Track capacity per section across proposals
      const runningCounts = new Map<number, number>();
      const currentSectionsMap = new Map(data.current_sections.map((s: any) => [s.id, s]));

      // Build preview list from proposals, checking capacity
      const previewList: PreviewAssignment[] = data.proposals.map((p: CarryOverProposal) => {
        const queueStudent = queue.find(q => q.student_id === p.student_id);
        let effectiveSectionId = p.proposed_section_id;
        let effectiveSectionName = p.proposed_section_name;

        if (effectiveSectionId != null) {
          const sec = currentSectionsMap.get(effectiveSectionId);
          const assigned = runningCounts.get(effectiveSectionId) ?? 0;
          if (sec && sec.current_count + assigned >= sec.capacity) {
            // Section full — try to find another open section for this grade
            const alt = data.current_sections.find(
              (s: any) => s.grade_level === carryOverGrade && s.current_count + (runningCounts.get(s.id) ?? 0) < s.capacity
            );
            effectiveSectionId = alt?.id ?? null;
            effectiveSectionName = alt?.name ?? null;
            if (alt) runningCounts.set(alt.id, (runningCounts.get(alt.id) ?? 0) + 1);
          } else {
            runningCounts.set(effectiveSectionId, assigned + 1);
          }
        }

        return {
          student_id: p.student_id,
          enrollment_id: queueStudent?.enrollment_id,
          name: p.student_name,
          lrn: p.lrn,
          student_display_id: p.student_display_id,
          grade_level: carryOverGrade,
          program: queueStudent?.program || "regular",
          current_section_id: effectiveSectionId,
          current_section_name: effectiveSectionName,
          general_average: queueStudent?.general_average ?? null,
          classifications: queueStudent?.classifications || [],
        };
      });

      setPreview(previewList);
    } catch (err: any) {
      setCommitMsg(err.detail?.error || err.message || "Failed to load carry-over preview.");
    } finally {
      setGenerating(false);
    }
  }, [carryOverGrade, queue]);

  /* ── Assign section for a single preview item (manual) ── */
  const assignSection = (studentId: number, sectionId: number) => {
    setPreview(prev =>
      prev.map(p =>
        p.student_id === studentId
          ? {
              ...p,
              current_section_id: sectionId,
              current_section_name: sections.find(s => s.id === sectionId)?.name ?? null,
            }
          : p
      )
    );
  };

  /* ── Confirm all assignments ── */
  const handleConfirm = async () => {
    const toAssign = preview.filter(p => p.current_section_id != null);
    if (toAssign.length === 0) {
      setCommitMsg("No assignments to confirm — assign sections first.");
      return;
    }
    if (!schoolYear) return;

    setCommitting(true);
    setCommitMsg(null);
    setCommitResults(null);
    try {
      const result = await sectioningApi.confirmAssignments({
        school_year_id: schoolYear.id,
        assignments: toAssign.map(a => ({
          enrollment_id: a.enrollment_id,
          student_id: a.student_id,
          section_id: a.current_section_id!,
        })),
      });
      setCommitResults(result.results);
      setCommitMsg(result.message);
      // Refresh queue after confirm
      await loadQueue();
    } catch (err: any) {
      setCommitMsg(err.detail?.error || err.message || "Failed to confirm assignments.");
    } finally {
      setCommitting(false);
    }
  };

  /* ── Generate callback depending on active tab ── */
  const handleGenerate = () => {
    setCommitMsg(null);
    setCommitResults(null);
    switch (activeTab) {
      case "random": generateRandomPreview(); break;
      case "placement": generatePlacementPreview(); break;
      case "carryover": loadCarryOverPreview(); break;
      case "manual": generateManualPreview(); break;
    }
  };

  const generateManualPreview = () => {
    setGenerating(true);
    const candidates = queue.filter(
      s => s.program === "als_shs" || s.program === "open_high"
    );

    if (candidates.length === 0) {
      setGenerating(false);
      setCommitMsg("No ALS-SHS or Open HS students in the pending queue.");
      return;
    }

    // Just show all eligible students, no auto-assign
    const previewList: PreviewAssignment[] = candidates.map(s => ({
      student_id: s.student_id,
      enrollment_id: s.enrollment_id,
      name: s.name,
      lrn: s.lrn,
      student_display_id: s.student_display_id,
      grade_level: s.grade_level,
      program: s.program,
      current_section_id: null,
      current_section_name: null,
      general_average: s.general_average,
      classifications: s.classifications,
    }));

    setPreview(previewList);
    setGenerating(false);
  };

  /* ── When switching to carry-over tab, auto-load ── */
  useEffect(() => {
    if (activeTab === "carryover") {
      loadCarryOverPreview();
    }
  }, [activeTab, loadCarryOverPreview]);

  /* ── Section picker for a student row (Manual tab) ── */
  const SectionPicker = ({
    student,
    currentSectionId,
  }: {
    student: PreviewAssignment;
    currentSectionId: number | null;
  }) => {
    const gradeSections = sections.filter(
      s => s.grade_level === student.grade_level && s.is_active === 1
    );
    return (
      <select
        className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white w-44 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        value={currentSectionId ?? ""}
        onChange={e => assignSection(student.student_id, parseInt(e.target.value))}
      >
        <option value="">— Select section —</option>
        {gradeSections.map(s => (
          <option
            key={s.id}
            value={s.id}
            disabled={s.current_count >= s.capacity}
          >
            {s.name} ({s.current_count}/{s.capacity})
            {s.current_count >= s.capacity ? " FULL" : ""}
          </option>
        ))}
      </select>
    );
  };

  /* ── Render ── */
  if (role === "teacher") {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-gray-400">
        <div className="text-center">
          <AlertTriangle size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium">Section assignment is handled by the Registrar.</p>
          <p className="text-xs mt-1">Please contact your Registrar for sectioning concerns.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* ── Header ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400" />
        <div className="p-5 sm:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-200 flex items-center justify-center flex-shrink-0">
            <Layers size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">Section Assignment</h2>
            <p className="text-gray-500 text-sm">
              {schoolYear ? `SY ${schoolYear.sy_label}` : ""} — Assign enrolled students to sections
            </p>
          </div>
          <button
            onClick={loadQueue}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Pending Queue Summary Bar ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            <Users size={16} className="text-indigo-500" />
            Pending Section Queue
            {loading && <Loader2 size={14} className="animate-spin text-indigo-500" />}
          </h3>
          {queue.length > 0 && !loading && (
            <span className="bg-indigo-50 text-indigo-700 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-indigo-100">
              {queue.length} pending
            </span>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
            <AlertTriangle size={15} />
            {error}
          </div>
        )}

        {/* Grade-level counts (shown when data loaded, even if 0) */}
        {!loading && (
          <div className="flex flex-wrap gap-2 mb-4">
            {gradeCounts.length > 0 ? gradeCounts.map(gc => (
              <div
                key={gc.grade_level}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50/60 text-indigo-700 rounded-lg text-xs font-medium border border-indigo-100"
              >
                <span className="font-semibold">Grade {gc.grade_level}</span>
                <span className="text-indigo-300">·</span>
                <span className="font-bold">{gc.count}</span>
                <span className="text-indigo-400">{gc.count === 1 ? "student" : "students"}</span>
              </div>
            )) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 text-gray-400 rounded-lg text-xs border border-gray-100">
                <Users size={14} />
                <span>No students in queue</span>
              </div>
            )}
          </div>
        )}

        {/* Filters — always visible */}
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold uppercase tracking-[0.04em]">
            <SlidersHorizontal size={12} />
            Filters
          </div>
          <select
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
            value={filterGrade}
            onChange={e => setFilterGrade(e.target.value ? parseInt(e.target.value) : "")}
          >
            <option value="">All Grades</option>
            {[7, 8, 9, 10, 11, 12].map(g => (
              <option key={g} value={g}>Grade {g}</option>
            ))}
          </select>
          <select
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
            value={filterProgram}
            onChange={e => setFilterProgram(e.target.value)}
          >
            <option value="">All Programs</option>
            {Object.entries(PROGRAM_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Queue list or empty or loading state */}
        {loading ? (
          <div className="text-center py-10 text-gray-400 border border-dashed border-gray-200 rounded-xl">
            <Loader2 size={28} className="mx-auto mb-2 animate-spin text-indigo-400" />
            <p className="text-sm font-medium text-gray-500">Loading queue...</p>
          </div>
        ) : queue.length === 0 ? (
          <div className="text-center py-10 text-gray-400 border border-dashed border-gray-200 rounded-xl">
            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
              <Users size={24} className="text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-500">
              {filterGrade || filterProgram
                ? "No students match the current filters."
                : "No students awaiting section assignment."}
            </p>
            <p className="text-xs mt-1 text-gray-400">
              {filterGrade || filterProgram
                ? "Try changing the grade or program filter above."
                : "Students enrolled by the Teacher will appear here."}
            </p>
          </div>
        ) : !loading ? (
          <div className="overflow-x-auto border border-gray-100 rounded-xl">
            <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/80">
                    <th className="text-left px-4 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">#</th>
                    <th className="text-left px-4 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">Student</th>
                    <th className="text-left px-4 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">LRN</th>
                    <th className="text-left px-4 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">Grade</th>
                    <th className="text-left px-4 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">Program</th>
                    <th className="text-left px-4 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">GA</th>
                    <th className="text-left px-4 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">Enrolled By</th>
                    <th className="text-left px-4 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {queue.map((s, idx) => (
                    <tr key={s.enrollment_id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-indigo-50/50 transition-colors duration-150`}>
                      <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-700 text-xs font-bold flex-shrink-0 shadow-sm">
                            {s.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-sm">{s.name}</p>
                            <p className="text-gray-400 text-[10px] font-mono">{s.student_display_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono">{s.lrn}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-indigo-50/60 text-indigo-700 border border-indigo-100">
                          G{s.grade_level}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500 font-medium">{PROGRAM_LABELS[s.program] || s.program}</span>
                        {s.classifications.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {s.classifications.map((c, ci) => (
                              <span key={ci} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-600 border border-purple-100">{c}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx(
                          "text-xs font-semibold",
                          s.general_average != null
                            ? s.general_average >= 85 ? "text-emerald-600" : s.general_average >= 75 ? "text-amber-600" : "text-red-600"
                            : "text-gray-300"
                        )}>
                          {s.general_average != null ? s.general_average.toFixed(2) : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{s.enrolled_by_name}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {new Date(s.enrollment_date).toLocaleDateString("en-PH")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        ) : null}
        </div>
      </div>

      {/* ── Workflow Tabs ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setPreview([]); setCommitMsg(null); setCommitResults(null); }}
                className={clsx(
                  "flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                  active
                    ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                )}
              >
                <Icon size={16} className={active ? "text-indigo-500" : "text-gray-400"} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="p-5 sm:p-6">
          {/* Tab description + generate */}
          <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-600">
                {TABS.find(t => t.key === activeTab)?.desc}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                <span className="inline-flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-400" /> {availableSections.length} sections available</span>
                <span className="text-gray-200">|</span>
                <span>{queue.length} students pending</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {activeTab === "carryover" && (
                <select
                  className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={carryOverGrade}
                  onChange={e => setCarryOverGrade(parseInt(e.target.value))}
                >
                  <option value={12}>G11 → G12</option>
                  <option value={11}>G10 → G11</option>
                  <option value={10}>G9 → G10</option>
                  <option value={9}>G8 → G9</option>
                  <option value={8}>G7 → G8</option>
                </select>
              )}
              <button
                onClick={handleGenerate}
                disabled={loading || generating || queue.length === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
              >
                {generating ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Sparkles size={15} />
                )}
                Generate Preview
              </button>
            </div>
          </div>

          {/* ── Preview Table ── */}
          {preview.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">
                    Preview Assignments
                  </p>
                  <span className="bg-indigo-50 text-indigo-700 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-indigo-100">
                    {preview.length} student{preview.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {preview.filter(p => p.current_section_id != null).length > 0 && (
                    <span className="text-emerald-600 font-medium flex items-center gap-1">
                      <Check size={12} /> {preview.filter(p => p.current_section_id != null).length} assigned
                    </span>
                  )}
                  {preview.filter(p => p.current_section_id == null).length > 0 && (
                    <span className="text-amber-600 font-medium flex items-center gap-1">
                      <AlertTriangle size={12} /> {preview.filter(p => p.current_section_id == null).length} unassigned
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50/80">
                      <th className="text-left px-4 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">#</th>
                      <th className="text-left px-4 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">Student</th>
                      <th className="text-left px-4 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">LRN</th>
                      <th className="text-left px-4 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">Grade</th>
                      <th className="text-left px-4 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">Program</th>
                      <th className="text-left px-4 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">GA</th>
                      <th className="text-left px-4 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">
                        {activeTab === "manual" ? "Assign Section" : "Section"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.map((student, idx) => (
                      <tr key={student.student_id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-indigo-50/50 transition-colors duration-150`}>
                        <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-700 text-xs font-bold flex-shrink-0 shadow-sm">
                              {student.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800 text-sm">{student.name}</p>
                              <p className="text-gray-400 text-xs font-mono">{student.student_display_id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs font-mono">{student.lrn}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-indigo-50/60 text-indigo-700 border border-indigo-100">
                            G{student.grade_level}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-500 font-medium">{PROGRAM_LABELS[student.program] || student.program}</span>
                          {student.classifications.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {student.classifications.map((c, ci) => (
                                <span key={ci} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-600 border border-purple-100">
                                  {c}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={clsx(
                            "text-xs font-semibold",
                            student.general_average != null
                              ? student.general_average >= 85 ? "text-emerald-600" : student.general_average >= 75 ? "text-amber-600" : "text-red-600"
                              : "text-gray-300"
                          )}>
                            {student.general_average != null ? student.general_average.toFixed(2) : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {activeTab === "manual" ? (
                            <SectionPicker student={student} currentSectionId={student.current_section_id} />
                          ) : student.current_section_id != null ? (
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {student.current_section_name}
                              </span>
                              {activeTab === "carryover" && (
                                <span className="text-[10px] text-gray-400 font-medium">(proposed)</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-red-400 flex items-center gap-1">
                              <AlertTriangle size={12} />
                              No section available
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Confirm button */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleConfirm}
                  disabled={committing || preview.filter(p => p.current_section_id != null).length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                >
                  {committing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  Confirm {preview.filter(p => p.current_section_id != null).length} Assignment{preview.filter(p => p.current_section_id != null).length !== 1 ? "s" : ""}
                </button>
              </div>
            </div>
          )}

          {/* ── Status messages ── */}
          {commitMsg && (
            <div className={clsx(
              "mt-4 p-4 rounded-xl border text-sm",
              commitResults
                ? commitResults.filter((r: any) => !r.ok).length > 0
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-indigo-50 border-indigo-200 text-indigo-800"
            )}>
              <div className="flex items-start gap-3">
                <div className={clsx(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  commitResults
                    ? commitResults.filter((r: any) => !r.ok).length > 0
                      ? "bg-amber-100"
                      : "bg-emerald-100"
                    : "bg-indigo-100"
                )}>
                  {commitResults ? (
                    commitResults.filter((r: any) => !r.ok).length > 0 ? (
                      <AlertTriangle size={16} className="text-amber-600" />
                    ) : (
                      <Check size={16} className="text-emerald-600" />
                    )
                  ) : (
                    <AlertTriangle size={16} className="text-indigo-600" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{commitMsg}</p>
                  {commitResults && (
                    <ul className="mt-2 space-y-1 text-xs max-h-40 overflow-y-auto">
                      {commitResults.map((r: any, i: number) => (
                        <li key={i} className={`flex items-center gap-1.5 ${r.ok ? "text-emerald-600" : "text-red-600"}`}>
                          {r.ok ? <Check size={12} /> : <X size={12} />}
                          {r.name}: {r.ok ? `Assigned to ${r.section_name}` : `Failed — ${r.error}`}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Empty state when no preview generated ── */}
          {preview.length === 0 && !commitMsg && !generating && (
            <div className="text-center py-14 text-gray-400">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <BarChart3 size={28} className="text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-500">No preview generated yet</p>
              <p className="text-xs mt-1 text-gray-400">Click <strong className="text-gray-500">Generate Preview</strong> to build a section assignment proposal.</p>
            </div>
          )}

          {generating && preview.length === 0 && (
            <div className="text-center py-14 text-gray-400">
              <Loader2 size={28} className="mx-auto mb-3 animate-spin text-indigo-500" />
              <p className="text-sm font-medium text-gray-500">Generating preview...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
