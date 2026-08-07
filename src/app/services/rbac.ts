import { api } from './api';
import type { Role } from '../navigation';

export interface RbacMyAccess {
  role: Role;
  menu_keys: string[];
}

export interface RbacMatrixRole {
  role: Role;
  permissions: Record<string, boolean>;
}

export interface RbacMatrix {
  roles: RbacMatrixRole[];
}

export const rbacApi = {
  /** Enabled menu keys for the signed-in user (drives sidebar filtering). */
  myAccess: () => api.get<RbacMyAccess>('/rbac/my-access'),

  /** Full permission matrix for the configurable roles (admin page). */
  matrix: () => api.get<RbacMatrix>('/rbac/matrix'),

  /** Toggle one module for one role. */
  setPermission: (role: Role, menu_key: string, enabled: boolean) =>
    api.put<{ message: string }>('/rbac/permissions', { role, menu_key, enabled }),

  /** Restore every module for a role to enabled. */
  resetRole: (role: Role) =>
    api.put<{ message: string }>('/rbac/reset', { role })
};
