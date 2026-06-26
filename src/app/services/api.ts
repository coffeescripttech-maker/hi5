/**
 * HI5 Portal API Service
 *
 * Centralized HTTP client with:
 * - Auto-attached JWT token from localStorage
 * - Consistent error handling (all API errors parsed into `ApiError`)
 * - 401 auto-redirect to login
 * - Type-safe request methods
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

// ─── Token Management ───────────────────────────────────────────────────────

const TOKEN_KEY = "hi5_portal_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ─── Error Types ────────────────────────────────────────────────────────────

export interface ApiErrorDetail {
  error: string;
  /** Present on 401 when wrong password: remaining attempts before lockout */
  attemptsRemaining?: number;
  /** Present on 423 when locked out */
  lockedUntil?: string;
  locked?: boolean;
  /** Present on 403 */
  yourRole?: string;
  requiredRoles?: string[];
}

export class ApiError extends Error {
  status: number;
  detail: ApiErrorDetail;

  constructor(status: number, detail: ApiErrorDetail) {
    super(detail.error || `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }

  get attemptsRemaining(): number | undefined {
    return this.detail.attemptsRemaining;
  }

  get isLocked(): boolean {
    return this.status === 423 || !!this.detail.locked;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }
}

// ─── Request Helpers ────────────────────────────────────────────────────────

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** Don't throw on error status — useful for reading lockout info etc. */
  noThrow?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, noThrow = false } = opts;

  const token = getToken();

  const hdrs: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (token) {
    hdrs["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: hdrs,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail: ApiErrorDetail;
    try {
      detail = (await res.json()) as ApiErrorDetail;
    } catch {
      detail = { error: `Request failed with status ${res.status}` };
    }

    const err = new ApiError(res.status, detail);

    // Auto-redirect on 401 (expired or invalid token)
    if (res.status === 401 && token) {
      clearToken();
      // Use replace so back button doesn't bounce
      window.location.replace("/login");
      // Throw to stop execution — the redirect will happen
      throw err;
    }

    if (noThrow) {
      // Return the error as the result type — caller handles it
      // We re-throw because we can't return T from a failed request
      throw err;
    }

    throw err;
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Build a query string from an object, omitting nullish values */
function buildQuery(params?: Record<string, string | number | undefined>): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== "");
  if (entries.length === 0) return "";
  return "?" + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&");
}

export const api = {
  get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    return request<T>(`${path}${buildQuery(params)}`);
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: "POST", body });
  },

  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: "PUT", body });
  },

  del<T = { message: string }>(path: string): Promise<T> {
    return request<T>(path, { method: "DELETE" });
  },

  /**
   * Upload a file via multipart form-data.
   * Does NOT set Content-Type (browser sets it with boundary).
   */
  upload<T>(path: string, formData: FormData): Promise<T> {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return request<T>(path, {
      method: "POST",
      body: formData,
      headers,
    });
  },
};

// ─── Auth API ───────────────────────────────────────────────────────────────

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    username: string;
    name: string;
    email: string;
    role: "admin" | "teacher" | "registrar";
    status: string;
  };
}

export interface UserProfile {
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
}

export const authApi = {
  login: (data: LoginPayload) => api.post<LoginResponse>("/auth/login", data),
  me: () => api.get<UserProfile>("/auth/me"),
  updateMe: (data: { name?: string; email?: string; phone?: string; address?: string }) =>
    api.put<UserProfile>("/auth/me", data),
  logout: () => api.post<{ message: string }>("/auth/logout"),
};
