/**
 * Registrar Schedule Modifier.
 *
 * Registrar-only schedule editor (backend write routes already gate to
 * admin/registrar; the admin console has no schedule UI, so this is the
 * operational tool). Includes:
 *   - create / edit / delete schedule entries
 *   - client-side conflict pre-checks (teacher, section, room overlap)
 *   - server-side 409 conflicts (DB unique constraints uk_teacher_time,
 *     uk_section_time, uk_room_time) surfaced verbatim
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Clock,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Users,
  BookOpen,
  MapPin,
  AlertTriangle,
  Save,
  X
} from "lucide-react";
import { schedulesApi, ScheduleRow } from "../../services/schedules";
import { schoolYearsApi, SchoolYearRow } from "../../services/schoolYears";
import { sectionsApi, SectionRow, TeacherBrief } from "../../services/sections";
import { subjectsApi, SubjectRow } from "../../services/subjects";
import { roomsApi, RoomRow } from "../../services/rooms";
import { useApp } from "../../context/AppContext";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const EMPTY_FORM = {
  teacher_id: 0,
  section_id: 0,
  subject_id: 0,
  day_of_week: 1,
  start_time: "07:00",
  end_time: "08:00",
  room: "",
  room_id: 0
};

interface Conflict {
  kind: "teacher" | "section" | "room";
  label: string;
}

function overlaps(
  a: { day: number; start: string; end: string },
  b: { day: number; start: string; end: string }
): boolean {
  return a.day === b.day && a.start < b.end && b.start < a.end;
}

export function ScheduleModifier() {
  const { showToast } = useApp();
  const [schoolYears, setSchoolYears] = useState<SchoolYearRow[]>([]);
  const [selectedSY, setSelectedSY] = useState<number | undefined>(undefined);
  const [teachers, setTeachers] = useState<TeacherBrief[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ScheduleRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  // ── Load reference data once ──
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      schoolYearsApi.list(),
      sectionsApi.listTeachers(),
      sectionsApi.list(),
      subjectsApi.list(),
      roomsApi.list()
    ])
      .then(([sys, ts, secs, subs, rms]) => {
        if (cancelled) return;
        setSchoolYears(sys);
        setTeachers(ts);
        setSections(secs);
        setSubjects(subs);
        setRooms(rms);
        const current = sys.find(y => y.is_current === 1);
        setSelectedSY(current?.id ?? sys[0]?.id);
      })
      .catch(err =>
        showToast(
          "error",
          "Failed to load schedule data: " + (err.detail?.error || err.message)
        )
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  // ── Load schedules for the selected SY ──
  const loadSchedules = useCallback(
    (syId: number | undefined) => {
      if (!syId) return;
      schedulesApi
        .list({ school_year_id: syId })
        .then(setSchedules)
        .catch(err =>
          showToast(
            "error",
            "Failed to load schedules: " + (err.detail?.error || err.message)
          )
        );
    },
    [showToast]
  );

  useEffect(() => {
    if (selectedSY) loadSchedules(selectedSY);
  }, [selectedSY, loadSchedules]);

  // ── Live conflict pre-check against the current schedule list ──
  const selectedRoom = rooms.find(r => r.id === form.room_id);
  const formRoomName = selectedRoom?.name || form.room || "";

  const conflicts = useMemo<Conflict[]>(() => {
    if (!form.teacher_id || !form.section_id) return [];
    const candidate = {
      day: form.day_of_week,
      start: form.start_time,
      end: form.end_time
    };
    const result: Conflict[] = [];
    for (const s of schedules) {
      if (editing && s.id === editing.id) continue;
      if (s.day_of_week !== form.day_of_week) continue;
      if (
        s.teacher_id === form.teacher_id &&
        overlaps(candidate, { day: s.day_of_week, start: s.start_time, end: s.end_time })
      ) {
        result.push({
          kind: "teacher",
          label: `Teacher is busy: ${s.subject_name} · ${s.section_name}`
        });
      }
      if (
        s.section_id === form.section_id &&
        overlaps(candidate, { day: s.day_of_week, start: s.start_time, end: s.end_time })
      ) {
        result.push({
          kind: "section",
          label: `Section has another class: ${s.subject_name} · ${s.teacher_name}`
        });
      }
      // Rooms are compared by id (the linked FK); legacy schedules without a
      // room_id fall back to matching the free-text name.
      const roomMatches =
        (form.room_id > 0 && s.room_id === form.room_id) ||
        (!s.room_id &&
          formRoomName &&
          s.room &&
          s.room.toLowerCase() === formRoomName.toLowerCase());
      if (
        roomMatches &&
        overlaps(candidate, { day: s.day_of_week, start: s.start_time, end: s.end_time })
      ) {
        result.push({
          kind: "room",
          label: `Room ${s.room_name || s.room} is occupied: ${s.subject_name} · ${s.section_name}`
        });
      }
    }
    return result;
  }, [form, schedules, editing, formRoomName]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (s: ScheduleRow) => {
    // Link to the stored room_id, or match a legacy free-text room to a
    // real room record by name so editing hooks it up to Room Management.
    const matchedId =
      s.room_id ??
      rooms.find(
        r => (s.room || "").toLowerCase() === r.name.toLowerCase()
      )?.id ??
      0;
    setEditing(s);
    setForm({
      teacher_id: s.teacher_id,
      section_id: s.section_id,
      subject_id: s.subject_id,
      day_of_week: s.day_of_week,
      start_time: s.start_time.slice(0, 5),
      end_time: s.end_time.slice(0, 5),
      room: s.room || "",
      room_id: matchedId
    });
    setFormError("");
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSY) {
      setFormError("Select a school year first.");
      return;
    }
    if (!form.teacher_id || !form.section_id || !form.subject_id) {
      setFormError("Teacher, section, and subject are required.");
      return;
    }
    if (form.start_time >= form.end_time) {
      setFormError("Start time must be before end time.");
      return;
    }
    if (conflicts.length > 0) {
      setFormError(
        "Schedule conflict detected — review the warnings below before saving."
      );
      return;
    }
    setSaving(true);
    try {
      const payload = {
        teacher_id: form.teacher_id,
        section_id: form.section_id,
        subject_id: form.subject_id,
        school_year_id: selectedSY,
        day_of_week: form.day_of_week,
        start_time: form.start_time,
        end_time: form.end_time,
        room: selectedRoom?.name || form.room || undefined,
        room_id: form.room_id || undefined
      };
      if (editing) {
        await schedulesApi.update(editing.id, payload);
        showToast("success", "Schedule entry updated.");
      } else {
        await schedulesApi.create(payload);
        showToast("success", "Schedule entry created.");
      }
      setShowForm(false);
      loadSchedules(selectedSY);
    } catch (err: any) {
      // 409 (unique constraint) messages from the API are user-safe; surface as-is
      setFormError(
        err.detail?.error ||
          err.message ||
          (editing ? "Failed to update schedule." : "Failed to create schedule.")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: ScheduleRow) => {
    if (!window.confirm(`Delete "${s.subject_name} · ${s.section_name}"?`))
      return;
    try {
      await schedulesApi.delete(s.id);
      showToast("success", "Schedule entry deleted.");
      loadSchedules(selectedSY);
    } catch (err: any) {
      showToast(
        "error",
        err.detail?.error || err.message || "Failed to delete schedule."
      );
    }
  };

  const inputClass =
    "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 bg-white";

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
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Calendar size={20} className="text-indigo-700" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800">Schedule Modifier</h2>
            <p className="text-gray-500 text-sm">
              Build and maintain the master class schedule
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <select
            value={selectedSY ?? ""}
            onChange={e => setSelectedSY(e.target.value ? parseInt(e.target.value) : undefined)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            {schoolYears.map(sy => (
              <option key={sy.id} value={sy.id}>
                {sy.sy_label}
                {sy.is_current === 1 ? " (Current)" : ""}
              </option>
            ))}
          </select>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all"
          >
            <Plus size={15} /> New Schedule
          </button>
        </div>
      </div>

      {/* Schedule list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto app-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                <th className="px-4 py-3">Day</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Teacher</th>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    No classes scheduled for this school year yet.
                  </td>
                </tr>
              )}
              {[...schedules]
                .sort(
                  (a, b) =>
                    a.day_of_week - b.day_of_week ||
                    a.start_time.localeCompare(b.start_time)
                )
                .map(s => (
                  <tr
                    key={s.id}
                    className="border-b border-gray-50 hover:bg-indigo-50/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold">
                        {DAY_SHORT[s.day_of_week - 1]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                      {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{s.teacher_name}</td>
                    <td className="px-4 py-3 text-gray-700">{s.section_name}</td>
                    <td className="px-4 py-3 text-gray-700">{s.subject_name}</td>
                    <td className="px-4 py-3 text-gray-500">{s.room || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEdit(s)}
                          title="Edit"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(s)}
                          title="Delete"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / edit form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto app-scroll"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">
                {editing ? "Edit Schedule Entry" : "New Schedule Entry"}
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Teacher
                </label>
                <select
                  value={form.teacher_id}
                  onChange={e =>
                    setForm({ ...form, teacher_id: parseInt(e.target.value) })
                  }
                  className={inputClass}
                >
                  <option value={0}>Select teacher…</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Section
                </label>
                <select
                  value={form.section_id}
                  onChange={e =>
                    setForm({ ...form, section_id: parseInt(e.target.value) })
                  }
                  className={inputClass}
                >
                  <option value={0}>Select section…</option>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} (G{s.grade_level})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Subject
                </label>
                <select
                  value={form.subject_id}
                  onChange={e =>
                    setForm({ ...form, subject_id: parseInt(e.target.value) })
                  }
                  className={inputClass}
                >
                  <option value={0}>Select subject…</option>
                  {subjects.map(sub => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Day
                </label>
                <select
                  value={form.day_of_week}
                  onChange={e =>
                    setForm({ ...form, day_of_week: parseInt(e.target.value) })
                  }
                  className={inputClass}
                >
                  {DAYS.map((d, i) => (
                    <option key={d} value={i + 1}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Start
                  </label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={e => setForm({ ...form, start_time: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    End
                  </label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={e => setForm({ ...form, end_time: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Room
                </label>
                <select
                  value={form.room_id}
                  onChange={e => {
                    const rid = parseInt(e.target.value);
                    const r = rooms.find(x => x.id === rid);
                    setForm({
                      ...form,
                      room_id: rid,
                      room: rid ? r?.name || "" : form.room
                    });
                  }}
                  className={inputClass}
                >
                  <option value={0}>
                    {form.room && !form.room_id
                      ? `No room (carry over: ${form.room})`
                      : "No room assigned (TBA)"}
                  </option>
                  {rooms
                    .filter(r => r.status !== "Inactive" || r.id === form.room_id)
                    .map(r => (
                      <option
                        key={r.id}
                        value={r.id}
                        disabled={r.status === "Inactive" && r.id !== form.room_id}
                      >
                        {r.name}
                        {r.building ? ` · ${r.building}` : ""} — {r.status}
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  Picks a room from Room Management — the room marks itself
                  Occupied while it is linked to a class.
                </p>
              </div>

              {/* Conflict warnings */}
              {conflicts.length > 0 && (
                <div className="sm:col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
                    <AlertTriangle size={13} /> Conflicts detected
                  </p>
                  {conflicts.map((c, i) => (
                    <p key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                      <Clock size={11} className="flex-shrink-0 mt-0.5" /> {c.label}
                    </p>
                  ))}
                </div>
              )}

              {formError && (
                <p className="sm:col-span-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  {formError}
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all"
              >
                {saving ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Save size={15} />
                )}
                {editing ? "Save Changes" : "Create Entry"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}