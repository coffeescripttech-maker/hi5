import React, { useState, useEffect } from "react";
import { Database, Download, CheckCircle, Clock, AlertTriangle, RefreshCw, Shield, HardDrive, Archive } from "lucide-react";
import { backupsApi, BackupRow } from "../../services/backups";
import { useApp } from "../../context/AppContext";

export function DatabaseBackup() {
  const { showToast } = useApp();
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [backing, setBacking] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    backupsApi.list()
      .then(setBackups)
      .catch(err => showToast("error", "Failed to load backups: " + (err.detail?.error || err.message)))
      .finally(() => setLoading(false));
  }, []);

  const handleBackup = async () => {
    setBacking(true);
    setDone(false);
    setProgress(0);
    try {
      // Simulate progress while the API processes
      const interval = setInterval(() => {
        setProgress(p => {
          if (p >= 90) {
            clearInterval(interval);
            return 90;
          }
          return p + 10;
        });
      }, 300);

      await backupsApi.create();
      clearInterval(interval);
      setProgress(100);
      setBacking(false);
      setDone(true);
      showToast("success", "Backup completed successfully.");

      // Refresh backup list
      backupsApi.list().then(setBackups).catch(() => {});
    } catch (err: any) {
      setBacking(false);
      showToast("error", err.detail?.error || err.message || "Backup failed");
    }
  };

  const lastBackup = backups.length > 0 ? backups[0] : null;
  const totalSize = lastBackup?.file_size
    ? lastBackup.file_size >= 1024 * 1024
      ? (lastBackup.file_size / (1024 * 1024)).toFixed(1) + " MB"
      : (lastBackup.file_size / 1024).toFixed(1) + " KB"
    : "—";
  const successCount = backups.filter(b => b.status === "success").length;
  const lastBackupDate = lastBackup
    ? new Date(lastBackup.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
    : "—";

  if (loading) {
    return <div className="p-10 text-center text-gray-400 text-sm">Loading backup records...</div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Database size={20} className="text-blue-700" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800">Database Backup Management</h2>
            <p className="text-gray-500 text-sm">Manage and monitor backups of all Hi5 Portal student and academic records</p>
          </div>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1"><p className="text-xs text-gray-500">Last Backup</p><CheckCircle size={13} className="text-green-500" /></div>
          <p className="text-sm font-bold text-green-700">{lastBackupDate}</p>
          <p className="text-xs text-gray-400 mt-0.5">{lastBackup ? (lastBackup.backup_type === "auto" ? "Automatic" : "Manual") : "No backups yet"}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1"><p className="text-xs text-gray-500">Backup Size</p><HardDrive size={13} className="text-blue-500" /></div>
          <p className="text-sm font-bold text-blue-700">{totalSize}</p>
          <p className="text-xs text-gray-400 mt-0.5">{lastBackup?.record_count?.toLocaleString() || "—"} records</p>
        </div>
        <div className="bg-white rounded-xl border border-indigo-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1"><p className="text-xs text-gray-500">Total Backups</p><Archive size={13} className="text-indigo-500" /></div>
          <p className="text-sm font-bold text-indigo-700">{backups.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">{successCount} successful</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1"><p className="text-xs text-gray-500">Auto Backup</p><Clock size={13} className="text-amber-500" /></div>
          <p className="text-sm font-bold text-amber-700">Daily</p>
          <p className="text-xs text-gray-400 mt-0.5">02:00 AM · Scheduled</p>
        </div>
      </div>

      {/* Manual Backup */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-1">Manual Backup</h3>
        <p className="text-xs text-gray-500 mb-4">Creates an immediate full backup of all student records, academic data, and system configurations. Recommended before major changes such as bulk promotion or school year archiving.</p>

        {!backing && !done && (
          <button onClick={handleBackup}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
            <Database size={15} /> Backup Now
          </button>
        )}

        {backing && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-blue-700 text-sm font-medium">
              <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-700 rounded-full animate-spin flex-shrink-0" />
              Backing up database... {progress}%
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-gray-400">Do not close the browser while backup is in progress.</p>
          </div>
        )}

        {done && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm font-semibold">
              <CheckCircle size={16} /> Backup completed successfully
            </div>
            <button onClick={() => { setDone(false); setProgress(0); }}
              className="flex items-center gap-2 text-xs text-gray-600 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition">
              <RefreshCw size={11} /> Run Another Backup
            </button>
          </div>
        )}
      </div>

      {/* Backup Settings */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Automatic Backup Schedule</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Backup Frequency</label>
            <select className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option>Daily (Recommended)</option>
              <option>Every 12 Hours</option>
              <option>Weekly</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Backup Time</label>
            <input type="time" defaultValue="02:00"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Retention Period</label>
            <select className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option>Keep last 30 backups</option>
              <option>Keep last 7 backups</option>
              <option>Keep all backups</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
            <div className="flex items-center gap-2 border border-green-200 bg-green-50 rounded-xl px-3 py-2.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-green-700 font-medium">Automatic backups are enabled</span>
            </div>
          </div>
        </div>
        <button className="mt-4 flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
          <CheckCircle size={14} /> Save Schedule
        </button>
      </div>

      {/* Backup History */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Backup History</h3>
          <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">{backups.length} records</span>
        </div>
        {backups.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Database size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No backup records yet.</p>
            <p className="text-xs mt-1">Run a manual backup to create the first record.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Backup ID", "Date", "Type", "Size", "Records", "Status", "Action"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {backups.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50/60">
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">#{b.id}</td>
                    <td className="px-5 py-3 text-gray-700 text-sm">
                      {new Date(b.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.backup_type === "manual" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                        {b.backup_type === "manual" ? "Manual" : "Automatic"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600 text-xs">
                      {b.file_size
                        ? b.file_size >= 1024 * 1024
                          ? (b.file_size / (1024 * 1024)).toFixed(1) + " MB"
                          : (b.file_size / 1024).toFixed(1) + " KB"
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-600 text-xs">{b.record_count?.toLocaleString() || "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${b.status === "success" ? "bg-green-100 text-green-700" : b.status === "failed" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {b.status === "success" ? "Success" : b.status === "failed" ? "Failed" : "In Progress"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {b.status === "success" && (
                        <button className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
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
      </div>

      {/* Compliance notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <Shield size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Data Privacy Act of 2012 (RA 10173) Compliance:</strong> All database backups contain personal student information and must be stored securely. Backup files must not be shared with unauthorized personnel and must be deleted in accordance with the institution's data retention policy and NPC guidelines.
        </p>
      </div>
    </div>
  );
}
