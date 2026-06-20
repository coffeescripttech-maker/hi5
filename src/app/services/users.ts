/**
 * Users API service
 */
import { api } from "./api";

export interface UserRow {
  id: number;
  username: string;
  name: string;
  email: string;
  role: "admin" | "teacher" | "registrar";
  status: "active" | "idle" | "inactive";
  phone: string | null;
  address: string | null;
  profile_photo_url: string | null;
  employee_id: string | null;
  designation: string | null;
  date_hired: string | null;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateUserPayload {
  username: string;
  password: string;
  name: string;
  email: string;
  role: "admin" | "teacher" | "registrar";
  phone?: string;
  address?: string;
  employee_id?: string;
  designation?: string;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  role?: "admin" | "teacher" | "registrar";
  status?: "active" | "idle" | "inactive";
  phone?: string;
  address?: string;
  employee_id?: string;
  designation?: string;
}

export const usersApi = {
  list: () => api.get<UserRow[]>("/users"),
  get: (id: number) => api.get<UserRow>(`/users/${id}`),
  create: (data: CreateUserPayload) => api.post<UserRow>("/users", data),
  update: (id: number, data: UpdateUserPayload) =>
    api.put<UserRow>(`/users/${id}`, data),
  delete: (id: number) => api.del(`/users/${id}`),
};
