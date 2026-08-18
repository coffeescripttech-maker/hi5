import React, { useState, useEffect, useCallback } from "react";
import {
  MessageSquare, RefreshCw, CheckCircle2, XCircle, Clock,
  Loader2, ShieldCheck, Search, CalendarDays, BookOpen, AlertTriangle
} from "lucide-react";
import { gradesApi, CorrectionRequestRow } from "../../services/grades";
import { useApp } from "../../context/AppContext";

type StatusFilter = "all" | "pending" | "approved" | "rejected";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-600 border-red-200",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const QUARTER_LABEL: Record<number, string> = {
  1: "1st Quarter",
  2: "2nd Quarter",
  3: "3rd Quarter",
  4: "4th Quarter",
};

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export function GradeCorrections() {
  const { showToast } = useApp();
  const [requests, setRequests] = useState<CorrectionRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [search, setSearch] = useState("");
  const [confirming, setConfirming] = useState<{ id: number; action: "approved" | "rejected" } | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gradesApi.listCorrections();
      setRequests(data);
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to load correction requests");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const counts: Record<StatusFilter, number> = {
    all: requests.length,
    pending: requests.filter(r => r.status === "pending").length,
    approved: requests.filter(r => r.status === "approved").length,
    rejected: requests.filter(r => r.status === "rejected").length,
  };

  const filtered = requests.filter(r => {
    if (filter !== "all" && r.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.student_name?.toLowerCase().includes(q) ||
        r.subject_name?.toLowerCase().includes(q) ||
        r.requested_by_name?.toLowerCase().includes(q) ||
        r.justification?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const confirmingRow = confirming ? requests.find(r => r.id === confirming.id) : null;

  const handleReview = async () => {
    if (!confirming) return;
    setActingId(confirming.id);
    try {
      await gradesApi.reviewCorrection(confirming.id, confirming.action);
      showToast(
        "success",
        confirming.action === "approved"
          ? "Request approved — the affected grade row(s) are unlocked for the teacher."
          : "Request rejected."
      );
      setConfirming(null);
      load();
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to review request");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5 px-3 sm:px-0">
      {/* ── Header ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-500" />
        <div className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center shadow-sm">
                <MessageSquare size={22} className="text-indigo-700" />
              </div>
              <div>
                <h1 className="text-xl text-gray-900">Grade Corrections</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Review teacher requests to unlock and correct locked grades.
                </p>
              </div>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          {/* Info banner */}
          <div className="mt-5 flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <ShieldCheck size={16} className="text-blue-700 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-800 leading-relaxed">
              <span className="font-semibold">Approving</span> unlocks this student's grades for the school
              year so the teacher can re-enter and re-save the corrected values. <span className="font-semibold">Rejecting</span>
              keeps the grades locked.
            </p>
          </div>

          {/* Filter tabs */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                  filter === f.key
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f.label}
                <span className={`ml-1.5 ${filter === f.key ? "text-indigo-200" : "text-gray-400"}`}>
                  {counts[f.key]}
                </span>
              </button>
            ))}
            <div className="flex-1" />
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search student, subject, teacher..."
                className="pl-9 pr-3 py-2 w-64 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Requests table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-indigo-50/70 border-b border-indigo-100">
                <th className="text-left px-5 py-3.5 text-indigo-800 font-semibold text-xs uppercase tracking-wider">Student</th>
                <th className="text-left px-4 py-3.5 text-indigo-800 font-semibold text-xs uppercase tracking-wider">Subject</th>
                <th className="text-left px-4 py-3.5 text-indigo-800 font-semibold text-xs uppercase tracking-wider">Quarter</th>
                <th className="text-left px-4 py-3.5 text-indigo-800 font-semibold text-xs uppercase tracking-wider">Justification</th>
                <th className="text-left px-4 py-3.5 text-indigo-800 font-semibold text-xs uppercase tracking-wider">Requested By</th>
                <th className="text-left px-4 py-3.5 text-indigo-800 font-semibold text-xs uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3.5 text-indigo-800 font-semibold text-xs uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center text-gray-400 text-sm">
                    <Loader2 size={18} className="animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading correction requests...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center text-gray-400 text-sm">
                    <MessageSquare size={22} className="mx-auto mb-2 text-gray-300" />
                    No {filter !== "all" ? STATUS_LABEL[filter].toLowerCase() : ""} correction requests found.
                  </td>
                </tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="hover:bg-indigo-50/20 transition align-top">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-gray-900">{r.student_name}</div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                      <CalendarDays size={11} />
                      {r.sy_label || "SY —"}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1.5 text-gray-700">
                      <BookOpen size={12} className="text-indigo-500" />
                      {r.subject_name || "All subjects"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-gray-600">
                    {r.quarter ? QUARTER_LABEL[r.quarter] : <span className="text-gray-400">All quarters</span>}
                  </td>
                  <td className="px-4 py-4 text-gray-600 max-w-[240px]">
                    <p className="line-clamp-2 text-xs leading-relaxed">{r.justification}</p>
                  </td>
                  <td className="px-4 py-4 text-gray-600">{r.requested_by_name}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${STATUS_STYLES[r.status]}`}>
                      {r.status === "pending" ? <Clock size={11} /> : r.status === "approved" ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                      {STATUS_LABEL[r.status]}
                    </span>
                    {r.reviewed_at && (
                      <div className="text-[11px] text-gray-400 mt-1">
                        {new Date(r.reviewed_at).toLocaleString("en-PH")}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    {r.status === "pending" ? (
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => setConfirming({ id: r.id, action: "approved" })}
                          disabled={actingId !== null}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition disabled:opacity-50"
                        >
                          <CheckCircle2 size={13} /> Approve
                        </button>
                        <button
                          onClick={() => setConfirming({ id: r.id, action: "rejected" })}
                          disabled={actingId !== null}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs font-semibold hover:bg-red-100 transition disabled:opacity-50"
                        >
                          <XCircle size={13} /> Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">
                        {r.reviewed_by_name ? `by ${r.reviewed_by_name}` : "—"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Confirm modal ── */}
      {confirming && confirmingRow && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                confirming.action === "approved" ? "bg-emerald-100" : "bg-red-100"
              }`}>
                {confirming.action === "approved"
                  ? <CheckCircle2 size={18} className="text-emerald-700" />
                  : <XCircle size={18} className="text-red-600" />}
              </div>
              <div>
                <h3 className="font-bold text-gray-900">
                  {confirming.action === "approved" ? "Approve Correction Request" : "Reject Correction Request"}
                </h3>
                <p className="text-xs text-gray-400">Request #{confirmingRow.id}</p>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Student</span>
                <span className="font-semibold text-gray-900">{confirmingRow.student_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subject</span>
                <span className="font-semibold text-gray-900">{confirmingRow.subject_name || "All subjects"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Quarter</span>
                <span className="font-semibold text-gray-900">
                  {confirmingRow.quarter ? QUARTER_LABEL[confirmingRow.quarter] : "All quarters"}
                </span>
              </div>
            </div>

            {confirming.action === "approved" ? (
              <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 mb-4">
                <AlertTriangle size={15} className="text-emerald-700 mt-0.5 shrink-0" />
                <p className="text-xs text-emerald-800 leading-relaxed">
                  This will <span className="font-semibold">unlock this student's grades for the school year</span>
                  so the teacher can re-enter the corrected values and re-save. Make sure the justification is valid.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4">
                <AlertTriangle size={15} className="text-red-600 mt-0.5 shrink-0" />
                <p className="text-xs text-red-700 leading-relaxed">
                  The grades stay locked and the teacher's request is marked as rejected.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(null)}
                disabled={actingId !== null}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReview}
                disabled={actingId !== null}
                className={`flex-1 text-white py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50 inline-flex items-center justify-center gap-2 ${
                  confirming.action === "approved"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                    : "bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600"
                }`}
              >
                {actingId === confirmingRow.id ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Processing...
                  </>
                ) : confirming.action === "approved" ? (
                  <>
                    <CheckCircle2 size={14} /> Confirm Approve
                  </>
                ) : (
                  <>
                    <XCircle size={14} /> Confirm Reject
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
