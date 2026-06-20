/**
 * At-Risk Predictions API service
 */
import { api } from "./api";

export interface AtRiskStudentRow {
  id: number;
  student_id: number;
  student_name: string;
  lrn: string;
  grade_level: number;
  section_name: string;
  school_year_id: number;
  q1_average: number | null;
  q2_average: number | null;
  q3_average: number | null;
  risk_score: number;
  risk_level: "at_risk" | "needs_monitoring" | "on_track";
  trend: "declining" | "stable" | "improving";
  predicted_by: number;
  predicted_by_name: string;
  created_at: string;
}

export interface PredictPayload {
  school_year_id: number;
  quarter?: number;
}

export const atRiskApi = {
  list: (params?: {
    risk_level?: string;
    grade_level?: number;
    section_id?: number;
  }) => {
    const query = params
      ? "?" + new URLSearchParams(
          Object.entries(params)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : "";
    return api.get<AtRiskStudentRow[]>(`/at-risk${query}`);
  },
  predict: (data: PredictPayload) =>
    api.post<{ message: string; count: number }>("/at-risk/predict", data),
};
