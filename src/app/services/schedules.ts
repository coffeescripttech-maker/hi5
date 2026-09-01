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
  room_id: number | null;
  room_name: string | null;
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
  room_id?: number | null;
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
  room_id?: number | null;
}

export interface ScheduleConflict {
  type: "room" | "teacher" | "section";
  message: string;
  existing: {
    subject_name: string;
    section_name: string;
    teacher_name: string;
    room_name: string | null;
  };
}

export interface ScheduleHistoryRow {
  id: number;
  schedule_id: number;
  changed_by: number;
  changed_by_name?: string;
  change_type: "update" | "reassign_room" | "reassign_teacher" | "reschedule";
  old_day: number | null;
  old_start: string | null;
  old_end: string | null;
  old_room: string | null;
  new_day: number | null;
  new_start: string | null;
  new_end: string | null;
  new_room: string | null;
  reason: string | null;
  created_at: string;
}

export const schedulesApi = {
  list: (params?: {
    teacher_id?: number;
    section_id?: number;
    subject_id?: number;
    school_year_id?: number;
  }) => api.get<ScheduleRow[]>("/schedules", params),
  get: (id: number) => api.get<ScheduleRow>(`/schedules/${id}`),
  create: (data: CreateSchedulePayload) =>
    api.post<ScheduleRow>("/schedules", data),
  update: (id: number, data: UpdateSchedulePayload & { reason?: string }) =>
    api.put<ScheduleRow>(`/schedules/${id}`, data),
  delete: (id: number) => api.del(`/schedules/${id}`),
  history: (id: number) => api.get<ScheduleHistoryRow[]>(`/schedules/${id}/history`),
  checkConflicts: (data: {
    schedule_id?: number;
    teacher_id: number;
    section_id: number;
    school_year_id: number;
    day_of_week: number;
    start_time: string;
    end_time: string;
    room_id?: number | null;
  }) => api.post<{ conflicts: ScheduleConflict[] }>("/schedules/check-conflicts", data),
};
