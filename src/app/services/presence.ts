/**
 * Presence API service
 * Best-effort heartbeat that keeps the admin User Management page's
 * online / idle / offline status in sync with real user activity.
 */
import { API_BASE, getToken } from "./api";

export const presenceApi = {
  /**
   * Fire-and-forget beat. Uses a raw fetch (no 401 auto-redirect) so a
   * stale token can never bounce the user to the login screen mid-click;
   * worst case the beat is lost and the row stays online until it drains.
   */
  heartbeat: (): Promise<void> => {
    const token = getToken();
    if (!token) return Promise.resolve();
    return fetch(`${API_BASE}/presence/heartbeat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then(() => {})
      .catch(() => {});
  },
};