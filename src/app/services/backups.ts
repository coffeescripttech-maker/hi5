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
};
