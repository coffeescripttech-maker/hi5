import React, { useState, useEffect } from "react";
import { Users, Layers, TrendingUp, GraduationCap, BookOpen, Activity, School, AlertTriangle, BarChart3, PieChart as PieChartIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { enrollmentsApi, EnrollmentRow } from "../../services/enrollments";
import { sectionsApi, SectionRow } from "../../services/sections";
import { useApp } from "../../context/AppContext";
import { StudentRiskOverview } from "../../components/StudentRiskOverview";
import { PageContainer } from "../../components/PageContainer";
import { HybridTable } from "../../components/HybridTable";

const COLORS = ["#9333ea", "#a855f7", "#c084fc", "#e9d5ff", "#7c3aed", "#d8b4fe"];

export function PrincipalDashboard() {
  const { showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);

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
  const totalEnrolled = enrollments.filter(e => e.status === "enrolled").length;
  const totalSections = sections.length;
  const totalCapacity = sections.reduce((sum, s) => sum + s.capacity, 0);
  const overallPercent = totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;

  const enrollmentByGrade = gradeLevels.map(g => ({
    grade: `Grade ${g}`,
    enrolled: enrollments.filter(e => e.grade_level === g && e.status === "enrolled").length,
    capacity: sections.filter(s => s.grade_level === g).reduce((sum, s) => sum + s.capacity, 0),
  }));

  const sectionPopData = sections
    .sort((a, b) => b.current_count - a.current_count)
    .slice(0, 10)
    .map(s => ({ name: `${s.name} (G${s.grade_level})`, value: s.current_count }));

  const programData = [
    { name: "Regular", value: enrollments.filter(e => e.status === "enrolled" && e.program === "regular").length, color: "#9333ea" },
    { name: "STE", value: enrollments.filter(e => e.status === "enrolled" && e.program === "ste").length, color: "#a855f7" },
    { name: "SPFL", value: enrollments.filter(e => e.status === "enrolled" && e.program === "spfl").length, color: "#c084fc" },
    { name: "Open High", value: enrollments.filter(e => e.status === "enrolled" && e.program === "open_high").length, color: "#e9d5ff" },
    { name: "ALS-SHS", value: enrollments.filter(e => e.status === "enrolled" && e.program === "als_shs").length, color: "#7c3aed" },
  ].filter(p => p.value > 0);

  if (loading) {
    return (
      <PageContainer>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="animate-spin w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm font-medium">Loading dashboard data...</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* HEADER */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-purple-500 via-purple-600 to-purple-400" />
        <div className="p-5 sm:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-200 flex items-center justify-center flex-shrink-0">
            <Activity size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">Principal Dashboard</h2>
            <p className="text-gray-500 text-sm">School-wide overview — enrollment, sections, and key metrics</p>
          </div>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <div className="group relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-[0_2px_14px_rgba(15,23,42,0.06)] p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-purple-400 via-purple-500 to-purple-400" />
          <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 opacity-[0.08] blur-2xl group-hover:opacity-[0.15] transition-opacity duration-300" />
          <div className="relative flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Total Students</span>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 shadow-md shadow-purple-200/60 flex items-center justify-center flex-shrink-0"><Users size={16} className="text-white" /></div>
          </div>
          <p className="relative text-2xl font-bold tracking-[-0.02em] leading-none text-purple-600">{totalEnrolled}</p>
          <p className="relative text-xs text-gray-400 mt-2">{overallPercent}% capacity</p>
        </div>
        <div className="group relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-[0_2px_14px_rgba(15,23,42,0.06)] p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-400 via-blue-500 to-blue-400" />
          <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 opacity-[0.08] blur-2xl group-hover:opacity-[0.15] transition-opacity duration-300" />
          <div className="relative flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Sections</span>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-md shadow-blue-200/60 flex items-center justify-center flex-shrink-0"><Layers size={16} className="text-white" /></div>
          </div>
          <p className="relative text-2xl font-bold tracking-[-0.02em] leading-none text-blue-600">{totalSections}</p>
          <p className="relative text-xs text-gray-400 mt-2">Across {gradeLevels.length} grade levels</p>
        </div>
        <div className="group relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-[0_2px_14px_rgba(15,23,42,0.06)] p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400" />
          <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 opacity-[0.08] blur-2xl group-hover:opacity-[0.15] transition-opacity duration-300" />
          <div className="relative flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Teachers</span>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-md shadow-emerald-200/60 flex items-center justify-center flex-shrink-0"><GraduationCap size={16} className="text-white" /></div>
          </div>
          <p className="relative text-2xl font-bold tracking-[-0.02em] leading-none text-emerald-600">{sections.filter(s => s.adviser_id).length}</p>
          <p className="relative text-xs text-gray-400 mt-2">Advisers assigned</p>
        </div>
        <div className="group relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-[0_2px_14px_rgba(15,23,42,0.06)] p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400" />
          <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 opacity-[0.08] blur-2xl group-hover:opacity-[0.15] transition-opacity duration-300" />
          <div className="relative flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Programs</span>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-md shadow-amber-200/60 flex items-center justify-center flex-shrink-0"><BookOpen size={16} className="text-white" /></div>
          </div>
          <p className="relative text-2xl font-bold tracking-[-0.02em] leading-none text-amber-600">{programData.length}</p>
          <p className="relative text-xs text-gray-400 mt-2 truncate">{programData.map(p => p.name).join(", ")}</p>
        </div>
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 shadow-sm flex items-center justify-center flex-shrink-0">
              <BarChart3 size={14} className="text-white" />
            </div>
            <h3 className="font-semibold text-gray-800 text-sm">Enrollment per Grade Level</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={enrollmentByGrade}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="enrolled" fill="#9333ea" radius={[4, 4, 0, 0]} name="Enrolled" />
              <Bar dataKey="capacity" fill="#f3e8ff" radius={[4, 4, 0, 0]} name="Capacity" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 shadow-sm flex items-center justify-center flex-shrink-0">
              <PieChartIcon size={14} className="text-white" />
            </div>
            <h3 className="font-semibold text-gray-800 text-sm">Enrollment by Program</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={programData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                {programData.map((_entry, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* STUDENT RISK OVERVIEW */}
      <StudentRiskOverview />

      {/* SECTION POPULATION TABLE */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 shadow-sm flex items-center justify-center flex-shrink-0">
              <Layers size={14} className="text-white" />
            </div>
            <h3 className="font-semibold text-gray-800 text-sm">Top Sections by Population</h3>
          </div>
          <span className="text-xs text-gray-400">{sectionPopData.length} sections</span>
        </div>
        <HybridTable
          desktop={
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/80">
                  <tr>
                    {["Section", "Students", "Progress"].map(h => (
                      <th key={h} className="text-left px-5 py-3.5">
                        <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">{h}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sectionPopData.map((s, idx) => (
                    <tr key={s.name} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-purple-50/50 transition-colors`}>
                      <td className="px-5 py-3.5 font-medium text-gray-800">{s.name}</td>
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-gray-900">{s.value}</span>
                        <span className="text-xs text-gray-400 ml-1">students</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="w-full max-w-[200px] bg-gray-100 rounded-full h-2">
                          <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${Math.min(100, (s.value / 50) * 100)}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
          mobile={
            <ul className="divide-y divide-gray-50">
              {sectionPopData.map(s => (
                <li key={s.name} className="px-4 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
                    <span className="text-xs font-bold text-gray-700 flex-shrink-0">{s.value} students</span>
                  </div>
                  <div className="mt-1.5 bg-gray-100 rounded-full h-1.5">
                    <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (s.value / 50) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          }
        />
      </div>
    </PageContainer>
  );
}
