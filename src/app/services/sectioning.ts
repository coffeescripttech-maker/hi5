/**
 * Sectioning API service — Auto-sectioning
 */
import { api } from "./api";

export interface SectioningStudent {
  id: number;
  student_id: string;
  lrn: string;
  name: string;
  grade_level: number;
  sex: string;
  birthdate: string | null;
  general_average: number | null;
  classifications: string[];
}

export interface SectioningSection {
  id: number;
  name: string;
  grade_level: number;
  section_type: string;
  capacity: number;
  current_count: number;
  min_average: number;
  adviser_name: string | null;
  is_active: number;
}

export interface SectioningData {
  school_year: { id: number; sy_label: string };
  students: SectioningStudent[];
  sections: SectioningSection[];
}

export interface AssignPayload {
  school_year_id: number;
  assignments: Array<{ student_id: number; section_id: number }>;
}

export interface AssignResult {
  message: string;
  succeeded: number;
  total: number;
  results: Array<{
    student_id: number;
    name: string;
    section_id: number;
    section_name: string;
    ok: boolean;
    error?: string;
  }>;
}

/** A student in the Pending Section Queue (enrolled but section_id IS NULL) */
export interface PendingQueueStudent {
  enrollment_id: number;
  student_id: number;
  program: string;
  enrollment_date: string;
  queued_at: string;
  id: number;
  student_display_id: string;
  lrn: string;
  name: string;
  grade_level: number;
  sex: string;
  enrolled_by_name: string;
  general_average: number | null;
  classifications: string[];
}

export interface PendingQueueData {
  school_year: { id: number; sy_label: string };
  queue: PendingQueueStudent[];
  sections: SectioningSection[];
  total_pending: number;
}

export interface ConfirmAssignPayload {
  school_year_id: number;
  assignments: Array<{
    enrollment_id?: number;
    student_id: number;
    section_id: number;
  }>;
}

export interface CarryOverProposal {
  student_id: number;
  student_name: string;
  lrn: string;
  student_display_id: string;
  prev_section_name: string | null;
  prev_section_type: string | null;
  proposed_section_id: number | null;
  proposed_section_name: string | null;
}

export interface CarryOverData {
  school_year: { id: number; sy_label: string };
  previous_sy: { id: number; sy_label: string };
  proposals: CarryOverProposal[];
  current_sections: SectioningSection[];
}

export const sectioningApi = {
  /** Get pending students with GA, classifications, and available sections */
  getPending: () => api.get<SectioningData>("/sectioning/pending"),

  /** Get the Pending Section Queue (enrolled students awaiting section assignment) */
  getPendingQueue: (params?: { grade_level?: number; program?: string }) =>
    api.get<PendingQueueData>("/sectioning/pending-queue", params),

  /** Confirm and commit section assignments */
  confirmAssignments: (data: ConfirmAssignPayload) =>
    api.post<AssignResult>("/sectioning/confirm-assignments", data),

  /** Preview carry-over assignments (Grade 11→12) */
  getCarryOverPreview: (gradeLevel?: number) =>
    api.get<CarryOverData>("/sectioning/carry-over-preview", { grade_level: gradeLevel ?? 12 }),

  /** Execute auto-sectioning assignments */
  assign: (data: AssignPayload) => api.post<AssignResult>("/sectioning/assign", data),
};
