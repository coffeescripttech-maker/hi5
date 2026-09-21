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
  // Grade security settings (from migration 018)
  grade_deadline_enabled?: number;
  grade_edit_deadline?: string | null;
  // Legal content overrides (migration 025) — JSON strings or null
  terms_of_service_text?: string | null;
  privacy_policy_text?: string | null;
  conditions_text?: string | null;
}

export interface UpdateSettingsPayload {
  school_name?: string;
  school_id?: string;
  region?: string;
  division?: string;
  district?: string;
  principal_name?: string;
  registrar_name?: string;
  // Grade security settings
  grade_deadline_enabled?: boolean | number;
  grade_edit_deadline?: string | null;
  // Legal content overrides (migration 025) — JSON strings or null
  terms_of_service_text?: string | null;
  privacy_policy_text?: string | null;
  conditions_text?: string | null;
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

export interface ActivityLogRetentionSettings {
  last_activity_log_cleanup: string | null;
  activity_log_cleanup_enabled: number;
  activity_log_retention_days: number;
}

/** Public (unauthenticated) school info for the login screen. */
export interface SchoolInfo {
  school_name: string;
  current_sy_label: string;
  enrollment_open: boolean;
  // Legal content overrides served publicly to the login modal (migration 025)
  terms_of_service_text?: string | null;
  privacy_policy_text?: string | null;
  conditions_text?: string | null;
}


/** One legal document as rendered in the login modal (mirrors LEGAL_CONTENT in Login.tsx). */
export interface LegalContentDoc {
  intro: string;
  sections: { heading: string; body: string }[];
}

/** Editable legal fields carried by the settings row. */
export interface LegalContentFields {
  terms_of_service_text: string | null;
  privacy_policy_text: string | null;
  conditions_text: string | null;
}

export const schoolInfoApi = {
  get: () => api.get<SchoolInfo>("/school-info"),
};

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
  getLogRetention: () => api.get<ActivityLogRetentionSettings>("/settings/log-retention"),
  updateLogRetention: (data: Partial<Pick<ActivityLogRetentionSettings, "activity_log_cleanup_enabled" | "activity_log_retention_days">>) =>
    api.put<ActivityLogRetentionSettings>("/settings/log-retention", data),
};
