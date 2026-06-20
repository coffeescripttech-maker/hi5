import React, { useState, useEffect } from "react";
import { Layers, Plus, CheckCircle, Trash2, Edit2, X, AlertTriangle, Users } from "lucide-react";
import { sectionsApi, SectionRow, CreateSectionPayload, UpdateSectionPayload } from "../../services/sections";
import { useApp } from "../../context/AppContext";

const SECTION_COLORS: Record<string, string> = {
  star: "bg-yellow-100 text-yellow-700 border-yellow-300",
  gold: "bg-amber-100 text-amber-700 border-amber-300",
  silver: "bg-gray-100 text-gray-700 border-gray-300",
  regular: "bg-blue-100 text-blue-700 border-blue-300",
  non_reader: "bg-red-100 text-red-700 border-red-300",
};

const SECTION_TYPES = ["star", "gold", "silver", "regular", "non_reader"];

export function SectionCreation() {
  const { showToast } = useApp();
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editTarget, setEditTarget] = useState<SectionRow | null>(null);
  const [editForm, setEditForm] = useState({ capacity: "", adviser_id: "", minAvg: "" });
  const [form, setForm] = useState({
    gradeLevel: "7",
    type: "star",
    capacity: "45",
    adviser_id: "",
    minAvg: "90",
  });

  const fetchSections = () => {
    setLoading(true);
    sectionsApi.list()
      .then(setSections)
      .catch(err => showToast("error", "Failed to load sections: " + (err.detail?.error || err.message)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSections(); }, []);

  const handleAdd = async () => {
    try {
      const payload: CreateSectionPayload = {
        name: `${form.gradeLevel}-${form.type}`,
        grade_level: parseInt(form.gradeLevel),
        section_type: form.type,
        capacity: parseInt(form.capacity),
        min_average: parseInt(form.minAvg),
        adviser_id: form.adviser_id ? parseInt(form.adviser_id) : undefined,
      };
      await sectionsApi.create(payload);
      setShowForm(false);
      setSaved(true);
      setForm({ gradeLevel: "7", type: "star", capacity: "45", adviser_id: "", minAvg: "90" });
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

  const handleEditSave = async () => {
    if (!editTarget) return;
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Layers size={20} className="text-blue-700" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800">Section Creation & Management</h2>
            <p className="text-gray-500 text-sm">Create, configure, and manage class sections per grade level</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium"><CheckCircle size={14} /> Saved.</span>}
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition">
            <Plus size={15} /> Create Section
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-blue-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Total Sections</p>
          <p className="text-2xl font-bold text-blue-700">{sections.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Total Capacity</p>
          <p className="text-2xl font-bold text-green-700">{sections.reduce((a, s) => a + s.capacity, 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Total Enrolled</p>
          <p className="text-2xl font-bold text-emerald-700">{sections.reduce((a, s) => a + s.current_count, 0)}</p>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">Loading sections...</div>
      ) : (
        /* Sections by grade */
        byGrade.map(({ grade, sections: gradeSections }) => (
          <div key={grade} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">Grade {grade}</span>
                <span className="text-xs text-gray-500">{gradeSections.length} section(s)</span>
              </div>
            </div>
            {gradeSections.length === 0
              ? <p className="text-xs text-gray-400 px-5 py-4">No sections created for Grade {grade} yet.</p>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Section</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Adviser</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Capacity</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Enrolled</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Min. Avg</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Occupancy</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {gradeSections.map(sec => {
                        const pct = Math.round((sec.current_count / sec.capacity) * 100);
                        return (
                          <tr key={sec.id} className="hover:bg-gray-50/60">
                            <td className="px-5 py-3">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${SECTION_COLORS[sec.section_type] || "bg-gray-100 text-gray-700 border-gray-300"}`}>
                                {sec.name}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-sm">{sec.adviser_name || "—"}</td>
                            <td className="px-4 py-3 text-center font-medium text-gray-700">{sec.capacity}</td>
                            <td className="px-4 py-3 text-center font-bold text-blue-700">{sec.current_count}</td>
                            <td className="px-4 py-3 text-center text-gray-500 text-xs">{sec.min_average}+</td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                  <div className={`h-1.5 rounded-full ${pct >= 95 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-green-500"}`}
                                    style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs text-gray-500">{pct}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => openEdit(sec)}
                                  className="text-blue-400 hover:text-blue-600 transition p-1 rounded hover:bg-blue-50">
                                  <Edit2 size={13} />
                                </button>
                                <button onClick={() => setDeleteId(sec.id)}
                                  className="text-red-400 hover:text-red-600 transition p-1 rounded hover:bg-red-50">
                                  <Trash2 size={13} />
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

      {/* Create Section Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-800">Create New Section</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Grade Level</label>
                <select value={form.gradeLevel} onChange={e => setForm(p => ({ ...p, gradeLevel: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  {[7,8,9,10,11,12].map(g => <option key={g} value={g}>Grade {g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Section Type</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  {SECTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Capacity</label>
                <input type="number" value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Min. Average</label>
                <input type="number" value={form.minAvg} onChange={e => setForm(p => ({ ...p, minAvg: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Adviser ID (optional)</label>
                <input type="number" value={form.adviser_id} onChange={e => setForm(p => ({ ...p, adviser_id: e.target.value }))}
                  placeholder="e.g. 1 (teacher user ID)"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-xs text-blue-700">
              Section will be created as: <strong>{form.gradeLevel}-{form.type}</strong> · Capacity: <strong>{form.capacity}</strong> · Min. Avg: <strong>{form.minAvg}+</strong>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleAdd}
                className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-200 disabled:text-gray-400 text-white py-2.5 rounded-xl text-sm font-semibold">
                Create Section
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Section Modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-gray-800">Edit Section</h3>
                <p className="text-xs text-gray-400 mt-0.5">Editing: <span className="font-semibold text-blue-700">{editTarget.name}</span></p>
              </div>
              <button onClick={() => setEditTarget(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Adviser ID</label>
                <input type="number" value={editForm.adviser_id} onChange={e => setEditForm(p => ({ ...p, adviser_id: e.target.value }))}
                  placeholder="Teacher user ID"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Capacity</label>
                  <input type="number" value={editForm.capacity} onChange={e => setEditForm(p => ({ ...p, capacity: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Min. Average</label>
                  <input type="number" value={editForm.minAvg} onChange={e => setEditForm(p => ({ ...p, minAvg: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditTarget(null)} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleEditSave}
                className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-200 disabled:text-gray-400 text-white py-2.5 rounded-xl text-sm font-semibold">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle size={22} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Delete Section</h3>
                <p className="text-gray-500 text-xs">This cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">Are you sure you want to delete this section? All student assignments to this section will be cleared.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
