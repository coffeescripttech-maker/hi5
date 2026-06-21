import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { Search, Eye, Users, GraduationCap, ChevronRight, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronFirst, ChevronLast, SlidersHorizontal, X } from "lucide-react";
import { studentsApi, StudentRow } from "../../services/students";
import { useApp } from "../../context/AppContext";

const GRADE_LEVELS = [7, 8, 9, 10, 11, 12];

type SortKey = "name" | "lrn" | "grade_level" | "sex" | "status";
interface SortConfig { key: SortKey; dir: "asc" | "desc" }

export function StudentList() {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Filters
  const [filterGrade, setFilterGrade] = useState<number | "all">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSex, setFilterSex] = useState<string>("all");

  // Sort
  const [sort, setSort] = useState<SortConfig>({ key: "name", dir: "asc" });

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const STATUSES = ["all", "enrolled", "pending", "dropped", "transferred", "graduated"];

  useEffect(() => {
    studentsApi.listMyStudents()
      .then(setStudents)
      .catch(err => showToast("error", "Failed to load students: " + (err.detail?.error || err.message)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset page when filters/search change
  useEffect(() => { setPage(1); }, [search, filterGrade, filterStatus, filterSex]);

  // ── Filter, search, sort ──────────────────────────────────
  const processed = useMemo(() => {
    let data = [...students];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.lrn.includes(q) ||
        s.student_id.toLowerCase().includes(q)
      );
    }

    if (filterGrade !== "all") data = data.filter(s => s.grade_level === filterGrade);
    if (filterStatus !== "all") data = data.filter(s => s.status === filterStatus);
    if (filterSex !== "all") data = data.filter(s => s.sex === filterSex);

    data.sort((a, b) => {
      let cmp = 0;
      switch (sort.key) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "lrn": cmp = a.lrn.localeCompare(b.lrn); break;
        case "grade_level": cmp = a.grade_level - b.grade_level; break;
        case "sex": cmp = a.sex.localeCompare(b.sex); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
      }
      return sort.dir === "desc" ? -cmp : cmp;
    });

    return data;
  }, [students, search, filterGrade, filterStatus, filterSex, sort]);

  const suggestions = search.trim().length >= 1
    ? students.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.lrn.includes(search) ||
        s.student_id.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 6)
    : [];

  // Pagination
  const totalPages = Math.max(1, Math.ceil(processed.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = processed.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: SortKey) => {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { key, dir: "asc" }
    );
  };

  const SortIcon = ({ colKey }: { colKey: SortKey }) => {
    if (sort.key !== colKey) return <ArrowUpDown size={11} className="text-gray-300 ml-1 flex-shrink-0" />;
    return sort.dir === "asc"
      ? <ArrowUp size={11} className="text-emerald-600 ml-1 flex-shrink-0" />
      : <ArrowDown size={11} className="text-emerald-600 ml-1 flex-shrink-0" />;
  };

  const filterChip = (label: string, active: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 border ${
        active
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm"
          : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-400" />
        <div className="p-5 sm:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-200 flex items-center justify-center flex-shrink-0">
            <Users size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">My Students</h2>
            <p className="text-gray-500 text-sm">View and manage students in your assigned sections</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400 bg-gray-50/80 px-3.5 py-2 rounded-xl border border-gray-100">
            <GraduationCap size={14} className="text-emerald-500" />
            <span className="font-semibold text-gray-600">{students.length}</span> total
          </div>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Search section */}
        <div className="p-5 sm:p-6">
          <div className="relative" ref={searchRef}>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2.5">
              <Search size={15} className="text-emerald-500" />
              Search Students
            </label>
            <div className="relative">
              <input
                type="text" value={search}
                onChange={e => { setSearch(e.target.value); setShowSuggestions(e.target.value.length >= 1); }}
                onFocus={() => { if (search.length >= 1) setShowSuggestions(true); }}
                placeholder="Search by name, LRN, or Student ID..."
                className="w-full pl-4 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-3 focus:border-emerald-400 focus:ring-emerald-100 transition-all bg-white/75"
              />
              {search && (
                <button onClick={() => { setSearch(""); setShowSuggestions(false); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition">
                  <X size={16} />
                </button>
              )}
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/50 z-50 overflow-hidden">
                {suggestions.map(s => (
                  <button key={s.id} type="button"
                    onClick={() => { setSearch(s.name); setShowSuggestions(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 transition text-left border-b border-gray-50 last:border-0">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center text-emerald-700 text-xs font-bold flex-shrink-0 shadow-sm">
                      {s.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                      <p className="text-xs text-gray-400">
                        <span className="font-mono">{s.lrn}</span> · Grade {s.grade_level} · {s.sex === "male" ? "Male" : "Female"}
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Filters section */}
        <div className="border-t border-gray-100 bg-gray-50/40 px-5 sm:px-6 py-4">
          <div className="flex items-center gap-2 mb-3">
            <SlidersHorizontal size={13} className="text-gray-400" />
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.04em]">Filter Students</span>
            {(filterGrade !== "all" || filterStatus !== "all" || filterSex !== "all") && (
              <span className="ml-auto">
                <button
                  onClick={() => { setFilterGrade("all"); setFilterStatus("all"); setFilterSex("all"); }}
                  className="text-[11px] font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded-lg transition flex items-center gap-1"
                >
                  <X size={12} /> Clear all
                </button>
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
            {/* Grade */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Grade</p>
              <div className="flex flex-wrap gap-1.5">
                {GRADE_LEVELS.map(g => filterChip(`Grd ${g}`, filterGrade === g, () => setFilterGrade(filterGrade === g ? "all" : g)))}
              </div>
            </div>
            {/* Status */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Status</p>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map(st => filterChip(st === "all" ? "All" : st.charAt(0).toUpperCase() + st.slice(1), filterStatus === st, () => setFilterStatus(filterStatus === st ? "all" : st)))}
              </div>
            </div>
            {/* Sex */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Sex</p>
              <div className="flex flex-wrap gap-1.5">
                {["all", "male", "female"].map(sex => filterChip(sex === "all" ? "All" : sex.charAt(0).toUpperCase() + sex.slice(1), filterSex === sex, () => setFilterSex(filterSex === sex ? "all" : sex)))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Student table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="animate-spin w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm font-medium">Loading students...</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-gray-900">Student Records</h3>
              <span className="bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-emerald-100">
                {processed.length} student{processed.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {search && <span className="text-xs text-gray-400">{processed.length} of {students.length} found</span>}
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <span>Show</span>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
                >
                  {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          </div>
          {processed.length === 0 ? (
            <div className="p-14 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <Users size={28} className="text-gray-300" />
              </div>
              <p className="text-gray-500 text-sm font-semibold">No students found</p>
              <p className="text-gray-400 text-xs mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-gray-50/80">
                    <tr>
                      {[
                        { key: "name" as SortKey, label: "Student" },
                        { key: "lrn" as SortKey, label: "LRN" },
                        { key: "grade_level" as SortKey, label: "Grade Level" },
                        { key: "sex" as SortKey, label: "Sex" },
                        { key: "status" as SortKey, label: "Status" },
                      ].map(col => (
                        <th key={col.key} className="px-6 py-3.5 text-left">
                          <button
                            onClick={() => toggleSort(col.key)}
                            className="flex items-center text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em] hover:text-gray-700 transition-colors"
                          >
                            {col.label}
                            <SortIcon colKey={col.key} />
                          </button>
                        </th>
                      ))}
                      <th className="px-6 py-3.5 text-left"><span className="sr-only">Action</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginated.map((s, idx) => {
                      const studentId = s.student_id || `STU-${String(s.id).padStart(3, "0")}`;
                      const statusBadge: Record<string, { bg: string; label: string }> = {
                        enrolled: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200/50", label: "Enrolled" },
                        pending: { bg: "bg-amber-50 text-amber-700 border-amber-200/50", label: "Pending" },
                        dropped: { bg: "bg-red-50 text-red-600 border-red-200/50", label: "Dropped" },
                        transferred: { bg: "bg-blue-50 text-blue-700 border-blue-200/50", label: "Transferred" },
                        graduated: { bg: "bg-purple-50 text-purple-700 border-purple-200/50", label: "Graduated" },
                      };
                      const badge = statusBadge[s.status] || { bg: "bg-gray-50 text-gray-500 border-gray-200/50", label: s.status };
                      return (
                        <tr key={s.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-emerald-50/50 transition-colors duration-150`}>
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center text-emerald-700 text-xs font-bold flex-shrink-0 shadow-sm">
                                {s.name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                                <p className="text-xs text-gray-400 font-mono">{studentId}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-3.5"><span className="font-mono text-xs text-gray-500">{s.lrn}</span></td>
                          <td className="px-6 py-3.5"><span className="text-sm text-gray-700 font-medium">Grade {s.grade_level}</span></td>
                          <td className="px-6 py-3.5"><span className="text-sm text-gray-600 capitalize">{s.sex}</span></td>
                          <td className="px-6 py-3.5">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-medium border ${badge.bg}`}>{badge.label}</span>
                          </td>
                          <td className="px-6 py-3.5">
                            <button
                              onClick={() => navigate(`/student/${s.id}`)}
                              className="flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200/70 px-3 py-1.5 rounded-lg hover:bg-emerald-100 hover:border-emerald-300 transition-all font-medium"
                            >
                              <Eye size={13} /> View Profile
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  Showing <span className="font-medium text-gray-600">{(safePage - 1) * pageSize + 1}</span>–
                  <span className="font-medium text-gray-600">{Math.min(safePage * pageSize, processed.length)}</span> of{' '}
                  <span className="font-medium text-gray-600">{processed.length}</span>
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(1)} disabled={safePage === 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
                    <ChevronFirst size={14} />
                  </button>
                  <button onClick={() => setPage(safePage - 1)} disabled={safePage === 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(1, Math.min(safePage - 2, totalPages - 4));
                    const n = start + i;
                    if (n > totalPages) return null;
                    return (
                      <button key={n} onClick={() => setPage(n)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition ${
                          n === safePage
                            ? "bg-emerald-500 text-white shadow-sm"
                            : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}>
                        {n}
                      </button>
                    );
                  })}
                  <button onClick={() => setPage(safePage + 1)} disabled={safePage === totalPages}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
                    <ChevronRight size={14} />
                  </button>
                  <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
                    <ChevronLast size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
