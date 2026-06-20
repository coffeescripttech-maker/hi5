/**
 * School Forms API service
 */
import { api } from "./api";

export interface SF1Row {
  /** student info */
  student_id: string;
  lrn: string;
  name: string;
  sex: "male" | "female";
  birthdate: string;
  age: number;
  guardian: string | null;
  address: string | null;
  /** per-subject grades for the first three grading periods */
  subjects: Array<{
    name: string;
    q1: number | null;
    q2: number | null;
    q3: number | null;
  }>;
  general_average: number | null;
}

export interface SF5Row {
  student_name: string;
  lrn: string;
  sex: string;
  subjects: Array<{
    name: string;
    final_grade: number | null;
    action: string;
  }>;
  general_average: number | null;
  remarks: string;
}

export interface SF9Row {
  student_name: string;
  lrn: string;
  grade_level: number;
  section_name: string;
  sy_label: string;
  subjects: Array<{
    name: string;
    q1: number | null;
    q2: number | null;
    q3: number | null;
    q4: number | null;
    final_grade: number | null;
    remarks: string;
  }>;
  general_average: number | null;
}

export interface SF10Row {
  student_name: string;
  lrn: string;
  birthdate: string;
  address: string | null;
  guardian: string | null;
  elementary: string | null;
  sy_label: string;
  grade_level: number;
  section_name: string;
  subjects: Array<{
    name: string;
    q1: number | null;
    q2: number | null;
    q3: number | null;
    q4: number | null;
    final_grade: number | null;
    remarks: string;
  }>;
  general_average: number | null;
}

export const formsApi = {
  sf1: (sectionId: number, schoolYearId: number) =>
    api.get<{ section: string; grade_level: number; students: SF1Row[] }>(
      `/forms/sf1?section_id=${sectionId}&school_year_id=${schoolYearId}`
    ),
  sf5: (sectionId: number, schoolYearId: number) =>
    api.get<{ section: string; grade_level: number; students: SF5Row[] }>(
      `/forms/sf5?section_id=${sectionId}&school_year_id=${schoolYearId}`
    ),
  sf9: (studentId: number, schoolYearId: number) =>
    api.get<SF9Row>(
      `/forms/sf9?student_id=${studentId}&school_year_id=${schoolYearId}`
    ),
  sf10: (studentId: number) =>
    api.get<SF10Row>(`/forms/sf10?student_id=${studentId}`),
};
