/**
 * Sections API service
 */
import { api } from "./api";

export interface SectionRow {
  id: number;
  name: string;
  grade_level: number;
  section_type: string;
  capacity: number;
  current_count: number;
  adviser_id: number | null;
  adviser_name: string | null;
  min_average: number;
  max_average: number | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSectionPayload {
  name: string;
  grade_level: number;
  section_type: string;
  capacity: number;
  adviser_id?: number;
  min_average: number;
  max_average?: number | null;
}

export interface UpdateSectionPayload {
  name?: string;
  section_type?: string;
  capacity?: number;
  adviser_id?: number | null;
  min_average?: number;
  max_average?: number | null;
  is_active?: number;
}

export interface TeacherBrief {
  id: number;
  name: string;
  employee_id: string | null;
  designation: string | null;
}

export const sectionsApi = {
  list: () => api.get<SectionRow[]>("/sections"),
  listTeachers: () => api.get<TeacherBrief[]>("/sections/teachers"),
  listMySections: () => api.get<SectionRow[]>("/sections/my-sections"),
  /** Only the section(s) the teacher advises (R20/R22 — promotion scope). */
  listMyAdvisorySections: () =>
    api.get<SectionRow[]>("/sections/my-sections?advisory=1"),
  get: (id: number) => api.get<SectionRow>(`/sections/${id}`),
  create: (data: CreateSectionPayload) =>
    api.post<SectionRow>("/sections", data),
  update: (id: number, data: UpdateSectionPayload) =>
    api.put<SectionRow>(`/sections/${id}`, data),
  delete: (id: number) => api.del(`/sections/${id}`),
};

/* ── Subject teachers per section (docs/new_requirement.txt R1-R10) ─────── */

export interface SubjectTeachersRow {
  id: number;
  name: string;
  subject_type: string | null;
  subject_group: string | null;
  program: string | null;
  hours_per_week: number | null;
  teacher_ids: number[];
  teachers: { id: number; name: string }[];
}

export interface UpdateTeachersResponse {
  id: number;
  added: number;
  removed: number;
  /** Master-Schedule overlap notes — warn only, the save itself succeeded. */
  warnings: string[];
}

export interface ApplyTeachersResponse {
  assigned: number[];
  skipped: { section_id: number; reason: string }[];
  warnings: string[];
}

export interface TeachingCoverageRow {
  section_id: number;
  name: string;
  grade_level: number;
  section_type: string;
  subjects_total: number;
  subjects_without_teacher: number;
}

export interface CopyTeachersResponse {
  copied: number;
  sections_touched: number;
  sections_without_match?: string[];
  message?: string;
}

/** subject_id -> teacher ids for one save (full replace per section). */
export type TeacherDraft = Record<number, number[]>;

export const assignmentsFromDraft = (draft: TeacherDraft) =>
  Object.entries(draft)
    .filter(([, ids]) => ids.length > 0)
    .map(([subject_id, teacher_ids]) => ({
      subject_id: Number(subject_id),
      teacher_ids,
    }));

export const updateTeachers = (
  sectionId: number,
  data: {
    school_year_id: number;
    assignments: { subject_id: number; teacher_ids: number[] }[];
  }
) => api.put<UpdateTeachersResponse>(`/sections/${sectionId}/teachers`, data);

export const getSectionTeachers = (sectionId: number, schoolYearId: number) =>
  api.get<{ subjects: SubjectTeachersRow[] }>(
    `/sections/${sectionId}/teachers?school_year_id=${schoolYearId}`
  );

export const subjectCatalog = (gradeLevel: number, sectionType: string) =>
  api.get<Omit<SubjectTeachersRow, "teacher_ids" | "teachers">[]>(
    `/sections/subject-catalog?grade_level=${gradeLevel}&section_type=${encodeURIComponent(sectionType)}`
  );

export const applyTeachers = (data: {
  school_year_id: number;
  subject_id: number;
  teacher_ids: number[];
  section_ids: number[];
}) => api.post<ApplyTeachersResponse>("/sections/teachers/apply", data);

export const teachingCoverage = (schoolYearId: number) =>
  api.get<TeachingCoverageRow[]>(
    `/sections/teaching-coverage?school_year_id=${schoolYearId}`
  );

export const copyPreviousYear = (data: {
  from_school_year_id: number;
  to_school_year_id: number;
  overwrite?: boolean;
}) => api.post<CopyTeachersResponse>("/sections/teachers/copy-previous-year", data);
