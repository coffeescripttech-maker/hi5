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
  student_id: number;
  student_id_display: string;
  lrn: string;
  name: string;
  grade_level: number;
  sex: string;
  section_name: string;
  section_type: string;
  general_average: number | null;
  promotion_status: 'PROMOTED' | 'RETAINED';
}

export interface SF5Response {
  form: string;
  school: {
    school_name: string;
    school_id: string;
  } | null;
  total_students: number;
  promoted: number;
  retained: number;
  students: SF5Row[];
}

export interface SF9Row {
  form: string;
  school: {
    school_name: string;
    school_id: string;
  } | null;
  student: {
    id: number;
    name: string;
    lrn: string;
    grade_level: number;
    sex: string;
    birthdate: string;
  } | null;
  enrollment: {
    section_name: string;
    sy_label: string;
    grade_level: number;
  } | null;
  general_average: number | null;
  subjects: Array<{
    subject_name: string;
    subject_type: string;
    q1: number | null;
    q2: number | null;
    q3: number | null;
    q4: number | null;
    final_average: number | null;
  }>;
}

export interface SF10Subject {
  subject_name: string;
  subject_type: string;
  q1: number | null;
  q2: number | null;
  q3: number | null;
  q4: number | null;
  final_average: number | null;
}

export interface SF10SchoolYear {
  grade_level: number;
  section_name: string;
  sy_label: string;
  general_average: number | null;
  subjects: SF10Subject[];
}

export interface SF10Row {
  form: string;
  school: {
    school_name: string;
    school_id: string;
  } | null;
  student: {
    id: number;
    student_id: string;
    lrn: string;
    name: string;
    grade_level: number;
    sex: string;
    birthdate: string;
    address: string | null;
    guardian: string | null;
    contact: string | null;
    status: string;
  } | null;
  /** Keyed by school year label (e.g. "2025-2026") */
  school_years: Record<string, SF10SchoolYear>;
}

export const formsApi = {
  sf1: (sectionId: number, schoolYearId: number) =>
    api.get<{ section: string; grade_level: number; students: SF1Row[] }>(
      `/forms/sf1?section_id=${sectionId}&school_year_id=${schoolYearId}`
    ),
  sf5: (sectionId: number, schoolYearId: number) =>
    api.get<SF5Response>(
      `/forms/sf5?section_id=${sectionId}&school_year_id=${schoolYearId}`
    ),
  sf9: (studentId: number, schoolYearId: number) =>
    api.get<SF9Row>(
      `/forms/sf9?student_id=${studentId}&school_year_id=${schoolYearId}`
    ),
  sf10: (studentId: number) =>
    api.get<SF10Row>(`/forms/sf10?student_id=${studentId}`),
};
