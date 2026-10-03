/**
 * Documents API service
 */
import { api } from "./api";
import { saveOrShareResponse } from "./nativeExport";

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
  // Teacher-scoped: only files for the teacher's assigned subjects in the
  // active school year (GET /api/documents/my-documents).
  myDocuments: () => api.get<DocumentRow[]>("/documents/my-documents"),
  upload: (formData: FormData) =>
    api.upload<DocumentRow>("/documents/upload", formData),
  // Fetches through the authenticated API client (Bearer header) and routes
  // the bytes to the native share sheet on Capacitor, or a browser download on
  // the web. Avoids putting the JWT in the URL.
  download: async (id: number): Promise<void> => {
    const response = await api.getBlob(`/documents/${id}/download`);
    if (!response.ok) throw new Error(`Document download failed (${response.status})`);
    await saveOrShareResponse(response, `document-${id}`);
  },
  template: async (params: TemplateParams): Promise<void> => {
    const response = await api.getBlob("/documents/template", {
      section_id: params.section_id,
      subject_id: params.subject_id,
      school_year_id: params.school_year_id,
      quarter: params.quarter,
    });
    if (!response.ok) throw new Error(`Template download failed (${response.status})`);
    await saveOrShareResponse(response, "grades-template.xlsx");
  },
  preview: (id: number) => api.get<GradePreviewResult>(`/documents/${id}/preview`),
  importGrades: (id: number) => api.post<ImportResult>(`/documents/${id}/import`, {}),
};
