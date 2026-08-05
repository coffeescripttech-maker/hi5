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
  completed: number;
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
  get: (id: number) =>
    api.get<{ promotion: PromotionRow; students: PromotionStudentRow[] }>(
      `/promotions/${id}`
    ),
  create: (data: CreatePromotionPayload) =>
    api.post<PromotionRow>("/promotions", data),
  completeSection: (data: CompleteSectionPayload) =>
    api.post<{ message: string; promotion_id: number; section_name: string; student_count: number; students: any[] }>(
      "/promotions/complete", data
    ),
  bulkPromote: () =>
    api.post<BulkPromoteResponse>("/promotions/bulk-promote"),
};
