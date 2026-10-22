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
  // Configurable academic thresholds (migration 035)
  passing_grade?: number;
  monitor_threshold?: number;
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
  // Configurable academic thresholds (migration 035)
  passing_grade?: number;
  monitor_threshold?: number;
  // Legal content overrides (migration 025) — JSON strings or null
  terms_of_service_text?: string | null;
  privacy_policy_text?: string | null;
  conditions_text?: string | null;
}

/** One program's eligibility minimums as returned by GET /settings/thresholds. */
export interface SectionTypeThreshold {
  section_type: string;
  label: string | null;
  icon: string | null;
  color_code: string | null;
  sort_order: number;
  /** Eligibility minimums (null = no rule of that kind). */
  min_general_average: number | null;
  min_science: number | null;
  min_math: number | null;
  min_english: number | null;
  min_filipino: number | null;
  grade_row_count: number;
}

export interface UpdateThresholdsPayload {
  types: {
    section_type: string;
    min_general_average?: number | null;
    min_science?: number | null;
    min_math?: number | null;
    min_english?: number | null;
    min_filipino?: number | null;
  }[];
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
    api.put<{ thresholds: SectionTypeThreshold[]; sections_raised: number }>("/settings/thresholds", data),
  getBackupSettings: () => api.get<BackupSettings>("/settings/backup"),
  updateBackupSettings: (data: Partial<BackupSettings>) =>
    api.put<BackupSettings>("/settings/backup", data),
  getLogRetention: () => api.get<ActivityLogRetentionSettings>("/settings/log-retention"),
  updateLogRetention: (data: Partial<Pick<ActivityLogRetentionSettings, "activity_log_cleanup_enabled" | "activity_log_retention_days">>) =>
    api.put<ActivityLogRetentionSettings>("/settings/log-retention", data),
};
