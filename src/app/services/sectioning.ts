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
  section_type: "star" | "gold" | "silver" | "regular" | "non_reader";
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

export const sectioningApi = {
  /** Get pending students with GA, classifications, and available sections */
  getPending: () => api.get<SectioningData>("/sectioning/pending"),

  /** Execute auto-sectioning assignments */
  assign: (data: AssignPayload) => api.post<AssignResult>("/sectioning/assign", data),
};
