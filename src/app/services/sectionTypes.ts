/**
 * Section Types API service
 */
import { api } from "./api";

export interface SectionType {
  id: number;
  name: string;
  label: string;
  color_code: string | null;
  icon: string | null;
  sort_order: number;
  is_locked: number;
  is_active: number;
  created_at: string;
}

export const sectionTypesApi = {
  list: () => api.get<SectionType[]>("/section-types"),
  create: (data: { name: string; label: string; color_code?: string; icon?: string; sort_order?: number }) =>
    api.post<SectionType>("/section-types", data),
  update: (id: number, data: { label?: string; color_code?: string; icon?: string; sort_order?: number; is_active?: number }) =>
    api.put<SectionType>(`/section-types/${id}`, data),
  delete: (id: number) => api.del(`/section-types/${id}`),
};
