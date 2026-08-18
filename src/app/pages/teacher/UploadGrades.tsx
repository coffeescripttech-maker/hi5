import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Download, Upload, CheckCircle, AlertTriangle, FileSpreadsheet, X, Info,
  GraduationCap, BookOpen, CalendarDays, ClipboardList, FileUp, Search,
  SkipForward, PartyPopper, ArrowRight, RefreshCw,
} from "lucide-react";
import { documentsApi, GradePreviewRow, ImportResult } from "../../services/documents";
import { sectionsApi, SectionRow } from "../../services/sections";
import { subjectsApi, SubjectRow } from "../../services/subjects";
import { schoolYearsApi, SchoolYearRow } from "../../services/schoolYears";
import { useApp } from "../../context/AppContext";
import { HybridTable } from "../../components/HybridTable";

type Stage = "idle" | "uploading" | "preview" | "importing" | "done";

const STEPS = [
  { label: "Download Template", sub: "Get the LRN roster file" },
  { label: "Fill in Grades", sub: "Enter scores per student" },
  { label: "Upload Excel", sub: "Attach the .xlsx file" },
  { label: "Confirm Import", sub: "Preview then import" },
];

type PreviewFilter = "all" | "valid" | "skipped" | "invalid";

export function UploadGrades() {
  const { showToast } = useApp();
  const [stage, setStage] = useState<Stage>("idle");
  const [dragActive, setDragActive] = useState(false);

  // Loaded data
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [years, setYears] = useState<SchoolYearRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Selections
  const [selectedSectionId, setSelectedSectionId] = useState<number | "">("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | "">("");
  const [selectedYearId, setSelectedYearId] = useState<number | "">("");
  const [quarter, setQuarter] = useState(1);

  // Upload flow state
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [previewRows, setPreviewRows] = useState<GradePreviewRow[]>([]);
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>("all");
  const [previewSearch, setPreviewSearch] = useState("");
  const [uploadedDocId, setUploadedDocId] = useState<number | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load teacher's sections, all subjects, and school years
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [secs, subs, yrs] = await Promise.all([
          sectionsApi.listMySections(),
          subjectsApi.list(),
          schoolYearsApi.list(),
        ]);
        if (cancelled) return;
        setSections(secs);
        setSubjects(subs);
        setYears(yrs);
        // Default to the current school year
        const current = yrs.find(y => y.is_current === 1);
        if (current) setSelectedYearId(current.id);
      } catch (err: any) {
        showToast("error", err.detail?.error || err.message || "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showToast]);

  // Subjects available for the selected section's grade level
  const sectionSubjects = useMemo(() => {
    if (!selectedSectionId) return subjects;
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return subjects;
    const matched = subjects.filter(s => s.grade_level === sec.grade_level);
    return matched.length > 0 ? matched : subjects;
  }, [subjects, sections, selectedSectionId]);

  // If the selected subject is no longer valid for the section, reset it
  useEffect(() => {
    if (selectedSubjectId && !sectionSubjects.some(s => s.id === selectedSubjectId)) {
      setSelectedSubjectId("");
    }
  }, [sectionSubjects, selectedSubjectId]);

  const hasSelection = !!selectedSectionId && !!selectedSubjectId && !!selectedYearId;

  // Context names for display
  const context = useMemo(() => {
    const sec = sections.find(s => s.id === selectedSectionId);
    const sub = subjects.find(s => s.id === selectedSubjectId);
    const yr = years.find(y => y.id === selectedYearId);
    return {
      section: sec ? `Grade ${sec.grade_level} – ${sec.name}` : null,
      subject: sub?.name ?? null,
      sy: yr?.sy_label ?? null,
    };
  }, [sections, subjects, years, selectedSectionId, selectedSubjectId, selectedYearId]);

  const validRows = previewRows.filter(r => r.status === "valid");
  const skippedRows = previewRows.filter(r => r.status === "skipped");
  const invalidRows = previewRows.filter(r => r.status === "invalid");

  // Preview rows after applying search + status filter
  const visibleRows = useMemo(() => {
    const q = previewSearch.trim().toLowerCase();
    return previewRows.filter(r => {
      const matchFilter = previewFilter === "all" || r.status === previewFilter;
      const matchSearch = !q || r.lrn.includes(q) || (r.name || "").toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });
  }, [previewRows, previewFilter, previewSearch]);

  const handleDownloadTemplate = () => {
    if (!hasSelection) return;
    documentsApi.template({
      section_id: selectedSectionId as number,
      subject_id: selectedSubjectId as number,
      school_year_id: selectedYearId as number,
      quarter,
    });
  };

  const handleFileChosen = async (file: File) => {
    if (!hasSelection) {
      showToast("error", "Please select Section, Subject, and School Year first.");
      return;
    }

    setFileName(file.name);
    setStage("uploading");
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("section_id", String(selectedSectionId));
    formData.append("subject_id", String(selectedSubjectId));
    formData.append("school_year_id", String(selectedYearId));
    formData.append("quarter", String(quarter));

    try {
      const interval = setInterval(() => {
        setProgress(p => Math.min(p + 15, 85));
      }, 200);

      const doc = await documentsApi.upload(formData);
      clearInterval(interval);
      setProgress(100);
      setUploadedDocId(doc.id);

      // Fetch the real parsed preview for this file
      const preview = await documentsApi.preview(doc.id);
      setPreviewRows(preview.rows);
      setPreviewFilter("all");
      setPreviewSearch("");
      setStage("preview");
    } catch (err: any) {
      setStage("idle");
      showToast("error", err.detail?.error || err.message || "Upload failed");
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFileChosen(file);
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFileChosen(file);
  };

  const handleImport = async () => {
    if (!uploadedDocId) return;
    setStage("importing");
    setProgress(0);
    let interval: ReturnType<typeof setInterval> | null = null;
    try {
      interval = setInterval(() => {
        setProgress(p => Math.min(p + 10, 90));
      }, 200);
      const result = await documentsApi.importGrades(uploadedDocId);
      if (interval) clearInterval(interval);
      setImportResult(result);
      setProgress(100);
      setTimeout(() => setStage("done"), 300);
    } catch (err: any) {
      if (interval) clearInterval(interval);
      setStage("preview");
      showToast("error", err.detail?.error || err.message || "Import failed");
    }
  };

  const reset = () => {
    setStage("idle");
    setFileName("");
    setProgress(0);
    setPreviewRows([]);
    setUploadedDocId(null);
    setImportResult(null);
    setPreviewFilter("all");
    setPreviewSearch("");
  };

  // Stepper state: which steps are complete / active
  const completedSteps: boolean[] = (() => {
    if (stage === "done") return [true, true, true, true];
    if (stage === "importing") return [true, true, true, false];
    if (stage === "preview" || stage === "uploading") return [true, true, false, false];
    return [false, false, false, false];
  })();
  const activeStep = stage === "idle" ? 0 : stage === "uploading" || stage === "preview" ? 2 : stage === "importing" ? 3 : -1;

  return (
    <div className="space-y-5">
      {/* Header + selectors */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-400" />
        <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-200 flex items-center justify-center shrink-0">
            <FileUp size={22} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-lg tracking-[-0.02em]">Upload Past Grades</h2>
            <p className="text-gray-500 text-sm">Pick a section, subject, and quarter, then download the roster template and fill in grades.</p>
          </div>
        </div>

        {/* Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1">
              <GraduationCap size={13} className="text-emerald-600" /> Section
            </label>
            <select
              value={selectedSectionId}
              onChange={e => setSelectedSectionId(e.target.value ? Number(e.target.value) : "")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select section…</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>Grade {s.grade_level} – {s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1">
              <BookOpen size={13} className="text-emerald-600" /> Subject
            </label>
            <select
              value={selectedSubjectId}
              onChange={e => setSelectedSubjectId(e.target.value ? Number(e.target.value) : "")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select subject…</option>
              {sectionSubjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1">
              <CalendarDays size={13} className="text-emerald-600" /> School Year
            </label>
            <select
              value={selectedYearId}
              onChange={e => setSelectedYearId(e.target.value ? Number(e.target.value) : "")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select school year…</option>
              {years.map(y => (
                <option key={y.id} value={y.id}>
                  {y.sy_label}{y.is_current === 1 ? " (Current)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1">
              <ClipboardList size={13} className="text-emerald-600" /> Quarter
            </label>
            <select
              value={quarter}
              onChange={e => setQuarter(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {[1, 2, 3, 4].map(q => (
                <option key={q} value={q}>Quarter {q}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-t border-gray-100 pt-4">
          <button
            onClick={handleDownloadTemplate}
            disabled={!hasSelection}
            title={!hasSelection ? "Select section, subject, and school year first" : undefined}
            className="flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-sm font-medium transition shadow-sm"
          >
            <Download size={16} />
            Download Excel Template
          </button>
          <div className="text-gray-400 text-xs flex items-center gap-1">
            <Info size={12} className="shrink-0" />
            Template format: LRN | Student Name | Grade — one file per subject &amp; quarter
          </div>
        </div>
        </div>
      </div>

      {/* Steps guide */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
        <div className="flex items-center">
          {STEPS.map((step, i) => {
            const complete = completedSteps[i];
            const active = activeStep === i;
            return (
              <React.Fragment key={step.label}>
                <div className="flex items-center gap-2 flex-1 last:flex-none">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
                    complete
                      ? "bg-emerald-600 text-white"
                      : active
                        ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-400"
                        : "bg-gray-100 text-gray-500"
                  }`}>
                    {complete ? <CheckCircle size={16} /> : i + 1}
                  </div>
                  <div className="hidden md:block leading-tight">
                    <p className={`text-xs font-semibold ${active ? "text-emerald-700" : "text-gray-700"}`}>{step.label}</p>
                    <p className="text-[10px] text-gray-400">{step.sub}</p>
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-2 mb-5 md:mb-0 ${complete ? "bg-emerald-500" : "bg-gray-200"}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Upload Area */}
      {stage === "idle" && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`bg-white rounded-2xl border-2 border-dashed p-6 sm:p-10 text-center transition-all cursor-pointer ${
            dragActive ? "border-emerald-500 bg-emerald-50" : "border-gray-300 hover:border-emerald-400 hover:bg-emerald-50/40"
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-colors ${dragActive ? "bg-emerald-600" : "bg-emerald-100"}`}>
            <Upload size={28} className={dragActive ? "text-white" : "text-emerald-600"} />
          </div>
          <p className="font-semibold text-gray-600 mb-1">
            {dragActive ? "Drop the file here" : "Drag & drop your Excel file"}
          </p>
          <p className="text-gray-400 text-sm mb-4">or click to browse · .xlsx, .xls formats</p>
          <span className="bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition inline-flex items-center gap-2">
            <Upload size={16} />
            Choose File
          </span>
          {loading && <p className="text-xs text-gray-400 mt-3">Loading sections, subjects, and school years…</p>}
        </div>
      )}

      {/* Uploading */}
      {stage === "uploading" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <FileSpreadsheet size={32} className="text-emerald-600 mx-auto mb-3" />
          <p className="font-semibold text-gray-700 mb-1">Processing: {fileName}</p>
          <p className="text-gray-400 text-sm mb-4">Validating data format and checking for errors...</p>
          <div className="w-full bg-gray-100 rounded-full h-2 max-w-sm mx-auto">
            <div className="bg-emerald-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-2">{progress}%</p>
        </div>
      )}

      {/* Preview */}
      {stage === "preview" && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <p className="text-2xl font-black text-gray-700">{previewRows.length || "—"}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total Records</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <p className="text-2xl font-black text-emerald-700">{validRows.length}</p>
                <CheckCircle size={18} className="text-emerald-500" />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Ready to Import</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <p className="text-2xl font-black text-yellow-600">{skippedRows.length}</p>
                <SkipForward size={18} className="text-yellow-500" />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Blank / Skipped</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <p className="text-2xl font-black text-red-600">{invalidRows.length}</p>
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Errors Found</p>
            </div>
          </div>

          {/* Context strip */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Context</span>
            <span className="text-gray-700 font-medium">{context.section || "—"}</span>
            <ArrowRight size={13} className="text-gray-300" />
            <span className="text-gray-700 font-medium">{context.subject || "—"}</span>
            <ArrowRight size={13} className="text-gray-300" />
            <span className="text-gray-700 font-medium">Q{quarter}</span>
            <ArrowRight size={13} className="text-gray-300" />
            <span className="text-gray-700 font-medium">{context.sy || "—"}</span>
          </div>

          {/* Error panel */}
          {invalidRows.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-red-700 mb-2">
                <AlertTriangle size={16} />
                <span className="font-semibold text-sm">{invalidRows.length} Error(s) Found – These rows will be skipped</span>
              </div>
              <div className="space-y-1.5 mt-2 max-h-40 overflow-y-auto">
                {invalidRows.map(r => (
                  <div key={r.row} className="flex items-start gap-2 text-xs text-red-600">
                    <span className="font-bold">Row {r.row}:</span>
                    <span>{r.name || r.lrn} — {r.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Row-by-row preview */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <FileSpreadsheet size={24} className="text-emerald-600" />
                <div>
                  <p className="font-semibold text-gray-800 truncate max-w-[260px]">{fileName}</p>
                  <p className="text-xs text-gray-400">Parsed and validated — green rows will be imported</p>
                </div>
              </div>
              <span className="text-xs text-gray-400">{previewRows.length} row(s)</span>
            </div>

            {/* Preview toolbar */}
            <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={previewSearch}
                  onChange={e => setPreviewSearch(e.target.value)}
                  placeholder="Search by LRN or name…"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(["all", "valid", "skipped", "invalid"] as PreviewFilter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setPreviewFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                      previewFilter === f
                        ? f === "invalid"
                          ? "bg-red-600 text-white"
                          : f === "skipped"
                            ? "bg-yellow-500 text-white"
                            : f === "valid"
                              ? "bg-emerald-600 text-white"
                              : "bg-gray-800 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {f === "all" ? `All (${previewRows.length})` : f === "valid" ? `Ready (${validRows.length})` : f === "skipped" ? `Blank (${skippedRows.length})` : `Errors (${invalidRows.length})`}
                  </button>
                ))}
              </div>
            </div>

            {visibleRows.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                <Search size={24} className="mx-auto mb-2 opacity-40" />
                No rows match your search or filter.
              </div>
            ) : (
              <HybridTable
                desktop={
                  <div className="overflow-x-auto max-h-80 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase sticky top-0">
                        <tr>
                          <th className="px-5 py-2.5 font-semibold">#</th>
                          <th className="px-5 py-2.5 font-semibold">LRN</th>
                          <th className="px-5 py-2.5 font-semibold">Student Name</th>
                          <th className="px-5 py-2.5 font-semibold">Grade</th>
                          <th className="px-5 py-2.5 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {visibleRows.map(r => (
                          <tr key={r.row} className={r.status === "invalid" ? "bg-red-50/60" : r.status === "skipped" ? "bg-yellow-50/40" : "hover:bg-gray-50/60"}>
                            <td className="px-5 py-2 text-gray-400">{r.row}</td>
                            <td className="px-5 py-2 text-gray-600">{r.lrn}</td>
                            <td className="px-5 py-2 text-gray-800">{r.name || "—"}</td>
                            <td className="px-5 py-2 text-gray-800 font-medium">{r.grade ?? "—"}</td>
                            <td className="px-5 py-2">
                              {r.status === "valid" && <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold"><CheckCircle size={13} /> Ready</span>}
                              {r.status === "skipped" && <span className="inline-flex items-center gap-1 text-yellow-600 text-xs font-semibold"><SkipForward size={13} /> Blank grade</span>}
                              {r.status === "invalid" && <span className="text-red-500 text-xs font-semibold" title={r.error}>{r.error || "Invalid"}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                }
                mobile={
                  <ul className="divide-y divide-gray-100">
                    {visibleRows.map(r => (
                      <li key={r.row} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800">{r.name || "—"}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              <span className="font-mono">{r.lrn}</span> · Row {r.row}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">Grade: <span className="font-semibold">{r.grade ?? "—"}</span></p>
                          </div>
                          <div className="flex-shrink-0">
                            {r.status === "valid" && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold border border-emerald-200"><CheckCircle size={11} /> Ready</span>}
                            {r.status === "skipped" && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-[11px] font-semibold border border-yellow-200"><SkipForward size={11} /> Blank</span>}
                            {r.status === "invalid" && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-[11px] font-semibold border border-red-200" title={r.error}>Invalid</span>}
                          </div>
                        </div>
                        {r.status === "invalid" && r.error && (
                          <p className="mt-2 text-xs text-red-600">{r.error}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                }
              />
            )}

            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Showing <strong>{visibleRows.length}</strong> of {previewRows.length} row(s).{" "}
                <strong className="text-emerald-600">Ready</strong> rows will be imported ·{" "}
                <strong className="text-yellow-600">blank</strong> grades are skipped ·{" "}
                <strong className="text-red-600">errors</strong> are blocked. Already-locked grades are skipped during import.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={reset} className="flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
              <X size={14} /> Cancel
            </button>
            <button onClick={handleImport} disabled={validRows.length === 0}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-gray-300 disabled:text-gray-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition shadow-sm">
              <Upload size={14} />
              Confirm Import ({validRows.length} valid records)
            </button>
          </div>
        </div>
      )}

      {/* Importing */}
      {stage === "importing" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-14 h-14 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="font-semibold text-gray-700 mb-1">Importing grades…</p>
          <p className="text-gray-400 text-sm mb-4">Writing validated grades and skipping locked entries</p>
          <div className="w-full bg-gray-100 rounded-full h-2 max-w-sm mx-auto">
            <div className="bg-emerald-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-2">{progress}%</p>
        </div>
      )}

      {/* Done */}
      {stage === "done" && (
        <div className="space-y-5">
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-400" />
            <div className="p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <PartyPopper size={30} className="text-emerald-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-1">Import Successful!</h3>
            <p className="text-gray-500 text-sm mb-4">
              <span className="font-medium text-gray-700">{context.subject || "Subject"}</span> grades for{" "}
              <span className="font-medium text-gray-700">{context.section || "section"}</span> · Q{quarter} · {context.sy}
            </p>
            {uploadedDocId && <span className="inline-block bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full">Document ID: #{uploadedDocId}</span>}
            </div>
          </div>

          {importResult && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                <p className="text-2xl font-black text-emerald-700">{importResult.imported}</p>
                <p className="text-xs text-gray-500 mt-0.5">Imported</p>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center">
                <p className="text-2xl font-black text-gray-700">{importResult.skipped}</p>
                <p className="text-xs text-gray-500 mt-0.5">Blank / Skipped</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                <p className="text-2xl font-black text-emerald-600">{importResult.locked}</p>
                <p className="text-xs text-gray-500 mt-0.5">Locked</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-center">
                <p className="text-2xl font-black text-yellow-600">{importResult.invalid}</p>
                <p className="text-xs text-gray-500 mt-0.5">Invalid</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
                <p className="text-2xl font-black text-red-600">{importResult.failed}</p>
                <p className="text-xs text-gray-500 mt-0.5">Failed</p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={reset} className="flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-2.5 rounded-lg font-medium transition text-sm shadow-sm">
              <RefreshCw size={14} /> Upload Another File
            </button>
            <a href="/teacher/documents" className="flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-6 py-2.5 rounded-lg font-medium transition hover:bg-gray-50 text-sm">
              View Grade Documents <ArrowRight size={14} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
