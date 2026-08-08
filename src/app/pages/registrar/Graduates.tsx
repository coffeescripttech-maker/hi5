import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  GraduationCap, Users, Award, Calendar, Search,
  ArrowRight, UserRound, FileText
} from "lucide-react";
import { studentsApi, GraduateRow } from "../../services/students";
import { useApp } from "../../context/AppContext";

/** "2030-2031" → "2031" (Class of 2031). Handles "-" and en-dash "–". */
function classYearOf(sy: string | null | undefined): string | null {
  if (!sy) return null;
  const parts = String(sy).split(/[-–]/);
  return parts.length === 2 ? parts[1].trim() : null;
}

export function Graduates() {
  const { showToast } = useApp();
  const navigate = useNavigate();
  const [graduates, setGraduates] = useState<GraduateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    studentsApi.graduates()
      .then(setGraduates)
      .catch(err => showToast("error", "Failed to load graduates: " + (err.detail?.error || err.message)))
      .finally(() => setLoading(false));
  }, []);

  const classYears = useMemo(() => {
    const years = new Set<string>();
    let hasUnknown = false;
    for (const g of graduates) {
      const cy = classYearOf(g.graduation_sy);
      if (cy) years.add(cy);
      else hasUnknown = true;
    }
    return {
      years: Array.from(years).sort((a, b) => parseInt(b) - parseInt(a)),
      hasUnknown,
    };
  }, [graduates]);

  const latestClass = classYears.years[0] ?? null;
  const latestCount = latestClass
    ? graduates.filter(g => classYearOf(g.graduation_sy) === latestClass).length
    : 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return graduates.filter(g => {
      const cy = classYearOf(g.graduation_sy);
      const okClass =
        classFilter === "all" ||
        (classFilter === "none" ? cy === null : cy === classFilter);
      if (!okClass) return false;
      if (!q) return true;
      return (
        g.name.toLowerCase().includes(q) ||
        g.lrn.toLowerCase().includes(q) ||
        g.student_id.toLowerCase().includes(q) ||
        (g.section_name || "").toLowerCase().includes(q)
      );
    });
  }, [graduates, classFilter, search]);

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
          <p className="text-gray-400 text-sm font-medium">Loading alumni records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-400" />
        <div className="p-5 sm:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 shadow-lg shadow-purple-200 flex items-center justify-center flex-shrink-0">
            <GraduationCap size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">Alumni / Graduates</h2>
            <p className="text-gray-500 text-sm">All students marked as graduates, filterable by batch ("Class of")</p>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-xs text-gray-400 bg-gray-50/80 px-3.5 py-2 rounded-xl border border-gray-100">
            <Award size={14} className="text-purple-500" />
            <span className="font-semibold text-gray-600">{classYears.years.length}</span> batches
            <span className="text-gray-300">|</span>
            <span className="text-purple-600 font-medium">{graduates.length}</span> alumni
          </div>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Total Alumni</span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center">
              <Users size={14} className="text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">{graduates.length}</p>
          <p className="text-xs text-gray-400 mt-1">Graduated students</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Batches</span>
            <div className="w-8 h-8 rounded-xl bg-fuchsia-100 flex items-center justify-center">
              <Award size={14} className="text-fuchsia-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">{classYears.years.length}</p>
          <p className="text-xs text-gray-400 mt-1">
            {classYears.hasUnknown ? "+1 with no batch year" : "Distinct Class of years"}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Latest Batch</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Calendar size={14} className="text-indigo-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">{latestClass ? `Class of ${latestClass}` : "—"}</p>
          <p className="text-xs text-gray-400 mt-1">
            {latestClass ? `${latestCount} graduate${latestCount !== 1 ? "s" : ""} in this batch` : "No graduates yet"}
          </p>
        </div>
      </div>

      {/* ── TABLE ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-gray-900">Graduate Records</h3>
            <span className="bg-purple-50 text-purple-700 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-purple-100">
              {filtered.length} of {graduates.length}
            </span>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2.5">
            {/* Class of filter */}
            <div className="relative">
              <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={classFilter}
                onChange={e => setClassFilter(e.target.value)}
                className="appearance-none bg-white border border-gray-200 rounded-lg pl-9 pr-8 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 hover:border-gray-300 transition-colors cursor-pointer"
                aria-label="Filter by class year"
              >
                <option value="all">All Classes</option>
                {classYears.years.map(y => (
                  <option key={y} value={y}>Class of {y}</option>
                ))}
                {classYears.hasUnknown && <option value="none">No batch year</option>}
              </select>
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, LRN, ID, section..."
                className="bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-700 placeholder-gray-400 w-56 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-colors"
              />
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <GraduationCap size={28} className="text-gray-300" />
            </div>
            <p className="text-gray-500 text-sm font-semibold">No graduates found</p>
            <p className="text-gray-400 text-xs mt-1">
              {graduates.length === 0
                ? "Graduates will appear here once sections are marked as completers."
                : "Try adjusting the Class-of filter or search query."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-gray-50/80">
                <tr>
                  {["Student", "LRN", "Sex", "Section", "School Year", "Class"].map(col => (
                    <th key={col} className="px-6 py-3.5 text-left">
                      <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">
                        {col}
                      </span>
                    </th>
                  ))}
                  <th className="px-6 py-3.5 text-right">
                    <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">View</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((g, idx) => {
                  const cy = classYearOf(g.graduation_sy);
                  return (
                    <tr
                      key={g.id}
                      onClick={() => navigate(`/student/${g.id}`)}
                      className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-purple-50/40 cursor-pointer transition-colors`}
                    >
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-100 to-fuchsia-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                            <UserRound size={15} className="text-purple-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 tracking-[-0.01em] truncate">{g.name}</p>
                            <p className="text-xs text-gray-400">{g.student_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-gray-500 text-sm font-mono">{g.lrn}</td>
                      <td className="px-6 py-3.5">
                        <span className={`text-[11px] font-medium capitalize px-2 py-0.5 rounded-md ${g.sex === "female" ? "bg-pink-50 text-pink-600" : "bg-sky-50 text-sky-600"}`}>
                          {g.sex}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-gray-600 text-sm">{g.section_name || "—"}</td>
                      <td className="px-6 py-3.5 text-gray-500 text-sm">{g.graduation_sy || "—"}</td>
                      <td className="px-6 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-[11px] font-semibold border border-purple-100">
                          <GraduationCap size={11} /> {cy ? `Class of ${cy}` : "—"}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={e => { e.stopPropagation(); navigate(`/student/${g.id}`); }}
                          className="inline-flex items-center gap-1 text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg shadow-sm hover:shadow transition-all font-medium"
                          title={`View ${g.name}'s profile`}
                        >
                          <FileText size={12} /> Profile
                          <ArrowRight size={12} />
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
    </div>
  );
}
