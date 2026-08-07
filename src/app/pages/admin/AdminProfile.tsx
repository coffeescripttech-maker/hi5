import React, { useState, useEffect } from "react";
import { User, Activity, Database, Shield } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { usersApi } from "../../services/users";
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

const STAT_TINTS: Record<string, { tile: string; shadow: string; soft: string; text: string }> = {
  blue: { tile: "from-blue-500 to-blue-600", shadow: "shadow-blue-200", soft: "bg-blue-50", text: "text-blue-600" },
  emerald: { tile: "from-blue-400 to-blue-500", shadow: "shadow-blue-200", soft: "bg-blue-50", text: "text-blue-600" },
  violet: { tile: "from-blue-600 to-blue-700", shadow: "shadow-blue-300", soft: "bg-blue-50", text: "text-blue-600" },
};

export function AdminProfile() {
  const { showToast, profilePhoto, setProfilePhoto } = useApp();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "System Administrator", email: "admin@school.edu.ph",
    phone: "", address: "",
    employeeId: "", designation: "", dateHired: "",
  });
  const [account, setAccount] = useState({
    username: "", role: "admin" as Role,
    status: "active", lastLogin: null as string | null, createdAt: null as string | null,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [draft, setDraft] = useState({ name: form.name, email: form.email, phone: form.phone, address: form.address });
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  // Fetch current user profile + user stats on mount
  useEffect(() => {
    authApi.me().then(me => {
      setCurrentUserId(me.id);
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
    usersApi.list().then(users => {
      setTotalUsers(users.length);
      setActiveUsers(users.filter(u => u.status === "active").length);
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!currentUserId) {
      showToast("error", "Cannot save: user ID not available.");
      return;
    }
    try {
      await usersApi.update(currentUserId, {
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

  const stats = [
    { label: "Total Users", value: totalUsers, icon: User, tint: "blue" },
    { label: "Active Users", value: activeUsers, icon: Activity, tint: "emerald" },
    { label: "Employee ID", value: form.employeeId || "—", icon: Database, tint: "violet" },
  ];

  const responsibilities = [
    "User Account Creation & Role Assignment", "System Configuration & School Settings",
    "Sectioning Threshold Management", "Enrollment Period Open / Close Control",
    "Academic Year Management & Archiving", "Bulk Section Promotion (School-wide)",
    "Database Backup Management", "System Activity Log Monitoring",
    "AI At-Risk System-Wide Summary Review", "Section Capacity Configuration",
  ];

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <ProfileHeader
        tone="blue"
        name={form.name}
        role="admin"
        designation={form.designation}
        email={form.email}
        employeeId={form.employeeId}
        profilePhoto={profilePhoto}
        onPhoto={handlePhotoChange}
      />

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stats.map(s => {
          const Icon = s.icon;
          const tint = STAT_TINTS[s.tint];
          return (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">{s.label}</p>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${tint.tile} shadow ${tint.shadow} flex items-center justify-center`}>
                  <Icon size={14} className="text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 truncate">{s.value}</p>
            </div>
          );
        })}
      </div>

      <EditableInfoCard
        tone="blue"
        form={form}
        draft={draft}
        editing={editing}
        onEdit={() => setEditing(true)}
        onChange={(key, value) => setDraft(d => ({ ...d, [key]: value }))}
        onSave={handleSave}
        onCancel={handleCancel}
      />

      <EmploymentInfoCard
        tone="blue"
        employeeId={form.employeeId}
        designation={form.designation}
        dateHired={form.dateHired}
      />

      <AccountSecurityCard
        tone="blue"
        username={account.username}
        role={account.role}
        status={account.status}
        lastLogin={account.lastLogin}
        createdAt={account.createdAt}
        onChangePassword={() => setShowPassword(true)}
      />

      <ChecklistCard icon={Shield} title="Admin Responsibilities" items={responsibilities} tone="blue" />

      <ChangePasswordModal open={showPassword} onClose={() => setShowPassword(false)} tone="blue" />
    </div>
  );
}
