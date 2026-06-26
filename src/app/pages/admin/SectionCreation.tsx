import { useState, useEffect, useRef, useCallback } from "react";
import { Layers, Plus, CheckCircle, Trash2, Edit2, X, AlertTriangle, Users, Search, ChevronRight, GraduationCap, Palette, Lock } from "lucide-react";
import { sectionsApi, SectionRow, CreateSectionPayload, UpdateSectionPayload, TeacherBrief } from "../../services/sections";
import { sectionTypesApi, SectionType } from "../../services/sectionTypes";
import { useApp } from "../../context/AppContext";

const FALLBACK_COLORS = "bg-gray-100 text-gray-700 border-gray-200";

const DEFAULT_SECTION_COLORS: Record<string, string> = {
  star: "bg-amber-100 text-amber-700 border-amber-200",
  gold: "bg-yellow-100 text-yellow-700 border-yellow-200",
  silver: "bg-slate-100 text-slate-700 border-slate-200",
  regular: "bg-blue-100 text-blue-700 border-blue-200",
  non_reader: "bg-red-100 text-red-700 border-red-200",
};

/* ── Reusable Teacher Search ── */
function TeacherSearch({
  value,
  onChange,
  teachers,
  placeholder,
  getConflict,
}: {
  value: string;
  onChange: (id: string, name: string) => void;
  teachers: TeacherBrief[];
  placeholder?: string;
  getConflict?: (teacherId: number) => string | null;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Sync query from initial value (numeric ID) on first render
  useEffect(() => {
    if (value && !query) {
      const t = teachers.find(u => u.id === parseInt(value));
      if (t) setQuery(`${t.name} (ID: ${t.id})`);
    }
  }, [value, teachers]);

  const filtered = query.trim()
    ? teachers.filter(t =>
        t.name.toLowerCase().includes(query.toLowerCase()) ||
        String(t.id).includes(query) ||
        (t.employee_id || "").toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : teachers.slice(0, 8);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (t: TeacherBrief) => {
    setQuery(`${t.name} (ID: ${t.id})`);
    onChange(String(t.id), t.name || "");
    setOpen(false);
  };

  const handleClear = () => {
    setQuery("");
    onChange("", "");
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder || "Search teacher by name or ID..."}
          className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400 transition-all bg-white"
        />
        {query && (
          <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition">
            <X size={14} />
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/50 z-50 overflow-hidden max-h-64 overflow-y-auto">
          {filtered.map(t => {
            const conflictName = getConflict?.(t.id) || null;
            return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleSelect(t)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition text-left border-b border-gray-50 last:border-0"
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm ${conflictName ? 'bg-red-100 text-red-600' : 'bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700'}`}>
                {(t.name || "?").charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{t.name}</p>
                <p className="text-xs text-gray-400">
                  <span className="font-mono">ID: {t.id}</span>
                  {t.employee_id ? ` · ${t.employee_id}` : ""}
                  {t.designation ? ` · ${t.designation}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {conflictName ? (
                  <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200 whitespace-nowrap">
                    Taken — {conflictName}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 whitespace-nowrap">
                    Available
                  </span>
                )}
                <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
              </div>
            </button>
            );
          })}
        </div>
      )}
      {open && query.trim() && filtered.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 p-4 text-center">
          <p className="text-sm text-gray-400">No teachers found matching "{query}"</p>
        </div>
      )}
    </div>
  );
}

function getSectionColor(typeName: string, sectionTypes: SectionType[], defaultColors: Record<string, string>): string {
  // Prefer known default colors for built-in types
  if (defaultColors[typeName]) return defaultColors[typeName];
  // Use color_code from the database if available
  const st = sectionTypes.find(t => t.name === typeName);
  if (st?.color_code) return st.color_code;
  return FALLBACK_COLORS;
}

export function SectionCreation() {
  const { showToast } = useApp();
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherBrief[]>([]);
  const [sectionTypes, setSectionTypes] = useState<SectionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editTarget, setEditTarget] = useState<SectionRow | null>(null);
  const [editForm, setEditForm] = useState({ capacity: "", adviser_id: "", minAvg: "" });
  const [form, setForm] = useState({
    gradeLevel: "7",
    sectionName: "",
    type: "ste",
    capacity: "45",
    adviser_id: "",
    minAvg: "85",
  });

  // ── Manage Types modal state ──
  const [showManageTypes, setShowManageTypes] = useState(false);
  const [typesLoading, setTypesLoading] = useState(false);
  const [typeFormMode, setTypeFormMode] = useState<"add" | "edit" | null>(null);
  const [editingType, setEditingType] = useState<SectionType | null>(null);
  const [typeForm, setTypeForm] = useState({ name: "", label: "", color_code: "", icon: "", sort_order: "0" });
  const [deleteTypeId, setDeleteTypeId] = useState<SectionType | null>(null);

  // ── Unique adviser per grade validation ──
  const findAdviserConflict = (grade: number, adviserId: string, excludeSectionId?: number): SectionRow | null => {
    if (!adviserId) return null;
    const id = parseInt(adviserId);
    return sections.find(s =>
      s.grade_level === grade &&
      s.adviser_id === id &&
      s.id !== excludeSectionId
    ) || null;
  };

  const getTeacherName = (adviserId: string): string => {
    if (!adviserId) return "";
    const t = teachers.find(t => t.id === parseInt(adviserId));
    return t ? t.name : "";
  };

  const fetchSections = useCallback(() => {
    setLoading(true);
    sectionsApi.list()
      .then(setSections)
      .catch(err => showToast("error", "Failed to load sections: " + (err.detail?.error || err.message)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSections();
    // Load teachers for adviser search
    sectionsApi.listTeachers().then(setTeachers).catch(() => {});
    // Load section types
    sectionTypesApi.list().then(setSectionTypes).catch(() => {});
  }, []);

  const createConflict = (): SectionRow | null => {
    if (!form.adviser_id) return null;
    return findAdviserConflict(parseInt(form.gradeLevel), form.adviser_id);
  };

  const handleAdd = async () => {
    const conflict = createConflict();
    if (conflict) {
      showToast("error", `${getTeacherName(form.adviser_id)} is already assigned to "${conflict.name}" in Grade ${form.gradeLevel}`);
      return;
    }
    try {
      const payload: CreateSectionPayload = {
        name: `${form.gradeLevel}-${form.sectionName}`,
        grade_level: parseInt(form.gradeLevel),
        section_type: form.type,
        capacity: parseInt(form.capacity),
        min_average: parseInt(form.minAvg),
        adviser_id: form.adviser_id ? parseInt(form.adviser_id) : undefined,
      };
      await sectionsApi.create(payload);
      setShowForm(false);
      setSaved(true);
      setForm({ gradeLevel: "7", sectionName: "", type: "ste", capacity: "45", adviser_id: "", minAvg: "85" });
      setTimeout(() => setSaved(false), 2500);
      fetchSections();
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to create section");
    }
  };

  const openEdit = (sec: SectionRow) => {
    setEditTarget(sec);
    setEditForm({
      capacity: String(sec.capacity),
      adviser_id: sec.adviser_id ? String(sec.adviser_id) : "",
      minAvg: String(sec.min_average),
    });
  };

  const editConflict = (): SectionRow | null => {
    if (!editTarget || !editForm.adviser_id) return null;
    return findAdviserConflict(editTarget.grade_level, editForm.adviser_id, editTarget.id);
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    const conflict = editConflict();
    if (conflict) {
      showToast("error", `${getTeacherName(editForm.adviser_id)} is already assigned to "${conflict.name}" in Grade ${editTarget.grade_level}`);
      return;
    }
    try {
      const payload: UpdateSectionPayload = {
        capacity: parseInt(editForm.capacity),
        adviser_id: editForm.adviser_id ? parseInt(editForm.adviser_id) : null,
        min_average: parseInt(editForm.minAvg),
      };
      await sectionsApi.update(editTarget.id, payload);
      setEditTarget(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      fetchSections();
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to update section");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await sectionsApi.delete(id);
      setSections(prev => prev.filter(s => s.id !== id));
      setDeleteId(null);
      showToast("success", "Section deleted.");
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to delete section");
    }
  };

  const byGrade = [7, 8, 9, 10, 11, 12].map(g => ({
    grade: g,
    sections: sections.filter(s => s.grade_level === g),
  }));

  const totalCapacity = sections.reduce((a, s) => a + s.capacity, 0);
  const totalEnrolled = sections.reduce((a, s) => a + s.current_count, 0);

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400" />
        <div className="p-5 sm:p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-200 flex items-center justify-center flex-shrink-0">
              <Layers size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">Section Creation & Management</h2>
              <p className="text-gray-500 text-sm">Create, configure, and manage class sections per grade level</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
                <CheckCircle size={14} /> Saved.
              </span>
            )}
            <button onClick={() => { setShowManageTypes(true); setTypesLoading(true); sectionTypesApi.list().then(types => { setSectionTypes(types); setTypesLoading(false); }).catch(() => setTypesLoading(false)); }}
              className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all">
              <Palette size={15} /> Manage Types
            </button>
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all">
              <Plus size={15} /> Create Section
            </button>
          </div>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Total Sections</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Layers size={14} className="text-indigo-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">{sections.length}</p>
          <p className="text-xs text-gray-400 mt-1">Across all grades</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Total Capacity</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Users size={14} className="text-indigo-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">{totalCapacity}</p>
          <p className="text-xs text-gray-400 mt-1">Student slots available</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Total Enrolled</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
              <GraduationCap size={14} className="text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">{totalEnrolled}</p>
          <p className="text-xs text-gray-400 mt-1">
            {totalCapacity > 0 ? `${Math.round((totalEnrolled / totalCapacity) * 100)}% occupancy` : "No sections"}
          </p>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="animate-spin w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm font-medium">Loading sections...</p>
        </div>
      ) : (
        byGrade.map(({ grade, sections: gradeSections }) => (
          <div key={grade} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
              <div className="flex items-center gap-3">
                <span className="bg-indigo-50 text-indigo-700 text-[11px] font-bold px-3 py-1 rounded-full border border-indigo-100">Grade {grade}</span>
                <span className="text-xs text-gray-500 font-medium">{gradeSections.length} section{gradeSections.length !== 1 && "s"}</span>
              </div>
            </div>
            {gradeSections.length === 0 ? (
              <p className="text-xs text-gray-400 px-6 py-5">No sections created for Grade {grade} yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-gray-50/80">
                    <tr>
                      {[
                        { label: "Section", key: "section" },
                        { label: "Adviser", key: "adviser" },
                        { label: "Capacity", key: "capacity" },
                        { label: "Enrolled", key: "enrolled" },
                        { label: "Min. Avg", key: "minAvg" },
                        { label: "Occupancy", key: "occupancy" },
                        { label: "Actions", key: "actions" },
                      ].map(col => (
                        <th key={col.key} className={`px-4 py-3.5 text-${col.key === "capacity" || col.key === "enrolled" || col.key === "minAvg" || col.key === "occupancy" ? "center" : "left"}`}>
                          <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">{col.label}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {gradeSections.map((sec, idx) => {
                      const pct = Math.round((sec.current_count / sec.capacity) * 100);
                      return (
                        <tr key={sec.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-indigo-50/50 transition-colors duration-150`}>
                          <td className="px-4 py-3.5">
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${getSectionColor(sec.section_type, sectionTypes, DEFAULT_SECTION_COLORS)}`}>
                              {sec.name}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            {sec.adviser_name ? (
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-600 text-xs font-bold flex-shrink-0 shadow-sm">
                                  {sec.adviser_name.charAt(0)}
                                </div>
                                <span className="text-sm text-gray-700 font-medium">{sec.adviser_name}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center font-medium text-gray-700">{sec.capacity}</td>
                          <td className="px-4 py-3.5 text-center font-bold text-indigo-700">{sec.current_count}</td>
                          <td className="px-4 py-3.5 text-center text-xs text-gray-500 font-medium">{sec.min_average}+</td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full transition-all ${pct >= 95 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 font-medium">{pct}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => openEdit(sec)}
                                className="text-indigo-400 hover:text-indigo-600 transition p-1.5 rounded-lg hover:bg-indigo-50">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => setDeleteId(sec.id)}
                                className="text-red-400 hover:text-red-600 transition p-1.5 rounded-lg hover:bg-red-50">
                                <Trash2 size={14} />
                              </button>
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
        ))
      )}

      {/* ── Create Section Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-gray-900">Create New Section</h3>
                <p className="text-xs text-gray-400 mt-0.5">Set up a new class section with its curriculum track and adviser</p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Grade Level</label>
                <select value={form.gradeLevel} onChange={e => setForm(p => ({ ...p, gradeLevel: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400 bg-white">
                  {[7,8,9,10,11,12].map(g => <option key={g} value={g}>Grade {g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Section Name</label>
                <input type="text" value={form.sectionName} onChange={e => setForm(p => ({ ...p, sectionName: e.target.value }))}
                  placeholder="e.g. Mabini, Sampaguita"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Curriculum Track</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400 bg-white">
                  {sectionTypes.filter(t => t.is_active).map(t => <option key={t.name} value={t.name}>{t.label || t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Capacity</label>
                <input type="number" value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Min. Average</label>
                <input type="number" value={form.minAvg} onChange={e => setForm(p => ({ ...p, minAvg: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400" />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Adviser (optional)</label>
                <TeacherSearch
                  value={form.adviser_id}
                  onChange={(id) => setForm(p => ({ ...p, adviser_id: id }))}
                  teachers={teachers}
                  placeholder="Search available teachers..."
                  getConflict={(teacherId) => {
                    const c = findAdviserConflict(parseInt(form.gradeLevel), String(teacherId));
                    return c ? c.name : null;
                  }}
                />
              </div>
            </div>
            <div className="mt-4 bg-indigo-50/60 border border-indigo-100 rounded-xl px-4 py-3 text-xs text-indigo-700">
              Section: <strong>{form.gradeLevel}-{form.sectionName || "?"}</strong> · Track: <strong>{sectionTypes.find(t => t.name === form.type)?.label || form.type}</strong> · Capacity: <strong>{form.capacity}</strong> · Min. Avg: <strong>{form.minAvg}+</strong>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleAdd}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all">
                Create Section
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Section Modal ── */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-gray-900">Edit Section</h3>
                <p className="text-xs text-gray-400 mt-0.5">Editing: <span className="font-semibold text-indigo-700">{editTarget.name}</span> · Grade {editTarget.grade_level} · {sectionTypes.find(t => t.name === editTarget.section_type)?.label || editTarget.section_type}</p>
              </div>
              <button onClick={() => setEditTarget(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Adviser</label>
                <TeacherSearch
                  value={editForm.adviser_id}
                  onChange={(id) => setEditForm(p => ({ ...p, adviser_id: id }))}
                  teachers={teachers}
                  placeholder="Search available teachers..."
                  getConflict={(teacherId) => {
                    if (!editTarget) return null;
                    const c = findAdviserConflict(editTarget.grade_level, String(teacherId), editTarget.id);
                    return c ? c.name : null;
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Capacity</label>
                  <input type="number" value={editForm.capacity} onChange={e => setEditForm(p => ({ ...p, capacity: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Min. Average</label>
                  <input type="number" value={editForm.minAvg} onChange={e => setEditForm(p => ({ ...p, minAvg: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditTarget(null)}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleEditSave}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all">
                Save Changes
              </button>
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
                <h3 className="font-bold text-gray-900">Delete Section</h3>
                <p className="text-gray-500 text-xs">This cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">Are you sure you want to delete this section? All student assignments to this section will be cleared.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => handleDelete(deleteId)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Manage Types Modal ── */}
      {showManageTypes && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-200 flex items-center justify-center">
                  <Palette size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Manage Section Types</h3>
                  <p className="text-xs text-gray-400">Add, edit, or remove section type definitions</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setTypeFormMode("add"); setTypeForm({ name: "", label: "", color_code: "", icon: "", sort_order: String(sectionTypes.length + 1) }); }}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-semibold transition">
                  <Plus size={13} /> Add Type
                </button>
                <button onClick={() => { setShowManageTypes(false); setTypeFormMode(null); setEditingType(null); setDeleteTypeId(null); }}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {typesLoading ? (
                <div className="py-10 text-center">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                    <svg className="animate-spin w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                  <p className="text-gray-400 text-sm">Loading section types...</p>
                </div>
              ) : sectionTypes.length === 0 ? (
                <div className="py-10 text-center text-gray-400 text-sm">No section types defined yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-3 py-3 text-left"><span className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.06em]">Name</span></th>
                        <th className="px-3 py-3 text-left"><span className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.06em]">Label</span></th>
                        <th className="px-3 py-3 text-center"><span className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.06em]">Order</span></th>
                        <th className="px-3 py-3 text-center"><span className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.06em]">Active</span></th>
                        <th className="px-3 py-3 text-right"><span className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.06em]">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {sectionTypes.map(t => (
                        <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-3 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${t.color_code || 'bg-gray-100 text-gray-600'}`}>
                                {t.icon && t.icon.length <= 2 ? t.icon : t.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm font-medium text-gray-800">{t.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-sm text-gray-600">{t.label}</td>
                          <td className="px-3 py-3.5 text-center text-sm text-gray-500">{t.sort_order}</td>
                          <td className="px-3 py-3.5 text-center">
                            {t.is_locked ? (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                <Lock size={10} /> Fixed
                              </span>
                            ) : (
                              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${t.is_active ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-gray-400 bg-gray-50 border-gray-200'}`}>
                                {t.is_active ? 'Active' : 'Inactive'}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => {
                                setEditingType(t);
                                setTypeFormMode("edit");
                                setTypeForm({ name: t.name, label: t.label, color_code: t.color_code || "", icon: t.icon || "", sort_order: String(t.sort_order) });
                              }}
                                className="text-indigo-400 hover:text-indigo-600 transition p-1.5 rounded-lg hover:bg-indigo-50">
                                <Edit2 size={13} />
                              </button>
                              {!t.is_locked && (
                                <button onClick={() => setDeleteTypeId(t)}
                                  className="text-red-400 hover:text-red-600 transition p-1.5 rounded-lg hover:bg-red-50">
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex items-center justify-between">
              <p className="text-xs text-gray-400">{sectionTypes.length} section type{sectionTypes.length !== 1 && "s"} defined</p>
              <button onClick={() => { setShowManageTypes(false); setTypeFormMode(null); setEditingType(null); setDeleteTypeId(null); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add/Edit Section Type Form Modal ── */}
      {typeFormMode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-gray-900">{typeFormMode === "add" ? "Add Section Type" : "Edit Section Type"}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{typeFormMode === "add" ? "Create a new section type definition" : `Editing: ${editingType?.name}`}</p>
              </div>
              <button onClick={() => { setTypeFormMode(null); setEditingType(null); }}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition">
                <X size={18} />
              </button>
            </div>
              <div className="space-y-4">
                {typeFormMode === "add" && (
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Internal Name</label>
                    <input type="text" value={typeForm.name}
                      onChange={e => setTypeForm(p => ({ ...p, name: e.target.value.replace(/[^a-z0-9_]/g, "") }))}
                      placeholder="e.g. ste, spfl, honors"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400" />
                    <p className="text-xs text-gray-400 mt-1 lowercase tracking-wide">Used internally — only lowercase letters, numbers, underscores</p>
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Display Label</label>
                  <input type="text" value={typeForm.label}
                    onChange={e => setTypeForm(p => ({ ...p, label: e.target.value }))}
                    placeholder="e.g. STE (Science & Technology)"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Color Theme</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "bg-amber-100 text-amber-700 border-amber-200", swatch: "bg-amber-400", label: "Amber" },
                      { value: "bg-blue-100 text-blue-700 border-blue-200", swatch: "bg-blue-400", label: "Blue" },
                      { value: "bg-yellow-100 text-yellow-700 border-yellow-200", swatch: "bg-yellow-400", label: "Yellow" },
                      { value: "bg-slate-100 text-slate-700 border-slate-200", swatch: "bg-slate-400", label: "Slate" },
                      { value: "bg-red-100 text-red-700 border-red-200", swatch: "bg-red-400", label: "Red" },
                      { value: "bg-green-100 text-green-700 border-green-200", swatch: "bg-green-400", label: "Green" },
                      { value: "bg-purple-100 text-purple-700 border-purple-200", swatch: "bg-purple-400", label: "Purple" },
                      { value: "bg-teal-100 text-teal-700 border-teal-200", swatch: "bg-teal-400", label: "Teal" },
                      { value: "bg-pink-100 text-pink-700 border-pink-200", swatch: "bg-pink-400", label: "Pink" },
                      { value: "bg-orange-100 text-orange-700 border-orange-200", swatch: "bg-orange-400", label: "Orange" },
                      { value: "bg-cyan-100 text-cyan-700 border-cyan-200", swatch: "bg-cyan-400", label: "Cyan" },
                      { value: "bg-emerald-100 text-emerald-700 border-emerald-200", swatch: "bg-emerald-400", label: "Emerald" },
                      { value: "bg-violet-100 text-violet-700 border-violet-200", swatch: "bg-violet-400", label: "Violet" },
                      { value: "bg-indigo-100 text-indigo-700 border-indigo-200", swatch: "bg-indigo-400", label: "Indigo" },
                    ].map(c => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setTypeForm(p => ({ ...p, color_code: c.value }))}
                        title={c.label}
                        className={`w-8 h-8 rounded-xl border-2 transition-all ${c.swatch} ${
                          typeForm.color_code === c.value
                            ? "border-gray-800 scale-110 shadow-md ring-2 ring-offset-1 ring-gray-800/20"
                            : "border-transparent hover:scale-105 hover:shadow-sm"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-gray-400">Selected:</span>
                    {typeForm.color_code ? (
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${typeForm.color_code}`}>
                        Sample Badge
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">None selected</span>
                    )}
                    {typeForm.color_code && (
                      <button onClick={() => setTypeForm(p => ({ ...p, color_code: "" }))}
                        className="text-[10px] text-gray-400 hover:text-red-500 underline ml-1">Clear</button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Icon</label>
                  <div className="flex flex-wrap gap-1.5">
                    {["🔬","🌐","📰","📚","📖","⭐","🏆","🎯","🎨","🎵","💻","🔧","🧪","🎭","🏅","📝","🎓","🛡️","⚡","🌈","🎪","🌿","📡","🎼"].map(icon => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setTypeForm(p => ({ ...p, icon }))}
                        className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all border-2 ${
                          typeForm.icon === icon
                            ? "border-indigo-500 bg-indigo-50 scale-110 shadow-sm"
                            : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                  {typeForm.icon && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-gray-400">Selected: <span className="text-lg">{typeForm.icon}</span></span>
                      <button onClick={() => setTypeForm(p => ({ ...p, icon: "" }))}
                        className="text-[10px] text-gray-400 hover:text-red-500 underline">Clear</button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Sort Order</label>
                  <input type="number" value={typeForm.sort_order}
                    onChange={e => setTypeForm(p => ({ ...p, sort_order: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400" />
                </div>
              </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setTypeFormMode(null); setEditingType(null); }}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={async () => {
                try {
                  if (typeFormMode === "add") {
                    await sectionTypesApi.create({
                      name: typeForm.name,
                      label: typeForm.label,
                      color_code: typeForm.color_code || undefined,
                      icon: typeForm.icon || undefined,
                      sort_order: parseInt(typeForm.sort_order) || 0,
                    });
                    showToast("success", `Section type "${typeForm.name}" created.`);
                  } else if (editingType) {
                    await sectionTypesApi.update(editingType.id, {
                      label: typeForm.label,
                      color_code: typeForm.color_code || undefined,
                      icon: typeForm.icon || undefined,
                      sort_order: parseInt(typeForm.sort_order) || 0,
                    });
                    showToast("success", `Section type "${editingType.name}" updated.`);
                  }
                  setTypeFormMode(null);
                  setEditingType(null);
                  const updated = await sectionTypesApi.list();
                  setSectionTypes(updated);
                } catch (err: any) {
                  showToast("error", err.detail?.error || err.message || "Failed to save section type");
                }
              }}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all"
                disabled={typeFormMode === "add" && (!typeForm.name || !typeForm.label)}>
                {typeFormMode === "add" ? "Create Type" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Section Type Confirm Modal ── */}
      {deleteTypeId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle size={22} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Delete Section Type</h3>
                <p className="text-gray-500 text-xs">This cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              Are you sure you want to delete "{deleteTypeId.label || deleteTypeId.name}"?
              Existing sections using this type will not be affected but will show as unknown.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTypeId(null)}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={async () => {
                try {
                  await sectionTypesApi.delete(deleteTypeId.id);
                  showToast("success", `Section type "${deleteTypeId.name}" deleted.`);
                  setDeleteTypeId(null);
                  const updated = await sectionTypesApi.list();
                  setSectionTypes(updated);
                } catch (err: any) {
                  showToast("error", err.detail?.error || err.message || "Failed to delete section type");
                }
              }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
