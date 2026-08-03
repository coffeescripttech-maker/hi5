import React, { useState, useEffect } from "react";
import {
  BarChart3, Filter, Users, GraduationCap, AlertTriangle
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { gradesApi, GradeDistribution as GradeDistributionData } from "../../services/grades";
import { sectionsApi, SectionRow } from "../../services/sections";
import { schoolYearsApi } from "../../services/schoolYears";
import { useApp } from "../../context/AppContext";

const BUCKET_COLORS: Record<string, string> = {
  "90-100": "#22c55e",
  "85-89": "#3b82f6",
  "80-84": "#f59e0b",
  "75-79": "#f97316",
  "<75": "#ef4444",
};

const GRADES = ["All Grades", "7", "8", "9", "10", "11", "12"];

export function GradeDistribution() {
  const { showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<GradeDistributionData | null>(null);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [syId, setSyId] = useState<number>(0);
  const [filterGrade, setFilterGrade] = useState("All Grades");
  const [filterSection, setFilterSection] = useState("");

  useEffect(() => {
    Promise.all([
      sectionsApi.list(),
      schoolYearsApi.list(),
    ]).then(([secs, years]) => {
      setSections(secs);
      const current = years.find(y => y.is_current === 1);
      if (current) setSyId(current.id);
    }).catch(err => {
      showToast("error", "Failed to load data: " + (err.detail?.error || err.message));
    });
  }, []);

  useEffect(() => {
    if (!syId) return;
    setLoading(true);
    const params: any = { school_year_id: syId };
    if (filterGrade !== "All Grades") params.grade_level = parseInt(filterGrade);
    if (filterSection) params.section_id = parseInt(filterSection);

    gradesApi.getDistribution(params)
      .then(setData)
      .catch(err => {
        showToast("error", "Failed to load distribution: " + (err.detail?.error || err.message));
      })
      .finally(() => setLoading(false));
  }, [syId, filterGrade, filterSection]);

  const filteredSections = sections.filter(s =>
    filterGrade === "All Grades" || s.grade_level === parseInt(filterGrade)
  );

  const chartBuckets = data?.subjects.map(s => ({
    subject: s.subject_name,
    total: s.total_students,
    passRate: s.pass_rate,
    mean: s.mean_grade,
    ...Object.fromEntries(s.buckets.map(b => [b.range, b.count])),
  })) ?? [];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const subject = data?.subjects.find(s => s.subject_name === label);
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-xl p-4 text-xs max-w-[200px]">
        <p className="font-bold text-gray-900 text-sm mb-2">{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.fill }} />
              {p.name}
            </span>
            <span className="font-semibold text-gray-800">{p.value}</span>
          </div>
        ))}
        {subject && (
          <div className="border-t border-gray-100 mt-2 pt-2 text-gray-500">
            <span>{subject.total_students} students · {subject.pass_rate}% pass rate</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400" />
        <div className="p-5 sm:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-200 flex items-center justify-center flex-shrink-0">
            <BarChart3 size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">Grade Distribution Report</h2>
            <p className="text-gray-500 text-sm">See how student grades are distributed per subject</p>
          </div>
        </div>
      </div>

      {/* ── FILTERS ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="min-w-[140px]">
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
              <Filter size={12} className="inline mr-1" />Grade Level
            </label>
            <select
              value={filterGrade}
              onChange={e => { setFilterGrade(e.target.value); setFilterSection(""); }}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 bg-white transition appearance-none cursor-pointer"
            >
              {GRADES.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Section</label>
            <select
              value={filterSection}
              onChange={e => setFilterSection(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 bg-white transition appearance-none cursor-pointer"
            >
              <option value="">All Sections</option>
              {filteredSections.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.current_count} students)</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── LOADING ── */}
      {loading && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="animate-spin w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm font-medium">Loading grade distribution...</p>
        </div>
      )}

      {/* ── SUMMARY STATS ── */}
      {!loading && data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Students Analyzed</span>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data.total_students}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Subjects</span>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data.subjects.length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Overall Pass Rate</span>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                <span className={data.overall_pass_rate >= 75 ? "text-emerald-600" : "text-red-500"}>
                  {data.overall_pass_rate}%
                </span>
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Grade Range</span>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {filterGrade !== "All Grades" ? `Grade ${filterGrade}` : "7–12"}
              </p>
            </div>
          </div>

          {/* ── SUBJECT DISTRIBUTION CHARTS ── */}
          {data.subjects.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={28} className="text-gray-300" />
              </div>
              <p className="text-gray-500 text-sm font-semibold">No grade data available</p>
              <p className="text-gray-400 text-xs mt-1">Try selecting a different grade level or section.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.subjects.map(subject => (
                <div key={subject.subject_name} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                        subject.pass_rate >= 90 ? "bg-green-100" :
                        subject.pass_rate >= 75 ? "bg-blue-100" :
                        "bg-red-100"
                      }`}>
                        <GraduationCap size={18} className={
                          subject.pass_rate >= 90 ? "text-green-700" :
                          subject.pass_rate >= 75 ? "text-blue-700" :
                          "text-red-600"
                        } />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">{subject.subject_name}</h4>
                        <p className="text-[11px] text-gray-400">{subject.total_students} students</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-center">
                        <p className="font-bold text-gray-900">{subject.mean_grade > 0 ? subject.mean_grade : "—"}</p>
                        <p className="text-gray-400 text-[10px]">Mean</p>
                      </div>
                      <div className={`text-center px-3 py-1.5 rounded-lg font-bold ${
                        subject.pass_rate >= 90 ? "bg-green-50 text-green-700" :
                        subject.pass_rate >= 75 ? "bg-blue-50 text-blue-700" :
                        "bg-red-50 text-red-600"
                      }`}>
                        <p>{subject.pass_rate}%</p>
                        <p className="text-[10px] font-medium opacity-80">Pass Rate</p>
                      </div>
                    </div>
                  </div>

                  {/* Stacked horizontal bar chart */}
                  <ResponsiveContainer width="100%" height={50}>
                    <BarChart
                      data={[subject.buckets.reduce((acc, b) => ({ ...acc, [b.range]: b.count }), { subject: subject.subject_name })]}
                      layout="vertical"
                      barSize={24}
                      stackOffset="expand"
                    >
                      <CartesianGrid strokeDasharray="0" horizontal={false} vertical={false} />
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="subject" hide />
                      <Tooltip content={<CustomTooltip />} />
                      {subject.buckets.filter(b => b.count > 0).map(b => (
                        <Bar key={b.range} dataKey={b.range} stackId="a" fill={BUCKET_COLORS[b.range] || "#9ca3af"} radius={[0, 0, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Bucket count row */}
                  <div className="flex gap-3 mt-2 flex-wrap">
                    {subject.buckets.map(b => (
                      <div key={b.range} className="flex items-center gap-1.5 text-[11px]">
                        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: BUCKET_COLORS[b.range] || "#9ca3af" }} />
                        <span className="text-gray-500">{b.range}:</span>
                        <span className="font-semibold text-gray-800">{b.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── EMPTY STATE (no data, not loading) ── */}
      {!loading && !data && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <BarChart3 size={28} className="text-gray-300" />
          </div>
          <p className="text-gray-500 text-sm font-semibold">No distribution data available</p>
          <p className="text-gray-400 text-xs mt-1">Ensure there are enrolled students with grades for the selected filters.</p>
        </div>
      )}

      {/* ── LEGEND ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-center gap-5 flex-wrap">
        {Object.entries(BUCKET_COLORS).map(([range, color]) => (
          <div key={range} className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
            <span className="text-gray-500">{range}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
