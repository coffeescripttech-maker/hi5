/**
 * LIS Import — Registrar/Administrator only.
 * Client revision: Hi5_Portal_LIS_Import_Expected_Behavior.md.
 */

export interface LisPreviewMapping {
  field: string;
  index: number;
}

export interface LisPreviewCounts {
  matched_update: number;
  matched_no_change: number;
  mismatch: number;
  not_in_hi5: number;
  error: number;
}

export interface LisPreviewRow {
  rowNum: number;
  lrn: string;
  name: string;
  result: "matched_update" | "matched_no_change" | "mismatch" | "not_in_hi5" | "error";
  error?: string;
  mismatches?: string[];
  student_id?: number;
  hi5_name?: string;
  changes?: { field: string; old: string; new: string; group: string; savedEdit: boolean }[];
  has_saved_sf_edit?: boolean;
  pwd_value?: string;
  pwd_already?: boolean;
}

export interface LisPreviewResponse {
  mapping: Record<string, number>;
  header_texts: string[];
  counts: LisPreviewCounts;
  rows: LisPreviewRow[];
}

export interface LisApplyResponse extends LisPreviewResponse {
  message: string;
  applied: number;
  batch_id: string;
}

export const lisImportApi = {
  preview: (formData: globalThis.FormData) =>
    apiUploadForLis<LisPreviewResponse>("/lis/import/preview", formData),
  apply: (formData: globalThis.FormData) =>
    apiUploadForLis<LisApplyResponse>("/lis/import/apply", formData)
};

/** Multipart POST with the shared 401 wall (blob-style raw fetch). */
async function apiUploadForLis<T>(path: string, formData: globalThis.FormData): Promise<T> {
  const { API_BASE, getToken, ApiError, clearToken } = await import("./api");
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers, body: formData });
  if (!res.ok) {
    let detail: { error: string } = { error: `Request failed with status ${res.status}` };
    try {
      detail = (await res.json()) as { error: string };
    } catch {
      /* not JSON */
    }
    if (res.status === 401) {
      clearToken();
      try { localStorage.removeItem("hi5_portal_session"); } catch { /* ignore */ }
      window.location.replace("/login");
    }
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as T;
}
