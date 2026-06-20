import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { Search, Eye, Users } from "lucide-react";
import { studentsApi, StudentRow } from "../../services/students";
import { useApp } from "../../context/AppContext";

export function StudentList() {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    studentsApi.list()
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

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.lrn.includes(search) || s.student_id.toLowerCase().includes(search.toLowerCase())
  );

  const suggestions = search.length >= 1 ? filtered.slice(0, 5) : [];

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Users size={18} className="text-emerald-700" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800">My Students</h2>
            <p className="text-gray-500 text-sm">View profiles of students in your assigned sections.</p>
          </div>
        </div>
        <div className="mt-4 relative" ref={searchRef}>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text" value={search}
            onChange={e => { setSearch(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Search by name, LRN, or Student ID..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
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
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center text-gray-400 text-sm">Loading students...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Students ({filtered.length})</p>
            <span className="text-xs text-gray-400">All enrolled students</span>
          </div>
          {filtered.length === 0 ? (
            <div className="p-10 text-center">
              <Users size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">No students found</p>
              <p className="text-gray-400 text-xs mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {["Student", "LRN", "Grade Level", "Sex", "Status", "Action"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(s => {
                    const studentId = s.student_id || `STU-${String(s.id).padStart(3, "0")}`;
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 transition">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold flex-shrink-0">
                              {s.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                              <p className="text-xs text-gray-400">{studentId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-600">{s.lrn}</td>
                        <td className="px-5 py-3.5 text-sm text-gray-700">Grade {s.grade_level}</td>
                        <td className="px-5 py-3.5 text-sm text-gray-600 capitalize">{s.sex}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            s.status === "enrolled" ? "bg-green-100 text-green-700" :
                            s.status === "pending" ? "bg-amber-100 text-amber-700" :
                            "bg-gray-100 text-gray-500"
                          }`}>{s.status}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => navigate(`/student/${s.id}`)}
                            className="flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition font-medium"
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
          )}
        </div>
      )}
    </div>
  );
}
