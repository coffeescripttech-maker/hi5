/**
 * Promotions API service
 */
import { api } from "./api";

export interface PromotionRow {
  id: number;
  section_id: number;
  section_name: string;
  from_grade_level: number;
  to_grade_level: number;
  school_year_id: number;
  sy_label: string;
  promoted_by: number;
  promoted_by_name: string;
  status: "completed" | "pending_review";
  student_count: number;
  created_at: string;
  /** 1/0 — true for Grade 12 completion records ("Mark as Completers") */
  is_completers?: boolean;
}

export interface PromotionStudentRow {
  id: number;
  promotion_id: number;
  student_id: number;
  student_name: string;
  lrn: string;
  from_section_id: number;
  from_section_name: string;
  to_section_id: number | null;
  to_section_name: string | null;
  general_average: number | null;
  is_retained: number;
  /** 0 when the student was blocked from promotion due to incomplete grades */
  grade_complete?: number;
}

export interface CreatePromotionPayload {
  section_id: number;
  school_year_id: number;
  to_grade_level: number;
}

export interface CompleteSectionPayload {
  section_id: number;
  school_year_id: number;
}

export interface BulkPromoteSummaryRow {
  grade_level: number;
  to_grade_level: number;
  label: string;
  sections: number;
  students_processed: number;
  promoted: number;
  retained: number;
  incomplete: number;
  completed: number;
}

export interface PromotionPreviewStudent {
  student_id: number;
  name: string;
  general_average: number | null;
  grade_complete: boolean;
  is_retained: boolean;
  promoted: boolean;
}

export interface PromotionPreview {
  section_id: number;
  section_name: string;
  grade_level: number;
  school_year_id: number;
  total: number;
  promoted: number;
  retained: number;
  incomplete: number;
  students: PromotionPreviewStudent[];
}

/** A single enrolled student on the individual promotion/graduation roster. */
export interface RosterStudent {
  student_id: number;
  student_code: string;
  lrn: string;
  name: string;
  grade_level: number;
  section_id: number | null;
  section_name: string | null;
  general_average: number | null;
  grade_complete: boolean;
  is_retained: boolean;
  can_promote: boolean;
  can_graduate: boolean;
}

export interface RosterResponse {
  school_year_id: number;
  section_id: number | null;
  passing_mark: number;
  total: number;
  students: RosterStudent[];
}

export interface IndividualPromotionPayload {
  student_id: number;
  school_year_id: number;
  action: "promote" | "graduate";
  to_section_id?: number | null;
  override?: boolean;
  reason?: string;
}

export interface IndividualPromotionResponse {
  message: string;
  action: "promote" | "graduate";
  student_id: number;
  name: string;
  student_code: string;
  from_grade?: number;
  to_grade?: number;
  from_section?: string | null;
  section_name?: string | null;
  general_average: number | null;
  override: boolean;
}

export interface BulkPromoteResponse {
  message: string;
  school_year_id: number;
  next_school_year_id: number;
  next_sy_label: string | null;
  summary: BulkPromoteSummaryRow[];
  failures: { section_name: string; grade_level: number; error: string }[];
}

export const promotionsApi = {
  list: () => api.get<PromotionRow[]>("/promotions"),
  preview: (params: { section_id: number; school_year_id: number }) =>
    api.get<PromotionPreview>("/promotions/preview", params),
  get: (id: number) =>
    api.get<PromotionRow & { students: PromotionStudentRow[] }>(
      `/promotions/${id}`
    ),
  create: (data: CreatePromotionPayload) =>
    api.post<PromotionRow>("/promotions", data),
  completeSection: (data: CompleteSectionPayload) =>
    api.post<{ message: string; promotion_id: number; section_name: string; student_count: number; students: any[] }>(
      "/promotions/complete", data
    ),
  rollback: (id: number) =>
    api.post<{ message: string; section_id: number; section_name: string; student_count: number }>(
      `/promotions/${id}/rollback`
    ),
  bulkPromote: () =>
    api.post<BulkPromoteResponse>("/promotions/bulk-promote"),
  roster: (params: { school_year_id: number; section_id?: number; search?: string }) =>
    api.get<RosterResponse>("/promotions/roster", params),
  promoteIndividual: (data: IndividualPromotionPayload) =>
    api.post<IndividualPromotionResponse>("/promotions/individual", data),
};
