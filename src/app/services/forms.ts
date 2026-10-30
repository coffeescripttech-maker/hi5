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
    principal_name: string | null;
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
    adviser_name: string | null;
    /** Strengthened SHS Curriculum: track name (Academic / TechPro) or legacy strand */
    strand_track_name?: string | null;
    track_type?: string | null;
  } | null;
  general_average: number | null;
  subjects: Array<{
    subject_name: string;
    subject_type: string;
    subject_group?: string | null;
    q1: number | null;
    q2: number | null;
    q3: number | null;
    final_average: number | null;
  }>;
}

export interface SF10Subject {
  subject_name: string;
  subject_type: string;
  subject_group?: string | null;
  q1: number | null;
  q2: number | null;
  q3: number | null;
  final_average: number | null;
}

export interface SF10SchoolYear {
  grade_level: number;
  section_name: string;
  sy_label: string;
  general_average: number | null;
  /** Strengthened SHS Curriculum: track name (Academic / TechPro) or legacy strand */
  strand_track_name?: string | null;
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

/** One saved school-form edit row (student_id null = form-level value). */
export interface FormEditRow {
  student_id: number | null;
  field_key: string;
  value: string;
  updated_by: number;
  updated_at: string;
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
  sf9FormData: (studentId: number, schoolYearId: number) =>
    api.get<{ observed_values: Record<string, string> }>(
      `/forms/sf9-data?student_id=${studentId}&school_year_id=${schoolYearId}`
    ),
  saveSF9FormData: (
    studentId: number,
    schoolYearId: number,
    observedValues: Record<string, string>
  ) =>
    api.put<{ observed_values: Record<string, string>; message: string }>(
      "/forms/sf9-data",
      { student_id: studentId, school_year_id: schoolYearId, observed_values: observedValues }
    ),
  sf10: (studentId: number) =>
    api.get<SF10Row>(`/forms/sf10?student_id=${studentId}`),

  // ── Saved School Form Edits (docs/MAJOR_CHANGES_IN_FORMS.txt) ──
  /** Batch of saved edits for a form/SY, scoped to student, section, or ids. */
  formEdits: (
    form: 'SF1' | 'SF5' | 'SF9' | 'SF10',
    schoolYearId: number,
    scope: { student_id?: number; section_id?: number; student_ids?: number[] } = {}
  ) => {
    const q = new URLSearchParams({ form, school_year_id: String(schoolYearId) });
    if (scope.student_id) q.set('student_id', String(scope.student_id));
    if (scope.section_id) q.set('section_id', String(scope.section_id));
    if (scope.student_ids?.length)
      q.set('student_ids', scope.student_ids.join(','));
    return api.get<{ edits: FormEditRow[]; carried?: FormEditRow[] }>(
      `/forms/edits?${q.toString()}`
    );
  },
  /** Save a batch of per-field edits (empty string value = cleared field). */
  saveFormEdits: (
    form: 'SF1' | 'SF5' | 'SF9' | 'SF10',
    schoolYearId: number,
    edits: { student_id?: number | null; field_key: string; value: string }[]
  ) =>
    api.put<{ message: string }>('/forms/edits', {
      form,
      school_year_id: schoolYearId,
      edits,
    }),
};
