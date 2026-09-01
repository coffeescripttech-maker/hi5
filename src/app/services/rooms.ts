/**
 * Rooms API service
 */
import { api } from "./api";

export interface RoomRow {
  id: number;
  name: string;
  building: string | null;
  floor: string | null;
  capacity: number | null;
  room_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateRoomPayload {
  name: string;
  building?: string;
  floor?: string;
  capacity?: number;
  room_type?: string;
  status?: string;
}

export interface UpdateRoomPayload {
  name?: string;
  building?: string;
  floor?: string;
  capacity?: number;
  room_type?: string;
  status?: string;
}

export const roomsApi = {
  list: (params?: { status?: string }) => api.get<RoomRow[]>("/rooms", params),
  get: (id: number) => api.get<RoomRow>(`/rooms/${id}`),
  create: (data: CreateRoomPayload) => api.post<RoomRow>("/rooms", data),
  update: (id: number, data: UpdateRoomPayload) => api.put<RoomRow>(`/rooms/${id}`, data),
  delete: (id: number) => api.del(`/rooms/${id}`),
};