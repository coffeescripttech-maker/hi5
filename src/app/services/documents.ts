/**
 * Documents API service
 */
import { api, getToken } from "./api";

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
  download: (id: number): void =>
    // Same-tab anchor navigation — can't be popup-blocked, and the server
    // returns Content-Disposition: attachment so the tab stays put and the
    // file is saved with the server-provided name.
    triggerNavigationDownload(`/documents/${id}/download`),
  template: (params: TemplateParams): void =>
    triggerNavigationDownload("/documents/template", {
      section_id: params.section_id,
      subject_id: params.subject_id,
      school_year_id: params.school_year_id,
      quarter: params.quarter,
    }),
  preview: (id: number) => api.get<GradePreviewResult>(`/documents/${id}/preview`),
  importGrades: (id: number) => api.post<ImportResult>(`/documents/${id}/import`, {}),
};

// Same-tab download via a temporary anchor. The JWT is passed as a query
// parameter because a navigation can't set headers (the server accepts
// ?token= for download links); the file is saved through the response's
// Content-Disposition header, so a.download is intentionally not set.
function triggerNavigationDownload(
  path: string,
  params?: Record<string, string | number | undefined>
): void {
  const token = getToken();
  const sp = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    }
  }
  if (token) sp.set("token", token);
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
  const a = document.createElement("a");
  a.href = `${API_BASE}${path}?${sp.toString()}`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
