import { RowDataPacket, ResultSetHeader } from "mysql2";
import { query } from "../config/database";

/**
 * Role-Based Access Control — menu-permission service.
 *
 * Deny-list model: a module is ENABLED by default. The role_permissions
 * table only records overrides; a row with enabled = 0 hides and blocks
 * that module for the role. getPermissionMap() merges missing keys as
 * enabled, so new modules default to visible and nothing breaks.
 *
 * The key lists here MUST mirror the keys in src/app/navigation.ts.
 */

export type Role = "admin" | "teacher" | "registrar" | "principal";

export const ROLES: Role[] = ["admin", "teacher", "registrar", "principal"];

/** Roles the ICT Coordinator can configure from the RBAC page. */
export const CONFIGURABLE_ROLES: Role[] = ["teacher", "registrar", "principal"];

/** Authoritative per-role menu keys (mirrors src/app/navigation.ts). */
export const MENU_KEYS_BY_ROLE: Record<Role, string[]> = {
  admin: [
    "admin_dashboard",
    "admin_users",
    "admin_subjects",
    "admin_sections",
    "admin_academic_year",
    "admin_forms_sf1",
    "admin_forms_sf5",
    "admin_forms_sf9",
    "admin_forms_sf10",
    "admin_settings",
    "admin_backup",
    "admin_lis_export",
    "admin_logs",
    "admin_rbac",
    "admin_profile",
    "admin_guide",
  ],
  teacher: [
    "teacher_dashboard",
    "teacher_enroll",
    "teacher_my_students",
    "teacher_sections",
    "teacher_promote",
    "teacher_schedule",
    "teacher_forms_sf1",
    "teacher_forms_sf5",
    "teacher_forms_sf9",
    "teacher_forms_sf10",
    "teacher_grades",
    "teacher_upload",
    "teacher_documents",
    "teacher_atrisk",
    "teacher_profile",
    "teacher_guide",
  ],
  registrar: [
    "registrar_dashboard",
    "registrar_students",
    "registrar_section_assignment",
    "registrar_promotions",
    "registrar_subjects",
    "registrar_forms_sf1",
    "registrar_forms_sf5",
    "registrar_forms_sf9",
    "registrar_forms_sf10",
    "registrar_reports",
    "registrar_sections",
    "registrar_grade_distribution",
    "registrar_grade_corrections",
    "registrar_document_completion",
    "registrar_atrisk",
    "registrar_certificate_enrollment",
    "registrar_certificate_good_moral",
    "registrar_profile",
    "registrar_guide",
  ],
  principal: [
    "principal_dashboard",
    "principal_enrollment",
    "principal_enrollment_trend",
    "principal_sections",
    "principal_grades",
    "principal_promotions",
    "principal_atrisk",
    "principal_profile",
    "principal_guide",
  ],
};

interface PermissionRow extends RowDataPacket {
  role: string;
  menu_key: string;
  enabled: number;
}

/**
 * Resolve a role's effective permission map.
 * Keys absent from the table default to enabled (deny-list semantics).
 */
export async function getPermissionMap(role: Role): Promise<Record<string, boolean>> {
  const map: Record<string, boolean> = {};
  for (const key of MENU_KEYS_BY_ROLE[role]) {
    map[key] = true;
  }

  const rows = await query<PermissionRow[]>(
    "SELECT role, menu_key, enabled FROM role_permissions WHERE role = ?",
    [role]
  );
  for (const row of rows) {
    if (row.menu_key in map) {
      map[row.menu_key] = row.enabled === 1;
    }
  }
  return map;
}

/** Enabled menu keys for a role (used by GET /api/rbac/my-access). */
export async function getEnabledKeys(role: Role): Promise<string[]> {
  const map = await getPermissionMap(role);
  return Object.keys(map).filter(key => map[key]);
}

/** Upsert a single permission override. */
export async function setPermission(
  role: Role,
  menuKey: string,
  enabled: boolean
): Promise<void> {
  if (!MENU_KEYS_BY_ROLE[role].includes(menuKey)) {
    throw new Error(`Unknown menu key "${menuKey}" for role "${role}".`);
  }
  await query<ResultSetHeader>(
    `INSERT INTO role_permissions (role, menu_key, enabled)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
    [role, menuKey, enabled ? 1 : 0]
  );
}

/** Remove every override for a role → all modules back to default-enabled. */
export async function resetRole(role: Role): Promise<void> {
  await query<ResultSetHeader>(
    "DELETE FROM role_permissions WHERE role = ?",
    [role]
  );
}

/** Full matrix for the RBAC page (configurable roles only). */
export async function getAllMatrix() {
  const roles = await Promise.all(
    CONFIGURABLE_ROLES.map(async role => ({
      role,
      permissions: await getPermissionMap(role),
    }))
  );
  return roles;
}
