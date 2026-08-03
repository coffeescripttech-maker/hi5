import React, { useState, useRef, useEffect } from "react";
import { User, CheckCircle, Pencil, X, Camera, Activity, Eye, TrendingUp } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { authApi } from "../../services/api";

export function PrincipalProfile() {
  const { showToast, profilePhoto, setProfilePhoto } = useApp();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", address: "",
    employeeId: "", designation: "",
  });
  const [draft, setDraft] = useState({ name: "", email: "", phone: "", address: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    authApi.me().then(me => {
      setForm({
        name: me.name || "", email: me.email || "", phone: me.phone || "",
        address: me.address || "", employeeId: me.employee_id || "",
        designation: me.designation || "",
      });
      setDraft({ name: me.name || "", email: me.email || "", phone: me.phone || "", address: me.address || "" });
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    try {
      await authApi.updateMe({
        name: draft.name, email: draft.email,
        phone: draft.phone || undefined, address: draft.address || undefined,
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
    { label: "Full Name", key: "name" },
    { label: "Email Address", key: "email" },
    { label: "Phone Number", key: "phone" },
    { label: "School Address", key: "address", full: true },
  ];

  return (
    <div className="space-y-4 max-w-3xl">
      {/* HEADER */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-violet-500 via-violet-600 to-violet-400" />
        <div className="p-5 sm:p-6 flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center overflow-hidden border-2 border-violet-200">
              {profilePhoto
                ? <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                : <User size={28} className="text-violet-700" />
              }
            </div>
            <button onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 w-6 h-6 bg-violet-600 rounded-full flex items-center justify-center hover:bg-violet-700 transition shadow">
              <Camera size={11} className="text-white" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-gray-800">{form.name || "Principal"}</h2>
              <span className="bg-violet-100 text-violet-700 text-xs font-semibold px-2 py-0.5 rounded-full">Principal</span>
            </div>
            <p className="text-gray-500 text-sm">{form.designation || "School Principal"}</p>
            <p className="text-gray-400 text-xs mt-0.5">{form.email}</p>
          </div>
        </div>
      </div>

      {/* ROLE INFO CARD */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 text-sm mb-3">Principal Responsibilities <span className="text-xs text-gray-400 font-normal">(View-only access)</span></h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            "View school-wide enrollment figures", "View grade submission progress",
            "View at-risk student classifications", "View promotion & retention statistics",
            "View section population data", "Monitor real-time enrollment trends",
          ].map(r => (
            <div key={r} className="flex items-center gap-2 text-sm text-gray-600">
              <Eye size={13} className="text-violet-400 flex-shrink-0" />{r}
            </div>
          ))}
        </div>
      </div>

      {/* PERSONAL INFO */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 text-sm">Personal Information</h3>
          {!editing
            ? <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 font-medium"><Pencil size={12} />Edit</button>
            : <div className="flex gap-2">
                <button onClick={handleSave} className="text-xs bg-violet-600 text-white px-3 py-1.5 rounded-lg hover:bg-violet-700 font-medium">Save</button>
                <button onClick={handleCancel} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 font-medium flex items-center gap-1"><X size={11} />Cancel</button>
              </div>
          }
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {editableFields.map(f => (
            <div key={f.key} className={(f as any).full ? "sm:col-span-2" : ""}>
              <p className="text-xs text-gray-400 mb-1">{f.label}</p>
              {editing
                ? <input value={(draft as any)[f.key]} onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                : <p className="text-sm font-medium text-gray-800">{(form as any)[f.key] || "—"}</p>
              }
            </div>
          ))}
        </div>
      </div>

      {/* EMPLOYMENT INFO */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 text-sm mb-4">Employment Information <span className="text-xs text-gray-400 font-normal">(Read-only)</span></h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: "Designation", value: form.designation },
            { label: "Employee ID", value: form.employeeId },
          ].map(f => (
            <div key={f.label}>
              <p className="text-xs text-gray-400 mb-1">{f.label}</p>
              <p className="text-sm font-medium text-gray-800 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">{f.value || "—"}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
