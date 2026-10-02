/**
 * Transfer requests API service.
 *
 * Registrar files Transfer-In / Transfer-Out requests; the Enrollment Committee
 * approves or rejects them. A filed request can be withdrawn while it is still
 * pending.
 */
import { api } from './api';

export type TransferType = 'transfer_in' | 'transfer_out';
export type TransferStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface TransferRequest {
  id: number;
  student_id: number;
  student_name: string;
  student_code: string;
  lrn: string;
  grade_level: number;
  transfer_type: TransferType;
  school_year_id: number;
  sy_label: string;
  requested_section_id: number | null;
  requested_section_name: string | null;
  enrolled_section_name: string | null;
  /** The learner's active enrollment for this request's school year, if any. */
  active_enrollment_id: number | null;
  active_enrollment_section_id: number | null;
  active_section_name: string | null;
  /**
   * 0 when the request cannot be approved — a Transfer-Out whose learner has no
   * active enrollment in the request's school year. The committee can still
   * reject or withdraw it, but Approve would find nothing to close.
   */
  is_approvable: number;
  previous_school: string | null;
  destination_school: string | null;
  reason: string | null;
  status: TransferStatus;
  requested_by: number;
  requested_by_name: string;
  reviewed_by: number | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_remarks: string | null;
  enrollment_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTransferPayload {
  transfer_type: TransferType;
  school_year_id: number;
  /** Existing learner. Omit together with `lrn` to register a new transfer-in. */
  student_id?: number;
  /** Existing LRN is reused; otherwise a new learner is registered. */
  lrn?: string;
  student_name?: string;
  sex?: 'male' | 'female';
  birthdate?: string;
  grade_level?: number;
  /** Section proposed for a Transfer-In (committee may change it on approval). */
  section_id?: number | null;
  previous_school?: string;
  destination_school?: string;
  reason?: string;
}

export interface ReviewTransferPayload {
  decision: 'approved' | 'rejected';
  remarks?: string;
  /** Required when approving a Transfer-In that has no proposed section. */
  section_id?: number | null;
}

export interface TransferFilters {
  status?: TransferStatus;
  transfer_type?: TransferType;
  school_year_id?: number;
  student_id?: number;
}

function qs(params?: Record<string, string | number | undefined>): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export const transfersApi = {
  list: (filters?: TransferFilters) =>
    api.get<TransferRequest[]>(
      `/transfers${qs({
        status: filters?.status,
        transfer_type: filters?.transfer_type,
        school_year_id: filters?.school_year_id,
        student_id: filters?.student_id,
      })}`
    ),

  get: (id: number) => api.get<TransferRequest>(`/transfers/${id}`),

  /** Registrar (or Admin) files a request; it starts as 'pending'. */
  create: (payload: CreateTransferPayload) =>
    api.post<TransferRequest>('/transfers', payload),

  /** Enrollment Committee decision. Approving a Transfer-In enrols the learner. */
  review: (id: number, payload: ReviewTransferPayload) =>
    api.put<TransferRequest>(`/transfers/${id}/decision`, payload),

  /** Withdraw a still-pending request. */
  cancel: (id: number) => api.put<TransferRequest>(`/transfers/${id}/cancel`, {}),
};