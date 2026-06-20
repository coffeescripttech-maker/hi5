import React, { useState, useEffect } from "react";
import { FileSpreadsheet, CheckCircle, Clock, Download, Search } from "lucide-react";
import { documentsApi, DocumentRow } from "../../services/documents";
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
  failed: <Clock size={11} />,
};

export function DocumentManagement() {
  const { showToast } = useApp();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterQuarter, setFilterQuarter] = useState<string>("All");

  useEffect(() => {
    documentsApi.list()
      .then(setDocuments)
      .catch(err => showToast("error", "Failed to load documents: " + (err.detail?.error || err.message)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = documents.filter(d => {
    const matchSearch = d.file_name.toLowerCase().includes(search.toLowerCase()) ||
      (d.section_name || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "All" || d.status === filterStatus;
    const matchQ = filterQuarter === "All" || (d.quarter && `Q${d.quarter}` === filterQuarter);
    return matchSearch && matchStatus && matchQ;
  });

  const statusCounts = (status: string) => documents.filter(d => d.status === status).length;

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-16 bg-gray-200 rounded-xl" />
        <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}</div>
        <div className="h-12 bg-gray-200 rounded-xl" />
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <FileSpreadsheet size={20} className="text-emerald-700" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800">Document Management</h2>
            <p className="text-gray-500 text-sm">View and track all your submitted grade files and their submission status</p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Validated", key: "validated", color: "border-green-100", text: "text-green-700" },
          { label: "Imported", key: "imported", color: "border-blue-100", text: "text-blue-700" },
          { label: "Pending", key: "pending", color: "border-amber-100", text: "text-amber-700" },
          { label: "Failed", key: "failed", color: "border-red-100", text: "text-red-700" },
        ].map(s => (
          <div key={s.key} className={`bg-white rounded-xl border ${s.color} p-4 shadow-sm`}>
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.text}`}>{statusCounts(s.key)}</p>
            <p className="text-xs text-gray-400 mt-0.5">grade file(s)</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by filename or section..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
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

      {/* Documents table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm">Grade Submission Records</h3>
          <span className="text-xs text-gray-400">{filtered.length} file(s)</span>
        </div>
        {documents.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">
            <FileSpreadsheet size={32} className="mx-auto mb-3 opacity-30" />
            <p>No grade documents uploaded yet.</p>
            <p className="text-xs mt-1">Upload grades from the Upload Grades page.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["File Name", "Section", "Quarter", "Records", "Uploaded By", "Date", "Status", "Action"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(doc => (
                  <tr key={doc.id} className="hover:bg-gray-50/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet size={14} className="text-emerald-500 flex-shrink-0" />
                        <span className="text-xs font-mono text-gray-700 truncate max-w-[180px]">{doc.file_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600 text-xs">{doc.section_name || "—"}</td>
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
                ))}
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
