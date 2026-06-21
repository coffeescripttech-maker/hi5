/**
 * Grades API service
 */
import { api } from "./api";

export interface GradeRow {
  id: number;
  student_id: number;
  subject_id: number;
  subject_name: string;
  enrollment_id: number;
  school_year_id: number;
  quarter: number;
  grade: number | null;
  is_locked: number;
  locked_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface GradeUpsertPayload {
  student_id: number;
  subject_id: number;
  school_year_id: number;
  quarter: number;
  grade: number | null;
}

export interface GradeLockPayload {
  student_id: number;
  school_year_id: number;
  subject_id?: number;
  quarter?: number;
}

export interface CorrectionRequestPayload {
  student_id: number;
  subject_id: number;
  school_year_id: number;
  quarter: number;
  justification: string;
}

export interface CorrectionRequestRow {
  id: number;
  student_id: number;
  student_name: string;
  subject_id: number;
  subject_name: string;
  school_year_id: number;
  quarter: number;
  requested_by: number;
  requested_by_name: string;
  justification: string;
  status: "pending" | "approved" | "rejected";
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const gradesApi = {
  list: (params?: { student_id?: number; section_id?: number; school_year_id?: number; subject_id?: number }) => {
    const query = params
      ? "?" + new URLSearchParams(
          Object.entries(params)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : "";
    return api.get<GradeRow[]>(`/grades${query}`);
  },
  upsert: (data: GradeUpsertPayload) =>
    api.post<GradeRow>("/grades", data),
  lock: (data: GradeLockPayload) =>
    api.post<{ message: string }>("/grades/lock", data),
  unlock: (data: GradeLockPayload) =>
    api.post<{ message: string }>("/grades/unlock", data),
  listCorrections: () =>
    api.get<CorrectionRequestRow[]>("/grades/corrections"),
  requestCorrection: (data: CorrectionRequestPayload) =>
    api.post<CorrectionRequestRow>("/grades/corrections", data),
  reviewCorrection: (id: number, status: "approved" | "rejected") =>
    api.put<CorrectionRequestRow>(`/grades/corrections/${id}`, { status }),
};
