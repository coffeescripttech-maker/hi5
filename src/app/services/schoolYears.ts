/**
 * School Years API service
 */
import { api } from "./api";

export interface SchoolYearRow {
  id: number;
  sy_label: string;
  is_current: number;
  enrollment_open: number;
  enrollment_start_date: string | null;
  enrollment_end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSchoolYearPayload {
  sy_label: string;
}

export interface UpdateSchoolYearPayload {
  sy_label?: string;
  enrollment_open?: number;
  enrollment_start_date?: string;
  enrollment_end_date?: string;
}

export const schoolYearsApi = {
  list: () => api.get<SchoolYearRow[]>("/school-years"),
  current: () => api.get<SchoolYearRow>("/school-years/current"),
  create: (data: CreateSchoolYearPayload) =>
    api.post<SchoolYearRow>("/school-years", data),
  update: (id: number, data: UpdateSchoolYearPayload) =>
    api.put<SchoolYearRow>(`/school-years/${id}`, data),
  setCurrent: (id: number) =>
    api.post<SchoolYearRow>(`/school-years/${id}/set-current`),
};
