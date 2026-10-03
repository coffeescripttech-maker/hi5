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
  /**
   * Reporting group key. Subjects sharing a key (TLE/EPP + its specializations)
   * are reported and averaged as one learning area. NULL = standalone subject.
   */
  subject_group?: string | null;
  /**
   * Curriculum program this subject belongs to (STE/SPFL/ALS additions).
   * NULL = shared across all programs (all core subjects).
   */
  program?: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSubjectPayload {
  name: string;
  grade_level: number;
  hours_per_week: number;
  subject_type: string;
  subject_group?: string | null;
  program?: string | null;
}

export interface UpdateSubjectPayload {
  name?: string;
  hours_per_week?: number;
  subject_type?: string;
  subject_group?: string | null;
  program?: string | null;
  is_active?: number;
}

export interface BulkSubjectItem {
  name: string;
  grade_level: number;
  hours_per_week: number;
  subject_type: string;
  program?: string | null;
}

export interface PopulateSubjectsResult {
  created: SubjectRow[];
  created_count: number;
  skipped_count: number;
}

/* ── SF9 Special Subject Rows ── */

/**
 * A special subject is a real subject: it is graded normally by teachers, and
 * it flows into SF9, SF10, LIS exports and the general average automatically.
 * The server pins subject_type='specialized' and subject_group=NULL so it
 * reports as its own row instead of collapsing into a TLE/TVL group.
 */
export interface SpecialSubjectPayload {
  name: string;
  grade_level: number;
  hours_per_week: number;
}

export interface DeleteSpecialSubjectResult {
  deleted: boolean;
  /** True when grades existed, so the subject was retired instead of removed. */
  deactivated: boolean;
  grade_records: number;
  message?: string;
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

  /* ── SF9 special subject rows (Admin/Registrar) ── */
  listSpecial: (gradeLevel?: number, includeInactive = false) => {
    const q = new URLSearchParams();
    if (gradeLevel) q.set("grade_level", String(gradeLevel));
    if (includeInactive) q.set("include_inactive", "1");
    const qs = q.toString();
    return api.get<SubjectRow[]>(`/subjects/special${qs ? `?${qs}` : ""}`);
  },
  createSpecial: (data: SpecialSubjectPayload) =>
    api.post<SubjectRow>("/subjects/special", data),
  updateSpecial: (id: number, data: Partial<SpecialSubjectPayload> & { is_active?: number }) =>
    api.put<SubjectRow>(`/subjects/special/${id}`, data),
  deleteSpecial: (id: number) =>
    api.del<DeleteSpecialSubjectResult>(`/subjects/special/${id}`),
};
