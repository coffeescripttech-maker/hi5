/**
 * Documents API service
 */
import { api } from "./api";

export interface DocumentRow {
  id: number;
  student_id: number | null;
  student_name: string | null;
  section_id: number | null;
  section_name: string | null;
  subject_id: number | null;
  subject_name: string | null;
  school_year_id: number | null;
  file_name: string;
  file_type: "pdf" | "xlsx" | "xls" | "docx";
  file_path: string;
  file_size: number | null;
  uploaded_by: number;
  uploaded_by_name: string;
  record_count: number | null;
  quarter: number | null;
  status: "pending" | "validated" | "imported" | "failed";
  created_at: string;
}

export interface GradePreviewRow {
  row: number;
  lrn: string;
  name: string;
  grade: number | null;
  status: "valid" | "skipped" | "invalid";
  error?: string;
}

export interface GradePreviewResult {
  rows: GradePreviewRow[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  locked: number;
  failed: number;
  invalid: number;
}

export interface TemplateParams {
  section_id: number;
  school_year_id: number;
  subject_id: number;
  quarter: number;
}

export const documentsApi = {
  list: (params?: { status?: string; section_id?: number; subject_id?: number }) => {
    const query = params
      ? "?" + new URLSearchParams(
          Object.entries(params)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : "";
    return api.get<DocumentRow[]>(`/documents${query}`);
  },
  upload: (formData: FormData) =>
    api.upload<DocumentRow>("/documents/upload", formData),
  download: (id: number) => {
    // Direct download via window.open (triggers browser download)
    const token = localStorage.getItem("hi5_portal_token");
    const base = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
    window.open(`${base}/documents/${id}/download?token=${token}`, "_blank");
  },
  template: (params: TemplateParams) => {
    const query = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ).toString();
    const token = localStorage.getItem("hi5_portal_token");
    const base = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
    window.open(`${base}/documents/template?${query}&token=${token}`, "_blank");
  },
  preview: (id: number) => api.get<GradePreviewResult>(`/documents/${id}/preview`),
  importGrades: (id: number) => api.post<ImportResult>(`/documents/${id}/import`, {}),
};
