import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { Search, Eye, Filter, X, Download } from "lucide-react";
import { studentsApi, StudentRow } from "../../services/students";
import { enrollmentsApi, EnrollmentRow } from "../../services/enrollments";
import { useApp } from "../../context/AppContext";

const sectionBadge = (section: string): string => {
  if (section === "Star") return "bg-yellow-100 text-yellow-700";
  if (section === "Gold") return "bg-amber-100 text-amber-700";
  if (section === "Silver") return "bg-gray-100 text-gray-700";
  if (section === "Regular") return "bg-blue-100 text-blue-700";
  if (section === "Pending") return "bg-orange-100 text-orange-700";
  return "bg-purple-100 text-purple-700";
};

export function StudentSearch() {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterGrade, setFilterGrade] = useState("All");
  const [filterSex, setFilterSex] = useState("All");
  const [filterClassification, setFilterClassification] = useState("All");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    Promise.all([
      studentsApi.list(),
      enrollmentsApi.list(),
    ]).then(([studs, enrs]) => {
      setStudents(studs);
      setEnrollments(enrs);
    }).catch(err => {
      showToast("error", "Failed to load data: " + (err.detail?.error || err.message));
    }).finally(() => setLoading(false));
  }, []);

  // Map student to their current enrollment (if any)
  const studentEnrollmentMap = new Map<number, EnrollmentRow>();
  enrollments.filter(e => e.status === "enrolled").forEach(e => {
    studentEnrollmentMap.set(e.student_id, e);
  });

  const suggestions = search.length >= 1
    ? students
        .filter(s =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.lrn.includes(search) ||
          s.student_id.includes(search)
        )
        .slice(0, 6)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = students.filter(s => {
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.lrn.includes(search) ||
      s.student_id.includes(search);
    const matchGrade = filterGrade === "All" || s.grade_level === parseInt(filterGrade);
    const matchSex = filterSex === "All" || s.sex === filterSex.toLowerCase();
    return matchSearch && matchGrade && matchSex;
  });

  if (loading) {
    return <div className="p-10 text-center text-gray-400 text-sm">Loading student records...</div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="font-bold text-gray-800 mb-1">Student Search</h2>
        <p className="text-gray-500 text-sm mb-4">Search and view student records. Click a student to view their full profile.</p>

        <div className="flex gap-3">
          <div className="relative flex-1" ref={searchRef}>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search by name, LRN, or Student ID..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                {suggestions.map(s => (
                  <button key={s.id} type="button"
                    onClick={() => { setSearch(s.name); setShowSuggestions(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-emerald-50 transition text-left border-b border-gray-50 last:border-0">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold flex-shrink-0">{s.name.charAt(0)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                      <p className="text-xs text-gray-400">LRN: {s.lrn} · Grade {s.grade_level}</p>
                    </div>
                    <span className="text-xs text-emerald-500">Select →</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition ${showFilters ? "bg-green-50 border-green-300 text-green-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
          >
            <Filter size={14} />
            Filters
          </button>
          <button className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
            <Download size={14} />
            Export
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Grade Level</label>
              <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="All">All Grades</option>
                {[7,8,9,10,11,12].map(g => <option key={g} value={g}>Grade {g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sex</label>
              <select value={filterSex} onChange={e => setFilterSex(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="All">All</option>
                <option>Male</option>
                <option>Female</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Student Records</h3>
          <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full">{filtered.length} student(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {["Student ID", "Name", "LRN", "Grade", "Sex", "Status", "Actions"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-gray-500 text-xs font-medium uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <Search size={32} className="mx-auto mb-2 text-gray-300" />
                    <p>No students found matching your search</p>
                  </td>
                </tr>
              ) : (
                filtered.map(s => {
                  const enrollment = studentEnrollmentMap.get(s.id);
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition">
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-600">{s.student_id}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: s.sex === "female" ? "#fce7f3" : "#dbeafe", color: s.sex === "female" ? "#db2777" : "#2563eb" }}>
                            {s.name.charAt(0)}
                          </div>
                          <span className="font-medium text-gray-800 whitespace-nowrap">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-500">{s.lrn}</td>
                      <td className="px-5 py-3.5 text-gray-600">Grade {s.grade_level}</td>
                      <td className="px-5 py-3.5 text-gray-600 capitalize">{s.sex}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.status === "enrolled" ? "bg-green-100 text-green-700" : s.status === "pending" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"}`}>
                          {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => navigate(`/student/${s.id}`)}
                          className="flex items-center gap-1 text-green-600 hover:text-green-800 text-xs font-medium hover:underline"
                        >
                          <Eye size={12} /> View Profile
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
