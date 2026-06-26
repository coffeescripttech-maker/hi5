import React, { useState, useMemo, useEffect } from "react";
import {
  Search, Download, Filter, Users, FileText,
  ChevronUp, ChevronDown, X, BarChart3, GraduationCap
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { enrollmentsApi, EnrollmentRow } from "../../services/enrollments";
import { sectionsApi, SectionRow } from "../../services/sections";
import { useApp } from "../../context/AppContext";

const SECTIONS = ["All Sections", "Star", "Gold", "Silver", "Regular", "Pending"];
const CLASSIFICATIONS = ["All Classifications", "4Ps", "PWD", "Transferee", "Non-Reader", "Regular"];
const GRADES = ["All Grades", "7", "8", "9", "10", "11", "12"];

const classifData = [
  { name: "4Ps", value: 142, color: "#6366f1" },
  { name: "PWD", value: 38, color: "#8b5cf6" },
  { name: "Transferee", value: 24, color: "#06b6d4" },
  { name: "Non-Reader", value: 11, color: "#ef4444" },
  { name: "Regular", value: 328, color: "#9ca3af" },
];

const STATUS_BADGE: Record<string, string> = {
  enrolled: "bg-emerald-50 text-emerald-700 border-emerald-200/50",
  pending: "bg-amber-50 text-amber-700 border-amber-200/50",
  dropped: "bg-red-50 text-red-600 border-red-200/50",
  transferred: "bg-blue-50 text-blue-700 border-blue-200/50",
  graduated: "bg-purple-50 text-purple-700 border-purple-200/50",
};

type SortKey = "name" | "lrn" | "grade_level" | "section_name" | "sex";
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
  const [exportMsg, setExportMsg] = useState(false);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      enrollmentsApi.list(),
      sectionsApi.list(),
    ]).then(([enr, sec]) => {
      setEnrollments(enr);
      setSections(sec);
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

  const handleExport = () => {
    const headers = ["Student ID", "LRN", "Name", "Grade", "Section", "Sex", "Status"];
    const rows = filtered.map(s => [
      s.student_name, s.lrn, s.student_name, `Grade ${s.grade_level}`,
      s.section_name, "", s.status
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "enrollment_report_SY2025-2026.csv";
    a.click(); URL.revokeObjectURL(url);
    setExportMsg(true);
    setTimeout(() => setExportMsg(false), 3000);
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
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400" />
        <div className="p-5 sm:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-200 flex items-center justify-center flex-shrink-0">
            <BarChart3 size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">Enrollment Report</h2>
            <p className="text-gray-500 text-sm">School Year 2025–2026 · Grade 7–12 · All Sections</p>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all flex-shrink-0"
          >
            <Download size={15} />
            Export Report
          </button>
        </div>
      </div>

      {/* Export toast */}
      {exportMsg && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium">
          <Download size={15} /> Report exported successfully!
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
          <p className="text-xl font-bold text-gray-900 tracking-[-0.02em]">94.2%</p>
          <p className="text-xs text-gray-400 mt-1">From previous school year</p>
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
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs font-medium shadow-sm hover:shadow transition-all"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
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
                    <td className="px-4 py-3.5 text-sm text-gray-600">—</td>
                    <td className="px-4 py-3.5">
                      <span className="bg-gray-100 text-gray-700 text-[11px] px-2.5 py-1 rounded-full font-medium">Gr. {s.grade_level}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium border ${sectionBadge[s.section_name] || "bg-gray-100 text-gray-500 border-gray-200"}`}>
                        {s.section_name || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-gray-400">—</span>
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
          <span>SY 2025–2026 · Hi5 Portal</span>
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
        </div>
      </div>
    </div>
  );
}
