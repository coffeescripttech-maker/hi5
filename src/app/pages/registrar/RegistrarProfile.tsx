import React, { useState, useEffect } from "react";
import { GraduationCap } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { authApi } from "../../services/api";
import {
  ProfileHeader,
  EditableInfoCard,
  EmploymentInfoCard,
  AccountSecurityCard,
  ChangePasswordModal,
  ChecklistCard,
  saveProfilePhoto,
  type Role
} from "../../components/ProfileSections";

export function RegistrarProfile() {
  const { showToast, profilePhoto, setProfilePhoto } = useApp();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", address: "",
    employeeId: "", designation: "", dateHired: "",
  });
  const [account, setAccount] = useState({
    username: "", role: "registrar" as Role,
    status: "active", lastLogin: null as string | null, createdAt: null as string | null,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [draft, setDraft] = useState({ name: form.name, email: form.email, phone: form.phone, address: form.address });

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
      setDraft({ name: me.name || "", email: me.email || "", phone: me.phone || "", address: me.address || "" });
      setAccount({
        username: me.username,
        role: me.role,
        status: me.status,
        lastLogin: me.last_login,
        createdAt: me.created_at,
      });
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

  const handlePhotoChange = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) { showToast("error", "Photo must be under 2MB."); return; }
    try {
      const url = await saveProfilePhoto(file);
      setProfilePhoto(url);
      showToast("success", "Profile photo updated!");
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to update photo.");
    }
  };

  const responsibilities = [
    "SF1 — School Register Generation", "SF5 — Promotion Report Generation",
    "SF9 — Progress Report Card Generation", "SF10 — Permanent Record Management",
    "Student Record Verification", "Enrollment Report Management",
    "Promotion Records Monitoring", "At-Risk Student Monitoring",
    "Section Population Reports", "Enrollment Status Tracking",
  ];

  return (
    <div className="space-y-5 max-w-3xl mx-auto px-3 sm:px-0">
      <ProfileHeader
        tone="indigo"
        name={form.name}
        role="registrar"
        designation={form.designation}
        email={form.email}
        employeeId={form.employeeId}
        profilePhoto={profilePhoto}
        onPhoto={handlePhotoChange}
      />

      <EditableInfoCard
        tone="indigo"
        form={form}
        draft={draft}
        editing={editing}
        onEdit={() => setEditing(true)}
        onChange={(key, value) => setDraft(d => ({ ...d, [key]: value }))}
        onSave={handleSave}
        onCancel={handleCancel}
      />

      <EmploymentInfoCard
        tone="indigo"
        employeeId={form.employeeId}
        designation={form.designation}
        dateHired={form.dateHired}
      />

      <AccountSecurityCard
        tone="indigo"
        username={account.username}
        role={account.role}
        status={account.status}
        lastLogin={account.lastLogin}
        createdAt={account.createdAt}
        onChangePassword={() => setShowPassword(true)}
      />

      <ChecklistCard icon={GraduationCap} title="Registrar Responsibilities" items={responsibilities} tone="indigo" />

      <ChangePasswordModal open={showPassword} onClose={() => setShowPassword(false)} tone="indigo" />
    </div>
  );
}
