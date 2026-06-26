import { useState, useEffect } from "react";
import { BookOpen, Plus, Trash2, CheckCircle, X, AlertTriangle, Edit2, Filter, Clock, Layers } from "lucide-react";
import { subjectsApi, SubjectRow, CreateSubjectPayload, UpdateSubjectPayload } from "../../services/subjects";
import { useApp } from "../../context/AppContext";

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

const emptyForm = { name: "", grade_level: 7, hours_per_week: 4, subject_type: "core" as const };

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
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400" />
        <div className="p-5 sm:p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-200 flex items-center justify-center flex-shrink-0">
              <BookOpen size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">Subject Management</h2>
              <p className="text-gray-500 text-sm">Configure subjects per grade level for automatic assignment to enrolled students</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
                <CheckCircle size={14} /> Saved.
              </span>
            )}
            <button onClick={() => { setEditSubject(null); setForm(emptyForm); setShowForm(true); }}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all">
              <Plus size={15} /> Add Subject
            </button>
          </div>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Total Subjects</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
              <BookOpen size={14} className="text-indigo-600" />
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
                ? "bg-indigo-600 text-white shadow-sm"
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
                    <span className="bg-indigo-50 text-indigo-700 text-[11px] font-bold px-3 py-1 rounded-full border border-indigo-100">Grade {grade}</span>
                    <span className="text-xs text-gray-500 font-medium">{gradeSubs.length} subject{gradeSubs.length !== 1 && "s"}</span>
                  </div>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock size={12} /> {gradeSubs.reduce((a, s) => a + s.hours_per_week, 0)} hrs/week
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead className="bg-gray-50/80">
                      <tr>
                        {[
                          { label: "Subject Name", key: "name" },
                          { label: "Type", key: "type" },
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
                        <tr key={s.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-indigo-50/50 transition-colors duration-150`}>
                          <td className="px-5 py-3.5">
                            <span className="text-sm font-medium text-gray-800">{s.name}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${TYPE_COLORS[s.subject_type]}`}>
                              {TYPE_LABEL[s.subject_type]}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center text-sm text-gray-600">{s.hours_per_week}</td>
                          <td className="px-5 py-3.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => openEdit(s)}
                                className="text-indigo-400 hover:text-indigo-600 transition p-1.5 rounded-lg hover:bg-indigo-50">
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-gray-900">{editSubject ? "Edit Subject" : "Add New Subject"}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{editSubject ? `Editing: ${editSubject.name}` : "Create a new subject for the curriculum"}</p>
              </div>
              <button onClick={() => { setShowForm(false); setEditSubject(null); }} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Subject Name</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Mathematics"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Grade Level</label>
                  <select value={form.grade_level} onChange={e => setForm(p => ({ ...p, grade_level: parseInt(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400 bg-white">
                    {[7, 8, 9, 10, 11, 12].map(g => <option key={g} value={g}>Grade {g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Hours per Week</label>
                  <input type="number" min={1} max={10} value={form.hours_per_week} onChange={e => setForm(p => ({ ...p, hours_per_week: parseInt(e.target.value) || 0 }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400" />
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
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowForm(false); setEditSubject(null); }}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleSave} disabled={!form.name}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all">
                {editSubject ? "Save Changes" : "Add Subject"}
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
