/**
 * Admin Dashboard — fetches live data from the API with fallback to static content.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Users,
  BookOpen,
  Layers,
  UserCheck,
  BarChart2,
  ArrowUpRight,
  Clock,
  School
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { studentsApi } from '../../services/students';
import { logsApi, ActivityLogRow } from '../../services/logs';
import { sectionsApi } from '../../services/sections';
import { usersApi } from '../../services/users';

export function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalSections, setTotalSections] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalTeachers, setTotalTeachers] = useState(0);
  const [totalCapacity, setTotalCapacity] = useState(0);
  const [activityLogs, setActivityLogs] = useState<ActivityLogRow[]>([]);
  // Chart data (populated from API where possible)
  const [enrollmentByGender, setEnrollmentByGender] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      studentsApi
        .list()
        .then(students => {
          if (cancelled) return;
          setTotalStudents(students.length);
          // Build gender distribution
          const gradeMap: Record<string, { male: number; female: number }> = {};
          students.forEach(s => {
            const key = `Gr.${s.grade_level}`;
            if (!gradeMap[key]) gradeMap[key] = { male: 0, female: 0 };
            if (s.sex === 'male') gradeMap[key].male++;
            else gradeMap[key].female++;
          });
          const grades = Object.entries(gradeMap).sort(([a], [b]) =>
            a.localeCompare(b)
          );
          setEnrollmentByGender(
            grades.map(([grade, data]) => ({
              grade,
              Male: data.male,
              Female: data.female,
              Total: data.male + data.female
            }))
          );
        })
        .catch(() => {}),
      sectionsApi
        .list()
        .then(sections => {
          if (cancelled) return;
          setTotalSections(sections.length);
          setTotalCapacity(sections.reduce((a, s) => a + s.capacity, 0));
        })
        .catch(() => {}),
      usersApi
        .list()
        .then(users => {
          if (cancelled) return;
          setTotalUsers(users.length);
          setTotalTeachers(users.filter(u => u.role === 'teacher').length);
        })
        .catch(() => {}),
      logsApi
        .list({ limit: 8 })
        .then(logs => {
          if (!cancelled) setActivityLogs(logs);
        })
        .catch(() => {})
    ]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
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

  const statCards = [
    {
      label: 'Total Enrolled',
      value: totalStudents.toString(),
      sub: `Across all grade levels`,
      icon: Users,
      light: 'bg-blue-100',
      text: 'text-blue-600',
      change: 'Current SY',
      trend: 'neutral'
    },
    {
      label: 'Total Sections',
      value: totalSections.toString(),
      sub: `Capacity: ${totalCapacity}`,
      icon: Layers,
      light: 'bg-blue-100',
      text: 'text-blue-600',
      change: 'Active',
      trend: 'neutral'
    },
    {
      label: 'Active Teachers',
      value: totalTeachers.toString(),
      sub: 'Fetched from users',
      icon: BookOpen,
      light: 'bg-blue-100',
      text: 'text-blue-600',
      change: 'Faculty',
      trend: 'neutral'
    },
    {
      label: 'System Users',
      value: totalUsers.toString(),
      sub: 'All roles',
      icon: UserCheck,
      light: 'bg-blue-100',
      text: 'text-blue-600',
      change: 'Registered',
      trend: 'neutral'
    }
  ];

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* HEADER */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-400" />
        <div className="p-5 sm:p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-200 flex items-center justify-center flex-shrink-0">
              <BarChart2 size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">Admin Analytics Dashboard</h2>
              <p className="text-gray-500 text-sm">Hi5 Portal · live data from the database</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/admin/settings')}
              className="border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all flex items-center gap-2">
              <School size={15} /> School Settings
            </button>
            <button
              onClick={() => navigate('/admin/users')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all flex items-center gap-2">
              <Users size={15} /> Manage Users
            </button>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">{card.label}</span>
                <div className={`w-8 h-8 rounded-xl ${card.light} flex items-center justify-center`}>
                  <Icon size={14} className={card.text} />
                </div>
              </div>
              <p className={`text-2xl font-bold ${card.text} tracking-[-0.02em]`}>{card.value}</p>
              <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
              <div className="flex items-center gap-1 mt-2">
                <span className={`text-[11px] font-semibold ${card.trend === 'up' ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {card.trend === 'up' && <ArrowUpRight size={11} className="inline" />} {card.change}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Enrollment by Grade */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-800">Enrollment by Grade Level</h3>
              <p className="text-gray-400 text-xs mt-0.5">
                Male vs. Female distribution
              </p>
            </div>
            <span className="bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full font-medium border border-blue-100">
              Live
            </span>
          </div>
          {enrollmentByGender.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={enrollmentByGender} barCategoryGap="30%">
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f0f0f0"
                  vertical={false}
                />
                <XAxis
                  dataKey="grade"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                />
                <Bar dataKey="Male" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Female" fill="#93c5fd" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">
              No enrollment data available
            </div>
          )}
          <div className="flex gap-4 mt-2 justify-center">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-3 h-3 rounded bg-blue-600 inline-block" /> Male
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-3 h-3 rounded bg-blue-300 inline-block" /> Female
            </span>
          </div>
        </div>

        {/* System-wide stats placeholder */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-gray-800">System Overview</h3>
            <p className="text-gray-400 text-xs mt-0.5">
              Key metrics at a glance
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-50/70 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Users size={16} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Students</p>
                  <p className="font-bold text-gray-800 text-lg">
                    {totalStudents}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50/70 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Layers size={16} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Active Sections</p>
                  <p className="font-bold text-gray-800 text-lg">
                    {totalSections}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50/70 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                  <UserCheck size={16} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">System Users</p>
                  <p className="font-bold text-gray-800 text-lg">
                    {totalUsers}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Grade-Level Enrollment Summary */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-800">Grade-Level Enrollment</h3>
              <p className="text-gray-400 text-xs mt-0.5">Student distribution per grade</p>
            </div>
          </div>
          {enrollmentByGender.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-50/60 border-b border-blue-100">
                    <th className="text-left px-6 py-3.5 text-blue-700 font-semibold text-[11px] uppercase tracking-[0.06em]">
                      Grade
                    </th>
                    <th className="text-center px-4 py-3.5 text-blue-700 font-semibold text-[11px] uppercase tracking-[0.06em]">
                      Male
                    </th>
                    <th className="text-center px-4 py-3.5 text-blue-700 font-semibold text-[11px] uppercase tracking-[0.06em]">
                      Female
                    </th>
                    <th className="text-center px-4 py-3.5 text-blue-700 font-semibold text-[11px] uppercase tracking-[0.06em]">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {enrollmentByGender.map((stat: any, idx: number) => (
                    <tr
                      key={stat.grade}
                      className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-blue-50/50 transition-colors`}>
                      <td className="px-6 py-3.5 font-medium text-gray-800">
                        {stat.grade}
                      </td>
                      <td className="px-4 py-3.5 text-center text-gray-600">
                        {stat.Male}
                      </td>
                      <td className="px-4 py-3.5 text-center text-gray-600">
                        {stat.Female}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-blue-600">
                        {stat.Total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-400 text-sm">
              No data available
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-800">Recent System Activity</h3>
              <p className="text-gray-400 text-xs mt-0.5">Latest actions across the system</p>
            </div>
            <button
              onClick={() => navigate('/admin/logs')}
              className="text-blue-600 text-xs font-medium hover:underline">
              View all →
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {activityLogs.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-sm">
                No recent activity
              </div>
            ) : (
              activityLogs.map(log => (
                <div key={log.id} className="px-6 py-3.5 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-blue-100 text-blue-600">
                    <span className="text-xs font-bold">
                      {log.user_name?.charAt(0) || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {log.action}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {log.user_name && (
                        <span className="text-xs font-medium text-gray-500">
                          {log.user_name}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock size={10} />{' '}
                        {new Date(log.created_at).toLocaleString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
