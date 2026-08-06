import React, { useState, useEffect } from "react";
import { FileSpreadsheet, CheckCircle, Clock, Download, Search, FileText, Filter, RefreshCw, AlertTriangle, Inbox } from "lucide-react";
import { documentsApi, DocumentRow } from "../../services/documents";
import { subjectsApi, SubjectRow } from "../../services/subjects";
import { useApp } from "../../context/AppContext";

const STATUS_STYLE: Record<string, string> = {
  validated: "bg-green-100 text-green-700 border-green-200",
  imported: "bg-blue-100 text-blue-700 border-blue-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  failed: "bg-red-100 text-red-700 border-red-200",
};

const STATUS_LABEL: Record<string, string> = {
  validated: "Validated",
  imported: "Imported",
  pending: "Pending",
  failed: "Failed",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  validated: <CheckCircle size={11} />,
  imported: <CheckCircle size={11} />,
  pending: <Clock size={11} />,
  failed: <AlertTriangle size={11} />,
};

// Card accent colors per status (used when the card is active)
const STATUS_CARD: Record<string, { chip: string; ring: string; text: string }> = {
  validated: { chip: "border-green-200 bg-green-50", ring: "ring-2 ring-green-400", text: "text-green-700" },
  imported: { chip: "border-blue-200 bg-blue-50", ring: "ring-2 ring-blue-400", text: "text-blue-700" },
  pending: { chip: "border-amber-200 bg-amber-50", ring: "ring-2 ring-amber-400", text: "text-amber-700" },
  failed: { chip: "border-red-200 bg-red-50", ring: "ring-2 ring-red-400", text: "text-red-700" },
};

function fileTypeBadge(ext: string): { label: string; cls: string; icon: React.ReactNode } {
  const t = ext.toLowerCase();
  if (t === "xlsx" || t === "xls") return { label: t.toUpperCase(), cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <FileSpreadsheet size={11} /> };
  if (t === "pdf") return { label: "PDF", cls: "bg-red-50 text-red-600 border-red-200", icon: <FileText size={11} /> };
  if (t === "docx") return { label: "DOCX", cls: "bg-blue-50 text-blue-700 border-blue-200", icon: <FileText size={11} /> };
  return { label: t.toUpperCase(), cls: "bg-gray-50 text-gray-600 border-gray-200", icon: <FileText size={11} /> };
}

export function DocumentManagement() {
  const { showToast } = useApp();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterQuarter, setFilterQuarter] = useState<string>("All");
  const [filterSubject, setFilterSubject] = useState<string>("All");

  const load = () => {
    setRefreshing(true);
    documentsApi.list()
      .then(setDocuments)
      .catch(err => showToast("error", "Failed to load documents: " + (err.detail?.error || err.message)))
      .finally(() => { setLoading(false); setRefreshing(false); });
  };

  useEffect(() => {
    load();
    subjectsApi.list()
      .then(setSubjects)
      .catch(() => { /* subject filter is optional — ignore failures */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleStatus = (status: string) => {
    setFilterStatus(prev => prev === status ? "All" : status);
  };

  const filtered = documents.filter(d => {
    const matchSearch = d.file_name.toLowerCase().includes(search.toLowerCase()) ||
      (d.section_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.subject_name || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "All" || d.status === filterStatus;
    const matchQ = filterQuarter === "All" || (d.quarter && `Q${d.quarter}` === filterQuarter);
    const matchSubject = filterSubject === "All" || d.subject_id === Number(filterSubject);
    return matchSearch && matchStatus && matchQ && matchSubject;
  });

  const statusCounts = (status: string) => documents.filter(d => d.status === status).length;

  const hasActiveFilters = search !== "" || filterStatus !== "All" || filterQuarter !== "All" || filterSubject !== "All";

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-16 bg-gray-200 rounded-xl" />
        <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}</div>
        <div className="h-12 bg-gray-200 rounded-xl" />
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <FileSpreadsheet size={20} className="text-emerald-700" />
            </div>
            <div>
              <h2 className="font-bold text-gray-800">Document Management</h2>
              <p className="text-gray-500 text-sm">View and track all your submitted grade files and their submission status</p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={refreshing}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary cards — click to filter */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Validated", key: "validated" },
          { label: "Imported", key: "imported" },
          { label: "Pending", key: "pending" },
          { label: "Failed", key: "failed" },
        ].map(s => {
          const active = filterStatus === s.key;
          const card = STATUS_CARD[s.key];
          return (
            <button
              key={s.key}
              onClick={() => toggleStatus(s.key)}
              className={`bg-white rounded-xl border p-4 shadow-sm text-left transition ${active ? card.ring : "border-gray-200 hover:border-gray-300"} ${active ? card.chip : ""}`}
            >
              <p className="text-xs text-gray-500 mb-1">{s.label}{active && " ✓"}</p>
              <p className={`text-2xl font-bold ${card.text}`}>{statusCounts(s.key)}</p>
              <p className="text-xs text-gray-400 mt-0.5">grade file(s)</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by filename, section, or subject..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-gray-400" />
          <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
            <option value="All">All Subjects</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
            <option value="All">All Status</option>
            <option value="validated">Validated</option>
            <option value="imported">Imported</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <select value={filterQuarter} onChange={e => setFilterQuarter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
            <option value="All">All Quarters</option>
            <option>Q1</option>
            <option>Q2</option>
            <option>Q3</option>
            <option>Q4</option>
          </select>
        </div>
      </div>

      {/* Documents table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm">Grade Submission Records</h3>
          <span className="text-xs text-gray-400">
            {filtered.length} of {documents.length} file(s)
            {hasActiveFilters && (
              <button onClick={() => { setSearch(""); setFilterStatus("All"); setFilterQuarter("All"); setFilterSubject("All"); }}
                className="ml-2 text-emerald-600 hover:underline">Clear filters</button>
            )}
          </span>
        </div>
        {documents.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">
            <Inbox size={32} className="mx-auto mb-3 opacity-30" />
            <p>No grade documents uploaded yet.</p>
            <p className="text-xs mt-1">Upload grades from the Upload Grades page.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">
            <Search size={32} className="mx-auto mb-3 opacity-30" />
            <p>No documents match your filters.</p>
            <button onClick={() => { setSearch(""); setFilterStatus("All"); setFilterQuarter("All"); setFilterSubject("All"); }}
              className="text-emerald-600 hover:underline text-xs mt-2">Clear all filters</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["File Name", "Section", "Subject", "Quarter", "Records", "Uploaded By", "Date", "Status", "Action"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(doc => {
                  const badge = fileTypeBadge(doc.file_type);
                  return (
                    <tr key={doc.id} className="hover:bg-gray-50/60">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold ${badge.cls}`}>{badge.icon}{badge.label}</span>
                          <span className="text-xs font-mono text-gray-700 truncate max-w-[160px]" title={doc.file_name}>{doc.file_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-600 text-xs">{doc.section_name || "—"}</td>
                      <td className="px-5 py-3">
                        <span className="bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded font-medium">
                          {doc.subject_name || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded font-medium">
                          {doc.quarter ? `Q${doc.quarter}` : "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600 text-xs">{doc.record_count ?? "—"}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{doc.uploaded_by_name}</td>
                      <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(doc.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLE[doc.status] || STATUS_STYLE.pending}`}>
                          {STATUS_ICON[doc.status]}{STATUS_LABEL[doc.status] || doc.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {doc.status !== "pending" && doc.status !== "failed" && (
                          <button onClick={() => documentsApi.download(doc.id)}
                            className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 hover:underline">
                            <Download size={11} /> Download
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            <strong className="text-green-600">Validated</strong> — file uploaded and format validated. &nbsp;
            <strong className="text-blue-600">Imported</strong> — grades have been processed. &nbsp;
            <strong className="text-amber-600">Pending</strong> — awaiting processing. &nbsp;
            <strong className="text-red-600">Failed</strong> — validation or import error.
          </p>
        </div>
      </div>
    </div>
  );
}
