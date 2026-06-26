import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  Users, Layers, Search, Eye, Printer, GraduationCap, Shield,
  X, SlidersHorizontal, ArrowUpDown, ChevronLeft, ChevronRight,
  ChevronFirst, ChevronLast, Building2, UserCheck, BookOpen,
  AlertCircle, Info, Clock, MapPin, Filter, School, Activity,
  Loader2,
} from "lucide-react";
import { sectionsApi, SectionRow } from "../../services/sections";
import { studentsApi, StudentRow } from "../../services/students";
import { schoolYearsApi } from "../../services/schoolYears";
import { useApp } from "../../context/AppContext";

const GRADE_LEVELS = [7, 8, 9, 10, 11, 12];

const GRADE_COLORS: Record<number, string> = {
  7: "bg-green-100 text-green-700 border-green-200/50",
  8: "bg-emerald-100 text-emerald-700 border-emerald-200/50",
  9: "bg-teal-100 text-teal-700 border-teal-200/50",
  10: "bg-cyan-100 text-cyan-700 border-cyan-200/50",
  11: "bg-blue-100 text-blue-700 border-blue-200/50",
  12: "bg-indigo-100 text-indigo-700 border-indigo-200/50",
};

const SECTION_TYPE_STYLES: Record<string, { icon: string; bg: string; label: string }> = {
  ste: { icon: "🔬", bg: "bg-amber-50 text-amber-700 border-amber-200/50", label: "STE" },
  regular: { icon: "📚", bg: "bg-blue-50 text-blue-700 border-blue-200/50", label: "Regular" },
  spfl: { icon: "🌐", bg: "bg-yellow-50 text-yellow-700 border-yellow-200/50", label: "SPFL" },
  spj: { icon: "📰", bg: "bg-slate-50 text-slate-600 border-slate-200/50", label: "SPJ" },
  non_reader: { icon: "📖", bg: "bg-red-50 text-red-600 border-red-200/50", label: "Non-Reader" },
};

type SortKey = "name" | "grade_level" | "section_type" | "current_count" | "capacity";
type SortDir = "asc" | "desc";
interface SortConfig { key: SortKey; dir: SortDir }

export function SectionManagement() {
  const navigate = useNavigate();
  const { showToast, role } = useApp();
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [sort, setSort] = useState<SortConfig>({ key: "grade_level", dir: "asc" });
  const [selectedSection, setSelectedSection] = useState<SectionRow | null>(null);

  // Scope toggle: "mine" (default for teachers) or "all"
  const [scope, setScope] = useState<"mine" | "all">("mine");

  // Section-scoped students
  const [sectionStudents, setSectionStudents] = useState<StudentRow[]>([]);
  const [studLoading, setStudLoading] = useState(false);
  const [schoolYearId, setSchoolYearId] = useState<number | null>(null);
  const [studPage, setStudPage] = useState(1);
  const studPageSize = 10;

  useEffect(() => {
    setLoading(true);
    // Default to teacher's own sections, but allow viewing all
    const fetcher = scope === "mine" ? sectionsApi.listMySections() : sectionsApi.list();
    Promise.all([
      fetcher,
      schoolYearsApi.current(),
    ]).then(([secs, sy]) => {
      setSections(secs);
      setSchoolYearId(sy.id);
    }).catch(err => {
      showToast("error", "Failed to load data: " + (err.detail?.error || err.message));
    }).finally(() => setLoading(false));
  }, [scope]);

  // Fetch section-scoped students when selectedSection changes
  useEffect(() => {
    if (!selectedSection || !schoolYearId) {
      setSectionStudents([]);
      return;
    }
    setStudLoading(true);
    setStudPage(1);
    studentsApi.list({ section_id: selectedSection.id, school_year_id: schoolYearId, status: "enrolled" })
      .then(setSectionStudents)
      .catch(err => showToast("error", "Failed to load students: " + (err.detail?.error || err.message)))
      .finally(() => setStudLoading(false));
  }, [selectedSection, schoolYearId]);

  // ── Processed sections (filter + sort) ──
  const processed = useMemo(() => {
    let list = [...sections];
    // search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.adviser_name || "").toLowerCase().includes(q)
      );
    }
    // grade filter
    if (filterGrade !== "all") {
      list = list.filter(s => s.grade_level === parseInt(filterGrade));
    }
    // sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sort.key) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "grade_level": cmp = a.grade_level - b.grade_level; break;
        case "section_type": cmp = a.section_type.localeCompare(b.section_type); break;
        case "current_count": cmp = a.current_count - b.current_count; break;
        case "capacity": cmp = a.capacity - b.capacity; break;
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [sections, search, filterGrade, sort]);

  // ── Students for selected section (fetched from API by section_id) ──
  const totalStudPages = Math.max(1, Math.ceil(sectionStudents.length / studPageSize));
  const safeStudPage = Math.min(studPage, totalStudPages);
  const paginatedStudents = sectionStudents.slice(
    (safeStudPage - 1) * studPageSize,
    safeStudPage * studPageSize
  );

  // Stats
  const totalSections = sections.length;
  const totalCapacity = sections.reduce((a, s) => a + s.capacity, 0);
  const totalEnrolled = sections.reduce((a, s) => a + s.current_count, 0);
  const utilization = totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;

  // ── Sort toggle ──
  const toggleSort = (key: SortKey) => {
    setSort(prev => prev.key === key && prev.dir === "asc" ? { key, dir: "desc" } : { key, dir: "asc" });
  };
  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sort.key !== columnKey) return <ArrowUpDown size={12} className="text-gray-300 group-hover:text-gray-400" />;
    return sort.dir === "asc" ? <ArrowUp size={12} className="text-emerald-600" /> : <ArrowDown size={12} className="text-emerald-600" />;
  };

  const capacityPct = (sec: SectionRow) =>
    sec.capacity > 0 ? Math.round((sec.current_count / sec.capacity) * 100) : 0;

  const capacityColor = (pct: number) =>
    pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-emerald-500";

  const capacityTextColor = (pct: number) =>
    pct >= 90 ? "text-red-500" : pct >= 75 ? "text-amber-500" : "text-emerald-500";

  // ── Loading Skeleton ──
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-5 animate-pulse">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-emerald-200 via-green-200 to-emerald-200" />
          <div className="p-6 space-y-5">
            <div className="h-5 w-48 bg-gray-100 rounded-lg" />
            <div className="h-4 w-72 bg-gray-50 rounded-md" />
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-50 rounded-xl" />)}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-36 bg-white rounded-xl border border-gray-100 shadow-sm" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-10">

      {/* ── Header Card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-shadow duration-200">
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-400" />
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center shadow-sm">
                <Layers size={22} className="text-emerald-700" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 tracking-tight">Section Management</h2>
                <p className="text-sm text-gray-400">View and manage class sections across all grade levels.</p>
              </div>
            </div>
            {/* Scope toggle */}
            {role === "teacher" && (
              <div className="flex items-center bg-gray-100 rounded-xl p-0.5 shadow-xs">
                <button
                  onClick={() => setScope("mine")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                    scope === "mine"
                      ? "bg-white text-emerald-700 shadow-sm border border-gray-200/50"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Users size={13} className="inline mr-1.5 -mt-0.5" />My Sections
                </button>
                <button
                  onClick={() => setScope("all")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                    scope === "all"
                      ? "bg-white text-emerald-700 shadow-sm border border-gray-200/50"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Layers size={13} className="inline mr-1.5 -mt-0.5" />All Sections
                </button>
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {[
              { icon: Layers, label: "Total Sections", value: totalSections, color: "emerald" },
              { icon: Users, label: "Total Capacity", value: totalCapacity, color: "blue" },
              { icon: UserCheck, label: "Enrolled Students", value: totalEnrolled, color: "purple" },
              { icon: Activity, label: "Utilization Rate", value: `${utilization}%`, color: utilization >= 90 ? "red" : utilization >= 75 ? "amber" : "emerald" },
            ].map((stat, i) => {
              const colorMap: Record<string, string> = {
                emerald: "bg-emerald-50 text-emerald-700 border-emerald-200/50",
                blue: "bg-blue-50 text-blue-700 border-blue-200/50",
                purple: "bg-purple-50 text-purple-700 border-purple-200/50",
                red: "bg-red-50 text-red-600 border-red-200/50",
                amber: "bg-amber-50 text-amber-700 border-amber-200/50",
              };
              return (
                <div key={i} className={`rounded-xl border p-4 ${colorMap[stat.color] || colorMap.emerald} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-default`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <stat.icon size={14} className="opacity-70" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.06em] opacity-70">{stat.label}</span>
                  </div>
                  <p className="text-xl font-bold">{stat.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Search & Filters Card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-shadow duration-200">
        <div className="p-5">
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by section name or adviser..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-white transition placeholder:text-gray-300"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition">
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Filter section */}
        <div className="bg-gray-50/40 border-t border-gray-100 px-5 py-3.5">
          <div className="flex items-center flex-wrap gap-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-[0.05em]">
              <SlidersHorizontal size={12} /> Grade
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilterGrade("all")}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all duration-150 ${
                  filterGrade === "all"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200/50 shadow-xs"
                    : "bg-white text-gray-500 border-gray-200/50 hover:bg-gray-50 hover:border-gray-300"
                }`}
              >
                All
              </button>
              {GRADE_LEVELS.map(g => (
                <button
                  key={g}
                  onClick={() => setFilterGrade(String(g))}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all duration-150 ${
                    filterGrade === String(g)
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200/50 shadow-xs"
                      : "bg-white text-gray-500 border-gray-200/50 hover:bg-gray-50 hover:border-gray-300"
                  }`}
                >
                  Grade {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sections Grid ── */}
      {processed.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <Building2 size={32} className="text-gray-300" />
          </div>
          <p className="text-gray-500 text-sm font-semibold">No sections found</p>
          <p className="text-gray-400 text-xs mt-1">
            {search || filterGrade !== "all" ? "Try adjusting your search or filters." : "No sections have been created yet."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing <span className="font-semibold text-gray-700">{processed.length}</span> section{processed.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {processed.map(sec => {
              const pct = capacityPct(sec);
              const typeStyle = SECTION_TYPE_STYLES[sec.section_type] || { icon: "📋", bg: "bg-gray-50 text-gray-600 border-gray-200/50", label: sec.section_type };
              const selected = selectedSection?.id === sec.id;
              return (
                <div
                  key={sec.id}
                  onClick={() => setSelectedSection(selected ? null : sec)}
                  className={`bg-white rounded-xl border-2 p-5 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                    selected
                      ? "border-emerald-500 ring-2 ring-emerald-200/50"
                      : "border-gray-100 hover:border-gray-200"
                  }`}
                >
                  {/* Header badges */}
                  <div className="flex items-start justify-between mb-3">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${GRADE_COLORS[sec.grade_level] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
                      Grade {sec.grade_level}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${typeStyle.bg}`}>
                      {typeStyle.icon} {typeStyle.label}
                    </span>
                  </div>

                  {/* Section name and adviser */}
                  <p className="font-bold text-gray-900 text-base">{sec.name}</p>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                    <Users size={12} className="flex-shrink-0" />
                    <span>Adviser: {sec.adviser_name || "—"}</span>
                  </div>

                  {/* Capacity bar */}
                  <div className="mt-4 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">{sec.current_count} / {sec.capacity} enrolled</span>
                      <span className={`font-bold ${capacityTextColor(pct)}`}>{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${capacityColor(pct)}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Selected Section Students ── */}
      {selectedSection && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-200">
          <div className="h-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-400" />
          <div className="px-5 sm:px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center shadow-xs">
                  <Users size={16} className="text-blue-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">{selectedSection.name}</h3>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <UserCheck size={11} /> {sectionStudents.length} enrolled student{sectionStudents.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSection(null)}
                className="text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg transition font-medium flex items-center gap-1"
              >
                <X size={12} /> Close
              </button>
            </div>
          </div>

          {sectionStudents.length === 0 && !studLoading ? (
            <div className="p-10 text-center">
              <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                <AlertCircle size={22} className="text-gray-300" />
              </div>
              <p className="text-gray-500 text-sm font-semibold">No enrolled students</p>
              <p className="text-gray-400 text-xs mt-1">No students are currently enrolled in this section for the current school year.</p>
            </div>
          ) : studLoading ? (
            <div className="p-10 text-center">
              <Loader2 size={22} className="text-gray-300 mx-auto mb-3 animate-spin" />
              <p className="text-gray-400 text-sm">Loading students...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead className="bg-gray-50/80">
                    <tr>
                      {["Student", "LRN", "Sex", "Status", ""].map(h => (
                        <th key={h} className="text-left px-5 py-3.5 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em] border-b border-gray-100">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginatedStudents.map((s, idx) => (
                      <tr key={s.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-blue-50/40 transition-colors duration-150`}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center text-emerald-700 text-xs font-bold shadow-xs">
                              {s.name.charAt(0)}
                            </div>
                            <span className="font-semibold text-gray-800">{s.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">{s.lrn}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            s.sex === "male" ? "bg-blue-50 text-blue-700" : "bg-pink-50 text-pink-700"
                          }`}>
                            {s.sex.charAt(0).toUpperCase() + s.sex.slice(1)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            s.status === "enrolled" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                          }`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/student/${s.id}`); }}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition shadow-xs"
                          >
                            <Eye size={12} /> View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {sectionStudents.length > studPageSize && (
                <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between flex-wrap gap-3">
                  <span className="text-xs text-gray-400">
                    Showing {(safeStudPage - 1) * studPageSize + 1}–
                    {Math.min(safeStudPage * studPageSize, sectionStudents.length)} of {sectionStudents.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setStudPage(1)} disabled={safeStudPage <= 1}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 disabled:opacity-30 disabled:cursor-not-allowed transition">
                      <ChevronFirst size={14} />
                    </button>
                    <button onClick={() => setStudPage(p => Math.max(1, p - 1))} disabled={safeStudPage <= 1}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 disabled:opacity-30 disabled:cursor-not-allowed transition">
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-xs font-medium text-gray-500 px-3">{safeStudPage} / {totalStudPages}</span>
                    <button onClick={() => setStudPage(p => Math.min(totalStudPages, p + 1))} disabled={safeStudPage >= totalStudPages}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 disabled:opacity-30 disabled:cursor-not-allowed transition">
                      <ChevronRight size={14} />
                    </button>
                    <button onClick={() => setStudPage(totalStudPages)} disabled={safeStudPage >= totalStudPages}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 disabled:opacity-30 disabled:cursor-not-allowed transition">
                      <ChevronLast size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
