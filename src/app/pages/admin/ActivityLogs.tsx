import React from "react";
import { Activity, Clock, ChevronDown, ChevronUp, SearchX } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "../../components/ui/pagination";
import { logsApi, ActivityLogRow } from "../../services/logs";
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

export function ActivityLogs() {
  const [logs, setLogs] = React.useState<ActivityLogRow[]>([]);
  const [pagination, setPagination] = React.useState({
    page: 1,
    limit: 6,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = React.useState(1);
  const [expanded, setExpanded] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Collapsed shows the newest 6 (fast page load); Expand raises to 50 and
  // reveals the pagination controls below.
  const limit = expanded ? 50 : 6;

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    logsApi
      .listPage({ page, limit })
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
  }, [page, limit]);

  const toggleExpanded = () => {
    setPage(1);
    setExpanded(v => !v);
  };

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
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <Clock size={12} /> Showing {logs.length}
                {expanded ? " of " : " latest of "}
                {pagination.total} entries
              </p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">
                  Total: <strong>{pagination.total}</strong>
                </span>
                <button
                  onClick={toggleExpanded}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                >
                  {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {expanded ? "Show less" : "Show more"}
                </button>
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
                            No logs found.
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
                    No logs found.
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
            {expanded && pagination.totalPages > 1 && (
              <Pagination className="py-3">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={e => {
                        e.preventDefault();
                        setPage(p => Math.max(1, p - 1));
                      }}
                      {...(page === 1
                        ? { className: "pointer-events-none opacity-40" }
                        : {})}
                    />
                  </PaginationItem>
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter(
                      n =>
                        n === 1 ||
                        n === pagination.totalPages ||
                        Math.abs(n - page) <= 1
                    )
                    .map((n, i, arr) => (
                      <React.Fragment key={n}>
                        {i > 0 && n - arr[i - 1] > 1 && (
                          <PaginationItem>
                            <span className="px-1 text-gray-400">…</span>
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
                      {...(page === pagination.totalPages
                        ? { className: "pointer-events-none opacity-40" }
                        : {})}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </>
        )}
      </div>
    </div>
  );
}
