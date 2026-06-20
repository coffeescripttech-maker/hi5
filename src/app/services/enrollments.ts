/**
 * Enrollments API service
 */
import { api } from "./api";

export interface EnrollmentRow {
  id: number;
  student_id: number;
  student_display_id?: string;
  student_name: string;
  lrn: string;
  grade_level: number;
  section_id: number;
  section_name: string;
  school_year_id: number;
  sy_label: string;
  enrollment_date: string;
  enrolled_by: number;
  enrolled_by_name: string;
  status: "enrolled" | "dropped" | "transferred";
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEnrollmentPayload {
  student_id: number;
  section_id: number;
  school_year_id: number;
  enrollment_date: string;
  remarks?: string;
}

export interface UpdateEnrollmentPayload {
  section_id?: number;
  status?: "enrolled" | "dropped" | "transferred";
  remarks?: string;
}

export const enrollmentsApi = {
  list: () => api.get<EnrollmentRow[]>("/enrollments"),
  get: (id: number) => api.get<EnrollmentRow>(`/enrollments/${id}`),
  create: (data: CreateEnrollmentPayload) =>
    api.post<EnrollmentRow>("/enrollments", data),
  update: (id: number, data: UpdateEnrollmentPayload) =>
    api.put<EnrollmentRow>(`/enrollments/${id}`, data),
  delete: (id: number) => api.del(`/enrollments/${id}`),
};
