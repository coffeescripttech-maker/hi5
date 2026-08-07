/**
 * Settings API service
 */
import { api } from "./api";

export interface SchoolSettingsRow {
  id: number;
  school_name: string;
  school_id: string;
  region: string;
  division: string;
  district: string | null;
  principal_name: string | null;
  registrar_name: string | null;
  current_sy_id: number | null;
  current_sy_label: string | null;
  updated_at: string;
}

export interface UpdateSettingsPayload {
  school_name?: string;
  school_id?: string;
  region?: string;
  division?: string;
  district?: string;
  principal_name?: string;
  registrar_name?: string;
}

export interface SectionTypeThreshold {
  id: number;
  section_type: string;
  grade_level: number;
  min_average: number;
  max_average: number;
  color_code: string | null;
  icon: string | null;
}

export interface UpdateThresholdsPayload {
  thresholds: { id: number; min_average?: number; max_average?: number }[];
}

export interface BackupSettings {
  backup_frequency: "daily" | "every_12h" | "weekly";
  backup_time: string;
  backup_retention: "last_7" | "last_30" | "all";
  backup_enabled: number;
}

export const settingsApi = {
  get: () => api.get<SchoolSettingsRow>("/settings"),
  update: (data: UpdateSettingsPayload) =>
    api.put<SchoolSettingsRow>("/settings", data),
  getThresholds: () => api.get<SectionTypeThreshold[]>("/settings/thresholds"),
  updateThresholds: (data: UpdateThresholdsPayload) =>
    api.put<SectionTypeThreshold[]>("/settings/thresholds", data),
  getBackupSettings: () => api.get<BackupSettings>("/settings/backup"),
  updateBackupSettings: (data: Partial<BackupSettings>) =>
    api.put<BackupSettings>("/settings/backup", data),
};
