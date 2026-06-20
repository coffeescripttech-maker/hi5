import React, { useState, useEffect } from "react";
import { BookOpen, Plus, Trash2, CheckCircle, X, AlertTriangle, Edit2, UserCheck } from "lucide-react";
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <BookOpen size={20} className="text-blue-700" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800">Subject Management</h2>
            <p className="text-gray-500 text-sm">Configure subjects per grade level for automatic assignment to enrolled students</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium"><CheckCircle size={14} /> Saved.</span>}
          <button onClick={() => { setEditSubject(null); setForm(emptyForm); setShowForm(true); }}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition">
            <Plus size={15} /> Add Subject
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">Loading subjects...</div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-blue-100 p-4 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">Total Subjects</p>
              <p className="text-2xl font-bold text-blue-700">{subjects.length}</p>
            </div>
            {["core", "applied", "specialized"].map(t => (
              <div key={t} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">{TYPE_LABEL[t]}</p>
                <p className="text-2xl font-bold text-gray-700">{subjects.filter(s => s.subject_type === t).length}</p>
              </div>
            ))}
          </div>

          {/* Filter */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 font-medium">Filter by Grade:</span>
            {(["All", 7, 8, 9, 10, 11, 12] as (number | "All")[]).map(g => (
              <button key={g} onClick={() => setFilterGrade(g)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filterGrade === g ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {g === "All" ? "All Grades" : `Grade ${g}`}
              </button>
            ))}
          </div>

          {/* Subjects by grade */}
          {byGrade.map(({ grade, subjects: gradeSubs }) => (
            gradeSubs.length > 0 && (
              <div key={grade} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">Grade {grade}</span>
                    <span className="text-xs text-gray-500">{gradeSubs.length} subject(s)</span>
                  </div>
                  <span className="text-xs text-gray-400">{gradeSubs.reduce((a, s) => a + s.hours_per_week, 0)} hrs/week total</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {["Subject Name", "Type", "Hrs/Week", "Actions"].map(h => (
                          <th key={h} className={`${h === "Actions" ? "text-center" : "text-left"} px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {gradeSubs.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50/60">
                          <td className="px-5 py-3 font-medium text-gray-800">{s.name}</td>
                          <td className="px-5 py-3">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${TYPE_COLORS[s.subject_type]}`}>{TYPE_LABEL[s.subject_type]}</span>
                          </td>
                          <td className="px-5 py-3 text-gray-600 text-sm">{s.hours_per_week} hrs</td>
                          <td className="px-5 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => openEdit(s)} className="text-blue-500 hover:text-blue-700 p-1 hover:bg-blue-50 rounded transition"><Edit2 size={13} /></button>
                              <button onClick={() => setDeleteId(s.id)} className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded transition"><Trash2 size={13} /></button>
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

          {byGrade.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 text-sm">No subjects found for the selected filters.</div>
          )}
        </>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-800">{editSubject ? "Edit Subject" : "Add New Subject"}</h3>
              <button onClick={() => { setShowForm(false); setEditSubject(null); }} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Subject Name</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Mathematics"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Grade Level</label>
                  <select value={form.grade_level} onChange={e => setForm(p => ({ ...p, grade_level: parseInt(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    {[7, 8, 9, 10, 11, 12].map(g => <option key={g} value={g}>Grade {g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Hrs/Week</label>
                  <input type="number" min={1} max={10} value={form.hours_per_week} onChange={e => setForm(p => ({ ...p, hours_per_week: parseInt(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Subject Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["core", "applied", "specialized"] as const).map(t => (
                    <button key={t} onClick={() => setForm(p => ({ ...p, subject_type: t }))}
                      className={`py-2 rounded-xl text-xs font-semibold border-2 transition ${form.subject_type === t ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                      {TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowForm(false); setEditSubject(null); }} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={!form.name}
                className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-200 disabled:text-gray-400 text-white py-2.5 rounded-xl text-sm font-semibold">
                {editSubject ? "Save Changes" : "Add Subject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center"><AlertTriangle size={22} className="text-red-600" /></div>
              <div><h3 className="font-bold text-gray-800">Delete Subject</h3><p className="text-gray-500 text-xs">This cannot be undone</p></div>
            </div>
            <p className="text-sm text-gray-600 mb-5">Are you sure you want to delete <strong>{subjects.find(s => s.id === deleteId)?.name}</strong>?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
