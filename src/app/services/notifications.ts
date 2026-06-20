/**
 * Notifications API service
 */
import { api } from "./api";

export interface NotificationRow {
  id: number;
  user_id: number | null;
  role: "admin" | "teacher" | "registrar" | null;
  type: "info" | "success" | "warning" | "error" | "security";
  title: string;
  message: string;
  created_at: string;
  is_read?: number;
}

export interface CreateNotificationPayload {
  role?: string;
  user_id?: number;
  type: string;
  title: string;
  message: string;
}

export const notificationsApi = {
  list: () => api.get<NotificationRow[]>("/notifications"),
  create: (data: CreateNotificationPayload) =>
    api.post<NotificationRow>("/notifications", data),
  markRead: (id: number) =>
    api.post<{ message: string }>(`/notifications/${id}/read`),
  markAllRead: () =>
    api.post<{ message: string }>("/notifications/read-all"),
};
