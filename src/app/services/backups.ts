/**
 * Backups API service
 */
import { api, getToken } from "./api";

export interface BackupRow {
  id: number;
  backup_type: "auto" | "manual";
  file_path: string;
  file_size: number | null;
  record_count: number | null;
  status: "success" | "failed" | "in_progress";
  initiated_by: number | null;
  initiated_by_name: string | null;
  created_at: string;
}

export const backupsApi = {
  list: () => api.get<BackupRow[]>("/backups"),
  create: () => api.post<BackupRow>("/backups"),
  restore: (id: number) => api.post<{ message: string; backup_id: number }>(`/backups/${id}/restore`),
  download: (id: number): void =>
    // Same-tab anchor navigation — can't be popup-blocked, and the server
    // returns Content-Disposition: attachment so the tab stays put and the
    // file is saved with the server-provided name.
    triggerNavigationDownload(`/backups/${id}/download`),
};

function triggerNavigationDownload(path: string): void {
  const token = getToken();
  const sp = new URLSearchParams();
  if (token) sp.set("token", token);
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
  const a = document.createElement("a");
  a.href = `${API_BASE}${path}?${sp.toString()}`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
