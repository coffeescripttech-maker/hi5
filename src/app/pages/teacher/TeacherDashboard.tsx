import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Layers, Users, TrendingUp, UserPlus, BookOpen, Upload } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { sectionsApi, SectionRow } from "../../services/sections";
import { studentsApi, StudentRow } from "../../services/students";
import { authApi } from "../../services/api";
import { useApp } from "../../context/AppContext";

const COLORS = ["#2563eb", "#db2777"];

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
    { name: "Male", value: maleCount || 1, color: "#2563eb" },
    { name: "Female", value: femaleCount || 1, color: "#db2777" },
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
    <div className="space-y-5 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-64 bg-gray-200 rounded-xl" />
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
      <div className="h-32 bg-gray-200 rounded-xl" />
      <div className="h-48 bg-gray-200 rounded-xl" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-green-200 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-500 text-xs mb-1">My Sections</p>
              <p className="text-2xl font-bold text-green-700">{adviserSections.length}</p>
              <p className="text-gray-400 text-xs mt-1">
                {adviserSections.map(s => `Grade ${s.grade_level}`).join(", ") || "—"}
              </p>
            </div>
            <div className="bg-green-100 w-11 h-11 rounded-xl flex items-center justify-center">
              <Layers size={20} className="text-green-700" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-500 text-xs mb-1">Total Enrolled Students</p>
              <p className="text-2xl font-bold text-emerald-700">{totalMyStudents}</p>
              <p className="text-gray-400 text-xs mt-1">Across all my sections</p>
            </div>
            <div className="bg-emerald-100 w-11 h-11 rounded-xl flex items-center justify-center">
              <Users size={20} className="text-emerald-700" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-teal-200 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-500 text-xs mb-1">Section Capacity</p>
              <p className="text-2xl font-bold text-teal-700">{totalMyCapacity}</p>
              <p className="text-gray-400 text-xs mt-1">Total slots available</p>
            </div>
            <div className="bg-teal-100 w-11 h-11 rounded-xl flex items-center justify-center">
              <TrendingUp size={20} className="text-teal-700" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">Students by Grade Level</h3>
          {gradeDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={gradeDistribution} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip contentStyle={{ borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                <Bar dataKey="count" fill="#16a34a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No student data available</div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-2">Gender Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
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
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button onClick={() => navigate("/teacher/enroll")}
            className="flex items-center gap-3 p-4 rounded-xl border-2 border-green-200 hover:border-green-400 hover:bg-green-50 transition group">
            <div className="w-11 h-11 bg-green-100 group-hover:bg-green-200 rounded-xl flex items-center justify-center transition">
              <UserPlus size={20} className="text-green-700" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-800 text-sm">Enroll Student</p>
              <p className="text-gray-400 text-xs">New or returning student</p>
            </div>
          </button>
          <button onClick={() => navigate("/teacher/grades")}
            className="flex items-center gap-3 p-4 rounded-xl border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 transition group">
            <div className="w-11 h-11 bg-emerald-100 group-hover:bg-emerald-200 rounded-xl flex items-center justify-center transition">
              <BookOpen size={20} className="text-emerald-700" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-800 text-sm">Encode Grades</p>
              <p className="text-gray-400 text-xs">Enter quarterly grades</p>
            </div>
          </button>
          <button onClick={() => navigate("/teacher/upload")}
            className="flex items-center gap-3 p-4 rounded-xl border-2 border-teal-200 hover:border-teal-400 hover:bg-teal-50 transition group">
            <div className="w-11 h-11 bg-teal-100 group-hover:bg-teal-200 rounded-xl flex items-center justify-center transition">
              <Upload size={20} className="text-teal-700" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-800 text-sm">Upload Past Grades</p>
              <p className="text-gray-400 text-xs">Import from Excel template</p>
            </div>
          </button>
        </div>
      </div>

      {/* My Sections Summary */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">My Sections Overview</h3>
        </div>
        {adviserSections.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No sections assigned to you yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-gray-500 text-xs font-medium uppercase tracking-wider">Section</th>
                  <th className="text-left px-6 py-3 text-gray-500 text-xs font-medium uppercase tracking-wider">Grade</th>
                  <th className="text-left px-6 py-3 text-gray-500 text-xs font-medium uppercase tracking-wider">Students</th>
                  <th className="text-left px-6 py-3 text-gray-500 text-xs font-medium uppercase tracking-wider">Capacity</th>
                  <th className="text-left px-6 py-3 text-gray-500 text-xs font-medium uppercase tracking-wider">Occupancy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {adviserSections.map(s => {
                  const pct = s.capacity > 0 ? Math.round((s.current_count / s.capacity) * 100) : 0;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-3.5 font-semibold text-gray-800">{s.name}</td>
                      <td className="px-6 py-3.5 text-gray-600">Grade {s.grade_level}</td>
                      <td className="px-6 py-3.5 text-gray-700 font-medium">{s.current_count}</td>
                      <td className="px-6 py-3.5 text-gray-500">{s.capacity}</td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[80px]">
                            <div className={`h-1.5 rounded-full ${pct >= 90 ? "bg-orange-500" : "bg-green-500"}`}
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
        )}
      </div>
    </div>
  );
}
