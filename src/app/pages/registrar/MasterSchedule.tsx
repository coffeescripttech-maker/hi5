/**
 * Master Schedule — Registrar/Admin scheduling overview
 * List + calendar view of all class schedules, with filters and summary stats.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

  // body of JSX appended in part 2
  return null;
}
