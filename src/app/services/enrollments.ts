/**
 * Enrollments API service
 */
import { api } from './api';

export interface EnrollmentRow {
  id: number;
  student_id: number;
  student_display_id?: string;
  student_name: string;
  lrn: string;
  grade_level: number;
  /** The section's grade level for that school year (null if pending/unassigned) */
  section_grade_level: number | null;
  sex?: string;
  classifications?: string;
  section_id: number | null;
  section_name: string | null;
  school_year_id: number;
  sy_label: string;
  program: string;
  strand_track_id: number | null;
  enrollment_date: string;
  enrolled_by: number;
  enrolled_by_name: string;
  status: 'enrolled' | 'dropped' | 'transferred' | 'completed';
  remarks: string | null;
  assigned_at: string | null;
  assigned_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEnrollmentPayload {
  student_id: number;
  section_id?: number;
  school_year_id: number;
  enrollment_date: string;
  program?: string;
  strand_track_id?: number;
  remarks?: string;
  requirements?: {
    requirement_key: string;
    label: string;
    is_submitted: boolean;
  }[];
}

export interface UpdateEnrollmentPayload {
  section_id?: number;
  status?: 'enrolled' | 'dropped' | 'transferred';
  remarks?: string;
  program?: string;
}

export interface EnrollmentRequirementRow {
  id: number;
  enrollment_id: number;
  requirement_key: string;
  label: string;
  is_submitted: number;
  submitted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenderBreakdown {
  grade: string;
  male: number;
  female: number;
  total: number;
}

export interface GenderTotals {
  male: number;
  female: number;
}

export interface ClassificationStat {
  classification: string;
  count: number;
}

export interface DashboardStats {
  gender_by_grade: GenderBreakdown[];
  gender_totals: GenderTotals;
  classifications: ClassificationStat[];
}

export interface StudentRequirement {
  id: number;
  requirement_key: string;
  label: string;
  is_submitted: boolean;
  submitted_at: string | null;
}

export interface StudentWithRequirements {
  student_id: number;
  student_name: string;
  display_id: string;
  requirements: StudentRequirement[];
  submitted_count: number;
  total_count: number;
}

export const enrollmentsApi = {
  list: () => api.get<EnrollmentRow[]>('/enrollments'),
  get: (id: number) => api.get<EnrollmentRow>(`/enrollments/${id}`),
  create: (data: CreateEnrollmentPayload) =>
    api.post<EnrollmentRow>('/enrollments', data),
  update: (id: number, data: UpdateEnrollmentPayload) =>
    api.put<EnrollmentRow>(`/enrollments/${id}`, data),
  delete: (id: number) => api.del(`/enrollments/${id}`),
  listRequirements: (enrollmentId: number) =>
    api.get<EnrollmentRequirementRow[]>(
      `/enrollments/${enrollmentId}/requirements`
    ),
  batchRequirements: (sectionId: number, schoolYearId?: number) =>
    api.get<StudentWithRequirements[]>(
      `/enrollments/requirements/batch?section_id=${sectionId}${schoolYearId ? `&school_year_id=${schoolYearId}` : ''}`
    ),
  updateRequirements: (
    enrollmentId: number,
    data: { requirements: { requirement_key: string; is_submitted: boolean }[] }
  ) =>
    api.put<EnrollmentRequirementRow[]>(
      `/enrollments/${enrollmentId}/requirements`,
      data
    ),
  stats: (schoolYearId?: number) =>
    api.get<DashboardStats>(`/enrollments/stats${schoolYearId ? `?school_year_id=${schoolYearId}` : ''}`),
};
