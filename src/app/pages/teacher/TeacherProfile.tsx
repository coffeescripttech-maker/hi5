import React, { useState, useRef, useEffect } from "react";
import { User, Layers, CheckCircle, Pencil, X, BookOpen, Camera } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { authApi } from "../../services/api";

export function TeacherProfile() {
  const { showToast, profilePhoto, setProfilePhoto } = useApp();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "Teacher", email: "teacher@school.edu.ph", phone: "",
    address: "",
    subject: "—", employeeId: "",
    designation: "", dateHired: "",
  });

  // Fetch current user profile on mount
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
    }).catch(() => {});
  }, []);
  const [draft, setDraft] = useState({ name: form.name, email: form.email, phone: form.phone, address: form.address });
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = () => { setForm(prev => ({ ...prev, ...draft })); setEditing(false); showToast("success", "Profile updated successfully."); };
  const handleCancel = () => { setDraft({ name: form.name, email: form.email, phone: form.phone, address: form.address }); setEditing(false); };
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast("error", "Photo must be under 2MB."); return; }
    const reader = new FileReader();
    reader.onload = () => { setProfilePhoto(reader.result as string); showToast("success", "Profile photo updated!"); };
    reader.readAsDataURL(file);
  };

  const editableFields = [
    { label: "Full Name", key: "name" }, { label: "Email Address", key: "email" },
    { label: "Phone Number", key: "phone" }, { label: "Address", key: "address", full: true },
  ];
  const readOnlyFields = [
    { label: "Subject", value: form.subject }, { label: "Designation", value: form.designation },
    { label: "Employee ID", value: form.employeeId }, { label: "Date Hired", value: form.dateHired },
  ];

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center overflow-hidden border-2 border-emerald-200 text-xl font-bold text-emerald-700">
            {profilePhoto ? <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" /> : form.name.charAt(0)}
          </div>
          <button onClick={() => fileRef.current?.click()} className="absolute bottom-0 right-0 w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center hover:bg-emerald-700 transition shadow">
            <Camera size={11} className="text-white" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-gray-800">{form.name}</h2>
            <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full">Teacher</span>
          </div>
          <p className="text-gray-500 text-sm">{form.designation} · {form.subject}</p>
          <p className="text-gray-400 text-xs mt-0.5">{form.email}</p>
          <p className="text-xs text-emerald-500 mt-1 cursor-pointer hover:underline" onClick={() => fileRef.current?.click()}>Click photo to change</p>
        </div>
      </div>

      {/* Editable Info */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 text-sm">Personal Information</h3>
          {!editing
            ? <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium"><Pencil size={12} />Edit</button>
            : <div className="flex gap-2">
                <button onClick={handleSave} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 font-medium">Save</button>
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
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                : <p className="text-sm font-medium text-gray-800">{(form as any)[f.key]}</p>
              }
            </div>
          ))}
        </div>
      </div>

      {/* Read-only */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <h3 className="font-semibold text-gray-800 text-sm mb-4">Employment Information <span className="text-xs text-gray-400 font-normal">(Read-only)</span></h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {readOnlyFields.map(f => (
            <div key={f.label}>
              <p className="text-xs text-gray-400 mb-1">{f.label}</p>
              <p className="text-sm font-medium text-gray-800 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">{f.value}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
