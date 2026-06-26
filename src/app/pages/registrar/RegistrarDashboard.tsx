import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Users, Layers, TrendingUp, FileText, ArrowUpRight, GraduationCap,
  BarChart3, Activity, BookOpen, School
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { enrollmentsApi, EnrollmentRow } from "../../services/enrollments";
import { sectionsApi, SectionRow } from "../../services/sections";
import { useApp } from "../../context/AppContext";

export function RegistrarDashboard() {
  const navigate = useNavigate();
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
  const enrollmentStats = gradeLevels.map(g => {
    const sectionForGrade = sections.filter(s => s.grade_level === g);
    const enrolled = enrollments.filter(e => e.grade_level === g && e.status === "enrolled").length;
    const capacity = sectionForGrade.reduce((sum, s) => sum + s.capacity, 0);
    return { grade: `Grade ${g}`, enrolled, capacity };
  });

  const totalEnrolled = enrollments.filter(e => e.status === "enrolled").length;
  const totalCapacity = sections.reduce((sum, s) => sum + s.capacity, 0);
  const overallPercent = totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;

  const sectionPopData = sections
    .sort((a, b) => b.current_count - a.current_count)
    .slice(0, 5)
    .map(s => ({ name: s.name, value: s.current_count }));

  const classifData = [
    { name: "4Ps", value: 142, color: "#6366f1" },
    { name: "PWD", value: 38, color: "#8b5cf6" },
    { name: "Transferee", value: 24, color: "#06b6d4" },
    { name: "Non-Reader", value: 11, color: "#ef4444" },
    { name: "Regular", value: 328, color: "#9ca3af" },
  ];

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
          <p className="text-gray-400 text-sm font-medium">Loading dashboard data...</p>
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
            <Activity size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">Registrar Dashboard</h2>
            <p className="text-gray-500 text-sm">Overview of enrollment, sections, and school form generation</p>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-xs text-gray-400 bg-gray-50/80 px-3.5 py-2 rounded-xl border border-gray-100">
            <School size={14} className="text-indigo-500" />
            <span className="font-semibold text-gray-600">{sections.length}</span> sections
            <span className="text-gray-300">|</span>
            <span className="text-indigo-600 font-medium">{totalEnrolled}</span> enrolled
          </div>
        </div>
      </div>

      {/* ── ENROLLMENT PER GRADE ── */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {enrollmentStats.map(stat => {
          const pct = stat.capacity > 0 ? Math.round((stat.enrolled / stat.capacity) * 100) : 0;
          return (
            <div key={stat.grade} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">{stat.grade}</p>
              <p className="text-xl font-bold text-gray-900 mt-1 tracking-[-0.02em]">{stat.enrolled}</p>
              <div className="flex items-center gap-2 mt-2.5">
                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-indigo-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-gray-400">{pct}%</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">of {stat.capacity} capacity</p>
            </div>
          );
        })}
      </div>

      {/* ── SUMMARY CARDS ROW ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Total Enrolled</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Users size={14} className="text-indigo-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">{totalEnrolled}</p>
          <p className="text-xs text-gray-400 mt-1">
            <span className="text-indigo-600 font-medium">{overallPercent}%</span> of {totalCapacity} total capacity
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Promotion Rate</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
              <TrendingUp size={14} className="text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">94.2%</p>
          <p className="text-xs text-gray-400 mt-1">From previous school year</p>
        </div>
      </div>

      {/* ── CHARTS ROW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Enrollment bar chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 tracking-[-0.01em]">Enrollment per Grade Level</h3>
            <BarChart3 size={16} className="text-gray-300" />
          </div>
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
          <div className="flex gap-4 mt-3 justify-center">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" /> Enrolled
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-3 h-3 rounded-sm bg-indigo-100 border border-indigo-200 inline-block" /> Capacity
            </span>
          </div>
        </div>

        {/* Classification pie chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 tracking-[-0.01em] mb-2">Classifications</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={classifData} cx="50%" cy="50%" outerRadius={75} dataKey="value" paddingAngle={2}>
                {classifData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "11px" }}
              />
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

      {/* ── SCHOOL FORM GENERATION ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText size={16} className="text-indigo-500" />
            <h3 className="font-semibold text-gray-900 tracking-[-0.01em]">School Form Generation</h3>
          </div>
          <button
            onClick={() => navigate("/registrar/forms")}
            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition flex items-center gap-1"
          >
            Open Forms <ArrowUpRight size={12} />
          </button>
        </div>
        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { code: "SF1", title: "School Form 1", desc: "School Register", color: "from-indigo-500 to-indigo-600", bg: "bg-indigo-50 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-100/50" },
            { code: "SF5", title: "School Form 5", desc: "Report on Promotion", color: "from-violet-500 to-violet-600", bg: "bg-violet-50 border-violet-200 hover:border-violet-400 hover:bg-violet-100/50" },
            { code: "SF9", title: "School Form 9", desc: "Progress Report Card", color: "from-emerald-500 to-emerald-600", bg: "bg-emerald-50 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100/50" },
            { code: "SF10", title: "School Form 10", desc: "Permanent Academic Record", color: "from-cyan-500 to-cyan-600", bg: "bg-cyan-50 border-cyan-200 hover:border-cyan-400 hover:bg-cyan-100/50" },
          ].map(f => (
            <button
              key={f.code}
              onClick={() => navigate("/registrar/forms")}
              className={`flex items-start gap-3 p-4 rounded-xl border transition-all text-left ${f.bg}`}
            >
              <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${f.color} shadow-sm flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <FileText size={15} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-gray-900 text-sm tracking-[-0.01em]">{f.title}</p>
                <p className="text-gray-500 text-xs mt-0.5">{f.desc}</p>
                <p className="text-indigo-600 text-[11px] mt-2 font-semibold flex items-center gap-1">
                  Generate <ArrowUpRight size={10} />
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── SECTION POPULATION ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 tracking-[-0.01em]">Section Population (Top 5)</h3>
          <Layers size={16} className="text-gray-300" />
        </div>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={sectionPopData} layout="vertical" barSize={20}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#374151" }} width={60} />
            <Tooltip
              contentStyle={{ borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "11px" }}
              formatter={(v: number) => [`${v} students`, "Population"]}
            />
            <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
