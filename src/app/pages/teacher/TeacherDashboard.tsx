import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Layers, Users, TrendingUp, UserPlus, BookOpen, Upload, LayoutDashboard, BarChart3, Zap, PieChart as PieChartIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { sectionsApi, SectionRow } from "../../services/sections";
import { studentsApi, StudentRow } from "../../services/students";
import { authApi } from "../../services/api";
import { useApp } from "../../context/AppContext";
import { PageContainer } from "../../components/PageContainer";
import { HybridTable } from "../../components/HybridTable";

const COLORS = ["#10b981", "#6ee7b7"];

export function TeacherDashboard() {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [mySections, setMySections] = useState<SectionRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      authApi.me().then(me => { if (!cancelled) setCurrentUserId(me.id); }).catch(() => {}),
      sectionsApi.list().then(secs => { if (!cancelled) setMySections(secs); }).catch(() => {}),
      studentsApi.list().then(studs => { if (!cancelled) setStudents(studs); }).catch(() => {}),
    ]).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Filter sections where current user is adviser
  const adviserSections = currentUserId
    ? mySections.filter(s => s.adviser_id === currentUserId)
    : [];

  const totalMyStudents = adviserSections.reduce((a, s) => a + s.current_count, 0);
  const totalMyCapacity = adviserSections.reduce((a, s) => a + s.capacity, 0);

  // Compute gender distribution from actual students (across my sections' grade levels)
  const myGradeLevels = adviserSections.map(s => s.grade_level);
  const myStudents = students.filter(s => myGradeLevels.includes(s.grade_level));
  const maleCount = myStudents.filter(s => s.sex === "male").length;
  const femaleCount = myStudents.filter(s => s.sex === "female").length;
  const genderData = [
    { name: "Male", value: maleCount || 1, color: "#10b981" },
    { name: "Female", value: femaleCount || 1, color: "#6ee7b7" },
  ];

  // Grade distribution from students (by grade_level as proxy)
  const gradeDistMap: Record<string, number> = {};
  myStudents.forEach(s => {
    const key = `Gr.${s.grade_level}`;
    gradeDistMap[key] = (gradeDistMap[key] || 0) + 1;
  });
  const gradeDistribution = Object.entries(gradeDistMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([range, count]) => ({ range, count, label: `Grade ${range}` }));

  if (loading) return (
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

  return (
    <PageContainer>
      {/* HEADER */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-400" />
        <div className="p-5 sm:p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-200 flex items-center justify-center flex-shrink-0">
              <LayoutDashboard size={22} className="text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">Teacher Dashboard</h2>
              <p className="text-gray-500 text-sm truncate">Your sections, students, and class overview at a glance</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/teacher/enroll")}
              className="border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all flex items-center gap-2 touch-target">
              <UserPlus size={15} /> Enroll Student
            </button>
            <button
              onClick={() => navigate("/teacher/grades")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all flex items-center gap-2 touch-target">
              <BookOpen size={15} /> Encode Grades
            </button>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 lg:gap-4">
        <div className="group relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-[0_2px_14px_rgba(15,23,42,0.06)] p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400" />
          <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 opacity-[0.08] blur-2xl group-hover:opacity-[0.15] transition-opacity duration-300" />
          <div className="relative flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">My Sections</span>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-md shadow-emerald-200/60 flex items-center justify-center flex-shrink-0">
              <Layers size={16} className="text-white" />
            </div>
          </div>
          <p className="relative text-2xl font-bold tracking-[-0.02em] leading-none text-emerald-600">{adviserSections.length}</p>
          <p className="relative text-xs text-gray-400 mt-2 truncate">
            {adviserSections.map(s => `Grade ${s.grade_level}`).join(", ") || "No sections yet"}
          </p>
        </div>
        <div className="group relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-[0_2px_14px_rgba(15,23,42,0.06)] p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-sky-400 via-sky-500 to-sky-400" />
          <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 opacity-[0.08] blur-2xl group-hover:opacity-[0.15] transition-opacity duration-300" />
          <div className="relative flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Enrolled Students</span>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 shadow-md shadow-sky-200/60 flex items-center justify-center flex-shrink-0">
              <Users size={16} className="text-white" />
            </div>
          </div>
          <p className="relative text-2xl font-bold tracking-[-0.02em] leading-none text-sky-600">{totalMyStudents}</p>
          <p className="relative text-xs text-gray-400 mt-2 truncate">Across all my sections</p>
        </div>
        <div className="group relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-[0_2px_14px_rgba(15,23,42,0.06)] p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-violet-400 via-violet-500 to-violet-400" />
          <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 opacity-[0.08] blur-2xl group-hover:opacity-[0.15] transition-opacity duration-300" />
          <div className="relative flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Section Capacity</span>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-400 to-violet-600 shadow-md shadow-violet-200/60 flex items-center justify-center flex-shrink-0">
              <TrendingUp size={16} className="text-white" />
            </div>
          </div>
          <p className="relative text-2xl font-bold tracking-[-0.02em] leading-none text-violet-600">{totalMyCapacity}</p>
          <p className="relative text-xs text-gray-400 mt-2 truncate">Total slots available</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-sm flex items-center justify-center flex-shrink-0">
              <BarChart3 size={14} className="text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Students by Grade Level</h3>
              <p className="text-gray-400 text-xs mt-0.5">Distribution across my sections</p>
            </div>
          </div>
          {gradeDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={gradeDistribution} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">No student data available</div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-400 to-violet-600 shadow-sm flex items-center justify-center flex-shrink-0">
              <PieChartIcon size={14} className="text-white" />
            </div>
            <h3 className="font-semibold text-gray-800">Gender Distribution</h3>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={genderData} cx="50%" cy="45%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                {genderData.map((entry, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
              <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-around mt-2">
            {genderData.map(d => (
              <div key={d.name} className="text-center">
                <p className="font-bold text-gray-800">{d.value}</p>
                <p className="text-xs text-gray-500">{d.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-sm flex items-center justify-center flex-shrink-0">
            <Zap size={14} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Quick Actions</h3>
            <p className="text-gray-400 text-xs mt-0.5">Common tasks you perform often</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button onClick={() => navigate("/teacher/enroll")}
            className="flex items-center gap-3 p-4 rounded-2xl border-2 border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/50 transition group">
            <div className="w-11 h-11 bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-md shadow-emerald-200/60 group-hover:shadow-lg group-hover:brightness-105 rounded-xl flex items-center justify-center transition">
              <UserPlus size={20} className="text-white" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-800 text-sm">Enroll Student</p>
              <p className="text-gray-400 text-xs">New or returning student</p>
            </div>
          </button>
          <button onClick={() => navigate("/teacher/grades")}
            className="flex items-center gap-3 p-4 rounded-2xl border-2 border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/50 transition group">
            <div className="w-11 h-11 bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-md shadow-emerald-200/60 group-hover:shadow-lg group-hover:brightness-105 rounded-xl flex items-center justify-center transition">
              <BookOpen size={20} className="text-white" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-800 text-sm">Encode Grades</p>
              <p className="text-gray-400 text-xs">Enter quarterly grades</p>
            </div>
          </button>
          <button onClick={() => navigate("/teacher/upload")}
            className="flex items-center gap-3 p-4 rounded-2xl border-2 border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/50 transition group">
            <div className="w-11 h-11 bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-md shadow-emerald-200/60 group-hover:shadow-lg group-hover:brightness-105 rounded-xl flex items-center justify-center transition">
              <Upload size={20} className="text-white" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-800 text-sm">Upload Past Grades</p>
              <p className="text-gray-400 text-xs">Import from Excel template</p>
            </div>
          </button>
        </div>
      </div>

      {/* My Sections Summary */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-sm flex items-center justify-center flex-shrink-0">
            <Layers size={14} className="text-white" />
          </div>
          <h3 className="font-semibold text-gray-800">My Sections Overview</h3>
        </div>
        {adviserSections.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No sections assigned to you yet.</div>
        ) : (
          <HybridTable
            desktop={
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/80">
                    <tr>
                      {["Section", "Grade", "Students", "Capacity", "Occupancy"].map(h => (
                        <th key={h} className="text-left px-6 py-3.5">
                          <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">{h}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {adviserSections.map((s, idx) => {
                      const pct = s.capacity > 0 ? Math.round((s.current_count / s.capacity) * 100) : 0;
                      return (
                        <tr key={s.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-emerald-50/50 transition-colors`}>
                          <td className="px-6 py-3.5 font-semibold text-gray-800">{s.name}</td>
                          <td className="px-6 py-3.5 text-gray-600">Grade {s.grade_level}</td>
                          <td className="px-6 py-3.5 text-gray-700 font-medium">{s.current_count}</td>
                          <td className="px-6 py-3.5 text-gray-500">{s.capacity}</td>
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[80px]">
                                <div className={`h-1.5 rounded-full ${pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                                  style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-gray-500">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            }
            mobile={
              <ul className="divide-y divide-gray-50">
                {adviserSections.map(s => {
                  const pct = s.capacity > 0 ? Math.round((s.current_count / s.capacity) * 100) : 0;
                  const barCls = pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-emerald-500";
                  return (
                    <li key={s.id} className="px-4 py-3.5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center flex-shrink-0">
                        <Layers size={16} className="text-emerald-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
                          <span className="text-xs font-bold text-gray-700 flex-shrink-0">{pct}%</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Grade {s.grade_level} · {s.current_count}/{s.capacity} students
                        </p>
                        <div className="mt-1.5 bg-gray-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${barCls}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            }
          />
        )}
      </div>
    </PageContainer>
  );
}
