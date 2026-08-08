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
  /** Present on teacher's my-students response — null means Pending Section Queue */
  section_id?: number | null;
  section_name?: string | null;
  program?: string;
}

/** Graduate/alumni row (from GET /api/students/graduates) */
export interface GraduateRow {
  id: number;
  student_id: string;
  lrn: string;
  name: string;
  sex: "male" | "female";
  grade_level: number;
  status: string;
  graduation_sy_id: number | null;
  graduation_sy: string | null;
  section_name: string | null;
}

/** Student with enrollment and section info (from GET /api/students/:id) */
export interface StudentDetail extends StudentRow {
  enrollment?: {
    id: number;
    section_id: number | null;
    section_name: string | null;
    school_year_id: number;
    sy_label: string;
    status: string;
    enrollment_date: string;
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
  classifications: string[];
  school_year_id: number;
}

export const studentsApi = {
  list: (params?: { search?: string; grade_level?: number; status?: string; section_id?: number; school_year_id?: number }) => {
    const query = params
      ? "?" + new URLSearchParams(
          Object.entries(params)
            .filter(([_, v]) => v !== undefined && v !== null)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : "";
    return api.get<StudentRow[]>(`/students${query}`);
  },
  /** Get students scoped to the logged-in teacher (their section assignments) */
  listMyStudents: (params?: { status?: string }) =>
    api.get<StudentRow[]>("/students/my-students", params),
  /** Alumni list — students marked as graduated with their graduation school year */
  graduates: () => api.get<GraduateRow[]>("/students/graduates"),
  get: (id: number) => api.get<StudentDetail>(`/students/${id}`),
  create: (data: CreateStudentPayload) =>
    api.post<StudentRow>("/students", data),
  update: (id: number, data: UpdateStudentPayload) =>
    api.put<StudentRow>(`/students/${id}`, data),
  delete: (id: number) => api.del(`/students/${id}`),
  addClassification: (id: number, data: ClassificationPayload) =>
    api.post<{ message: string }>(`/students/${id}/classifications`, data),
};
