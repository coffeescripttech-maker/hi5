/**
 * Schedules API service
 */
import { api } from "./api";

export interface ScheduleRow {
  id: number;
  teacher_id: number;
  section_id: number;
  subject_id: number;
  school_year_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  created_at: string;
  updated_at: string;
  teacher_name: string;
  section_name: string;
  subject_name: string;
  sy_label: string;
}

export interface CreateSchedulePayload {
  teacher_id: number;
  section_id: number;
  subject_id: number;
  school_year_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room?: string;
}

export interface UpdateSchedulePayload {
  teacher_id?: number;
  section_id?: number;
  subject_id?: number;
  school_year_id?: number;
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  room?: string;
}

export const schedulesApi = {
  list: (params?: {
    teacher_id?: number;
    section_id?: number;
    subject_id?: number;
    school_year_id?: number;
  }) => api.get<ScheduleRow[]>("/schedules", { params }),
  get: (id: number) => api.get<ScheduleRow>(`/schedules/${id}`),
  create: (data: CreateSchedulePayload) =>
    api.post<ScheduleRow>("/schedules", data),
  update: (id: number, data: UpdateSchedulePayload) =>
    api.put<ScheduleRow>(`/schedules/${id}`, data),
  delete: (id: number) => api.del(`/schedules/${id}`),
};
