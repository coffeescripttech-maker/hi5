import React, { useState, useEffect } from "react";
import { Calendar, Clock, BookOpen, Users, MapPin, Loader2 } from "lucide-react";
import { schedulesApi, ScheduleRow } from "../../services/schedules";
import { schoolYearsApi } from "../../services/schoolYears";
import { authApi } from "../../services/api";
import { useApp } from "../../context/AppContext";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const HOURS = Array.from({ length: 11 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);

function formatTime(t: string) {
  const d = new Date(`2000-01-01T${t}`);
  return d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function TeacherSchedule() {
  const { showToast } = useApp();
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syLabel, setSyLabel] = useState("");
  const [teacherName, setTeacherName] = useState("");

  useEffect(() => {
    let cancelled = false;
    authApi.me()
      .then(me => {
        if (cancelled) return null;
        setTeacherName(me.name || me.username);
        return Promise.all([
          schedulesApi.list({ teacher_id: me.id }),
          schoolYearsApi.list().then(years => years.find(y => y.is_current)?.sy_label || ""),
        ]);
      })
      .then((res) => {
        if (cancelled || !res) return;
        const [scheds, label] = res;
        setSchedules(scheds);
        setSyLabel(label);
      })
      .catch((err: any) => showToast("error", "Failed to load schedule: " + (err?.detail?.error || err?.message)))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [showToast]);

  // Group schedules by day
  const byDay = DAYS.map((_, i) => {
    const day = i + 1;
    return schedules.filter(s => s.day_of_week === day).sort((a, b) => a.start_time.localeCompare(b.start_time));
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Calendar size={20} className="text-indigo-700" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800">My Teaching Schedule</h2>
            <p className="text-gray-500 text-sm">
              {teacherName} · {syLabel || "Current School Year"}
            </p>
          </div>
        </div>
      </div>

      {schedules.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <Calendar size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">No classes scheduled yet</p>
          <p className="text-gray-400 text-sm mt-1">Ask the Registrar to set up your class schedule.</p>
        </div>
      ) : (
        /* Weekly timetable grid */
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-gray-50 z-10 border-r border-b border-gray-200 px-3 py-3 w-20">
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Time</span>
                  </th>
                  {DAYS.map((day, i) => (
                    <th key={i} className="bg-gray-50 border-b border-r border-gray-200 px-3 py-3 text-center min-w-[140px]">
                      <span className="text-xs font-bold text-gray-700">{day}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour, hi) => (
                  <tr key={hour} className={hi % 2 === 0 ? "bg-white" : "bg-gray-50/30"}>
                    <td className="sticky left-0 z-10 border-r border-b border-gray-200 px-3 py-2 text-[11px] text-gray-400 font-mono bg-inherit">
                      {formatTime(hour + ":00")}
                    </td>
                    {DAYS.map((_, di) => {
                      const dayNum = di + 1;
                      const slot = byDay[di].find(s => {
                        const sh = s.start_time.slice(0, 5);
                        const eh = s.end_time.slice(0, 5);
                        // Check if this hour falls within the schedule's time range
                        return sh <= hour && eh > hour;
                      });
                      const isStart = slot && slot.start_time.slice(0, 5) === hour;

                      return (
                        <td key={di} className="border-r border-b border-gray-200 px-2 py-1 align-top relative min-h-[48px]">
                          {slot && isStart && (
                            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 space-y-1.5 shadow-sm">
                              <p className="font-semibold text-indigo-800 text-xs leading-tight">{slot.subject_name}</p>
                              <div className="flex items-center gap-1.5 text-[11px] text-indigo-600">
                                <Users size={11} />
                                <span>{slot.section_name}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-indigo-600">
                                <Clock size={11} />
                                <span>{formatTime(slot.start_time)} – {formatTime(slot.end_time)}</span>
                              </div>
                              {slot.room && (
                                <div className="flex items-center gap-1.5 text-[11px] text-indigo-600">
                                  <MapPin size={11} />
                                  <span>{slot.room}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Compact list view below the grid */}
      {schedules.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <BookOpen size={15} /> All Class Sessions
          </h3>
          <div className="divide-y divide-gray-50">
            {schedules
              .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
              .map(s => (
                <div key={s.id} className="flex items-center gap-4 py-3">
                  <div className="w-14 text-center">
                    <p className="text-xs font-bold text-gray-700">{DAY_SHORT[s.day_of_week - 1]}</p>
                    <p className="text-[11px] text-gray-400 font-mono">{s.start_time.slice(0, 5)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{s.subject_name}</p>
                    <p className="text-xs text-gray-500">{s.section_name}</p>
                  </div>
                  {s.room && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <MapPin size={11} /> {s.room}
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
