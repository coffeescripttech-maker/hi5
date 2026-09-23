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
  download: async (id: number): Promise<void> => {
    // Fetch as a blob (Authorization header) and trigger a save — avoids
    // popup blockers and the blank-tab behavior of window.open.
    const response = await api.getBlob(`/backups/${id}/download`);
    if (!response.ok) {
      let message = `Download failed (${response.status})`;
      try {
        const body = await response.json();
        if (body?.error) message = body.error;
      } catch {
        /* not JSON */
      }
      throw new Error(message);
    }
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?(.+?)"?$/);
    const filename = match ? match[1] : `backup-${id}.sql`;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  },
};
