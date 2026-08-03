import { useState, useEffect } from "react";
import {
  Users, Plus, Edit2, Trash2, X, Search, Shield,
  GraduationCap, FileText, CheckCircle, AlertTriangle,
  Key, Mail, User, Lock, Eye, EyeOff, Filter, Clock, Info
} from "lucide-react";
import { usersApi, UserRow, CreateUserPayload, UpdateUserPayload } from "../../services/users";
import { useApp } from "../../context/AppContext";

type UserRole = "admin" | "teacher" | "registrar" | "principal";
const ROLES: UserRole[] = ["admin", "teacher", "registrar", "principal"];

const PERMISSIONS: Record<string, string[]> = {
  admin: [
    "View & manage all user accounts",
    "Configure school settings & school year",
    "Set auto-sectioning thresholds",
    "View all activity logs",
    "Backup & restore database",
    "Manage enrollment periods",
  ],
  teacher: [
    "Enroll new & returning students",
    "Encode and upload grades",
    "View & manage class sections",
    "Run auto-sectioning process",
    "View own student roster",
  ],
  registrar: [
    "Search and view student records",
    "Generate SF1, SF5, SF9, and SF10",
    "View enrollment reports & analytics",
    "Monitor promotion records",
    "Monitor at-risk students",
  ],
  principal: [
    "View school-wide enrollment figures",
    "View grade submission progress",
    "View at-risk student classifications",
    "View promotion & retention statistics",
    "View section population data",
    "Read-only access to school data",
  ],
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin", teacher: "Teacher", registrar: "Registrar", principal: "Principal",
};

const roleIcons: Record<string, any> = {
  admin: Shield, teacher: GraduationCap, registrar: FileText, principal: User,
};

const roleBadge: Record<string, string> = {
  admin: "bg-blue-100 text-blue-800 border-blue-200",
  teacher: "bg-emerald-100 text-emerald-700 border-emerald-200",
  registrar: "bg-purple-100 text-purple-700 border-purple-200",
  principal: "bg-violet-100 text-violet-800 border-violet-200",
};

const STATUS_CLASS: Record<string, string> = {
  active: "bg-green-100 text-green-700 border-green-200",
  idle: "bg-amber-100 text-amber-700 border-amber-200",
  inactive: "bg-gray-100 text-gray-500 border-gray-200",
};

export function UserManagement() {
  const { showToast } = useApp();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [newUser, setNewUser] = useState<CreateUserPayload>({
    name: "", username: "", email: "", role: "teacher", password: "",
  });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [showPermissions, setShowPermissions] = useState<string | null>(null);

  const fetchUsers = () => {
    setLoading(true);
    usersApi.list()
      .then(setUsers)
      .catch(err => showToast("error", "Failed to load users: " + (err.detail?.error || err.message)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const openCreate = () => {
    setEditUser(null);
    setNewUser({ name: "", username: "", email: "", role: "teacher", password: "" });
    setPassword("");
    setShowModal(true);
  };

  const openEdit = (user: UserRow) => {
    setEditUser(user);
    setPassword("");
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (editUser) {
        const payload: UpdateUserPayload = {
          name: editUser.name,
          email: editUser.email,
          role: editUser.role,
          status: editUser.status,
        };
        await usersApi.update(editUser.id, payload);
        showToast("success", `User "${editUser.name}" updated successfully.`);
      } else {
        await usersApi.create({ ...newUser, password: password || "changeme123" });
        showToast("success", `User "${newUser.name}" created successfully.`);
      }
      setShowModal(false);
      setEditUser(null);
      fetchUsers();
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to save user");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await usersApi.delete(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      setShowDeleteConfirm(null);
      showToast("success", "User deleted successfully.");
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to delete user");
    }
  };

  const filteredUsers = users.filter(u => {
    const matchSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRole = filterRole === "all" || u.role === filterRole;
    const matchStatus = filterStatus === "all" || u.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  const currentRole = (editUser?.role || newUser.role) as UserRole;

  const formValue = (field: string): string => {
    if (editUser) return (editUser as any)[field] ?? "";
    return (newUser as any)[field] ?? "";
  };

  const handleChange = (field: string, value: string) => {
    if (editUser) setEditUser({ ...editUser, [field]: value });
    else setNewUser({ ...newUser, [field]: value });
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400" />
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-200 flex items-center justify-center flex-shrink-0">
                <Users size={22} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">User Account Management</h2>
                <p className="text-gray-500 text-sm">Create, edit, and manage system user accounts. Assign roles and control system access permissions.</p>
              </div>
            </div>
            <button onClick={openCreate}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all">
              <Plus size={15} /> Add New User
            </button>
          </div>

          {/* Role quick-links */}
          <div className="mt-5 grid grid-cols-4 gap-3">
            {ROLES.map(r => {
              const RoleIcon = roleIcons[r];
              return (
                <button key={r} onClick={() => setShowPermissions(showPermissions === r ? null : r)}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm transition-all ${
                    showPermissions === r
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm"
                      : "border-gray-100 bg-gray-50 text-gray-600 hover:border-indigo-200 hover:bg-indigo-50/50"
                  }`}>
                  <RoleIcon size={15} />
                  <span className="font-semibold">{ROLE_LABEL[r] || r}</span>
                  <span className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full border ${roleBadge[r]}`}>
                    {users.filter(u => u.role === r).length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Permissions expand */}
          {showPermissions && (
            <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
              <p className="text-[11px] font-semibold text-indigo-700 uppercase tracking-[0.06em] mb-2.5">{ROLE_LABEL[showPermissions] || showPermissions} Role Permissions</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                {PERMISSIONS[showPermissions]?.map(perm => (
                  <div key={perm} className="flex items-start gap-2 text-xs text-indigo-800">
                    <CheckCircle size={12} className="text-indigo-500 mt-0.5 flex-shrink-0" />{perm}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── FILTER BAR ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by name, username, or email..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400 bg-white" />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={13} className="text-gray-400" />
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.06em] mr-1">Role:</span>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-700 focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400 bg-white">
            <option value="all">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.06em] mr-1 ml-1">Status:</span>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-700 focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400 bg-white">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="idle">Idle</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <span className="text-xs text-gray-400 ml-auto">{filteredUsers.length} of {users.length} users</span>
      </div>

      {/* ── TABLE ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-14 text-center">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg className="animate-spin w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm font-medium">Loading users...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/80">
                  <tr>
                    {["User", "Username", "Role", "Status", "Last Login", "Actions"].map(h => (
                      <th key={h} className={`px-5 py-3.5 ${h === "Actions" ? "text-center" : "text-left"}`}>
                        <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">{h}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsers.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-14 text-center text-gray-400 text-sm">No users found.</td></tr>
                  ) : filteredUsers.map((user, idx) => {
                    const RoleIcon = roleIcons[user.role] || User;
                    return (
                      <tr key={user.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-indigo-50/50 transition-colors duration-150`}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-indigo-700 font-bold text-sm">{user.name.charAt(0)}</span>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800 text-sm">{user.name}</p>
                              <p className="text-gray-400 text-xs">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-gray-500 font-mono text-xs">{user.username}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${roleBadge[user.role] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
                            <RoleIcon size={11} />{ROLE_LABEL[user.role] || user.role}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {user.status !== "active" ? (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${STATUS_CLASS[user.status] || "bg-gray-100 text-gray-500 border-gray-200"}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${user.status === "idle" ? "bg-amber-500" : "bg-gray-400"}`} />
                              {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                            <Clock size={11} />
                            {user.last_login
                              ? new Date(user.last_login).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
                              : <span className="text-amber-500 font-medium">Never logged in</span>}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openEdit(user)}
                              className="p-1.5 rounded-lg text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => setShowDeleteConfirm(user.id)}
                              className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">Showing {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}</p>
              <div className="flex gap-3">
                <span className="text-xs text-gray-500">Total: <strong>{users.length}</strong></span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Delete Confirm Modal ── */}
      {showDeleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle size={22} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Delete User Account</h3>
                <p className="text-gray-500 text-xs">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              Are you sure you want to permanently delete the account for <strong>{users.find(u => u.id === showDeleteConfirm)?.name}</strong>?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all">Delete Account</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit User Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Users size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">{editUser ? "Edit User Account" : "Create New User"}</h3>
                  <p className="text-indigo-200 text-xs">{editUser ? "Update user info and role assignment" : "Set up a new system user"}</p>
                </div>
              </div>
              <button onClick={() => { setShowModal(false); setEditUser(null); }} className="p-2 hover:bg-white/10 rounded-lg text-white/80 transition">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Full Name</label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={formValue("name")} onChange={e => handleChange("name", e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400"
                    placeholder="e.g. Juan dela Cruz" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Username</label>
                  <div className="relative">
                    <Key size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" value={formValue("username")} onChange={e => handleChange("username", e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400 font-mono"
                      placeholder="e.g. teacher05" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="email" value={formValue("email")} onChange={e => handleChange("email", e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400"
                      placeholder="user@school.edu.ph" />
                  </div>
                </div>
              </div>

              {!editUser && (
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-400"
                      placeholder="Minimum 8 characters" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">Role Assignment</label>
                <div className="grid grid-cols-4 gap-2">
                  {ROLES.map(r => {
                    const RoleIcon = roleIcons[r];
                    const isSelected = formValue("role") === r;
                    return (
                      <button key={r} type="button" onClick={() => handleChange("role", r)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition text-xs font-semibold ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                            : "border-gray-200 bg-white text-gray-500 hover:border-indigo-200 hover:bg-indigo-50/50"
                        }`}>
                        <RoleIcon size={18} />{ROLE_LABEL[r]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <p className="text-[11px] font-semibold text-indigo-700 uppercase tracking-[0.04em] mb-2">{ROLE_LABEL[currentRole]} Permissions Preview</p>
                <ul className="space-y-1">
                  {PERMISSIONS[currentRole]?.map(p => (
                    <li key={p} className="flex items-start gap-2 text-xs text-indigo-700">
                      <CheckCircle size={11} className="text-indigo-500 mt-0.5 flex-shrink-0" />{p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-gray-50/50">
              <button onClick={() => { setShowModal(false); setEditUser(null); }}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleSave}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all">
                {editUser ? "Save Changes" : "Create User Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
