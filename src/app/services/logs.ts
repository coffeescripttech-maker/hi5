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

export const logsApi = {
  list: (params?: { page?: number; limit?: number }) => {
    const query = params
      ? "?" + new URLSearchParams(
          Object.entries(params)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : "";
    // API returns { data: ActivityLogRow[], pagination: {...} } — unwrap .data
    return api.get<{ data: ActivityLogRow[] }>(`/logs${query}`).then(r => r.data);
  },
};
