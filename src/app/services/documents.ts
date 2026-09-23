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
  // Teacher-scoped: only files for the teacher's assigned subjects in the
  // active school year (GET /api/documents/my-documents).
  myDocuments: () => api.get<DocumentRow[]>("/documents/my-documents"),
  upload: (formData: FormData) =>
    api.upload<DocumentRow>("/documents/upload", formData),
  download: async (id: number): Promise<void> => {
    // Blob fetch with the Authorization header — avoids popup blockers and the
    // blank-tab behavior of window.open.
    const response = await api.getBlob(`/documents/${id}/download`);
    if (!response.ok) {
      let message = `Download failed (${response.status})`;
      try {
        const body = await response.json();
        if (body?.error) message = body.error;
      } catch {
        /* not JSON */
      }
      throw new Error(message);
    }
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?(.+?)"?$/);
    const filename = match ? match[1] : `document-${id}`;
    await saveBlob(response, filename);
  },
  template: async (params: TemplateParams): Promise<void> => {
    // Blob fetch with the Authorization header — avoids popup blockers and the
    // blank-tab behavior of window.open.
    const response = await api.getBlob("/documents/template", { ...params });
    if (!response.ok) {
      let message = `Template download failed (${response.status})`;
      try {
        const body = await response.json();
        if (body?.error) message = body.error;
      } catch {
        /* not JSON */
      }
      throw new Error(message);
    }
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?(.+?)"?$/);
    const filename = match ? match[1] : "grade-template.xlsx";
    await saveBlob(response, filename);
  },
  preview: (id: number) => api.get<GradePreviewResult>(`/documents/${id}/preview`),
  importGrades: (id: number) => api.post<ImportResult>(`/documents/${id}/import`, {}),
};

async function saveBlob(response: Response, defaultFilename: string): Promise<void> {
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}
