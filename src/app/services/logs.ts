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

export type LogsQuery = {
  page?: number;
  limit?: number;
  user_id?: number;
  entity_type?: string;
  action?: string;
  search?: string;
  sort_by?: "created_at" | "user_name" | "entity_type" | "action";
  order?: "asc" | "desc";
};

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
  list: (params?: LogsQuery) =>
    api.get<ActivityLogPage>("/logs", params).then(r => r.data),
  // Returns the full payload so the logs page can render pagination controls.
  listPage: (params?: LogsQuery) =>
    api.get<ActivityLogPage>("/logs", params).then(r => r),
};
