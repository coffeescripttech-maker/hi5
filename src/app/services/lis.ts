/**
 * LIS Export API service
 * Triggers file downloads for DepEd Learner Information System submission:
 *  - CSV (legacy, unchanged) — for direct LIS portal upload
 *  - Excel (.xlsx) — official formatted workbooks
 *  - JSON datasets — consumed by the official PDF composer (lisPdf.ts)
 */
import { api } from "./api";

export type ExportParams = {
  school_year_id?: number;
  grade_level?: number;
  section_id?: number;
};

export type LisCard = "learner-profile" | "grades" | "enrolled-list";

export interface LisDataset {
  title: string;
  sy_label: string;
  columns: string[];
  rows: (string | number)[][];
}

/** Trigger a browser download from a blob Response. */
async function triggerDownload(response: Response, defaultFilename: string): Promise<void> {
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?(.+?)"?$/);
  const filename = match ? match[1] : defaultFilename;
  const blob = await response.blob();

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

async function downloadFile(url: string, params: ExportParams | undefined, defaultFilename: string): Promise<void> {
  const response = await api.getBlob(url, params || {});
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
  await triggerDownload(response, defaultFilename);
}

/** Fetch a dataset as JSON (used by the official PDF composer). */
async function fetchDataset(card: LisCard, params?: ExportParams): Promise<LisDataset> {
  const response = await api.getBlob("/lis/data", { card, ...params });
  if (!response.ok) {
    let message = `Failed to fetch export data (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  return response.json();
}

export const lisApi = {
  // Legacy CSV (unchanged)
  downloadLearnerProfile: (params?: ExportParams) =>
    downloadFile("/lis/learner-profile", params, "lis-learner-profile.csv"),

  downloadGrades: (params?: ExportParams) =>
    downloadFile("/lis/grades", params, "lis-grades.csv"),

  downloadEnrolledList: (params?: ExportParams) =>
    downloadFile("/lis/enrolled-list", params, "lis-enrolled-list.csv"),

  // Official Excel workbooks
  downloadLearnerProfileXlsx: (params?: ExportParams) =>
    downloadFile("/lis/learner-profile.xlsx", params, "lis-learner-profile.xlsx"),

  downloadGradesXlsx: (params?: ExportParams) =>
    downloadFile("/lis/grades.xlsx", params, "lis-grades.xlsx"),

  downloadEnrolledListXlsx: (params?: ExportParams) =>
    downloadFile("/lis/enrolled-list.xlsx", params, "lis-enrolled-list.xlsx"),

  // JSON dataset for PDF composition
  fetchData: fetchDataset,
};
