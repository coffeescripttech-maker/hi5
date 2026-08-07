import { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Lock,
  Search,
  RotateCcw,
  Check,
  X,
  Loader2
} from 'lucide-react';
import { NAV_BY_ROLE, CORE_KEYS, ROLE_LABELS, type Role } from '../../navigation';
import { rbacApi } from '../../services/rbac';
import { useApp } from '../../context/AppContext';

const CONFIGURABLE_ROLES: Role[] = ['teacher', 'registrar', 'principal'];

type EnabledMap = Record<string, boolean>;

interface MatrixRow {
  role: Role;
  permissions: EnabledMap;
}

const ROLE_ACCENT: Record<Role, { dot: string; text: string; chip: string }> = {
  teacher: { dot: 'bg-emerald-500', text: 'text-emerald-700', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  registrar: { dot: 'bg-indigo-500', text: 'text-indigo-700', chip: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  principal: { dot: 'bg-purple-500', text: 'text-purple-700', chip: 'bg-purple-50 text-purple-700 border-purple-200' },
  admin: { dot: 'bg-blue-500', text: 'text-blue-700', chip: 'bg-blue-50 text-blue-700 border-blue-200' }
};

function Toggle({
  checked,
  locked,
  saving,
  onToggle
}: {
  checked: boolean;
  locked?: boolean;
  saving?: boolean;
  onToggle: (next: boolean) => void;
}) {
  const disabled = !!locked || !!saving;
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onToggle(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${
        checked ? 'bg-emerald-500' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      {saving ? (
        <Loader2 size={11} className="mx-auto text-white animate-spin" />
      ) : (
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      )}
    </button>
  );
}

export function RoleAccessControl() {
  const { showToast } = useApp();
  const [matrix, setMatrix] = useState<Record<Role, EnabledMap> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [resetting, setResetting] = useState<Role | null>(null);

  useEffect(() => {
    let cancelled = false;
    rbacApi
      .matrix()
      .then(res => {
        if (cancelled) return;
        const map = {} as Record<Role, EnabledMap>;
        for (const row of res.roles) {
          map[row.role] = row.permissions;
        }
        setMatrix(map);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(err?.detail?.error || err?.message || 'Failed to load role permissions.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const searchTerm = search.trim().toLowerCase();

  const allKeysOf = (role: Role) =>
    NAV_BY_ROLE[role].flatMap(g => g.items).map(i => i.key);

  const isVisible = (role: Role, label: string, path: string) => {
    if (!searchTerm) return true;
    return (
      label.toLowerCase().includes(searchTerm) ||
      path.toLowerCase().includes(searchTerm)
    );
  };

  const handleToggle = (role: Role, key: string, next: boolean) => {
    if (CORE_KEYS[role].includes(key)) return;
    const label = NAV_BY_ROLE[role]
      .flatMap(g => g.items)
      .find(i => i.key === key)?.label || key;

    // Optimistic update
    setMatrix(prev =>
      prev
        ? {
            ...prev,
            [role]: { ...prev[role], [key]: next }
          }
        : prev
    );
    setSavingKeys(s => new Set(s).add(`${role}:${key}`));

    rbacApi
      .setPermission(role, key, next)
      .then(() =>
        showToast(
          'success',
          `${ROLE_LABELS[role]} ${next ? 'can now access' : 'can no longer access'} ${label}.`
        )
      )
      .catch(err => {
        // Revert optimistic change
        setMatrix(prev =>
          prev
            ? {
                ...prev,
                [role]: { ...prev[role], [key]: !next }
              }
            : prev
        );
        showToast('error', err.detail?.error || 'Failed to update permission.');
      })
      .finally(() =>
        setSavingKeys(s => {
          const n = new Set(s);
          n.delete(`${role}:${key}`);
          return n;
        })
      );
  };

  const handleSetAll = async (role: Role, value: boolean) => {
    const keys = allKeysOf(role).filter(k => !CORE_KEYS[role].includes(k));
    const label = ROLE_LABELS[role];
    setMatrix(prev =>
      prev
        ? {
            ...prev,
            [role]: Object.fromEntries(
              allKeysOf(role).map(k => [k, CORE_KEYS[role].includes(k) ? true : value])
            )
          }
        : prev
    );
    const results = await Promise.allSettled(
      keys.map(k => rbacApi.setPermission(role, k, value))
    );
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) {
      showToast(
        'error',
        `${failed} update(s) failed for ${label}. Please try again.`
      );
      // Reload to restore a consistent state
      rbacApi.matrix().then(res => {
        const map = {} as Record<Role, EnabledMap>;
        for (const row of res.roles) map[row.role] = row.permissions;
        setMatrix(map);
      });
    } else {
      showToast(
        'success',
        `${label} ${value ? 'can now access' : 'can no longer access'} all modules.`
      );
    }
  };

  const handleReset = async (role: Role) => {
    setResetting(role);
    try {
      await rbacApi.resetRole(role);
      setMatrix(prev =>
        prev
          ? {
              ...prev,
              [role]: Object.fromEntries(allKeysOf(role).map(k => [k, true]))
            }
          : prev
      );
      showToast('success', `${ROLE_LABELS[role]} reset to default permissions.`);
    } catch (err: any) {
      showToast('error', err.detail?.error || 'Failed to reset permissions.');
    } finally {
      setResetting(null);
    }
  };

  const enabledCount = (role: Role) => {
    const map = matrix?.[role];
    if (!map) return 0;
    return allKeysOf(role).filter(k => map[k]).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-gray-400 text-sm">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading role permissions…
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-600 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center text-white shadow-sm">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Role-Based Access Control</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Configure which modules each role may access. Changes apply on the
              user's next page load.
            </p>
          </div>
        </div>

        {/* RA10173 banner */}
        <div className="mt-5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex gap-3">
          <span className="text-blue-700 shrink-0 mt-0.5">
            <ShieldCheck size={18} />
          </span>
          <div className="text-blue-900 text-sm">
            <p className="font-semibold">
              Data Privacy Act of 2012 (RA 10173) — Least-Privilege Access
            </p>
            <p className="text-blue-800/80 text-xs mt-0.5 leading-relaxed">
              Restrict each role to the functions and data relevant to its
              institutional responsibilities. Server-side API access remains
              protected by role-based authorization for every endpoint.
            </p>
          </div>
        </div>

        {/* Admin locked note */}
        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center text-white shrink-0">
            <Lock size={15} />
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-800">
              Administrator (ICT Coordinator) — full access
            </span>
            <span className="text-gray-500">
              {' '}always enabled. The ICT Coordinator governs all system
              functions and can never be locked out of the control panel.
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-5 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search modules… (e.g. Grades, At-Risk)"
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
      </div>

      {/* ── Role columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {CONFIGURABLE_ROLES.map(role => {
          const accent = ROLE_ACCENT[role];
          const total = allKeysOf(role).length;
          const enabled = enabledCount(role);
          return (
            <div
              key={role}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Column header */}
              <div className="px-5 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${accent.dot}`} />
                    <h3 className={`font-bold ${accent.text}`}>{ROLE_LABELS[role]}</h3>
                  </div>
                  <span className="text-xs text-gray-400 font-medium">
                    {enabled}/{total} enabled
                  </span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${accent.dot}`}
                    style={{ width: `${total ? (enabled / total) * 100 : 0}%` }}
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleSetAll(role, true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-medium transition-colors border border-emerald-200">
                    <Check size={13} /> Enable all
                  </button>
                  <button
                    onClick={() => handleSetAll(role, false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium transition-colors border border-red-200">
                    <X size={13} /> Disable all
                  </button>
                  <button
                    onClick={() => handleReset(role)}
                    disabled={resetting === role}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-medium transition-colors border border-gray-200 disabled:opacity-50">
                    {resetting === role ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <RotateCcw size={13} />
                    )}
                    Reset
                  </button>
                </div>
              </div>

              {/* Checklist */}
              <div className="divide-y divide-gray-50 max-h-[560px] overflow-y-auto">
                {NAV_BY_ROLE[role].map(group => {
                  const visible = group.items.filter(item =>
                    isVisible(role, item.label, item.path)
                  );
                  if (visible.length === 0) return null;
                  const Icon = group.items[0].icon;
                  return (
                    <div key={group.group} className="px-5 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                        {group.group}
                      </p>
                      <div className="space-y-2">
                        {visible.map(item => {
                          const locked = CORE_KEYS[role].includes(item.key);
                          const checked = matrix?.[role]?.[item.key] ?? true;
                          const saving = savingKeys.has(`${role}:${item.key}`);
                          return (
                            <div
                              key={item.key}
                              className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-50 transition-colors">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Icon size={15} className="text-gray-400 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm text-gray-700 truncate">{item.label}</p>
                                  <p className="text-[11px] text-gray-400 truncate font-mono">
                                    {item.path}
                                  </p>
                                </div>
                              </div>
                              {locked ? (
                                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${accent.chip}`}>
                                  <Lock size={10} /> Required
                                </span>
                              ) : (
                                <Toggle
                                  checked={checked}
                                  saving={saving}
                                  onToggle={next => handleToggle(role, item.key, next)}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {!NAV_BY_ROLE[role].some(group =>
                  group.items.some(item => isVisible(role, item.label, item.path))
                ) && (
                  <div className="px-5 py-8 text-center text-sm text-gray-400">
                    No modules match "{search}".
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
