/**
 * Activity Logs API service
 */
import { api } from "./api";

export interface ActivityLogRow {
  id: number;
  user_id: number | null;
  user_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
}

function buildQuery(params?: { page?: number; limit?: number }): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

export interface ActivityLogPage {
  data: ActivityLogRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const logsApi = {
  // Unwraps .data for summary feeds (dashboard keeps its own limit).
  list: (params?: { page?: number; limit?: number }) =>
    api.get<ActivityLogPage>(`/logs${buildQuery(params)}`).then(r => r.data),
  // Returns the full payload so the logs page can render pagination controls.
  listPage: (params?: { page?: number; limit?: number }) =>
    api.get<ActivityLogPage>(`/logs${buildQuery(params)}`).then(r => r),
};
