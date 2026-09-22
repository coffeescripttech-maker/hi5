import { useState, useEffect, useCallback } from "react";
import {
  MapPin,
  Plus,
  Trash2,
  Edit2,
  Search,
  Filter,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { roomsApi, RoomRow, CreateRoomPayload, UpdateRoomPayload } from "../../services/rooms";
import { useApp } from "../../context/AppContext";

const ROOM_TYPES = [
  { value: "Classroom", label: "Classroom" },
  { value: "Laboratory", label: "Laboratory" },
  { value: "Computer Laboratory", label: "Computer Laboratory" },
  { value: "Lecture Hall", label: "Lecture Hall" },
  { value: "Other", label: "Other" },
];

const STATUSES = [
  { value: "Available", label: "Available", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "Maintenance", label: "Maintenance", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "Inactive", label: "Inactive", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "Occupied", label: "Occupied", color: "bg-blue-100 text-blue-700 border-blue-200" },
];

const MANUAL_STATUSES = STATUSES.filter((s) => s.value !== "Occupied");
const STATUS_OPTIONS = ["Available", "Maintenance", "Inactive", "Occupied"];
const emptyForm: CreateRoomPayload = { name: "", building: "", floor: "", capacity: undefined, room_type: "Classroom", status: "Available" };

function statusColor(status: string) {
  return STATUSES.find((s) => s.value === status)?.color ?? "bg-gray-100 text-gray-700 border-gray-200";
}

export function AdminRooms() {
  const { showToast } = useApp();
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | "All">("All");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RoomRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");

  const loadRooms = useCallback(() => {
    setLoading(true);
    roomsApi
      .list(statusFilter !== "All" ? { status: statusFilter } : undefined)
      .then(setRooms)
      .catch((err) =>
        showToast("error", "Failed to load rooms: " + (err.detail?.error || err.message))
      )
      .finally(() => setLoading(false));
  }, [statusFilter, showToast]);

  useEffect(() => {
    loadRooms();
    }, [loadRooms]);

  const filtered = rooms.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.building ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.floor ?? "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (r: RoomRow) => {
    setEditing(r);
    setForm({
      name: r.name,
      building: r.building ?? "",
      floor: r.floor ?? "",
      capacity: r.capacity ?? undefined,
      room_type: r.room_type,
      status: r.status,
    });
    setFormError("");
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim()) { setFormError("Room name is required."); return; }
    if (!form.room_type) { setFormError("Room type is required."); return; }
    setSaving(true);
    try {
      if (editing) {
        await roomsApi.update(editing.id, form as UpdateRoomPayload);
        showToast("success", "Room updated.");
        setRooms((prev) => prev.map((r) => (r.id === editing.id ? { ...r, ...form, updated_at: new Date().toISOString() } : r)));
      } else {
        const created = await roomsApi.create(form);
        showToast("success", "Room created.");
        setRooms((prev) => [...prev, created]);
      }
      setShowForm(false);
    } catch (err: any) {
      setFormError(err.detail?.error || err.message || "Failed to save room.");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (deleteId === null) return;
    setDeleting(true);
    try {
      await roomsApi.delete(deleteId);
      showToast("success", "Room deleted.");
      setRooms((prev) => prev.filter((r) => r.id !== deleteId));
      setDeleteId(null);
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to delete room.");
      setDeleteId(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <MapPin size={20} className="text-blue-600" /> Rooms Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage school rooms and facilities used in class scheduling.</p>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all">
          <Plus size={16} /> Add Room
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by name, building, or floor..."
            className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400" />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          {(["All", ...STATUS_OPTIONS] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                statusFilter === s ? "bg-blue-50 text-blue-700 border-blue-200" : "border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
          <Loader2 size={20} className="animate-spin text-gray-400 mx-auto mb-3" />
          <p className="text-gray-400 text-sm font-medium">Loading rooms...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <MapPin size={18} className="text-gray-400" />
          </div>
          <p className="text-gray-400 text-sm font-medium">No rooms found</p>
          <p className="text-gray-400 text-xs mt-1">Try a different filter or add a new room.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{r.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {[r.building, r.floor].filter(Boolean).join(" · ") || "No location set"}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border flex-shrink-0 ${statusColor(r.status)}`}>
                  {r.status}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-3 text-[11px] text-gray-500">
                <span className="bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg font-medium">{r.room_type}</span>
                {r.capacity != null && <span>{r.capacity} seats</span>}
              </div>
              <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-gray-50">
                <button onClick={() => openEdit(r)} className="text-blue-400 hover:text-blue-600 transition p-1.5 rounded-lg hover:bg-blue-50">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => setDeleteId(r.id)} className="text-red-400 hover:text-red-600 transition p-1.5 rounded-lg hover:bg-red-50">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* -- Form Modal (Create/Edit) -- */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-400 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <MapPin size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">{editing ? "Edit Room" : "Add New Room"}</h3>
                  <p className="text-blue-200 text-xs">{editing ? `Editing: ${editing.name}` : "Register a room or facility"}</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="p-2 hover:bg-white/10 rounded-lg text-white/80 transition">
                <span className="text-lg leading-none">&times;</span>
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium px-3 py-2 rounded-xl">{formError}</div>
              )}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Room Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Room 301"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Building</label>
                  <input value={form.building ?? ""} onChange={e => setForm(p => ({ ...p, building: e.target.value }))}
                    placeholder="e.g. Main Building"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Floor</label>
                  <input value={form.floor ?? ""} onChange={e => setForm(p => ({ ...p, floor: e.target.value }))}
                    placeholder="e.g. 3rd Floor"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Capacity</label>
                  <input type="number" min={1} value={form.capacity ?? ""} onChange={e => setForm(p => ({ ...p, capacity: e.target.value ? parseInt(e.target.value) : undefined }))}
                    placeholder="e.g. 40"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as CreateRoomPayload["status"] }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400 bg-white">
                    {MANUAL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <p className="text-[11px] text-gray-400 mt-1.5">"Occupied" is set automatically when a class is scheduled in a room.</p>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Room Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {ROOM_TYPES.map(t => (
                    <button key={t.value} type="button" onClick={() => setForm(p => ({ ...p, room_type: t.value }))}
                      className={`py-2 rounded-xl text-[11px] font-semibold border-2 transition-all ${
                        form.room_type === t.value
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 text-gray-500 hover:border-blue-300 hover:bg-blue-50/50"
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-gray-50/50">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button type="submit" disabled={saving || !form.name.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all">
                {saving ? "Saving..." : editing ? "Save Changes" : "Add Room"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* -- Delete Confirmation Modal -- */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <h3 className="font-bold text-gray-900">Delete this room?</h3>
              <p className="text-gray-500 text-sm mt-1">This action cannot be undone. Schedules referencing this room will lose their room assignment.</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-gray-50/50">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={doDelete} disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 text-white py-2.5 rounded-xl text-sm font-semibold transition-all">
                {deleting ? "Deleting..." : "Delete Room"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
