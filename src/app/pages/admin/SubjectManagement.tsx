import { useState, useEffect, useMemo } from "react";
import { BookOpen, Plus, Trash2, CheckCircle, X, AlertTriangle, Edit2, Filter, Clock, Layers, Sparkles, GraduationCap, FlaskConical, Globe, Users, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { subjectsApi, SubjectRow, CreateSubjectPayload, UpdateSubjectPayload, BulkSubjectItem, TeacherAssignmentRow } from "../../services/subjects";
import { usersApi, UserRow } from "../../services/users";
import { useApp } from "../../context/AppContext";
import { formatHoursPerWeek } from "../../utils/hours";
import { HybridTable } from "../../components/HybridTable";

const TYPE_COLORS: Record<string, string> = {
  core: "bg-blue-100 text-blue-700 border-blue-200",
  applied: "bg-emerald-100 text-emerald-700 border-emerald-200",
  specialized: "bg-violet-100 text-violet-700 border-violet-200",
};

const TYPE_LABEL: Record<string, string> = {
  core: "Core",
  applied: "Applied",
  specialized: "Specialized",
};

type SubjectType = "core" | "applied" | "specialized";

const emptyForm: { name: string; grade_level: number; hours_per_week: number; subject_type: SubjectType } =
  { name: "", grade_level: 7, hours_per_week: 4, subject_type: "core" };

/* ── Curriculum preset catalog for the "Populate Subjects" shortcut ── */

interface PresetSubjectItem {
  name: string;
  hours_per_week: number;
  subject_type: SubjectType;
}

interface SubjectPreset {
  id: string;
  name: string;
  description: string;
  grades: number[];
  icon: LucideIcon;
  getSubjects: (grade: number) => PresetSubjectItem[];
}

const MATATAG_JHS: PresetSubjectItem[] = [
  { name: "Filipino", hours_per_week: 4, subject_type: "core" },
  { name: "English", hours_per_week: 4, subject_type: "core" },
  { name: "Mathematics", hours_per_week: 4, subject_type: "core" },
  { name: "Science", hours_per_week: 4, subject_type: "core" },
  { name: "Araling Panlipunan", hours_per_week: 3, subject_type: "core" },
  { name: "TLE/EPP", hours_per_week: 4, subject_type: "applied" },
  { name: "Music", hours_per_week: 1, subject_type: "core" },
  { name: "Arts", hours_per_week: 1, subject_type: "core" },
  { name: "Physical Education", hours_per_week: 1, subject_type: "core" },
  { name: "Health", hours_per_week: 1, subject_type: "core" },
  { name: "Values Education", hours_per_week: 2, subject_type: "core" },
];

const STE_ADDITIONS: PresetSubjectItem[] = [
  { name: "Research", hours_per_week: 2, subject_type: "specialized" },
  { name: "Advanced Mathematics", hours_per_week: 2, subject_type: "specialized" },
  { name: "Advanced Science", hours_per_week: 2, subject_type: "specialized" },
];

const SPFL_ADDITIONS: PresetSubjectItem[] = [
  { name: "Foreign Language", hours_per_week: 2, subject_type: "specialized" },
];

const SHS_CORE_11: PresetSubjectItem[] = [
  { name: "Oral Communication", hours_per_week: 3, subject_type: "core" },
  { name: "Komunikasyon at Pananaliksik sa Wika at Kulturang Pilipino", hours_per_week: 3, subject_type: "core" },
  { name: "General Mathematics", hours_per_week: 4, subject_type: "core" },
  { name: "Earth and Life Science", hours_per_week: 4, subject_type: "core" },
  { name: "Personal Development", hours_per_week: 2, subject_type: "core" },
  { name: "Understanding Culture, Society and Politics", hours_per_week: 3, subject_type: "core" },
  { name: "Physical Education and Health", hours_per_week: 2, subject_type: "core" },
  { name: "21st Century Literature from the Philippines and the World", hours_per_week: 3, subject_type: "core" },
  { name: "Contemporary Philippine Arts from the Regions", hours_per_week: 2, subject_type: "core" },
];

const SHS_CORE_12: PresetSubjectItem[] = [
  { name: "Reading and Writing Skills", hours_per_week: 3, subject_type: "core" },
  { name: "Media and Information Literacy", hours_per_week: 3, subject_type: "core" },
  { name: "Statistics and Probability", hours_per_week: 4, subject_type: "core" },
  { name: "Physical Science", hours_per_week: 4, subject_type: "core" },
  { name: "Introduction to the Philosophy of the Human Person", hours_per_week: 3, subject_type: "core" },
  { name: "Physical Education and Health", hours_per_week: 2, subject_type: "core" },
];

const SUBJECT_PRESETS: SubjectPreset[] = [
  {
    id: "matatag_jhs",
    name: "MATATAG JHS Regular",
    description: "8 learning areas (MAPEH as 4 components, Values Education in place of ESP) for regular classes",
    grades: [7, 8, 9, 10],
    icon: GraduationCap,
    getSubjects: () => MATATAG_JHS,
  },
  {
    id: "ste",
    name: "STE Additions",
    description: "Research + Advanced Math & Science added on top of the regular set for STE special classes",
    grades: [7, 8, 9, 10],
    icon: FlaskConical,
    getSubjects: () => STE_ADDITIONS,
  },
  {
    id: "spfl",
    name: "SPFL Additions",
    description: "A foreign language subject added for SPFL special classes",
    grades: [7, 8, 9, 10],
    icon: Globe,
    getSubjects: () => SPFL_ADDITIONS,
  },
  {
    id: "shs_core",
    name: "SHS Core Subjects",
    description: "Core subject set for Grades 11–12, shared across all strands (strand-specific subjects are added manually)",
    grades: [11, 12],
    icon: BookOpen,
    getSubjects: (grade) => (grade === 11 ? SHS_CORE_11 : SHS_CORE_12),
  },
];

export function SubjectManagement() {
  const { showToast } = useApp();
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterGrade, setFilterGrade] = useState<number | "All">("All");
  const [showForm, setShowForm] = useState(false);
  const [editSubject, setEditSubject] = useState<SubjectRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saved, setSaved] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showPopulate, setShowPopulate] = useState(false);
  const [popPresetId, setPopPresetId] = useState<string>("matatag_jhs");
  const [popGrades, setPopGrades] = useState<number[]>([7, 8, 9, 10]);
  const [populating, setPopulating] = useState(false);

  /* ── Teacher–Subject Assignments ── */
  const [assignments, setAssignments] = useState<TeacherAssignmentRow[]>([]);
  const [teachers, setTeachers] = useState<UserRow[]>([]);
  const [assignSubject, setAssignSubject] = useState<SubjectRow | null>(null);
  const [togglingTeacherId, setTogglingTeacherId] = useState<number | null>(null);
  const [expandSubjectId, setExpandSubjectId] = useState<number | null>(null);

  const rowAssignments = (subjectId: number) => assignments.filter(a => a.subject_id === subjectId);

  const fetchAssignments = () => {
    subjectsApi.teacherAssignments()
      .then(setAssignments)
      .catch(() => {}); // non-critical; chips simply stay empty on failure
  };

  const fetchTeachers = () => {
    usersApi.list()
      .then(users => setTeachers(users.filter(u => u.role === "teacher" && u.status === "active")))
      .catch(err => showToast("error", "Failed to load teachers: " + (err.detail?.error || err.message)));
  };

  useEffect(() => { fetchAssignments(); }, []);

  // Teachers assigned to the currently open subject (derived)
  const assignedForSubject = useMemo(() => {
    if (!assignSubject) return [] as TeacherAssignmentRow[];
    return assignments.filter(a => a.subject_id === assignSubject.id);
  }, [assignments, assignSubject]);

  const openAssign = (s: SubjectRow) => {
    setAssignSubject(s);
    fetchTeachers();
    fetchAssignments();
  };

  const toggleAssignment = async (teacherId: number) => {
    if (!assignSubject || togglingTeacherId !== null) return;
    const isAssigned = assignedForSubject.some(a => a.teacher_id === teacherId);
    setTogglingTeacherId(teacherId);
    try {
      if (isAssigned) {
        await subjectsApi.unassignTeacher(assignSubject.id, teacherId);
        setAssignments(prev => prev.filter(a => !(a.subject_id === assignSubject.id && a.teacher_id === teacherId)));
        showToast("success", "Teacher unassigned from subject.");
      } else {
        await subjectsApi.assignTeacher(assignSubject.id, teacherId);
        const t = teachers.find(x => x.id === teacherId);
        setAssignments(prev => [...prev, {
          subject_id: assignSubject.id,
          teacher_id: teacherId,
          teacher_name: t?.name || `Teacher #${teacherId}`,
          employee_id: t?.employee_id ?? null,
        }]);
        showToast("success", "Teacher assigned to subject.");
      }
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to update assignment");
    } finally {
      setTogglingTeacherId(null);
    }
  };

  const fetchSubjects = () => {
    setLoading(true);
    subjectsApi.list()
      .then(setSubjects)
      .catch(err => showToast("error", "Failed to load subjects: " + (err.detail?.error || err.message)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSubjects(); }, []);

  const filtered = subjects.filter(s => filterGrade === "All" || s.grade_level === filterGrade);

  const byGrade = [7, 8, 9, 10, 11, 12].map(g => ({
    grade: g,
    subjects: filtered.filter(s => s.grade_level === g),
  })).filter(g => filterGrade === "All" || g.grade === filterGrade);

  /* ── Populate Subjects helpers ── */
  const openPopulate = () => {
    setPopPresetId("matatag_jhs");
    setPopGrades([7, 8, 9, 10]);
    setShowPopulate(true);
  };

  const selectPopPreset = (id: string) => {
    setPopPresetId(id);
    const p = SUBJECT_PRESETS.find(x => x.id === id);
    setPopGrades(p ? [...p.grades] : []);
  };

  const togglePopGrade = (g: number) => {
    setPopGrades(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g].sort((a, b) => a - b)
    );
  };

  const popPreset = SUBJECT_PRESETS.find(p => p.id === popPresetId);

  // Flatten the selected preset across the chosen grades
  const plannedItems: BulkSubjectItem[] = useMemo(() => {
    if (!popPreset) return [];
    return popGrades.flatMap(g =>
      popPreset.getSubjects(g).map(s => ({ ...s, grade_level: g }))
    );
  }, [popPreset, popGrades]);

  // Client-side dedup preview — mirrors the server's (name + grade) uniqueness rule
  const popExistingKeys = new Set(subjects.map(s => `${s.name.toLowerCase()}|${s.grade_level}`));
  const popNewItems = plannedItems.filter(i => !popExistingKeys.has(`${i.name.toLowerCase()}|${i.grade_level}`));
  const popNewKeys = new Set(popNewItems.map(i => `${i.name.toLowerCase()}|${i.grade_level}`));
  const popSkippedCount = plannedItems.length - popNewItems.length;

  const handlePopulate = async () => {
    if (popNewItems.length === 0) return;
    setPopulating(true);
    try {
      const res = await subjectsApi.populate(popNewItems);
      showToast("success",
        `Added ${res.created_count} subject${res.created_count !== 1 ? "s" : ""}` +
        (res.skipped_count > 0 ? `, skipped ${res.skipped_count} existing.` : "."));
      setShowPopulate(false);
      fetchSubjects();
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to populate subjects");
    } finally {
      setPopulating(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editSubject) {
        const payload: UpdateSubjectPayload = { name: form.name, hours_per_week: form.hours_per_week, subject_type: form.subject_type };
        await subjectsApi.update(editSubject.id, payload);
        showToast("success", `Subject "${form.name}" updated.`);
      } else {
        const payload: CreateSubjectPayload = { name: form.name, grade_level: form.grade_level, hours_per_week: form.hours_per_week, subject_type: form.subject_type };
        await subjectsApi.create(payload);
        showToast("success", `Subject "${form.name}" created.`);
      }
      setShowForm(false);
      setEditSubject(null);
      setForm(emptyForm);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      fetchSubjects();
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to save subject");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await subjectsApi.delete(id);
      setSubjects(prev => prev.filter(s => s.id !== id));
      setAssignments(prev => prev.filter(a => a.subject_id !== id));
      setExpandSubjectId(prev => (prev === id ? null : prev));
      setDeleteId(null);
      showToast("success", "Subject deleted.");
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to delete subject");
    }
  };

  const openEdit = (s: SubjectRow) => {
    setEditSubject(s);
    setForm({ name: s.name, grade_level: s.grade_level, hours_per_week: s.hours_per_week, subject_type: s.subject_type });
    setShowForm(true);
  };

  const totalHours = filtered.reduce((a, s) => a + s.hours_per_week, 0);

  return (
    <div className="space-y-5 max-w-6xl mx-auto px-3 sm:px-0">
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-400" />
        <div className="p-5 sm:p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-200 flex items-center justify-center flex-shrink-0">
              <BookOpen size={22} className="text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">Subject Management</h2>
              <p className="text-gray-500 text-sm">Configure subjects per grade level for automatic assignment to enrolled students</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {saved && (
              <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
                <CheckCircle size={14} /> Saved.
              </span>
            )}
            <button onClick={openPopulate}
              className="flex items-center justify-center gap-2 border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all flex-1 sm:flex-none">
              <Sparkles size={15} /> Populate Subjects
            </button>
            <button onClick={() => { setEditSubject(null); setForm(emptyForm); setShowForm(true); }}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all flex-1 sm:flex-none">
              <Plus size={15} /> Add Subject
            </button>
          </div>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Total Subjects</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
              <BookOpen size={14} className="text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">{subjects.length}</p>
          <p className="text-xs text-gray-400 mt-1">Across all grades</p>
        </div>
        {(["core", "applied", "specialized"] as const).map(t => (
          <div key={t} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">{TYPE_LABEL[t]}</span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                t === "core" ? "bg-blue-100" : t === "applied" ? "bg-emerald-100" : "bg-violet-100"
              }`}>
                <Layers size={14} className={`${
                  t === "core" ? "text-blue-600" : t === "applied" ? "text-emerald-600" : "text-violet-600"
                }`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">{subjects.filter(s => s.subject_type === t).length}</p>
            <p className="text-xs text-gray-400 mt-1">{t} subjects</p>
          </div>
        ))}
      </div>

      {/* ── FILTER BAR ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 mr-2">
          <Filter size={13} className="text-gray-400" />
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.06em]">Grade:</span>
        </div>
        {(["All", 7, 8, 9, 10, 11, 12] as (number | "All")[]).map(g => (
          <button key={g} onClick={() => setFilterGrade(g)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterGrade === g
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}>
            {g === "All" ? "All" : `G${g}`}
          </button>
        ))}
        {filterGrade !== "All" && (
          <span className="text-xs text-gray-400 ml-auto">{filtered.reduce((a, s) => a + s.hours_per_week, 0)} hrs/week</span>
        )}
      </div>

      {/* ── LOADING ── */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="animate-spin w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm font-medium">Loading subjects...</p>
        </div>
      ) : (
        <>
          {byGrade.map(({ grade, subjects: gradeSubs }) => (
            gradeSubs.length > 0 && (
              <div key={grade} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
                  <div className="flex items-center gap-3">
                    <span className="bg-blue-50 text-blue-700 text-[11px] font-bold px-3 py-1 rounded-full border border-blue-100">Grade {grade}</span>
                    <span className="text-xs text-gray-500 font-medium">{gradeSubs.length} subject{gradeSubs.length !== 1 && "s"}</span>
                  </div>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock size={12} /> {gradeSubs.reduce((a, s) => a + s.hours_per_week, 0)} hrs/week
                  </span>
                </div>
                <HybridTable
                  desktop={
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[500px]">
                        <thead className="bg-gray-50/80">
                          <tr>
                            {[
                              { label: "Subject Name", key: "name" },
                              { label: "Type", key: "type" },
                              { label: "Assigned Teacher", key: "teachers" },
                              { label: "Hrs/Week", key: "hours" },
                              { label: "Actions", key: "actions" },
                            ].map(col => (
                              <th key={col.key} className={`px-5 py-3.5 text-${col.key === "hours" || col.key === "actions" ? "center" : "left"}`}>
                                <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">{col.label}</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {gradeSubs.map((s, idx) => (
                            <tr key={s.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-blue-50/50 transition-colors duration-150`}>
                              <td className="px-5 py-3.5">
                                <span className="text-sm font-medium text-gray-800">{s.name}</span>
                              </td>
                              <td className="px-5 py-3.5">
                                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${TYPE_COLORS[s.subject_type]}`}>
                                  {TYPE_LABEL[s.subject_type]}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-center text-sm text-gray-600 whitespace-nowrap">{formatHoursPerWeek(s.hours_per_week)}</td>
                              <td className="px-5 py-3.5">
                                {(() => {
                                  const rowAssigned = rowAssignments(s.id);
                                  return (
                                    <div>
                                      <button
                                        onClick={() => setExpandSubjectId(prev => (prev === s.id ? null : s.id))}
                                        aria-expanded={expandSubjectId === s.id}
                                        title="Show the currently assigned teacher"
                                        className="group inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 px-2 py-1 rounded-lg transition-all">
                                        <Users size={12} className="text-gray-400 group-hover:text-indigo-500" />
                                        Assigned Teacher
                                        {rowAssigned.length > 0 && (
                                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1 rounded-md flex-shrink-0">
                                            {rowAssigned.length}
                                          </span>
                                        )}
                                        <ChevronDown size={12} className={`text-gray-400 transition-transform duration-200 ${expandSubjectId === s.id ? "rotate-180" : ""}`} />
                                      </button>
                                      {expandSubjectId === s.id && (
                                        <div className="mt-2">
                                          {rowAssigned.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5">
                                              {rowAssigned.map(a => (
                                                <span key={a.teacher_id} className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-lg">
                                                  {a.teacher_name}
                                                </span>
                                              ))}
                                            </div>
                                          ) : (
                                            <span className="text-[11px] text-gray-400 italic">No teacher assigned yet</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="px-5 py-3.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button onClick={() => openAssign(s)} title="Assign Teacher"
                                    className="text-indigo-400 hover:text-indigo-600 transition p-1.5 rounded-lg hover:bg-indigo-50">
                                    <Users size={14} />
                                  </button>
                                  <button onClick={() => openEdit(s)}
                                    className="text-blue-400 hover:text-blue-600 transition p-1.5 rounded-lg hover:bg-blue-50">
                                    <Edit2 size={14} />
                                  </button>
                                  <button onClick={() => setDeleteId(s.id)}
                                    className="text-red-400 hover:text-red-600 transition p-1.5 rounded-lg hover:bg-red-50">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  }
                  mobile={
                    <ul className="divide-y divide-gray-50">
                      {gradeSubs.map(s => (
                        <li key={s.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${TYPE_COLORS[s.subject_type]}`}>
                                  {TYPE_LABEL[s.subject_type]}
                                </span>
                                <span className="flex items-center gap-1 text-xs text-gray-400">
                                  <Clock size={11} /> {formatHoursPerWeek(s.hours_per_week)}
                                </span>
                              </div>
                              <div className="mt-2">
                                {(() => {
                                  const rowAssigned = rowAssignments(s.id);
                                  return (
                                    <div>
                                      <button
                                        onClick={() => setExpandSubjectId(prev => (prev === s.id ? null : s.id))}
                                        aria-expanded={expandSubjectId === s.id}
                                        title="Show the currently assigned teacher"
                                        className="group inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 px-2 py-1 rounded-lg transition-all touch-target">
                                        <Users size={12} className="text-gray-400 group-hover:text-indigo-500" />
                                        Assigned Teacher
                                        {rowAssigned.length > 0 && (
                                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1 rounded-md flex-shrink-0">
                                            {rowAssigned.length}
                                          </span>
                                        )}
                                        <ChevronDown size={12} className={`text-gray-400 transition-transform duration-200 ${expandSubjectId === s.id ? "rotate-180" : ""}`} />
                                      </button>
                                      {expandSubjectId === s.id && (
                                        <div className="mt-1.5">
                                          {rowAssigned.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5">
                                              {rowAssigned.map(a => (
                                                <span key={a.teacher_id} className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-lg">
                                                  {a.teacher_name}
                                                </span>
                                              ))}
                                            </div>
                                          ) : (
                                            <span className="text-[11px] text-gray-400 italic">No teacher assigned yet</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => openAssign(s)}
                                className="text-indigo-400 hover:text-indigo-600 transition p-2 rounded-lg hover:bg-indigo-50 touch-target">
                                <Users size={15} />
                              </button>
                              <button onClick={() => openEdit(s)}
                                className="text-blue-400 hover:text-blue-600 transition p-2 rounded-lg hover:bg-blue-50 touch-target">
                                <Edit2 size={15} />
                              </button>
                              <button onClick={() => setDeleteId(s.id)}
                                className="text-red-400 hover:text-red-600 transition p-2 rounded-lg hover:bg-red-50 touch-target">
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  }
                />
              </div>
            )
          ))}

          {byGrade.every(g => g.subjects.length === 0) && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <BookOpen size={18} className="text-gray-400" />
              </div>
              <p className="text-gray-400 text-sm font-medium">No subjects found</p>
              <p className="text-gray-400 text-xs mt-1">Try a different filter or add a new subject.</p>
            </div>
          )}
        </>
      )}

      {/* ── Add/Edit Subject Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-400 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <BookOpen size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">{editSubject ? "Edit Subject" : "Add New Subject"}</h3>
                  <p className="text-blue-200 text-xs">{editSubject ? `Editing: ${editSubject.name}` : "Create a new subject for the curriculum"}</p>
                </div>
              </div>
              <button onClick={() => { setShowForm(false); setEditSubject(null); }} className="p-2 hover:bg-white/10 rounded-lg text-white/80 transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Subject Name</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Mathematics"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Grade Level</label>
                  <select value={form.grade_level} onChange={e => setForm(p => ({ ...p, grade_level: parseInt(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400 bg-white">
                    {[7, 8, 9, 10, 11, 12].map(g => <option key={g} value={g}>Grade {g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Hours per Week</label>
                  <input type="number" min={1} max={10} value={form.hours_per_week} onChange={e => setForm(p => ({ ...p, hours_per_week: parseInt(e.target.value) || 0 }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400" />
                  {form.hours_per_week > 0 && (
                    <p className="text-[11px] text-gray-400 mt-1.5">
                      {form.hours_per_week > 0 ? formatHoursPerWeek(form.hours_per_week) : "Enter weekly hours"}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Subject Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["core", "applied", "specialized"] as const).map(t => {
                    const colors: Record<string, string> = {
                      core: "border-blue-500 bg-blue-50 text-blue-700",
                      applied: "border-emerald-500 bg-emerald-50 text-emerald-700",
                      specialized: "border-violet-500 bg-violet-50 text-violet-700",
                    };
                    const hover: Record<string, string> = {
                      core: "hover:border-blue-300 hover:bg-blue-50/50",
                      applied: "hover:border-emerald-300 hover:bg-emerald-50/50",
                      specialized: "hover:border-violet-300 hover:bg-violet-50/50",
                    };
                    return (
                      <button key={t} onClick={() => setForm(p => ({ ...p, subject_type: t }))}
                        className={`py-2.5 rounded-xl text-xs font-semibold border-2 transition-all ${
                          form.subject_type === t
                            ? colors[t]
                            : `border-gray-200 text-gray-500 ${hover[t]}`
                        }`}>
                        {TYPE_LABEL[t]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-gray-50/50">
              <button onClick={() => { setShowForm(false); setEditSubject(null); }}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleSave} disabled={!form.name}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all">
                {editSubject ? "Save Changes" : "Add Subject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign Teachers Modal ── */}
      {assignSubject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Users size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Assign Teachers</h3>
                  <p className="text-indigo-200 text-xs">{assignSubject.name} &middot; Grade {assignSubject.grade_level} &middot; current school year</p>
                </div>
              </div>
              <button onClick={() => setAssignSubject(null)} className="p-2 hover:bg-white/10 rounded-lg text-white/80 transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <p className="text-[11px] text-gray-400 px-2 pb-3">
                Toggled teachers are saved immediately. Assigned teachers may encode grades for this subject;
                unassigned teachers see it read-only in Grade Management.
              </p>
              {teachers.length === 0 ? (
                <div className="p-8 text-center">
                  <Users size={20} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm font-medium">No active teachers found</p>
                  <p className="text-gray-400 text-xs mt-1">Add teachers in User Management first.</p>
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {teachers.map(t => {
                    const isAssigned = assignedForSubject.some(a => a.teacher_id === t.id);
                    const isToggling = togglingTeacherId === t.id;
                    return (
                      <li key={t.id}>
                        <button onClick={() => toggleAssignment(t.id)} disabled={togglingTeacherId !== null}
                          className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                            isAssigned
                              ? "border-indigo-200 bg-indigo-50/70"
                              : "border-gray-100 bg-white hover:bg-gray-50"
                          } ${togglingTeacherId !== null && !isToggling ? "opacity-50" : ""}`}>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{t.name}</p>
                            <p className="text-[11px] text-gray-400 truncate">
                              {t.employee_id ? `Employee ID: ${t.employee_id}` : `@${t.username}`}
                            </p>
                          </div>
                          {isToggling ? (
                            <svg className="animate-spin w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : isAssigned ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 flex-shrink-0">
                              <CheckCircle size={14} /> Assigned
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-gray-300 flex-shrink-0">Not assigned</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
              <span className="text-xs text-gray-400">{assignedForSubject.length} teacher{assignedForSubject.length !== 1 && "s"} assigned</span>
              <button onClick={() => setAssignSubject(null)}
                className="border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-100 transition">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Populate Subjects Modal ── */}
      {showPopulate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-400 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Sparkles size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Populate Subjects</h3>
                  <p className="text-blue-200 text-xs">Auto-fill a curriculum preset — existing subjects are skipped, never duplicated</p>
                </div>
              </div>
              <button onClick={() => setShowPopulate(false)} className="p-2 hover:bg-white/10 rounded-lg text-white/80 transition">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Preset cards */}
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-2">Curriculum Preset</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SUBJECT_PRESETS.map(p => {
                    const active = popPresetId === p.id;
                    return (
                      <button key={p.id} onClick={() => selectPopPreset(p.id)}
                        className={`text-left p-3.5 rounded-2xl border-2 transition-all ${
                          active ? "border-blue-500 bg-blue-50/60 shadow-sm" : "border-gray-200 hover:border-blue-200 hover:bg-gray-50"
                        }`}>
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${active ? "bg-blue-600" : "bg-gray-100"}`}>
                            <p.icon size={15} className={active ? "text-white" : "text-gray-500"} />
                          </div>
                          <span className={`text-sm font-bold ${active ? "text-blue-700" : "text-gray-800"}`}>{p.name}</span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">{p.description}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {p.grades.map(g => (
                            <span key={g} className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md">G{g}</span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grade toggles */}
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-2">Apply To Grades</p>
                <div className="flex flex-wrap gap-2">
                  {[7, 8, 9, 10, 11, 12].map(g => (
                    <button key={g} onClick={() => togglePopGrade(g)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        popGrades.includes(g)
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}>
                      Grade {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dedup preview */}
              <div className="bg-gray-50/80 border border-gray-100 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${popNewItems.length > 0 ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                    + {popNewItems.length} new
                  </span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                    {popSkippedCount} existing (skipped)
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">{plannedItems.length} total rows</span>
                </div>
                <div className="max-h-52 overflow-y-auto divide-y divide-gray-100">
                  {[7, 8, 9, 10, 11, 12].filter(g => popGrades.includes(g)).map(g => {
                    const items = plannedItems.filter(i => i.grade_level === g);
                    if (items.length === 0) return null;
                    return (
                      <div key={g} className="px-4 py-2.5">
                        <p className="text-[11px] font-bold text-blue-700 mb-1.5">Grade {g}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                          {items.map((i, idx) => {
                            const isNew = popNewKeys.has(`${i.name.toLowerCase()}|${i.grade_level}`);
                            return (
                              <div key={idx} className="flex items-center gap-2 py-0.5">
                                <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${isNew ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                                  {isNew ? <CheckCircle size={11} /> : <X size={10} />}
                                </span>
                                <span className={`text-xs truncate ${isNew ? "text-gray-800 font-medium" : "text-gray-400 line-through"}`}>{i.name}</span>
                                <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">{i.hours_per_week}h</span>
                                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${TYPE_COLORS[i.subject_type]}`}>{TYPE_LABEL[i.subject_type]}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {plannedItems.length === 0 && (
                    <p className="px-4 py-6 text-center text-xs text-gray-400">No grades selected — choose at least one grade above.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
              <p className="text-[11px] text-gray-400 hidden sm:block">Duplicates are skipped automatically by subject name + grade.</p>
              <div className="flex gap-3 ml-auto">
                <button onClick={() => setShowPopulate(false)}
                  className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button onClick={handlePopulate} disabled={popNewItems.length === 0 || populating}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all">
                  {populating ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Populating...
                    </>
                  ) : (
                    <>Add {popNewItems.length} Subject{popNewItems.length !== 1 && "s"}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle size={22} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Delete Subject</h3>
                <p className="text-gray-500 text-xs">This cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              Are you sure you want to delete <strong>{subjects.find(s => s.id === deleteId)?.name}</strong>?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => handleDelete(deleteId)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
