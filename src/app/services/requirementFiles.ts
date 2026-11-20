/**
 * Digital Requirements Upload (client revision #1) — frontend service.
 *
 * Files live behind the authenticated /api/enrollment-files endpoints:
 * Committee + Registrar upload/replace/delete; Administrator views only.
 * Teacher and Principal have no access at all (the server enforces 403).
 */
import { getToken } from "./api";

export interface RequirementFileRow {
  id: number;
  enrollment_id: number;
  requirement_key: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  uploaded_by: number;
  uploaded_by_name?: string;
  created_at: string;
}

const base = async (): Promise<string> => {
  const { API_BASE } = await import("./api");
  return API_BASE;
};

const authHeadersSync = (): Record<string, string> => {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};

const authHeaders = async (): Promise<Record<string, string>> => {
  const { getToken, clearToken } = await import("./api");
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  void clearToken;
  return headers;
};

const requireFilesApi = {
  /** All files attached to the enrollment (any requirement). */
  list: async (enrollmentId: number): Promise<RequirementFileRow[]> => {
    const { getToken, ApiError, clearToken } = await import("./api");
    const res = await fetch(`${await base()}/enrollment-files/${enrollmentId}/requirement-files`, {
      headers: await authHeaders()
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
      if (res.status === 401) {
        clearToken();
        window.location.replace("/login");
      }
      throw new ApiError(res.status, detail);
    }
    return (await res.json()) as RequirementFileRow[];
  },

  /** Multipart upload (PDF/JPG/PNG, ≤5 MB, ≤3 per requirement). */
  upload: async (enrollmentId: number, key: string, file: File): Promise<RequirementFileRow> => {
    const { getToken, ApiError, clearToken } = await import("./api");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(
      `${await base()}/enrollment-files/${enrollmentId}/requirements/${encodeURIComponent(key)}/files`,
      { method: "POST", headers: await authHeaders(), body: fd }
    );
    if (!res.ok) {
      const detail = await res.json().catch(() => ({ error: `Upload failed (${res.status})` }));
      if (res.status === 401) {
        clearToken();
        window.location.replace("/login");
      }
      throw new ApiError(res.status, detail);
    }
    return (await res.json()) as RequirementFileRow;
  },

  /** Replace one file atomically — the server validates the new copy before
   *  removing the old one, so a failed upload never loses the original. */
  replace: async (enrollmentId: number, key: string, fileId: number, file: File): Promise<RequirementFileRow> => {
    const { getToken, ApiError, clearToken } = await import("./api");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(
      `${await base()}/enrollment-files/${enrollmentId}/requirements/${encodeURIComponent(key)}/files/${fileId}`,
      { method: "PUT", headers: await authHeaders(), body: fd }
    );
    if (!res.ok) {
      const detail = await res.json().catch(() => ({ error: `Replace failed (${res.status})` }));
      if (res.status === 401) {
        clearToken();
        window.location.replace("/login");
      }
      throw new ApiError(res.status, detail);
    }
    return (await res.json()) as RequirementFileRow;
  },

  /** Multipart upload with real progress (XHR) — client doc #1 asks for
   *  visible upload progress with a Retry on failure. */
  uploadWithProgress: (
    enrollmentId: number,
    key: string,
    file: File,
    onProgress: (pct: number) => void
  ): Promise<RequirementFileRow> =>
    new Promise(async (resolve, reject) => {
      const { ApiError, clearToken } = await import("./api");
      const xhr = new XMLHttpRequest();
      xhr.open(
        "POST",
        `${await base()}/enrollment-files/${enrollmentId}/requirements/${encodeURIComponent(key)}/files`
      );
      const headers = authHeadersSync();
      for (const [h, v] of Object.entries(headers)) xhr.setRequestHeader(h, v);
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText) as RequirementFileRow);
          } catch {
            reject(new ApiError(xhr.status, { error: "Malformed server response." }));
          }
        } else {
          let detail: { error: string } = { error: `Upload failed (${xhr.status})` };
          try {
            detail = JSON.parse(xhr.responseText);
          } catch {
            /* not JSON */
          }
          if (xhr.status === 401) {
            clearToken();
            window.location.replace("/login");
          }
          reject(new ApiError(xhr.status, detail));
        }
      };
      xhr.onerror = () => reject(new ApiError(0, { error: "Network error during upload." }));
      const fd = new FormData();
      fd.append("file", file);
      xhr.send(fd);
    }),

  delete: async (enrollmentId: number, key: string, fileId: number): Promise<void> => {
    const { getToken, ApiError, clearToken } = await import("./api");
    const res = await fetch(
      `${await base()}/enrollment-files/${enrollmentId}/requirements/${encodeURIComponent(key)}/files/${fileId}`,
      { method: "DELETE", headers: await authHeaders() }
    );
    if (!res.ok) {
      const detail = await res.json().catch(() => ({ error: `Delete failed (${res.status})` }));
      if (res.status === 401) {
        clearToken();
        window.location.replace("/login");
      }
      throw new ApiError(res.status, detail);
    }
  },

  /** Stream one file through the authenticated endpoint as an object URL
   *  (never a permanent public link — the URL dies with the page). */
  openView: async (enrollmentId: number, key: string, fileId: number): Promise<string> => {
    const { getToken, ApiError, clearToken } = await import("./api");
    const res = await fetch(
      `${await base()}/enrollment-files/${enrollmentId}/requirements/${encodeURIComponent(key)}/files/${fileId}`,
      { headers: await authHeaders() }
    );
    if (!res.ok) {
      const detail = await res.json().catch(() => ({ error: `View failed (${res.status})` }));
      if (res.status === 401) {
        clearToken();
        window.location.replace("/login");
      }
      throw new ApiError(res.status, detail);
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }
};

export { requireFilesApi };
