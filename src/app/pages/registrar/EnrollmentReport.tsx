import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Search, Download, Filter, Users, FileText,
  ChevronUp, ChevronDown, X, BarChart3, GraduationCap, FileSpreadsheet, Printer
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { enrollmentsApi, EnrollmentRow, DashboardStats } from "../../services/enrollments";
import { sectionsApi, SectionRow } from "../../services/sections";
import { schoolYearsApi } from "../../services/schoolYears";
import { useApp } from "../../context/AppContext";
import { exportToPdf } from "../../services/pdfExport";

const SECTIONS = ["All Sections", "Star", "Gold", "Silver", "Regular", "Pending"];
const CLASSIFICATIONS = ["All Classifications", "4Ps", "PWD", "Transferee", "Non-Reader", "Balik-aral", "Regular"];
const GRADES = ["All Grades", "7", "8", "9", "10", "11", "12"];

const CLASSIF_COLORS: Record<string, string> = {
  "4ps": "#6366f1",
  "pwd": "#8b5cf6",
  "transferee": "#06b6d4",
  "non_reader": "#ef4444",
  "balik_aral": "#f59e0b",
  "regular": "#9ca3af",
};

const CLASSIF_LABELS: Record<string, string> = {
  "4ps": "4Ps",
  "pwd": "PWD",
  "transferee": "Transferee",
  "non_reader": "Non-Reader",
  "balik_aral": "Balik-aral",
  "regular": "Regular",
};

const STATUS_BADGE: Record<string, string> = {
  enrolled: "bg-emerald-50 text-emerald-700 border-emerald-200/50",
  pending: "bg-amber-50 text-amber-700 border-amber-200/50",
  dropped: "bg-red-50 text-red-600 border-red-200/50",
  transferred: "bg-blue-50 text-blue-700 border-blue-200/50",
  completed: "bg-purple-50 text-purple-700 border-purple-200/50",
};

type SortKey = "name" | "lrn" | "grade_level" | "section_name" | "sex" | "status";
type SortDir = "asc" | "desc";

export function EnrollmentReport() {
  const { showToast } = useApp();
  const [lrnSearch, setLrnSearch] = useState("");
  const [nameSearch, setNameSearch] = useState("");
  const [filterSection, setFilterSection] = useState("All Sections");
  const [filterClassif, setFilterClassif] = useState("All Classifications");
  const [filterGrade, setFilterGrade] = useState("All Grades");
  const [sortKey, setSortKey] = useState<SortKey>("grade_level");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [exportMsg, setExportMsg] = useState("");
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [syLabel, setSyLabel] = useState("2025–2026");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      enrollmentsApi.list(),
      sectionsApi.list(),
      schoolYearsApi.list(),
      enrollmentsApi.stats(),
    ]).then(([enr, sec, years, st]) => {
      setEnrollments(enr);
      setSections(sec);
      setStats(st);
      const current = years.find(y => y.is_current === 1);
      if (current) setSyLabel(current.sy_label);
    }).catch(err => {
      showToast("error", "Failed to load data: " + (err.detail?.error || err.message));
    }).finally(() => setLoading(false));
  }, []);

  const gradeLevels = [7, 8, 9, 10, 11, 12];
  const enrollmentStats = gradeLevels.map(g => {
    const sectionForGrade = sections.filter(s => s.grade_level === g);
    const enrolled = enrollments.filter(e => e.grade_level === g && e.status === "enrolled").length;
    const capacity = sectionForGrade.reduce((sum, s) => sum + s.capacity, 0);
    return { grade: `Grade ${g}`, enrolled, capacity };
  });

  const totalEnrolled = enrollments.filter(e => e.status === "enrolled").length;
  const totalCapacity = sections.reduce((sum, s) => sum + s.capacity, 0);
  const overallPercent = totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;

  // Compute promotion rate: count of students in grades that were promoted vs total
  // Use the number of enrolled students that are NOT in Grade 7 (new entrants)
  // as a proxy, or simply show stats from the promotion system
  const promotionRate = totalEnrolled > 0
    ? Math.round((enrollments.filter(e => e.status === "enrolled" && e.grade_level > 7).length / totalEnrolled) * 100)
    : 0;

  // Build live classification data from stats
  const classifData = useMemo(() => {
    if (!stats?.classifications) return [];
    return stats.classifications.map(c => ({
      name: CLASSIF_LABELS[c.classification] || c.classification,
      value: c.count,
      color: CLASSIF_COLORS[c.classification] || "#9ca3af",
    }));
  }, [stats]);

  const filtered = useMemo(() => {
    let list = [...enrollments];

    if (lrnSearch.trim()) {
      list = list.filter(s => s.lrn.includes(lrnSearch.trim()));
    }
    if (nameSearch.trim()) {
      list = list.filter(s => s.student_name.toLowerCase().includes(nameSearch.trim().toLowerCase()));
    }
    if (filterGrade !== "All Grades") {
      list = list.filter(s => s.grade_level === parseInt(filterGrade));
    }
    if (filterSection !== "All Sections") {
      list = list.filter(s => s.section_name === filterSection);
    }
    if (filterClassif !== "All Classifications") {
      const cf = filterClassif.toLowerCase().replace(/[\s-]/g, "_");
      list = list.filter(s => s.classifications?.toLowerCase().includes(cf));
    }

    list.sort((a, b) => {
      let av: any = a[sortKey as keyof typeof a] ?? "";
      let bv: any = b[sortKey as keyof typeof b] ?? "";
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [lrnSearch, nameSearch, filterSection, filterClassif, filterGrade, sortKey, sortDir, enrollments]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  // ── CSV Export ──
  const handleExportCsv = () => {
    const escapeCsv = (val: string | number | null | undefined) => {
      if (val == null) return "";
      const s = String(val);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const headers = ["#", "LRN", "Student Name", "Sex", "Grade Level", "Section", "Classification", "Status"];
    const rows = filtered.map((s, idx) => [
      idx + 1,
      escapeCsv(s.lrn),
      escapeCsv(s.student_name),
      escapeCsv(s.sex ? (s.sex.charAt(0).toUpperCase() + s.sex.slice(1)) : ""),
      s.grade_level,
      escapeCsv(s.section_name || ""),
      escapeCsv(s.classifications || ""),
      escapeCsv(s.status.charAt(0).toUpperCase() + s.status.slice(1)),
    ]);

    const bom = "﻿";
    const csv = bom + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Enrollment_Report_${syLabel.replace(/\s/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMsg("CSV exported successfully!");
    setTimeout(() => setExportMsg(""), 3000);
  };

  // ── Excel Export ──
  const handleExportExcel = () => {
    // Build an HTML table that Excel can open
    const rowsHtml = filtered.map((s, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${s.lrn}</td>
        <td>${s.student_name}</td>
        <td>${s.sex ? s.sex.charAt(0).toUpperCase() + s.sex.slice(1) : ""}</td>
        <td>Grade ${s.grade_level}</td>
        <td>${s.section_name || ""}</td>
        <td>${s.classifications || ""}</td>
        <td>${s.status.charAt(0).toUpperCase() + s.status.slice(1)}</td>
      </tr>
    `).join("");

    const summaryRows = enrollmentStats.map(stat => `
      <tr>
        <td>${stat.grade}</td>
        <td>${stat.enrolled}</td>
        <td>${stat.capacity}</td>
        <td>${stat.capacity > 0 ? Math.round((stat.enrolled / stat.capacity) * 100) : 0}%</td>
      </tr>
    `).join("");

    const classifRows = classifData.map(c => `
      <tr><td>${c.name}</td><td>${c.value}</td></tr>
    `).join("");

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>
        <x:ExcelWorksheet><x:Name>Enrollment_Report</x:Name><x:WorksheetOptions>
        <x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
        <x:ExcelWorksheet><x:Name>Summary</x:Name></x:ExcelWorksheet>
        <x:ExcelWorksheet><x:Name>Classifications</x:Name></x:ExcelWorksheet>
        </x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <style>
          table { border-collapse: collapse; font-family: Calibri, sans-serif; font-size: 11px; }
          th, td { border: 1px solid #999; padding: 4px 8px; }
          th { background: #6366f1; color: #fff; font-weight: 600; }
          .summary th { background: #059669; }
        </style>
      </head>
      <body>
        <h2>Enrollment Report — SY ${syLabel}</h2>
        <table>
          <tr><th>#</th><th>LRN</th><th>Student Name</th><th>Sex</th><th>Grade Level</th><th>Section</th><th>Classification</th><th>Status</th></tr>
          ${rowsHtml}
        </table>
        <br/>
        <h3>Enrollment Summary per Grade</h3>
        <table class="summary">
          <tr><th>Grade</th><th>Enrolled</th><th>Capacity</th><th>Utilization</th></tr>
          ${summaryRows}
          <tr style="font-weight:bold;background:#f0fdf4;"><td>Total</td><td>${totalEnrolled}</td><td>${totalCapacity}</td><td>${overallPercent}%</td></tr>
        </table>
        <br/>
        <h3>Classifications</h3>
        <table>
          <tr><th>Classification</th><th>Count</th></tr>
          ${classifRows}
        </table>
        <p><em>Generated by Hi5 Portal — ${new Date().toLocaleString("en-PH")}</em></p>
      </body></html>
    `;

    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Enrollment_Report_${syLabel.replace(/\s/g, "_")}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMsg("Excel exported successfully!");
    setTimeout(() => setExportMsg(""), 3000);
  };

  // ── PDF Export ──
  const handleExportPdf = async () => {
    setExporting(true);
    try {
      await exportToPdf({
        elementId: "enrollment-report-content",
        filename: `Enrollment_Report_${syLabel.replace(/\s/g, "_")}`,
        orientation: "landscape",
        format: "letter",
        scale: 2,
      });
      setExportMsg("PDF exported successfully!");
      setTimeout(() => setExportMsg(""), 3000);
    } catch (err) {
      showToast("error", "Failed to export PDF.");
    } finally {
      setExporting(false);
    }
  };

  // ── Print ──
  const handlePrint = () => {
    window.print();
  };

  const clearFilters = () => {
    setLrnSearch("");
    setNameSearch("");
    setFilterSection("All Sections");
    setFilterClassif("All Classifications");
    setFilterGrade("All Grades");
  };

  const hasFilters = lrnSearch || nameSearch || filterSection !== "All Sections" || filterClassif !== "All Classifications" || filterGrade !== "All Grades";

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="inline-flex flex-col ml-1 leading-none">
      {sortKey === col ? (
        sortDir === "asc"
          ? <ChevronUp size={11} className="text-indigo-600" />
          : <ChevronDown size={11} className="text-indigo-600" />
      ) : (
        <ChevronUp size={11} className="text-gray-300" />
      )}
    </span>
  );

  const sectionBadge: Record<string, string> = {
    Star: "bg-yellow-50 text-yellow-700 border-yellow-200/50",
    Gold: "bg-amber-50 text-amber-700 border-amber-200/50",
    Silver: "bg-slate-100 text-slate-700 border-slate-200/50",
    Regular: "bg-blue-50 text-blue-700 border-blue-200/50",
    Pending: "bg-gray-100 text-gray-500 border-gray-200",
  };

  const sexBadge: Record<string, string> = {
    male: "bg-blue-50 text-blue-700 border-blue-200/50",
    female: "bg-pink-50 text-pink-700 border-pink-200/50",
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="animate-spin w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm font-medium">Loading enrollment data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-10">
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400" />
        <div className="p-5 sm:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-200 flex items-center justify-center flex-shrink-0">
            <BarChart3 size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">Enrollment Report</h2>
            <p className="text-gray-500 text-sm">School Year {syLabel} · Grade 7–12 · All Sections</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3.5 py-2.5 rounded-xl text-xs font-medium shadow-sm transition-all"
            >
              <FileSpreadsheet size={14} />
              CSV
            </button>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2.5 rounded-xl text-xs font-medium shadow-sm hover:shadow transition-all"
            >
              <FileText size={14} />
              Excel
            </button>
            <button
              onClick={handleExportPdf}
              disabled={exporting}
              className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-3.5 py-2.5 rounded-xl text-xs font-medium shadow-sm hover:shadow transition-all disabled:opacity-60"
            >
              <Download size={14} />
              {exporting ? "Exporting..." : "PDF"}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2.5 rounded-xl text-xs font-medium shadow-sm hover:shadow transition-all"
            >
              <Printer size={14} />
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Export toast */}
      {exportMsg && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-in">
          <Download size={15} /> {exportMsg}
        </div>
      )}

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {enrollmentStats.map(stat => {
          const pct = stat.capacity > 0 ? Math.round((stat.enrolled / stat.capacity) * 100) : 0;
          return (
            <div key={stat.grade} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">{stat.grade}</p>
              <p className="text-xl font-bold text-gray-900 mt-1 tracking-[-0.02em]">{stat.enrolled}</p>
              <div className="flex items-center gap-2 mt-2.5">
                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                  <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] font-semibold text-gray-400">{pct}%</span>
              </div>
            </div>
          );
        })}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Total Enrolled</span>
            <div className="w-7 h-7 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Users size={13} className="text-indigo-600" />
            </div>
          </div>
          <p className="text-xl font-bold text-gray-900 tracking-[-0.02em]">{totalEnrolled}</p>
          <p className="text-xs text-gray-400 mt-1">
            <span className="text-indigo-600 font-medium">{overallPercent}%</span> capacity used
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Promotion Rate</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-100 flex items-center justify-center">
              <GraduationCap size={13} className="text-emerald-600" />
            </div>
          </div>
          <p className="text-xl font-bold text-gray-900 tracking-[-0.02em]">{promotionRate}%</p>
          <p className="text-xs text-gray-400 mt-1">{enrollments.filter(e => e.status === "enrolled" && e.grade_level > 7).length} students promoted</p>
        </div>
      </div>

      {/* ── SEARCH & FILTERS ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap gap-3 items-end">
            {/* LRN Search */}
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Search by LRN</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={lrnSearch}
                  onChange={e => setLrnSearch(e.target.value)}
                  placeholder="e.g. 123456789012"
                  className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400 transition-all bg-white"
                />
                {lrnSearch && (
                  <button onClick={() => setLrnSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Name Search */}
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Search by Name</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={nameSearch}
                  onChange={e => setNameSearch(e.target.value)}
                  placeholder="e.g. Maria Santos"
                  className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400 transition-all bg-white"
                />
                {nameSearch && (
                  <button onClick={() => setNameSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Grade Filter */}
            <div className="min-w-[130px]">
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Grade Level</label>
              <div className="relative">
                <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select
                  value={filterGrade}
                  onChange={e => setFilterGrade(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400 bg-white appearance-none cursor-pointer"
                >
                  {GRADES.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
            </div>

            {/* Section Filter */}
            <div className="min-w-[140px]">
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Section</label>
              <div className="relative">
                <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select
                  value={filterSection}
                  onChange={e => setFilterSection(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400 bg-white appearance-none cursor-pointer"
                >
                  {SECTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Classification Filter */}
            <div className="min-w-[170px]">
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Classification</label>
              <div className="relative">
                <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select
                  value={filterClassif}
                  onChange={e => setFilterClassif(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400 bg-white appearance-none cursor-pointer"
                >
                  {CLASSIFICATIONS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Clear */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition self-end"
              >
                <X size={13} /> Clear
              </button>
            )}
          </div>

          {/* Result count */}
          <div className="mt-3 flex items-center gap-2">
            <span className="bg-indigo-50 text-indigo-700 text-[11px] px-2.5 py-1 rounded-full font-semibold border border-indigo-100">
              {filtered.length} learner{filtered.length !== 1 ? "s" : ""} found
            </span>
            {hasFilters && (
              <span className="text-xs text-gray-400">Filters active</span>
            )}
          </div>
        </div>
      </div>

      {/* ── STUDENT TABLE ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-indigo-500" />
            <h3 className="font-semibold text-gray-900">Learner Enrollment List</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm transition-all"
            >
              <FileSpreadsheet size={13} /> CSV
            </button>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm transition-all"
            >
              <FileText size={13} /> Excel
            </button>
            <button
              onClick={handleExportPdf}
              disabled={exporting}
              className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm transition-all disabled:opacity-60"
            >
              <Download size={13} /> {exporting ? "..." : "PDF"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto" id="enrollment-report-content" ref={reportRef}>
          <table className="w-full min-w-[850px]">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-4 py-3.5 text-left">
                  <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">#</span>
                </th>
                {[
                  { label: "LRN", key: "lrn" as SortKey },
                  { label: "Learner Name", key: "name" as SortKey },
                  { label: "Sex", key: "sex" as SortKey },
                  { label: "Grade", key: "grade_level" as SortKey },
                  { label: "Section", key: "section_name" as SortKey },
                ].map(({ label, key }) => (
                  <th key={label} className="px-4 py-3.5 text-left">
                    <button
                      onClick={() => handleSort(key)}
                      className="flex items-center text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em] hover:text-gray-700 transition-colors"
                    >
                      {label}
                      <SortIcon col={key} />
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3.5 text-left">
                  <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">Classification</span>
                </th>
                <th className="px-4 py-3.5 text-left">
                  <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">Status</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-14 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                      <Search size={28} className="text-gray-300" />
                    </div>
                    <p className="text-gray-500 text-sm font-semibold">No learners found</p>
                    <button onClick={clearFilters} className="mt-2 text-indigo-600 text-xs font-medium hover:underline">Clear filters</button>
                  </td>
                </tr>
              ) : (
                filtered.map((s, idx) => (
                  <tr key={s.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-indigo-50/50 transition-colors duration-150`}>
                    <td className="px-4 py-3.5 text-xs text-gray-400 font-mono">{idx + 1}</td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs text-gray-500 font-medium">{s.lrn}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-700 text-xs font-bold flex-shrink-0 shadow-sm">
                          {(s.student_name || "?").charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-gray-900 whitespace-nowrap">{s.student_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {s.sex ? (
                        <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium border ${sexBadge[s.sex] || "bg-gray-100 text-gray-500 border-gray-200"}`}>
                          {s.sex.charAt(0).toUpperCase() + s.sex.slice(1)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="bg-gray-100 text-gray-700 text-[11px] px-2.5 py-1 rounded-full font-medium">Gr. {s.grade_level}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium border ${sectionBadge[s.section_name ?? ""] || "bg-gray-100 text-gray-500 border-gray-200"}`}>
                        {s.section_name || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-gray-500">{s.classifications || "—"}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-medium border ${STATUS_BADGE[s.status] || "bg-gray-50 text-gray-500 border-gray-200/50"}`}>
                        {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3.5 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <span>Showing <span className="font-medium text-gray-600">{filtered.length}</span> of <span className="font-medium text-gray-600">{enrollments.length}</span> total learners</span>
          <span>SY {syLabel} · Hi5 Portal</span>
        </div>
      </div>

      {/* ── CHARTS ROW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 tracking-[-0.01em] mb-4">Enrollment per Grade Level</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={enrollmentStats} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="grade" tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <Tooltip
                contentStyle={{ borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}
                formatter={(v: number, name: string) => [v, name === "enrolled" ? "Enrolled" : "Capacity"]}
              />
              <Bar dataKey="capacity" fill="#e0e7ff" radius={[4, 4, 0, 0]} name="capacity" />
              <Bar dataKey="enrolled" fill="#6366f1" radius={[4, 4, 0, 0]} name="enrolled" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-center">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" /> Enrolled
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-3 h-3 rounded-sm bg-indigo-100 border border-indigo-200 inline-block" /> Capacity
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 tracking-[-0.01em] mb-2">Classifications</h3>
          {classifData.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-xs">No classification data available</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={classifData} cx="50%" cy="50%" outerRadius={70} dataKey="value" paddingAngle={2}>
                    {classifData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-1">
                {classifData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: d.color }} />
                      {d.name}
                    </span>
                    <span className="font-semibold text-gray-700">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
