/**
 * Master Schedule — Registrar/Admin scheduling overview
 * List + calendar view of all class schedules, with filters and summary stats.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  CalendarDays, Clock, Users, DoorOpen, LayoutList, Search,
  BookOpen, GraduationCap, Plus, AlertCircle,
} from "lucide-react";
import { schedulesApi, ScheduleRow } from "../../services/schedules";
import { sectionsApi, SectionRow } from "../../services/sections";
import { schoolYearsApi, SchoolYearRow } from "../../services/schoolYears";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function MasterSchedule() {
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [years, setYears] = useState<SchoolYearRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [syId, setSyId] = useState<number | "all">("all");
  const [sectionId, setSectionId] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "calendar">("list");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [scheds, secs, yrs] = await Promise.all([
          schedulesApi.list(),
          sectionsApi.list(),
          schoolYearsApi.list(),
        ]);
        if (cancelled) return;
        setSchedules(scheds);
        setSections(secs);
        setYears(yrs);
        const current = yrs.find(y => y.is_current === 1);
        if (current) setSyId(current.id);
      } catch {
        if (!cancelled) setError("Failed to load schedules. Please refresh.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return schedules.filter(s => {
      if (syId !== "all" && s.school_year_id !== syId) return false;
      if (sectionId !== "all" && s.section_id !== sectionId) return false;
      if (q && !`${s.subject_name} ${s.teacher_name} ${s.section_name} ${s.room_name ?? ""} ${s.room ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [schedules, syId, sectionId, search]);

  const stats = useMemo(() => ({
    total: filtered.length,
    sections: new Set(filtered.map(s => s.section_id)).size,
    teachers: new Set(filtered.map(s => s.teacher_id)).size,
    rooms: new Set(filtered.map(s => s.room_name ?? s.room ?? "TBA")).size,
  }), [filtered]);

  const visibleSections = useMemo(
    () => sections.filter(sec => {
      const sySecs = schedules.find(s => s.section_id === sec.id);
      return sySecs && (syId === "all" || sySecs.school_year_id === syId);
    }),
    [sections, schedules, syId]
  );

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="animate-spin w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm font-medium">Loading master schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <CalendarDays size={22} className="text-blue-600" /> Master Schedule
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">All class schedules across sections, teachers, and rooms</p>
        </div>
        <Link to="/registrar/schedule-modifier"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition self-start">
          <Plus size={15} /> Add / Modify Schedule
        </Link>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: BookOpen, label: "Scheduled Classes", value: stats.total, color: "text-blue-600 bg-blue-50" },
          { icon: Users, label: "Sections", value: stats.sections, color: "text-emerald-600 bg-emerald-50" },
          { icon: GraduationCap, label: "Teachers", value: stats.teachers, color: "text-violet-600 bg-violet-50" },
          { icon: DoorOpen, label: "Rooms in Use", value: stats.rooms, color: "text-amber-600 bg-amber-50" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 ${s.color}`}>
              <s.icon size={16} />
            </div>
            <p className="text-xl font-bold text-gray-900">{s.value}</p>
            <p className="text-[11px] text-gray-400 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search subject, teacher, section, room..."
            className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400" />
        </div>
        <select value={syId} onChange={e => setSyId(e.target.value === "all" ? "all" : parseInt(e.target.value))}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400">
          <option value="all">All School Years</option>
          {years.map(y => <option key={y.id} value={y.id}>{y.sy_label}{y.is_current === 1 ? " (Current)" : ""}</option>)}
        </select>
        <select value={sectionId} onChange={e => setSectionId(e.target.value === "all" ? "all" : parseInt(e.target.value))}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400">
          <option value="all">All Sections</option>
          {visibleSections.map(sec => <option key={sec.id} value={sec.id}>{sec.name}</option>)}
        </select>
        <div className="flex bg-gray-100 rounded-xl p-1">
          {(["list", "calendar"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${view === v ? "bg-white shadow-sm text-blue-700" : "text-gray-500 hover:text-gray-700"}`}>
              {v === "list" ? <LayoutList size={13} /> : <CalendarDays size={13} />}
              {v === "list" ? "List" : "Calendar"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* ── List View ── */}
      {view === "list" && (
        filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <CalendarDays size={18} className="text-gray-400" />
            </div>
            <p className="text-gray-400 text-sm font-medium">No scheduled classes found</p>
            <p className="text-gray-400 text-xs mt-1">Try different filters or add a schedule via the Schedule Modifier.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em]">Day</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em]">Time</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em]">Subject</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em]">Section</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em]">Teacher</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em]">Room</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-blue-50/40 transition">
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                          <CalendarDays size={12} className="text-blue-500" />
                          {DAY_NAMES[s.day_of_week - 1] ?? `Day ${s.day_of_week}`}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                          <Clock size={12} className="text-emerald-500" />
                          {fmtTime(String(s.start_time).slice(0, 5))} – {fmtTime(String(s.end_time).slice(0, 5))}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-1.5 font-semibold text-gray-800 text-xs">
                          <BookOpen size={12} className="text-indigo-500 flex-shrink-0" />
                          {s.subject_name}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-1.5 text-xs text-gray-600">
                          <GraduationCap size={12} className="text-amber-500 flex-shrink-0" />
                          {s.section_name}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-1.5 text-xs text-gray-600">
                          <Users size={12} className="text-sky-500 flex-shrink-0" />
                          {s.teacher_name}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {s.room_name || s.room ? (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                            <DoorOpen size={12} className="text-violet-500 flex-shrink-0" />
                            {s.room_name || s.room}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">TBA</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-50">
              {filtered.map(s => (
                <div key={s.id} className="px-4 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                      <BookOpen size={13} className="text-indigo-500 flex-shrink-0" />
                      {s.subject_name}
                    </p>
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full flex-shrink-0">
                      {DAY_NAMES[s.day_of_week - 1] ?? `Day ${s.day_of_week}`}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                    <Clock size={11} className="text-emerald-500 flex-shrink-0" />
                    {fmtTime(String(s.start_time).slice(0, 5))} – {fmtTime(String(s.end_time).slice(0, 5))}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {s.section_name} · {s.teacher_name} · {s.room_name || s.room || "Room TBA"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* ── Calendar View ── */}
      {view === "calendar" && (
        filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <CalendarDays size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-600">No classes to display</p>
            <p className="text-xs text-gray-400 mt-1">Adjust your filters or add schedules in the Schedule Modifier.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {DAY_NAMES.map((dayName, dayIdx) => {
              const daySchedules = filtered
                .filter(s => s.day_of_week === dayIdx + 1)
                .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
              const isToday = new Date().getDay() === (dayIdx + 1);
              return (
                <div key={dayName} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isToday ? "border-blue-300 ring-2 ring-blue-100" : "border-gray-100"}`}>
                  <div className={`px-3 py-2.5 flex items-center justify-between ${isToday ? "bg-gradient-to-r from-blue-500 to-blue-400" : "bg-gray-50"}`}>
                    <span className={`text-xs font-bold ${isToday ? "text-white" : "text-gray-700"}`}>{dayName}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isToday ? "bg-white/20 text-white" : "bg-gray-200 text-gray-500"}`}>
                      {daySchedules.length}
                    </span>
                  </div>
                  <div className="p-2 space-y-2 min-h-[120px] max-h-[560px] overflow-y-auto">
                    {daySchedules.length === 0 && (
                      <p className="text-[11px] text-gray-300 text-center py-6">No classes</p>
                    )}
                    {daySchedules.map(s => (
                      <div key={s.id} className="rounded-xl border border-gray-100 bg-gray-50/50 p-2.5 hover:border-blue-200 hover:bg-blue-50/30 transition">
                        <p className="text-[10px] font-bold text-emerald-600">
                          {fmtTime(String(s.start_time).slice(0, 5))} – {fmtTime(String(s.end_time).slice(0, 5))}
                        </p>
                        <p className="text-xs font-semibold text-gray-800 mt-0.5 flex items-center gap-1">
                          <BookOpen size={10} className="text-indigo-500 flex-shrink-0" />
                          <span className="truncate">{s.subject_name}</span>
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1 truncate">
                          <GraduationCap size={9} className="inline text-amber-500 mr-0.5" />
                          {s.section_name}
                        </p>
                        <p className="text-[10px] text-gray-500 truncate">
                          <Users size={9} className="inline text-sky-500 mr-0.5" />
                          {s.teacher_name}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-0.5">
                          <DoorOpen size={9} className="text-violet-400 flex-shrink-0" />
                          {s.room_name || s.room || "Room TBA"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
