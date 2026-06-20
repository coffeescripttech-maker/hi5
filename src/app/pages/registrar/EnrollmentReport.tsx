import React, { useState, useMemo, useEffect } from "react";
import {
  Search, Download, Filter, Users, TrendingUp, FileSpreadsheet,
  ChevronUp, ChevronDown, X, BarChart2
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
  { name: "4Ps", value: 142, color: "#16a34a" },
  { name: "PWD", value: 38, color: "#2563eb" },
  { name: "Transferee", value: 24, color: "#9333ea" },
  { name: "Non-Reader", value: 11, color: "#ef4444" },
  { name: "Regular", value: 328, color: "#6b7280" },
];

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

  // Compute enrollment stats per grade
  const gradeLevels = [7, 8, 9, 10, 11, 12];
  const enrollmentStats = gradeLevels.map(g => {
    const sectionForGrade = sections.filter(s => s.grade_level === g);
    const enrolled = enrollments.filter(e => e.grade_level === g && e.status === "enrolled").length;
    const capacity = sectionForGrade.reduce((sum, s) => sum + s.capacity, 0);
    return { grade: `Grade ${g}`, enrolled, capacity };
  });

  const totalEnrolled = enrollments.filter(e => e.status === "enrolled").length;

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
    <span className="inline-flex flex-col ml-1 opacity-50">
      {sortKey === col ? (
        sortDir === "asc" ? <ChevronUp size={11} className="opacity-100" /> : <ChevronDown size={11} className="opacity-100" />
      ) : (
        <ChevronUp size={11} />
      )}
    </span>
  );

  const sectionBadge: Record<string, string> = {
    Star: "bg-yellow-100 text-yellow-800 border-yellow-200",
    Gold: "bg-amber-100 text-amber-800 border-amber-200",
    Silver: "bg-slate-100 text-slate-700 border-slate-200",
    Regular: "bg-blue-50 text-blue-700 border-blue-200",
    Pending: "bg-gray-100 text-gray-500 border-gray-200",
  };

  if (loading) {
    return <div className="p-10 text-center text-gray-400 text-sm">Loading enrollment data...</div>;
  }

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <div className="bg-gradient-to-r from-blue-800 to-indigo-900 rounded-2xl p-5 text-white shadow-lg flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <BarChart2 size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Enrollment Report</h2>
            <p className="text-blue-200 text-sm">School Year 2025–2026 · Grade 7–12 · All Sections</p>
          </div>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-white text-blue-800 px-4 py-2.5 rounded-xl text-sm font-bold shadow hover:bg-blue-50 transition flex-shrink-0"
        >
          <Download size={15} />
          Export Report
        </button>
      </div>

      {/* Export toast */}
      {exportMsg && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium">
          <Download size={15} /> Report exported successfully!
        </div>
      )}

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {enrollmentStats.map(stat => (
          <div key={stat.grade} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-400 font-medium">{stat.grade}</p>
            <p className="text-2xl font-extrabold text-green-700 mt-0.5">{stat.enrolled}</p>
            <div className="flex items-center justify-between mt-2 gap-2">
              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-green-500 h-1.5 rounded-full"
                  style={{ width: `${stat.capacity > 0 ? Math.round((stat.enrolled / stat.capacity) * 100) : 0}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">{stat.capacity > 0 ? Math.round((stat.enrolled / stat.capacity) * 100) : 0}%</span>
            </div>
          </div>
        ))}
        <div className="bg-white rounded-xl border border-teal-200 p-4 shadow-sm">
          <p className="text-xs text-gray-400 font-medium">Total Enrolled</p>
          <p className="text-2xl font-extrabold text-teal-700">{totalEnrolled}</p>
          <p className="text-gray-400 text-xs mt-1">SY 2025–2026</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-sm">
          <p className="text-xs text-gray-400 font-medium">Promotion Rate</p>
          <p className="text-2xl font-extrabold text-emerald-700">94.2%</p>
          <p className="text-gray-400 text-xs mt-1">From previous school year</p>
        </div>
      </div>

      {/* ── Search & Filters ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* LRN Search */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Search by LRN</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={lrnSearch}
                onChange={e => setLrnSearch(e.target.value)}
                placeholder="e.g. 123456789012"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
              />
              {lrnSearch && (
                <button onClick={() => setLrnSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Name Search */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Search by Name</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={nameSearch}
                onChange={e => setNameSearch(e.target.value)}
                placeholder="e.g. Maria Santos"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
              />
              {nameSearch && (
                <button onClick={() => setNameSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Grade Filter */}
          <div className="min-w-[130px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Grade Level</label>
            <div className="relative">
              <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                value={filterGrade}
                onChange={e => setFilterGrade(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 appearance-none cursor-pointer"
              >
                {GRADES.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
          </div>

          {/* Section Filter */}
          <div className="min-w-[140px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Section</label>
            <div className="relative">
              <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                value={filterSection}
                onChange={e => setFilterSection(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 appearance-none cursor-pointer"
              >
                {SECTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Classification Filter */}
          <div className="min-w-[170px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Classification</label>
            <div className="relative">
              <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                value={filterClassif}
                onChange={e => setFilterClassif(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 appearance-none cursor-pointer"
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
          <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full font-semibold border border-blue-200">
            {filtered.length} learner{filtered.length !== 1 ? "s" : ""} found
          </span>
          {hasFilters && (
            <span className="text-xs text-gray-400">Filters active</span>
          )}
        </div>
      </div>

      {/* ── Student Table ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-blue-600" />
            <h3 className="font-semibold text-gray-800">Learner Enrollment List</h3>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white px-3.5 py-2 rounded-lg text-xs font-medium transition"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blue-50 border-b border-blue-100">
                {[
                  { label: "#", key: null },
                  { label: "LRN", key: "lrn" },
                  { label: "Learner Name", key: "name" },
                  { label: "Sex", key: "sex" },
                  { label: "Grade", key: "grade_level" },
                  { label: "Section", key: "section_name" },
                  { label: "Classification", key: null },
                  { label: "Status", key: null },
                ].map(({ label, key }) => (
                  <th
                    key={label}
                    className={`text-left px-4 py-3.5 text-blue-700 font-semibold text-xs uppercase tracking-wider whitespace-nowrap ${key ? "cursor-pointer hover:bg-blue-100 select-none" : ""}`}
                    onClick={() => key && handleSort(key as SortKey)}
                  >
                    <span className="inline-flex items-center gap-0.5">
                      {label}
                      {key && <SortIcon col={key as SortKey} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    <Search size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">No learners found matching your filters.</p>
                    <button onClick={clearFilters} className="mt-2 text-blue-500 text-xs underline">Clear filters</button>
                  </td>
                </tr>
              ) : (
                filtered.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-blue-50/30 transition">
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{idx + 1}</td>
                    <td className="px-4 py-3 text-gray-700 font-mono text-xs font-medium">{s.lrn}</td>
                    <td className="px-4 py-3 text-gray-800 font-medium whitespace-nowrap">{s.student_name}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">—</td>
                    <td className="px-4 py-3">
                      <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full font-medium">Gr. {s.grade_level}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${sectionBadge[s.section_name] || "bg-gray-100 text-gray-500 border-gray-200"}`}>
                        {s.section_name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400">—</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${s.status === "enrolled" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                        {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <span>Showing {filtered.length} of {enrollments.length} total learners</span>
          <span>SY 2025–2026 · Hi5 Portal</span>
        </div>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">Enrollment per Grade Level</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={enrollmentStats} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="grade" tick={{ fontSize: 10, fill: "#6b7280" }} />
              <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
              <Tooltip contentStyle={{ borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                formatter={(v: number, name: string) => [v, name === "enrolled" ? "Enrolled" : "Capacity"]} />
              <Bar dataKey="capacity" fill="#d1fae5" radius={[4, 4, 0, 0]} name="capacity" />
              <Bar dataKey="enrolled" fill="#16a34a" radius={[4, 4, 0, 0]} name="enrolled" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-center">
            <span className="flex items-center gap-1 text-xs text-gray-500"><span className="w-3 h-3 rounded bg-green-600 inline-block" /> Enrolled</span>
            <span className="flex items-center gap-1 text-xs text-gray-500"><span className="w-3 h-3 rounded bg-green-100 border border-green-300 inline-block" /> Capacity</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-2">4Ps & PWD Summary</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={classifData} cx="50%" cy="50%" outerRadius={65} dataKey="value" paddingAngle={2}>
                {classifData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "11px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {classifData.map(d => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: d.color }} />
                  {d.name}
                </span>
                <span className="font-bold text-gray-700">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
