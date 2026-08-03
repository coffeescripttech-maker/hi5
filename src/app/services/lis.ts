/**
 * LIS Export API service
 * Triggers CSV file downloads for DepEd Learner Information System submission
 */
import { api } from "./api";

interface ExportParams {
  school_year_id?: number;
  grade_level?: number;
  section_id?: number;
}

async function downloadCSV(url: string, params: ExportParams | undefined, defaultFilename: string): Promise<void> {
  const response = await api.getBlob(url, params || {});
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?(.+?)"?$/);
  const filename = match ? match[1] : defaultFilename;
  const blob = await response.blob();

  // Trigger download
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

export const lisApi = {
  downloadLearnerProfile: (params?: ExportParams) =>
    downloadCSV("/lis/learner-profile", params, "lis-learner-profile.csv"),

  downloadGrades: (params?: ExportParams) =>
    downloadCSV("/lis/grades", params, "lis-grades.csv"),

  downloadEnrolledList: (params?: ExportParams) =>
    downloadCSV("/lis/enrolled-list", params, "lis-enrolled-list.csv"),
};
