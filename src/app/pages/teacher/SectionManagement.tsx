import React, { useState, useEffect } from "react";
import { Users, Layers, Search, Eye, Printer } from "lucide-react";
import { useNavigate } from "react-router";
import { sectionsApi, SectionRow } from "../../services/sections";
import { studentsApi, StudentRow } from "../../services/students";
import { useApp } from "../../context/AppContext";

const gradeColors: Record<number, string> = {
  7: "bg-green-100 text-green-700",
  8: "bg-emerald-100 text-emerald-700",
  9: "bg-teal-100 text-teal-700",
  10: "bg-cyan-100 text-cyan-700",
  11: "bg-blue-100 text-blue-700",
  12: "bg-indigo-100 text-indigo-700",
};

const sectionBadge = (name: string): string => {
  if (name.includes("Star")) return "bg-yellow-100 text-yellow-700 border border-yellow-300";
  if (name.includes("Gold")) return "bg-amber-100 text-amber-700 border border-amber-300";
  if (name.includes("Silver")) return "bg-gray-100 text-gray-700 border border-gray-300";
  if (name.includes("Regular")) return "bg-blue-100 text-blue-700 border border-blue-300";
  return "bg-purple-100 text-purple-700 border border-purple-300";
};

export function SectionManagement() {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterGrade, setFilterGrade] = useState<string>("All");
  const [selectedSection, setSelectedSection] = useState<SectionRow | null>(null);

  useEffect(() => {
    Promise.all([
      sectionsApi.list(),
      studentsApi.list(),
    ]).then(([secs, studs]) => {
      setSections(secs);
      setStudents(studs);
    }).catch(err => {
      showToast("error", "Failed to load data: " + (err.detail?.error || err.message));
    }).finally(() => setLoading(false));
  }, []);

  const filtered = sections.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || (s.adviser_name || "").toLowerCase().includes(search.toLowerCase());
    const matchGrade = filterGrade === "All" || s.grade_level === parseInt(filterGrade);
    return matchSearch && matchGrade;
  });

  const sectionStudents = selectedSection
    ? students.filter(s => s.grade_level === selectedSection.grade_level && s.status === "enrolled")
    : [];

  const totalStudents = sections.reduce((a, s) => a + s.current_count, 0);
  const totalCap = sections.reduce((a, s) => a + s.capacity, 0);

  if (loading) {
    return <div className="p-10 text-center text-gray-400 text-sm">Loading sections...</div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Layers size={20} className="text-emerald-700" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800">Section Management</h2>
            <p className="text-gray-500 text-sm">View and manage class sections.</p>
          </div>
        </div>
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">Total Sections</p>
            <p className="text-xl font-bold text-emerald-700">{sections.length}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">Total Capacity</p>
            <p className="text-xl font-bold text-blue-700">{totalCap}</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">Enrolled Students</p>
            <p className="text-xl font-bold text-purple-700">{totalStudents}</p>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search section name or adviser..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
        </div>
        <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
          <option value="All">All Grades</option>
          {[7,8,9,10,11,12].map(g => <option key={g} value={g}>Grade {g}</option>)}
        </select>
      </div>

      {/* Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(sec => {
          const pct = sec.capacity > 0 ? Math.round((sec.current_count / sec.capacity) * 100) : 0;
          return (
            <div key={sec.id}
              onClick={() => setSelectedSection(selectedSection?.id === sec.id ? null : sec)}
              className={`bg-white rounded-xl border-2 p-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${
                selectedSection?.id === sec.id ? "border-emerald-500 ring-2 ring-emerald-200" : "border-transparent"
              }`}>
              <div className="flex items-start justify-between mb-3">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${gradeColors[sec.grade_level] || "bg-gray-100 text-gray-700"}`}>
                  Grade {sec.grade_level}
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sectionBadge(sec.name)}`}>{sec.name.split("-")[1] || sec.name}</span>
              </div>
              <p className="font-bold text-gray-800">{sec.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">Adviser: {sec.adviser_name || "—"}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-500">{sec.current_count} / {sec.capacity} enrolled</span>
                <span className={`text-xs font-bold ${pct >= 90 ? "text-red-500" : pct >= 75 ? "text-amber-500" : "text-emerald-500"}`}>{pct}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                <div className={`h-1.5 rounded-full ${pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Section Students */}
      {selectedSection && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-gray-500" />
              <h3 className="font-semibold text-gray-800">{selectedSection.name} — Enrolled Students</h3>
              <span className="text-xs text-gray-400">({sectionStudents.length} enrolled)</span>
            </div>
            <button onClick={() => setSelectedSection(null)} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
          </div>
          {sectionStudents.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">No enrolled students in this section.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">LRN</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Sex</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {sectionStudents.slice(0, 20).map(s => (
                    <tr key={s.id} className="hover:bg-gray-50 transition">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold">{s.name.charAt(0)}</div>
                          <span className="font-medium text-gray-800">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{s.lrn}</td>
                      <td className="px-4 py-3 text-center text-gray-600 capitalize">{s.sex}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          s.status === "enrolled" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                        }`}>{s.status}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => navigate(`/student/${s.id}`)}
                          className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-100 transition font-medium flex items-center gap-1 mx-auto">
                          <Eye size={12} /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
