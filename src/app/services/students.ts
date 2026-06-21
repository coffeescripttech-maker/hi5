/**
 * Students API service
 */
import { api } from "./api";

export interface StudentRow {
  id: number;
  student_id: string;
  lrn: string;
  name: string;
  grade_level: number;
  sex: "male" | "female";
  birthdate: string;
  address: string | null;
  guardian: string | null;
  contact: string | null;
  status: "enrolled" | "pending" | "dropped" | "transferred" | "graduated";
  created_at: string;
  updated_at: string;
}

/** Student with enrollment and section info (from GET /api/students/:id) */
export interface StudentDetail extends StudentRow {
  enrollment?: {
    id: number;
    section_id: number;
    section_name: string;
    school_year_id: number;
    sy_label: string;
    status: string;
  };
}

export interface CreateStudentPayload {
  student_id: string;
  lrn: string;
  name: string;
  grade_level: number;
  sex: "male" | "female";
  birthdate: string;
  address?: string;
  guardian?: string;
  contact?: string;
}

export interface UpdateStudentPayload {
  name?: string;
  grade_level?: number;
  address?: string;
  guardian?: string;
  contact?: string;
  status?: "enrolled" | "pending" | "dropped" | "transferred" | "graduated";
}

export interface ClassificationPayload {
  classification: string;
  school_year_id: number;
}

export const studentsApi = {
  list: (params?: { search?: string; grade_level?: number; status?: string }) => {
    const query = params
      ? "?" + new URLSearchParams(
          Object.entries(params)
            .filter(([_, v]) => v !== undefined && v !== null)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : "";
    return api.get<StudentRow[]>(`/students${query}`);
  },
  get: (id: number) => api.get<StudentDetail>(`/students/${id}`),
  create: (data: CreateStudentPayload) =>
    api.post<StudentRow>("/students", data),
  update: (id: number, data: UpdateStudentPayload) =>
    api.put<StudentRow>(`/students/${id}`, data),
  delete: (id: number) => api.del(`/students/${id}`),
  addClassification: (id: number, data: ClassificationPayload) =>
    api.post<{ message: string }>(`/students/${id}/classifications`, data),
};
