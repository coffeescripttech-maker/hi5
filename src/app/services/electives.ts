/**
 * Electives API service — Strengthened SHS Curriculum
 *
 * Endpoints (backend: /api/electives):
 * - GET  /catalog               — grouped elective catalog (per school year)
 * - GET  /assignments           — a learner's elective picks for a school year
 * - PUT  /assignments           — replace a learner's picks (committee workflow)
 * - POST /offerings/off|on      — per school year elective on/off switches (admin)
 * - GET  /roster                — learners who picked one elective
 */
import { api } from './api';

export interface ElectiveSubject {
  id: number;
  name: string;
  grade_level: number;
  /** 1 = offered for the school year, 0 = switched off (exclusion row). */
  is_offered: number;
}

export interface ElectiveCatalogGroup {
  track_id: number;
  track_name: string;
  cluster: string;
  subjects: ElectiveSubject[];
}

export interface ElectiveAssignment {
  subject_id: number;
  subject_name: string;
  elective_cluster: string | null;
  is_offered: number;
}

export interface ElectiveRosterEntry {
  student_id: number;
  student_name: string;
  lrn: string | null;
  student_number: string | null;
  section_name: string | null;
  grade_level: number | null;
}

/** One row of the batch elective map (all learners for one school year). */
export interface ElectiveBatchRow {
  student_id: number;
  subject_id: number;
  subject_name: string;
  elective_cluster: string | null;
}

export const electivesApi = {
  catalog: (school_year_id: number) =>
    api.get<ElectiveCatalogGroup[]>('/electives/catalog', { school_year_id }),
  assignments: (school_year_id: number, student_id: number) =>
    api.get<ElectiveAssignment[]>('/electives/assignments', {
      school_year_id,
      student_id,
    }),
  saveAssignments: (payload: {
    school_year_id: number;
    student_id: number;
    subject_ids: number[];
  }) =>
    api.put<{ saved: number }>('/electives/assignments', payload),
  /** All learners' elective picks for a school year (SF1 / committee views). */
  assignmentsBatch: (school_year_id: number) =>
    api.get<ElectiveBatchRow[]>('/electives/assignments/batch', {
      school_year_id,
    }),
  /** Switch electives on/off per school year (admin; one call per subject). */
  setOfferings: async (
    school_year_id: number,
    subject_ids: number[],
    offered: boolean
  ) => {
    let updated = 0;
    for (const subject_id of subject_ids) {
      await api.post(`/electives/offerings/${offered ? 'on' : 'off'}`, {
        school_year_id,
        subject_id,
      });
      updated++;
    }
    return { updated };
  },
  roster: (school_year_id: number, subject_id: number) =>
    api.get<ElectiveRosterEntry[]>('/electives/roster', {
      school_year_id,
      subject_id,
    }),
};
