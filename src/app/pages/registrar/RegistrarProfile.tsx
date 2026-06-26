import React, { useState, useRef, useEffect } from "react";
import { CheckCircle, Pencil, X, Camera, User, Mail, Phone, MapPin, Briefcase, Calendar, Building, GraduationCap } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { authApi } from "../../services/api";

export function RegistrarProfile() {
  const { showToast, profilePhoto, setProfilePhoto } = useApp();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", address: "",
    employeeId: "", designation: "",
    dateHired: "", division: "", district: "",
  });
  const [draft, setDraft] = useState({ name: form.name, email: form.email, phone: form.phone, address: form.address });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    authApi.me().then(me => {
      setForm(prev => ({
        ...prev,
        name: me.name || prev.name,
        email: me.email || prev.email,
        phone: me.phone || "",
        address: me.address || "",
        employeeId: me.employee_id || "",
        designation: me.designation || "",
        dateHired: me.date_hired || "",
      }));
      setDraft({ name: me.name || "", email: me.email || "", phone: me.phone || "", address: me.address || "" });
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    try {
      await authApi.updateMe({
        name: draft.name,
        email: draft.email,
        phone: draft.phone || undefined,
        address: draft.address || undefined,
      });
      setForm(prev => ({ ...prev, ...draft }));
      setEditing(false);
      showToast("success", "Profile updated successfully.");
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to save profile");
    }
  };

  const handleCancel = () => {
    setDraft({ name: form.name, email: form.email, phone: form.phone, address: form.address });
    setEditing(false);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast("error", "Photo must be under 2MB."); return; }
    const reader = new FileReader();
    reader.onload = () => { setProfilePhoto(reader.result as string); showToast("success", "Profile photo updated!"); };
    reader.readAsDataURL(file);
  };

  const editableFields = [
    { label: "Full Name", key: "name", icon: User },
    { label: "Email Address", key: "email", icon: Mail },
    { label: "Phone Number", key: "phone", icon: Phone },
    { label: "Address", key: "address", icon: MapPin, full: true },
  ];

  const readOnlyFields = [
    { label: "Designation", value: form.designation, icon: Briefcase },
    { label: "Employee ID", value: form.employeeId, icon: Calendar },
    { label: "Date Hired", value: form.dateHired, icon: Calendar },
    { label: "Division", value: form.division, icon: Building },
    { label: "District", value: form.district, icon: MapPin },
  ];

  const responsibilities = [
    "SF1 — School Register Generation", "SF5 — Promotion Report Generation",
    "SF9 — Progress Report Card Generation", "SF10 — Permanent Record Management",
    "Student Record Verification", "Enrollment Report Management",
    "Promotion Records Monitoring", "At-Risk Student Monitoring",
    "Section Population Reports", "Enrollment Status Tracking",
  ];

  return (
    <div className="space-y-5 max-w-3xl">
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400" />
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center overflow-hidden border-2 border-indigo-200 shadow-md">
                {profilePhoto
                  ? <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                  : <span className="text-xl font-bold text-indigo-700">{form.name.charAt(0) || "R"}</span>
                }
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-700 transition shadow-md border-2 border-white"
              >
                <Camera size={12} className="text-white" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">{form.name || "Registrar"}</h2>
                <span className="bg-indigo-50 text-indigo-700 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-indigo-100">Registrar</span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{form.designation || "School Registrar"}</p>
              <p className="text-xs text-gray-400 mt-1">
                {form.email}
                {form.employeeId ? ` · ID: ${form.employeeId}` : ""}
              </p>
              <p className="text-xs text-indigo-500 mt-1.5 cursor-pointer hover:text-indigo-700 transition font-medium" onClick={() => fileRef.current?.click()}>
                Change profile photo
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Personal Information ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User size={15} className="text-indigo-500" />
            <h3 className="font-semibold text-gray-900">Personal Information</h3>
          </div>
          {!editing
            ? <button onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition font-medium">
                <Pencil size={12} /> Edit
              </button>
            : <div className="flex gap-2">
                <button onClick={handleSave}
                  className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 font-medium shadow-sm transition">Save</button>
                <button onClick={handleCancel}
                  className="text-xs text-gray-500 px-3 py-1.5 font-medium flex items-center gap-1 hover:bg-gray-100 rounded-lg transition">
                  <X size={11} /> Cancel
                </button>
              </div>
          }
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {editableFields.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.key} className={(f as any).full ? "sm:col-span-2" : ""}>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em] mb-1.5">{f.label}</p>
                  {editing
                    ? <input
                        value={(draft as any)[f.key]}
                        onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400 transition-all bg-white"
                        placeholder={`Enter ${f.label.toLowerCase()}`}
                      />
                    : <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                          <Icon size={14} className="text-indigo-500" />
                        </div>
                        <p className="text-sm font-medium text-gray-800">{(form as any)[f.key] || "—"}</p>
                      </div>
                  }
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Employment Information ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Briefcase size={15} className="text-indigo-500" />
          <h3 className="font-semibold text-gray-900">Employment Information</h3>
          <span className="text-xs text-gray-400 font-normal ml-1">(Read-only)</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {readOnlyFields.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.label}>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em] mb-1.5">{f.label}</p>
                  <div className="flex items-center gap-2.5 bg-gray-50/80 px-3.5 py-2.5 rounded-xl border border-gray-100">
                    <Icon size={14} className="text-gray-400" />
                    <p className="text-sm font-medium text-gray-800">{f.value || "—"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Responsibilities ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <GraduationCap size={15} className="text-indigo-500" />
          <h3 className="font-semibold text-gray-900">Registrar Responsibilities</h3>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {responsibilities.map(r => (
              <div key={r} className="flex items-center gap-2.5 text-sm text-gray-600 px-2 py-1.5 rounded-lg hover:bg-indigo-50/40 transition">
                <CheckCircle size={14} className="text-indigo-400 flex-shrink-0" />
                {r}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
