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

export const documentsApi = {
  list: (params?: { status?: string; section_id?: number }) => {
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
    api.upload<DocumentRow>("/documents", formData),
  download: (id: number) => {
    // Direct download via window.open (triggers browser download)
    const token = localStorage.getItem("hi5_portal_token");
    const base = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
    window.open(`${base}/documents/${id}/download?token=${token}`, "_blank");
  },
};
