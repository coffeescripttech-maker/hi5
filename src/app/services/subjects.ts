/**
 * Subjects API service
 */
import { api } from "./api";

export interface SubjectRow {
  id: number;
  name: string;
  grade_level: number;
  hours_per_week: number;
  subject_type: "core" | "applied" | "specialized";
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSubjectPayload {
  name: string;
  grade_level: number;
  hours_per_week: number;
  subject_type: string;
}

export interface UpdateSubjectPayload {
  name?: string;
  hours_per_week?: number;
  subject_type?: string;
  is_active?: number;
}

export const subjectsApi = {
  list: () => api.get<SubjectRow[]>("/subjects"),
  get: (id: number) => api.get<SubjectRow>(`/subjects/${id}`),
  create: (data: CreateSubjectPayload) =>
    api.post<SubjectRow>("/subjects", data),
  update: (id: number, data: UpdateSubjectPayload) =>
    api.put<SubjectRow>(`/subjects/${id}`, data),
  delete: (id: number) => api.del(`/subjects/${id}`),
};
