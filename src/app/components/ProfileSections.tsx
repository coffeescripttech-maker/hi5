/**
 * Shared profile page sections — used by all four role profile pages so the
 * header, Personal / Employment Information, Account & Security, Change
 * Password, responsibilities list, and photo logic stay in one place instead
 * of being copy-pasted 4x.
 *
 * Design follows the app's premium pages (rounded-2xl cards, gradient accent
 * bars, icon tiles, uppercase tracking labels) with a per-role accent colour:
 * admin → blue, teacher → emerald, registrar → indigo, principal → violet.
 */
import React, { useState, useRef } from "react";
import {
  Briefcase,
  Calendar,
  User as UserIcon,
  KeyRound,
  Clock,
  BadgeCheck,
  Lock,
  X,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Camera,
  Pencil,
  Mail,
  Phone,
  MapPin,
  CheckCircle
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useApp } from "../context/AppContext";
import { authApi } from "../services/api";
import { isValidPhotoUrl } from "../utils/photo";

export type Role = "admin" | "teacher" | "registrar" | "principal";
export type Tone = "blue" | "emerald" | "indigo" | "violet" | "purple";

interface ToneClasses {
  gradient: string;   // h-1.5 top bar + modal header gradient
  tile: string;       // gradient icon tile / avatar background
  tileShadow: string; // soft shadow colour for the avatar tile
  soft: string;       // soft tint background for small icon tiles
  text: string;       // accent text colour
  chip: string;       // role chip (bg / text / border)
  dot: string;        // chip + status dot colour
  button: string;     // solid button background
  hover: string;      // solid button hover
  ring: string;       // input focus ring + border
}

const TONE: Record<Tone, ToneClasses> = {
  blue: {
    gradient: "from-blue-500 via-blue-600 to-blue-400",
    tile: "from-blue-500 to-blue-600",
    tileShadow: "shadow-blue-200",
    soft: "bg-blue-50",
    text: "text-blue-600",
    chip: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
    button: "bg-blue-600",
    hover: "hover:bg-blue-700",
    ring: "focus:ring-blue-100 focus:border-blue-400",
  },
  emerald: {
    gradient: "from-emerald-500 via-emerald-600 to-emerald-400",
    tile: "from-emerald-500 to-emerald-600",
    tileShadow: "shadow-emerald-200",
    soft: "bg-emerald-50",
    text: "text-emerald-600",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    button: "bg-emerald-600",
    hover: "hover:bg-emerald-700",
    ring: "focus:ring-emerald-100 focus:border-emerald-400",
  },
  indigo: {
    gradient: "from-indigo-500 via-indigo-600 to-indigo-400",
    tile: "from-indigo-500 to-indigo-600",
    tileShadow: "shadow-indigo-200",
    soft: "bg-indigo-50",
    text: "text-indigo-600",
    chip: "bg-indigo-50 text-indigo-700 border-indigo-200",
    dot: "bg-indigo-500",
    button: "bg-indigo-600",
    hover: "hover:bg-indigo-700",
    ring: "focus:ring-indigo-100 focus:border-indigo-400",
  },
  violet: {
    gradient: "from-violet-500 via-violet-600 to-violet-400",
    tile: "from-violet-500 to-violet-600",
    tileShadow: "shadow-violet-200",
    soft: "bg-violet-50",
    text: "text-violet-600",
    chip: "bg-violet-50 text-violet-700 border-violet-200",
    dot: "bg-violet-500",
    button: "bg-violet-600",
    hover: "hover:bg-violet-700",
    ring: "focus:ring-violet-100 focus:border-violet-400",
  },
  purple: {
    gradient: "from-purple-500 via-purple-600 to-purple-400",
    tile: "from-purple-500 to-purple-600",
    tileShadow: "shadow-purple-200",
    soft: "bg-purple-50",
    text: "text-purple-600",
    chip: "bg-purple-50 text-purple-700 border-purple-200",
    dot: "bg-purple-500",
    button: "bg-purple-600",
    hover: "hover:bg-purple-700",
    ring: "focus:ring-purple-100 focus:border-purple-400",
  },
};

const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  teacher: "Teacher",
  registrar: "Registrar",
  principal: "Principal",
};

/** Fallback display name + subtitle when the DB has no name / designation. */
const ROLE_NAME: Record<Role, string> = {
  admin: "System Administrator",
  teacher: "Teacher",
  registrar: "Registrar",
  principal: "Principal",
};
const ROLE_SUBTITLE: Record<Role, string> = {
  admin: "System Administrator",
  teacher: "Faculty Member",
  registrar: "School Registrar",
  principal: "School Principal",
};

const STATUS_META: Record<string, { label: string; chip: string; dot: string }> = {
  active: { label: "Active", chip: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  idle: { label: "Idle", chip: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  inactive: { label: "Inactive", chip: "bg-gray-50 text-gray-500 border-gray-200", dot: "bg-gray-400" }
};

/* ── Date / time formatting helpers ─────────────────────────────────── */

/** "2020-06-01" | ISO → "Jun 1, 2020"; empty/null → "—" */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

/** ISO timestamp → "just now", "12m ago", "3d ago", "2mo ago", "1y ago" */
export function relativeTime(value: string | null | undefined): string {
  if (!value) return "Never";
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

/** Years & months served since date_hired, e.g. "5 yrs 2 mos" */
export function yearsOfService(dateHired: string | null | undefined): string {
  if (!dateHired) return "—";
  const start = new Date(dateHired);
  if (Number.isNaN(start.getTime())) return "—";
  if (start.getTime() > Date.now()) return "—";
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  const y = years > 0 ? `${years} yr${years !== 1 ? "s" : ""}` : "";
  const m = months > 0 ? `${months} mo${months !== 1 ? "s" : ""}` : "";
  if (!y && !m) return "Less than a month";
  return [y, m].filter(Boolean).join(" ");
}

/** "Juan dela Cruz" → "JD"; single word → first letter uppercase. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words.slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

/* ── Generic card shell (premium style) ─────────────────────────────── */

export function SectionCard({
  icon: Icon,
  title,
  subtitle,
  tone = "indigo",
  actions,
  children,
  bodyClass = ""
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  tone?: Tone;
  actions?: React.ReactNode;
  children: React.ReactNode;
  bodyClass?: string;
}) {
  const accent = TONE[tone];
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-9 h-9 rounded-lg ${accent.soft} flex items-center justify-center flex-shrink-0`}>
            <Icon size={16} className={accent.text} />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
            {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
          </div>
        </div>
        {actions}
      </div>
      <div className={`p-5 sm:p-6 ${bodyClass}`}>{children}</div>
    </div>
  );
}

/* ── Profile header (avatar + photo upload + identity) ──────────────── */

export function ProfileHeader({
  name,
  role,
  designation,
  email,
  employeeId,
  profilePhoto,
  tone = "indigo",
  onPhoto
}: {
  name: string;
  role: Role;
  designation?: string | null;
  email?: string | null;
  employeeId?: string | null;
  profilePhoto: string | null;
  tone?: Tone;
  onPhoto: (file: File) => void;
}) {
  const accent = TONE[tone];
  const fileRef = useRef<HTMLInputElement>(null);
  const photo = profilePhoto && isValidPhotoUrl(profilePhoto) ? profilePhoto : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className={`h-1.5 bg-gradient-to-r ${accent.gradient}`} />
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-5 flex-wrap">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${accent.tile} shadow-lg ${accent.tileShadow} flex items-center justify-center overflow-hidden border-2 border-white`}>
              {photo
                ? <img src={photo} alt={name || "Profile"} className="w-full h-full object-cover" />
                : <span className="text-2xl font-bold text-white">{initials(name || ROLE_NAME[role])}</span>
              }
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              title="Change profile photo"
              className={`absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-xl ${accent.button} ${accent.hover} flex items-center justify-center shadow-md border-2 border-white transition`}>
              <Camera size={13} className="text-white" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) onPhoto(f);
                e.target.value = "";
              }}
            />
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em] truncate">{name || ROLE_NAME[role]}</h2>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${accent.chip}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />{ROLE_LABELS[role] || role}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{designation || ROLE_SUBTITLE[role]}</p>
            <div className="flex items-center gap-2.5 mt-1 flex-wrap">
              <p className="text-xs text-gray-400 flex items-center gap-1.5 min-w-0">
                <Mail size={11} className="flex-shrink-0" />
                <span className="truncate">{email || "—"}</span>
              </p>
              {employeeId && (
                <span className="text-[11px] font-mono text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-md">
                  ID: {employeeId}
                </span>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className={`text-xs ${accent.text} hover:underline mt-2 font-medium inline-flex items-center gap-1`}>
              <Camera size={11} /> Change profile photo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Personal Information (editable) ────────────────────────────────── */

export interface InfoField {
  label: string;
  key: string;
  icon: LucideIcon;
  full?: boolean;
}

const DEFAULT_INFO_FIELDS: InfoField[] = [
  { label: "Full Name", key: "name", icon: UserIcon },
  { label: "Email Address", key: "email", icon: Mail },
  { label: "Phone Number", key: "phone", icon: Phone },
  { label: "Address", key: "address", icon: MapPin, full: true },
];

export function EditableInfoCard({
  form,
  draft,
  editing,
  tone = "indigo",
  fields = DEFAULT_INFO_FIELDS,
  onEdit,
  onChange,
  onSave,
  onCancel
}: {
  form: Record<string, string>;
  draft: Record<string, string>;
  editing: boolean;
  tone?: Tone;
  fields?: InfoField[];
  onEdit: () => void;
  onChange: (key: string, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const accent = TONE[tone];
  return (
    <SectionCard
      icon={UserIcon}
      title="Personal Information"
      subtitle={editing ? "Editing profile details" : undefined}
      tone={tone}
      actions={
        editing ? (
          <div className="flex gap-2">
            <button
              onClick={onSave}
              className={`text-xs ${accent.button} ${accent.hover} text-white px-3.5 py-1.5 rounded-lg font-medium shadow-sm transition`}>
              Save Changes
            </button>
            <button
              onClick={onCancel}
              className="text-xs text-gray-500 px-3 py-1.5 font-medium flex items-center gap-1 hover:bg-gray-100 rounded-lg transition">
              <X size={11} /> Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={onEdit}
            className={`flex items-center gap-1.5 text-xs ${accent.text} hover:opacity-80 font-medium transition`}>
            <Pencil size={12} /> Edit
          </button>
        )
      }>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map(f => {
          const Icon = f.icon;
          return (
            <div key={f.key} className={f.full ? "sm:col-span-2" : ""}>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em] mb-1.5">{f.label}</p>
              {editing ? (
                <div className="relative">
                  <Icon size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${accent.text}`} />
                  <input
                    value={draft[f.key] ?? ""}
                    onChange={e => onChange(f.key, e.target.value)}
                    className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-3 bg-white border border-gray-200 ${accent.ring}`}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-lg ${accent.soft} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={16} className={accent.text} />
                  </div>
                  <p className="text-sm font-medium text-gray-800 truncate">{form[f.key] || "—"}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

/* ── Employment Information (Read-only) ─────────────────────────────── */

export function EmploymentInfoCard({
  employeeId,
  designation,
  dateHired,
  tone = "indigo"
}: {
  employeeId?: string | null;
  designation?: string | null;
  dateHired?: string | null;
  tone?: Tone;
}) {
  const accent = TONE[tone];
  const rows = [
    { label: "Employee ID", value: employeeId || "—", icon: BadgeCheck },
    { label: "Designation", value: designation || "—", icon: Briefcase },
    { label: "Date Hired", value: formatDate(dateHired), icon: Calendar },
    { label: "Years of Service", value: yearsOfService(dateHired), icon: Clock }
  ];
  return (
    <SectionCard icon={Briefcase} title="Employment Information" subtitle="Read-only" tone={tone}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows.map(r => {
          const Icon = r.icon;
          return (
            <div key={r.label} className="flex items-center gap-3 bg-gray-50/80 px-4 py-3 rounded-xl border border-gray-100">
              <div className={`w-9 h-9 rounded-lg ${accent.soft} flex items-center justify-center flex-shrink-0`}>
                <Icon size={16} className={accent.text} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">{r.label}</p>
                <p className="text-sm font-medium text-gray-800 truncate">{r.value}</p>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

/* ── Account & Security (Read-only + Change Password) ───────────────── */

export function AccountSecurityCard({
  username,
  role,
  status,
  lastLogin,
  createdAt,
  tone = "indigo",
  onChangePassword
}: {
  username: string;
  role: Role;
  status: string;
  lastLogin?: string | null;
  createdAt?: string | null;
  tone?: Tone;
  onChangePassword: () => void;
}) {
  const accent = TONE[tone];
  const statusMeta = STATUS_META[status] || STATUS_META.inactive;
  const rows = [
    { label: "Username", value: username, icon: UserIcon, mono: true },
    { label: "Last Login", value: relativeTime(lastLogin), icon: Clock },
    { label: "Member Since", value: formatDate(createdAt), icon: Calendar }
  ];

  const tile = (label: string, value: string, Icon: LucideIcon, mono?: boolean, chip?: React.ReactNode) => (
    <div className="flex items-center gap-3 bg-gray-50/80 px-4 py-3 rounded-xl border border-gray-100">
      <div className={`w-9 h-9 rounded-lg ${accent.soft} flex items-center justify-center flex-shrink-0`}>
        <Icon size={16} className={accent.text} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">{label}</p>
        {chip || <p className={`text-sm font-medium text-gray-800 truncate ${mono ? "font-mono" : ""}`}>{value}</p>}
      </div>
    </div>
  );

  return (
    <SectionCard
      icon={Lock}
      title="Account & Security"
      subtitle="Login details & password"
      tone={tone}
      actions={
        <button
          onClick={onChangePassword}
          className={`flex items-center gap-1.5 text-xs ${accent.text} hover:opacity-80 font-medium`}>
          <Lock size={12} /> Change Password
        </button>
      }>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows.map(r => tile(r.label, r.value || "—", r.icon, r.mono))}
        {tile("Role", ROLE_LABELS[role] || role, KeyRound, undefined,
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border mt-0.5 ${accent.chip}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />{ROLE_LABELS[role] || role}
          </span>
        )}
        {tile("Account Status", statusMeta.label, BadgeCheck, undefined,
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border mt-0.5 ${statusMeta.chip}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />{statusMeta.label}
          </span>
        )}
      </div>
    </SectionCard>
  );
}

/* ── Responsibilities / checklist card ──────────────────────────────── */

export function ChecklistCard({
  icon: Icon,
  title,
  subtitle,
  items,
  tone = "indigo"
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  items: string[];
  tone?: Tone;
}) {
  const accent = TONE[tone];
  return (
    <SectionCard icon={Icon} title={title} subtitle={subtitle} tone={tone}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map(item => (
          <div key={item} className="flex items-center gap-2.5 text-sm text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition">
            <CheckCircle size={14} className={`${accent.text} flex-shrink-0`} />{item}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

/* ── Change Password Modal ──────────────────────────────────────────── */

export function ChangePasswordModal({
  open,
  onClose,
  tone = "indigo"
}: {
  open: boolean;
  onClose: () => void;
  tone?: Tone;
}) {
  const { showToast } = useApp();
  const accent = TONE[tone];
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
    setSaving(false);
    setShow(false);
  };

  const handleSubmit = async () => {
    setError(null);
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New password and confirmation do not match.");
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword({ current_password: current, new_password: next });
      showToast("success", "Password updated successfully.");
      reset();
      onClose();
    } catch (err: any) {
      setError(err.detail?.error || err.message || "Failed to change password.");
    } finally {
      setSaving(false);
    }
  };

  const input = (v: string, set: (s: string) => void, placeholder: string, autoComplete: string) => (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={v}
        onChange={e => { set(e.target.value); if (error) setError(null); }}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`w-full pl-3 pr-10 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-3 border border-gray-200 bg-white ${accent.ring}`}
      />
      <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className={`px-6 py-5 bg-gradient-to-r ${accent.gradient} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Lock size={18} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">Change Password</h3>
              <p className="text-white/70 text-xs">Keep your account secure</p>
            </div>
          </div>
          <button onClick={() => { reset(); onClose(); }} className="p-2 hover:bg-white/10 rounded-lg text-white/80 transition">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Current Password</label>
            {input(current, setCurrent, "Enter current password", "current-password")}
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">New Password</label>
            {input(next, setNext, "Minimum 8 characters", "new-password")}
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Confirm New Password</label>
            {input(confirm, setConfirm, "Re-enter new password", "new-password")}
          </div>
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertCircle size={12} className="flex-shrink-0" />{error}
            </p>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-gray-50/50">
          <button
            onClick={() => { reset(); onClose(); }}
            className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className={`flex-1 ${accent.button} ${accent.hover} disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all flex items-center justify-center gap-2`}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Updating…" : "Update Password"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Profile photo persistence ──────────────────────────────────────── */

/** Resize an image file to a small thumbnail (keeps DB rows small) and
 *  persist it via /auth/me. Returns the stored data URL. */
export async function saveProfilePhoto(file: File): Promise<string> {
  const dataUrl = await resizeImage(file, 256);
  if (!isValidPhotoUrl(dataUrl)) {
    throw new Error("Image could not be processed. Please try a different photo.");
  }
  const me = await authApi.updateMe({ profile_photo_url: dataUrl });
  return me.profile_photo_url || dataUrl;
}

function resizeImage(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, size / Math.max(img.width, img.height));
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas is not supported.")); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("Failed to load image."));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}
