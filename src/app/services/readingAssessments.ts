/**
 * Reading assessments API service.
 *
 * A recorded reading assessment is the only basis for tagging a learner as
 * Non-Reader — it is never derived from grades or general averages.
 */
import { api } from './api';

export type ReadingResult = 'non_reader' | 'reader';

export interface ReadingAssessment {
  id: number;
  student_id: number;
  student_name: string;
  student_code: string;
  lrn: string;
  school_year_id: number;
  sy_label: string;
  assessment_date: string;
  result: ReadingResult;
  score: number | null;
  instrument: string | null;
  remarks: string | null;
  assessed_by: number;
  assessed_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface CreateReadingAssessmentPayload {
  student_id: number;
  school_year_id: number;
  assessment_date?: string;
  result: ReadingResult;
  score?: number | null;
  instrument?: string;
  remarks?: string;
}

export const readingAssessmentsApi = {
  list: (filters?: {
    student_id?: number;
    school_year_id?: number;
    result?: ReadingResult;
  }) => {
    const search = new URLSearchParams();
    if (filters?.student_id) search.set('student_id', String(filters.student_id));
    if (filters?.school_year_id) search.set('school_year_id', String(filters.school_year_id));
    if (filters?.result) search.set('result', filters.result);
    const s = search.toString();
    return api.get<ReadingAssessment[]>(`/reading-assessments${s ? `?${s}` : ''}`);
  },

  /** History for one learner (powers the Non-Reader tag decision). */
  forStudent: (studentId: number) =>
    api.get<ReadingAssessment[]>(`/reading-assessments/student/${studentId}`),

  create: (payload: CreateReadingAssessmentPayload) =>
    api.post<ReadingAssessment>('/reading-assessments', payload),

  /** Removes the assessment; the Non-Reader tag is cleared if no evidence remains. */
  remove: (id: number) =>
    api.del<{ message: string; non_reader_tag_cleared: boolean }>(`/reading-assessments/${id}`),
};