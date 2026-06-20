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
  Clock
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
          if (!cancelled) setTotalUsers(users.length);
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
        <div className="h-28 bg-gray-200 rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-64 bg-gray-200 rounded-xl" />
          <div className="h-64 bg-gray-200 rounded-xl" />
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
      color: 'bg-blue-600',
      light: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-700',
      change: 'Current SY',
      trend: 'neutral'
    },
    {
      label: 'Total Sections',
      value: totalSections.toString(),
      sub: `Capacity: ${totalCapacity}`,
      icon: Layers,
      color: 'bg-indigo-600',
      light: 'bg-indigo-50',
      border: 'border-indigo-200',
      text: 'text-indigo-700',
      change: 'Active',
      trend: 'neutral'
    },
    {
      label: 'Active Teachers',
      value: '—',
      sub: 'Fetched from users',
      icon: BookOpen,
      color: 'bg-emerald-600',
      light: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-700',
      change: '—',
      trend: 'neutral'
    },
    {
      label: 'System Users',
      value: totalUsers.toString(),
      sub: 'All roles',
      icon: UserCheck,
      color: 'bg-violet-600',
      light: 'bg-violet-50',
      border: 'border-violet-200',
      text: 'text-violet-700',
      change: 'Registered',
      trend: 'neutral'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Page Intro */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-900 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-lg">Admin Analytics Dashboard</h2>
            <p className="text-blue-200 text-sm mt-0.5">
              Hi5 Portal · Data loaded from database
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/admin/users')}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
              <Users size={15} /> Manage Users
            </button>
            <button
              onClick={() => navigate('/admin/settings')}
              className="bg-white text-blue-800 hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
              <BarChart2 size={15} /> School Settings
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
              className={`bg-white rounded-xl border ${card.border} p-4 shadow-sm hover:shadow-md transition`}>
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`${card.color} w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                  <Icon size={18} className="text-white" />
                </div>
                {card.trend === 'up' && (
                  <span className="flex items-center gap-0.5 text-xs text-emerald-600 font-medium">
                    <ArrowUpRight size={12} /> {card.change}
                  </span>
                )}
              </div>
              <p className={`text-2xl font-bold ${card.text}`}>{card.value}</p>
              <p className="text-gray-500 text-xs mt-0.5">{card.label}</p>
              <p className="text-gray-400 text-xs mt-1">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Enrollment by Grade */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-800">
                Enrollment by Grade Level
              </h3>
              <p className="text-gray-400 text-xs mt-0.5">
                Male vs. Female distribution
              </p>
            </div>
            <span className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full font-medium border border-blue-100">
              Live
            </span>
          </div>
          {enrollmentByGender.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={enrollmentByGender} barCategoryGap="30%">
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
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
                <Bar dataKey="Male" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Female" fill="#a78bfa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
              No enrollment data available
            </div>
          )}
          <div className="flex gap-4 mt-2 justify-center">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Male
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-3 h-3 rounded bg-violet-400 inline-block" />{' '}
              Female
            </span>
          </div>
        </div>

        {/* System-wide stats placeholder */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="font-semibold text-gray-800">System Overview</h3>
            <p className="text-gray-400 text-xs mt-0.5">
              Key metrics at a glance
            </p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
              <div className="flex items-center gap-3">
                <Users size={18} className="text-blue-600" />
                <div>
                  <p className="text-xs text-gray-500">Total Students</p>
                  <p className="font-bold text-gray-800 text-lg">
                    {totalStudents}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl">
              <div className="flex items-center gap-3">
                <Layers size={18} className="text-indigo-600" />
                <div>
                  <p className="text-xs text-gray-500">Active Sections</p>
                  <p className="font-bold text-gray-800 text-lg">
                    {totalSections}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-violet-50 rounded-xl">
              <div className="flex items-center gap-3">
                <UserCheck size={18} className="text-violet-600" />
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">
              Grade-Level Enrollment
            </h3>
          </div>
          {enrollmentByGender.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-50 border-b border-blue-100">
                    <th className="text-left px-5 py-3 text-blue-700 font-semibold text-xs uppercase">
                      Grade
                    </th>
                    <th className="text-center px-4 py-3 text-blue-700 font-semibold text-xs uppercase">
                      Male
                    </th>
                    <th className="text-center px-4 py-3 text-blue-700 font-semibold text-xs uppercase">
                      Female
                    </th>
                    <th className="text-center px-4 py-3 text-blue-700 font-semibold text-xs uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {enrollmentByGender.map((stat: any) => (
                    <tr
                      key={stat.grade}
                      className="hover:bg-gray-50 transition">
                      <td className="px-5 py-3 font-medium text-gray-800 text-sm">
                        {stat.grade}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {stat.Male}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {stat.Female}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-blue-700">
                        {stat.Total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400 text-sm">
              No data available
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">
              Recent System Activity
            </h3>
            <button
              onClick={() => navigate('/admin/logs')}
              className="text-blue-600 text-xs font-medium hover:underline">
              View all →
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {activityLogs.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                No recent activity
              </div>
            ) : (
              activityLogs.map(log => (
                <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-gray-100 text-gray-500">
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
