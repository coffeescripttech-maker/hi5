/**
 * Backups API service
 */
import { api } from "./api";
import { saveOrShareResponse } from "./nativeExport";

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
  // Fetches through the authenticated API client (Bearer header) and routes
  // the bytes to the native share sheet on Capacitor, or a browser download on
  // the web. Avoids putting the JWT in the URL.
  download: async (id: number): Promise<void> => {
    const response = await api.getBlob(`/backups/${id}/download`);
    if (!response.ok) {
      throw new Error(`Backup download failed (${response.status})`);
    }
    await saveOrShareResponse(response, `backup-${id}.sql`);
  },
};
