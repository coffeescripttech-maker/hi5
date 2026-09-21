import React from "react";
import {
  Activity,
  Clock,
  Search,
  SearchX,
  SlidersHorizontal,
  ToggleLeft,
  ToggleRight,
  History,
  CheckCircle,
} from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "../../components/ui/pagination";
import { logsApi, ActivityLogRow } from "../../services/logs";
import { settingsApi, ActivityLogRetentionSettings } from "../../services/settings";
import { useApp } from "../../context/AppContext";
import { HybridTable } from "../../components/HybridTable";

/** Map backend entity_type → readable label + badge styling. */
const CATEGORY_META: Record<string, { label: string; badge: string }> = {
  users: { label: "User", badge: "bg-blue-50 text-blue-700 border-blue-200" },
  students: { label: "Student", badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  enrollments: { label: "Enrollment", badge: "bg-violet-50 text-violet-700 border-violet-200" },
  grades: { label: "Grades", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  sections: { label: "Section", badge: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  section_types: { label: "Section Type", badge: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  subjects: { label: "Subject", badge: "bg-teal-50 text-teal-700 border-teal-200" },
  school_years: { label: "School Year", badge: "bg-orange-50 text-orange-700 border-orange-200" },
  settings: { label: "Settings", badge: "bg-slate-50 text-slate-700 border-slate-200" },
  backups: { label: "Backup", badge: "bg-rose-50 text-rose-700 border-rose-200" },
  security: { label: "Security", badge: "bg-red-50 text-red-700 border-red-200" },
  documents: { label: "Document", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  uploaded_documents: { label: "Document", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  schedules: { label: "Schedule", badge: "bg-pink-50 text-pink-700 border-pink-200" },
  notifications: { label: "Notification", badge: "bg-purple-50 text-purple-700 border-purple-200" },
  corrections: { label: "Correction", badge: "bg-rose-50 text-rose-700 border-rose-200" },
  promotions: { label: "Promotion", badge: "bg-green-50 text-green-700 border-green-200" },
  student_classifications: { label: "Classification", badge: "bg-sky-50 text-sky-700 border-sky-200" },
  strand_tracks: { label: "Strand / Track", badge: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
  rbac: { label: "Access Control", badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  at_risk: { label: "At-Risk", badge: "bg-amber-50 text-amber-700 border-amber-200" },
};

function categoryMeta(entityType: string | null): { label: string; badge: string } {
  const meta = CATEGORY_META[(entityType || "").toLowerCase()];
  if (meta) return meta;
  return { label: entityType || "System", badge: "bg-gray-50 text-gray-600 border-gray-200" };
}

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "created_at:desc", label: "Newest first" },
  { value: "created_at:asc", label: "Oldest first" },
  { value: "user_name:asc", label: "User (A–Z)" },
  { value: "entity_type:asc", label: "Category (A–Z)" },
  { value: "action:asc", label: "Action (A–Z)" },
];

const PAGE_SIZES = [10, 25, 50];

export function ActivityLogs() {
  const { showToast } = useApp();
  const [logs, setLogs] = React.useState<ActivityLogRow[]>([]);
  const [pagination, setPagination] = React.useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Filters
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [sort, setSort] = React.useState("created_at:desc");

  // Log retention / cleanup settings
  const [retentionLoading, setRetentionLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [retentionEnabled, setRetentionEnabled] = React.useState(true);
  const [retentionDays, setRetentionDays] = React.useState(90);
  const [lastCleanup, setLastCleanup] = React.useState<string | null>(null);

  const [sortBy, order] = React.useMemo(() => {
    const [sb, o] = sort.split(":");
    return [sb as "created_at" | "user_name" | "entity_type" | "action", (o || "desc") as "asc" | "desc"];
  }, [sort]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    logsApi
      .listPage({
        page,
        limit: pageSize,
        search: search.trim() || undefined,
        entity_type: category || undefined,
        sort_by: sortBy,
        order,
      })
      .then(res => {
        if (cancelled) return;
        setLogs(res.data);
        setPagination(res.pagination);
      })
      .catch(err => {
        if (!cancelled)
          setError(err.detail?.error || err.message || "Failed to load logs");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, search, category, sortBy, order]);

  // Load retention settings on mount
  React.useEffect(() => {
    let cancelled = false;
    settingsApi
      .getLogRetention()
      .then((s: ActivityLogRetentionSettings) => {
        if (cancelled) return;
        setRetentionEnabled(s.activity_log_cleanup_enabled === 1);
        setRetentionDays(s.activity_log_retention_days);
        setLastCleanup(s.last_activity_log_cleanup);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRetentionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset to page 1 whenever a filter changes
  const changeFilter = (updater: () => void) => {
    updater();
    setPage(1);
  };

  const handleSaveRetention = async () => {
    setSaving(true);
    try {
      const updated = await settingsApi.updateLogRetention({
        activity_log_cleanup_enabled: retentionEnabled ? 1 : 0,
        activity_log_retention_days: retentionDays,
      });
      setLastCleanup(updated.last_activity_log_cleanup);
      showToast("success", "Activity log retention settings saved.");
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to save retention settings");
    } finally {
      setSaving(false);
    }
  };

  const hasActiveFilters = search.trim() !== "" || category !== "";

  return (
    <div className="space-y-5 max-w-6xl mx-auto px-3 sm:px-0">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-400" />
        <div className="p-5 sm:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-200 flex items-center justify-center flex-shrink-0">
            <Activity size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">System Activity Logs</h2>
            <p className="text-gray-500 text-sm">Full audit trail of all user actions in the system</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => changeFilter(() => setSearch(e.target.value))}
              placeholder="Search by user or action..."
              className="w-full border border-gray-300 rounded-xl pl-9 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {search && (
              <button
                onClick={() => changeFilter(() => setSearch(""))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-gray-400" />
            <select
              value={category}
              onChange={e => changeFilter(() => setCategory(e.target.value))}
              className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">All categories</option>
              {Object.entries(CATEGORY_META)
                .sort(([, a], [, b]) => a.label.localeCompare(b.label))
                .map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
            </select>
            <select
              value={sort}
              onChange={e => changeFilter(() => setSort(e.target.value))}
              className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {hasActiveFilters && (
              <button
                onClick={() => changeFilter(() => {
                  setSearch("");
                  setCategory("");
                  setSort("created_at:desc");
                })}
                className="text-xs font-medium text-blue-700 border border-blue-200 bg-blue-50 rounded-lg px-3 py-2.5 hover:bg-blue-100 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-14 text-center">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
              <svg className="animate-spin w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm font-medium">Loading logs...</p>
          </div>
        ) : error ? (
          <div className="p-14 text-center">
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <Clock size={12} /> Showing{" "}
                {pagination.total === 0
                  ? "no entries"
                  : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, pagination.total)} of ${pagination.total}`}{" "}
                entries
              </p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">
                  Total: <strong>{pagination.total}</strong>
                </span>
                <label className="flex items-center gap-1.5 text-xs text-gray-500">
                  Per page
                  <select
                    value={pageSize}
                    onChange={e => changeFilter(() => setPageSize(Number(e.target.value)))}
                    className="border border-gray-300 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {PAGE_SIZES.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <HybridTable
              desktop={
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50/80">
                      <tr>
                        {["Timestamp", "User", "Category", "Action"].map(h => (
                          <th key={h} className="px-5 py-3.5 text-left">
                            <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">{h}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {logs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-5 py-14 text-center text-gray-400 text-sm">
                            <SearchX size={22} className="mx-auto mb-2 text-gray-300" />
                            No logs match your filters.
                          </td>
                        </tr>
                      ) : logs.map((log, idx) => {
                        const cat = categoryMeta(log.entity_type);
                        return (
                          <tr key={log.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-blue-50/50 transition-colors duration-150`}>
                            <td className="px-5 py-4 text-gray-400 text-xs font-mono whitespace-nowrap">
                              {new Date(log.created_at).toLocaleString("en-PH")}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                                  <span className="text-blue-600 font-bold text-xs">{(log.user_name || "S").charAt(0).toUpperCase()}</span>
                                </div>
                                <span className="text-gray-700 font-medium text-xs">{log.user_name || "System"}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border ${cat.badge}`}>
                                {cat.label}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-gray-600 text-xs">{log.action}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              }
              mobile={
                logs.length === 0 ? (
                  <div className="px-5 py-14 text-center text-gray-400 text-sm">
                    <SearchX size={22} className="mx-auto mb-2 text-gray-300" />
                    No logs match your filters.
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-50">
                    {logs.map(log => {
                      const cat = categoryMeta(log.entity_type);
                      return (
                        <li key={log.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                                <span className="text-blue-600 font-bold text-xs">{(log.user_name || "S").charAt(0).toUpperCase()}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-gray-700 font-medium text-xs truncate">{log.user_name || "System"}</p>
                                <p className="text-gray-400 text-[11px] font-mono">{new Date(log.created_at).toLocaleString("en-PH")}</p>
                              </div>
                            </div>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border flex-shrink-0 ${cat.badge}`}>
                              {cat.label}
                            </span>
                          </div>
                          <p className="text-gray-600 text-xs mt-2 leading-relaxed">{log.action}</p>
                        </li>
                      );
                    })}
                  </ul>
                )
              }
            />
            {pagination.totalPages > 1 && (
              <Pagination className="py-3">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={e => {
                        e.preventDefault();
                        setPage(p => Math.max(1, p - 1));
                      }}
                      {...(page === 1 ? { className: "pointer-events-none opacity-40" } : {})}
                    />
                  </PaginationItem>
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter(n => n === 1 || n === pagination.totalPages || Math.abs(n - page) <= 1)
                    .reduce<number[]>((acc, n) => {
                      if (!acc.includes(n)) acc.push(n);
                      return acc;
                    }, [])
                    .map((n, i, arr) => (
                      <React.Fragment key={n}>
                        {i > 0 && n - arr[i - 1] > 1 && (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            isActive={n === page}
                            onClick={e => {
                              e.preventDefault();
                              setPage(n);
                            }}
                          >
                            {n}
                          </PaginationLink>
                        </PaginationItem>
                      </React.Fragment>
                    ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={e => {
                        e.preventDefault();
                        setPage(p => Math.min(pagination.totalPages, p + 1));
                      }}
                      {...(page === pagination.totalPages ? { className: "pointer-events-none opacity-40" } : {})}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </>
        )}
      </div>

      {/* Log Retention & Cleanup */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <History size={18} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Log Retention &amp; Cleanup</h3>
              <p className="text-xs text-gray-500">Automatically delete activity logs older than a set period.</p>
            </div>
          </div>
          {!retentionLoading && (
            <button
              onClick={() => setRetentionEnabled(e => !e)}
              className={`flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition self-start ${
                retentionEnabled ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-100 text-gray-500 border border-gray-200"
              }`}
            >
              {retentionEnabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
              {retentionEnabled ? "Enabled" : "Disabled"}
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Keep logs for</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={7}
                max={3650}
                value={retentionDays}
                disabled={!retentionEnabled}
                onChange={e => setRetentionDays(Math.max(7, Math.min(3650, Number(e.target.value) || 7)))}
                className="w-28 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-400"
              />
              <span className="text-sm text-gray-600">days</span>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Logs older than this are permanently deleted, typically within 24 hours after the grace period expires. Min 7 days.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
            {retentionEnabled ? (
              <div className="flex items-center gap-2 border border-green-200 bg-green-50 rounded-xl px-3 py-2.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-green-700 font-medium">Automatic cleanup is active</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5">
                <span className="w-2 h-2 rounded-full bg-gray-400" />
                <span className="text-sm text-gray-500 font-medium">Automatic cleanup is paused</span>
              </div>
            )}
            {lastCleanup && (
              <p className="text-xs text-gray-400 mt-1.5">
                Last cleaned: {new Date(lastCleanup).toLocaleString("en-PH")}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleSaveRetention}
          disabled={saving}
          className="mt-4 flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50"
        >
          {saving ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
          ) : (
            <><CheckCircle size={14} /> Save Settings</>
          )}
        </button>
      </div>
    </div>
  );
}