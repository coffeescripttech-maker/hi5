/**
 * Strand Tracks API service
 */
import { api } from "./api";

export interface StrandTrackRow {
  id: number;
  code: string;
  name: string;
  track_type: "tle" | "shs_strand";
  grade_level: number;
  description: string | null;
  is_active: number;
  sort_order: number;
  created_at: string;
}

export interface CreateStrandTrackPayload {
  code: string;
  name: string;
  track_type: "tle" | "shs_strand";
  grade_level?: number;
  description?: string;
  sort_order?: number;
}

export interface UpdateStrandTrackPayload {
  code?: string;
  name?: string;
  track_type?: "tle" | "shs_strand";
  grade_level?: number;
  description?: string;
  sort_order?: number;
  is_active?: number;
}

export const strandTracksApi = {
  list: (params?: { track_type?: string; grade_level?: number; include_inactive?: boolean }) =>
    api.get<StrandTrackRow[]>("/strand-tracks", {
      track_type: params?.track_type,
      grade_level: params?.grade_level,
      include_inactive: params?.include_inactive ? 1 : undefined,
    }),
  get: (id: number) => api.get<StrandTrackRow>(`/strand-tracks/${id}`),
  create: (data: CreateStrandTrackPayload) =>
    api.post<StrandTrackRow>("/strand-tracks", data),
  update: (id: number, data: UpdateStrandTrackPayload) =>
    api.put<StrandTrackRow>(`/strand-tracks/${id}`, data),
  delete: (id: number) => api.del(`/strand-tracks/${id}`),
  getSubjects: (id: number) => api.get<any[]>(`/strand-tracks/${id}/subjects`),
  setSubjects: (id: number, subjectIds: number[]) =>
    api.put(`/strand-tracks/${id}/subjects`, { subject_ids: subjectIds }),
};
