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
  /** null = all subjects */
  subject_id: number | null;
  school_year_id: number;
  /** null = all quarters */
  quarter: number | null;
  justification: string;
}

export interface CorrectionRequestRow {
  id: number;
  student_id: number;
  student_name: string;
  subject_id: number | null;
  subject_name: string;
  school_year_id: number;
  sy_label: string | null;
  /** null = all quarters */
  quarter: number | null;
  requested_by: number;
  requested_by_name: string;
  justification: string;
  status: "pending" | "approved" | "rejected";
  reviewed_by: number | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DistributionBucket {
  range: string;
  count: number;
  color: string;
}

export interface SubjectDistribution {
  subject_name: string;
  total_students: number;
  mean_grade: number;
  pass_rate: number;
  buckets: DistributionBucket[];
}

export interface GradeDistribution {
  school_year_id: number;
  total_students: number;
  overall_pass_rate: number;
  subjects: SubjectDistribution[];
}

export interface GradeHistorySubject {
  subject_id: number;
  subject_name: string;
  subject_type: string;
  q1: number | null;
  q2: number | null;
  q3: number | null;
  q4: number | null;
  final_average: number | null;
}

export interface GradeHistoryYear {
  school_year_id: number;
  sy_label: string;
  grade_level: number | null;
  section_name: string | null;
  general_average: number | null;
  subjects: GradeHistorySubject[];
}

export interface GradeHistory {
  student_id: number;
  school_years: GradeHistoryYear[];
}

export interface SectionGradeSubmission {
  section_id: number;
  section_name: string;
  grade_level: number;
  adviser_name: string | null;
  total_students: number;
  graded_students: number;
  grade_rows: number;
  locked_rows: number;
}

export interface GradeSubmissionStatus {
  school_year_id: number;
  total_sections: number;
  submitted_sections: number;
  overall_pct: number;
  by_grade: {
    grade_level: number;
    sections: SectionGradeSubmission[];
    submitted: number;
    total: number;
    pct: number;
  }[];
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
  history: (studentId: number) =>
    api.get<GradeHistory>(`/grades/history?student_id=${studentId}`),
  reviewCorrection: (id: number, status: "approved" | "rejected") =>
    api.put<CorrectionRequestRow>(`/grades/corrections/${id}`, { status }),
  getDistribution: (params?: { school_year_id?: number; grade_level?: number; section_id?: number }) => {
    const query = params
      ? "?" + new URLSearchParams(
          Object.entries(params)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : "";
    return api.get<GradeDistribution>(`/grades/distribution${query}`);
  },
  submissionStatus: (params?: { school_year_id?: number }) => {
    const query = params
      ? "?" + new URLSearchParams(
          Object.entries(params)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : "";
    return api.get<GradeSubmissionStatus>(`/grades/submission-status${query}`);
  },
};
