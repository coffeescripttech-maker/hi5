import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Users, Layers, TrendingUp, FileText, ArrowUpRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
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

  // Compute enrollment stats per grade level
  const gradeLevels = [7, 8, 9, 10, 11, 12];
  const enrollmentStats = gradeLevels.map(g => {
    const sectionForGrade = sections.filter(s => s.grade_level === g);
    const enrolled = enrollments.filter(e => e.grade_level === g && e.status === "enrolled").length;
    const capacity = sectionForGrade.reduce((sum, s) => sum + s.capacity, 0);
    return { grade: `Grade ${g}`, enrolled, capacity };
  });

  const totalEnrolled = enrollments.filter(e => e.status === "enrolled").length;
  const promotionRate = 94.2;

  // Top 5 sections by enrollment count
  const sectionPopData = sections
    .sort((a, b) => b.current_count - a.current_count)
    .slice(0, 5)
    .map(s => ({ name: s.name, value: s.current_count }));

  // Classification data (hardcoded until classification API is available)
  const classifData = [
    { name: "4Ps", value: 142, color: "#16a34a" },
    { name: "PWD", value: 38, color: "#2563eb" },
    { name: "Transferee", value: 24, color: "#9333ea" },
    { name: "Non-Reader", value: 11, color: "#ef4444" },
    { name: "Regular", value: 328, color: "#6b7280" },
  ];

  if (loading) return (
    <div className="space-y-5 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-64 bg-gray-200 rounded-xl" />
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
      <div className="h-48 bg-gray-200 rounded-xl" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {enrollmentStats.map(stat => (
          <div key={stat.grade} className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
            <p className="text-xs text-gray-500">{stat.grade}</p>
            <p className="text-xl font-bold text-green-700 mt-0.5">{stat.enrolled}</p>
            <div className="flex items-center justify-between mt-2">
              <div className="flex-1 bg-gray-100 rounded-full h-1.5 mr-2">
                <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${stat.capacity > 0 ? Math.round((stat.enrolled / stat.capacity) * 100) : 0}%` }} />
              </div>
              <span className="text-xs text-gray-400">{stat.capacity > 0 ? Math.round((stat.enrolled / stat.capacity) * 100) : 0}%</span>
            </div>
          </div>
        ))}
        <div className="bg-white rounded-xl border border-teal-200 p-4 shadow-sm col-span-2 lg:col-span-1">
          <p className="text-xs text-gray-500">Digital Logbook — Total Enrolled</p>
          <p className="text-2xl font-bold text-teal-700">{totalEnrolled}</p>
          <p className="text-gray-400 text-xs mt-1">SY 2025–2026</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-sm col-span-2 lg:col-span-1">
          <p className="text-xs text-gray-500">Promotion Rate</p>
          <p className="text-2xl font-bold text-emerald-700">{promotionRate}%</p>
          <p className="text-gray-400 text-xs mt-1">From previous school year</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Enrollment by grade */}
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

        {/* Classification */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-2">4Ps & PWD Summary</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={classifData} cx="50%" cy="50%" outerRadius={70} dataKey="value" paddingAngle={2}>
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
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: d.color }} />{d.name}</span>
                <span className="font-bold text-gray-700">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions – SF Generation */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">School Form Generation</h3>
          <button
            onClick={() => navigate("/registrar/forms")}
            className="text-xs text-green-700 hover:underline font-medium"
          >
            Open School Forms page →
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { code: "SF1", title: "School Form 1", desc: "School Register", color: "border-green-200 hover:border-green-400 hover:bg-green-50", iconColor: "bg-green-100 text-green-700" },
            { code: "SF5", title: "School Form 5", desc: "Report on Promotion", color: "border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50", iconColor: "bg-emerald-100 text-emerald-700" },
            { code: "SF9", title: "School Form 9", desc: "Progress Report Card", color: "border-violet-200 hover:border-violet-400 hover:bg-violet-50", iconColor: "bg-violet-100 text-violet-700" },
            { code: "SF10", title: "School Form 10", desc: "Permanent Academic Record", color: "border-teal-200 hover:border-teal-400 hover:bg-teal-50", iconColor: "bg-teal-100 text-teal-700" },
          ].map(f => (
            <button
              key={f.code}
              onClick={() => navigate("/registrar/forms")}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 transition text-left ${f.color}`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${f.iconColor}`}>
                <FileText size={16} />
              </div>
              <div>
                <p className="font-bold text-gray-800 text-sm">{f.title}</p>
                <p className="text-gray-500 text-xs mt-0.5">{f.desc}</p>
                <p className="text-green-600 text-xs mt-2 font-medium flex items-center gap-1">
                  Generate <ArrowUpRight size={10} />
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Section Population Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-4">Section Population (Top 5)</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={sectionPopData} layout="vertical" barSize={18}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: "#6b7280" }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#374151" }} width={55} />
            <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "11px" }} />
            <Bar dataKey="value" fill="#16a34a" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
