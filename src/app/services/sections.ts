/**
 * Sections API service
 */
import { api } from "./api";

export interface SectionRow {
  id: number;
  name: string;
  grade_level: number;
  section_type: string;
  capacity: number;
  current_count: number;
  adviser_id: number | null;
  adviser_name: string | null;
  min_average: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSectionPayload {
  name: string;
  grade_level: number;
  section_type: string;
  capacity: number;
  adviser_id?: number;
  min_average: number;
}

export interface UpdateSectionPayload {
  name?: string;
  section_type?: string;
  capacity?: number;
  adviser_id?: number | null;
  min_average?: number;
  is_active?: number;
}

export interface TeacherBrief {
  id: number;
  name: string;
  employee_id: string | null;
  designation: string | null;
}

export const sectionsApi = {
  list: () => api.get<SectionRow[]>("/sections"),
  listTeachers: () => api.get<TeacherBrief[]>("/sections/teachers"),
  listMySections: () => api.get<SectionRow[]>("/sections/my-sections"),
  get: (id: number) => api.get<SectionRow>(`/sections/${id}`),
  create: (data: CreateSectionPayload) =>
    api.post<SectionRow>("/sections", data),
  update: (id: number, data: UpdateSectionPayload) =>
    api.put<SectionRow>(`/sections/${id}`, data),
  delete: (id: number) => api.del(`/sections/${id}`),
};
