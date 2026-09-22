/**
 * Backups API service
 */
import { api } from "./api";

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
  download: (id: number) => {
    // Direct download via window.open (browser download; token passed as query).
    const token = localStorage.getItem("hi5_portal_token");
    const base = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
    window.open(`${base}/backups/${id}/download?token=${token}`, "_blank");
  },
};
