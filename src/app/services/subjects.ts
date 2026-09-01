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

export interface BulkSubjectItem {
  name: string;
  grade_level: number;
  hours_per_week: number;
  subject_type: string;
}

export interface PopulateSubjectsResult {
  created: SubjectRow[];
  created_count: number;
  skipped_count: number;
}

/* ── Teacher–Subject Assignments (Admin) ── */

export interface TeacherAssignmentRow {
  subject_id: number;
  teacher_id: number;
  teacher_name: string;
  employee_id: string | null;
}

export const subjectsApi = {
  list: () => api.get<SubjectRow[]>("/subjects"),
  assigned: () => api.get<SubjectRow[]>("/subjects/me/assigned"),
  get: (id: number) => api.get<SubjectRow>(`/subjects/${id}`),
  create: (data: CreateSubjectPayload) =>
    api.post<SubjectRow>("/subjects", data),
  update: (id: number, data: UpdateSubjectPayload) =>
    api.put<SubjectRow>(`/subjects/${id}`, data),
  delete: (id: number) => api.del(`/subjects/${id}`),
  // Bulk-insert a curriculum preset; existing (name, grade) pairs are skipped server-side
  populate: (items: BulkSubjectItem[]) =>
    api.post<PopulateSubjectsResult>("/subjects/populate", { items }),
  // Teacher–subject assignment management (Admin only)
  teacherAssignments: () => api.get<TeacherAssignmentRow[]>("/subjects/teachers/assignments"),
  assignTeacher: (subjectId: number, teacherId: number) =>
    api.post<{ message: string }>(`/subjects/${subjectId}/teachers`, { teacher_id: teacherId }),
  unassignTeacher: (subjectId: number, teacherId: number) =>
    api.del<{ message: string }>(`/subjects/${subjectId}/teachers/${teacherId}`),
};
