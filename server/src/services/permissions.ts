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

export type Role = "admin" | "teacher" | "registrar" | "principal" | "enrollment_committee";

export const ROLES: Role[] = ["admin", "teacher", "registrar", "principal", "enrollment_committee"];

/** Roles the ICT Coordinator can configure from the RBAC page. */
export const CONFIGURABLE_ROLES: Role[] = ["teacher", "registrar", "principal", "enrollment_committee"];

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
    "admin_logs",
    "admin_rbac",
    "admin_rooms",
    "admin_profile",
    "admin_guide",
  ],
  teacher: [
    "teacher_dashboard",
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
    "teacher_reading_assessments",
    "teacher_profile",
    "teacher_guide",
  ],
  registrar: [
    "registrar_dashboard",
    "registrar_students",
    "registrar_section_assignment",
    "registrar_promotions",
    "registrar_graduates",
    "registrar_subjects",
    "registrar_forms_sf1",
    "registrar_forms_sf5",
    "registrar_forms_sf9",
    "registrar_forms_sf10",
    "registrar_reports",
    "registrar_sections",
    "registrar_grade_distribution",
    "registrar_grade_corrections",
    "registrar_transfers",
    "registrar_document_completion",
        "registrar_schedule",
    "registrar_master_schedule",
    "registrar_schedule_modifier",
    "registrar_lis_export",
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
    "principal_graduates",
    "principal_atrisk",
    "principal_export_documents",
    "principal_export_reports",
    "principal_export_data",
    "principal_profile",
    "principal_guide",
  ],
  // The Enrollment Committee carries Admin permissions plus its own duties:
  // enrollment, section assignment, document verification and transfer approval.
  enrollment_committee: [
    "committee_dashboard",
    "committee_enrollment",
    "committee_section_assignment",
    "committee_document_verification",
    "committee_transfers",
    "committee_profile",
    "committee_guide",
  ],
};

/** Menu keys the committee inherits and can never have switched off. */
const INHERITED_MENU_KEYS: Record<string, string[]> = {
  enrollment_committee: [
    ...MENU_KEYS_BY_ROLE.admin,
    ...MENU_KEYS_BY_ROLE.registrar,
  ],
};

/** True when a key is part of a role's locked, inherited scope. */
function isInheritedKey(role: Role, menuKey: string): boolean {
  return (INHERITED_MENU_KEYS[role] ?? []).includes(menuKey);
}

/** All keys a role effectively has: its own plus anything it inherits. */
export function effectiveMenuKeys(role: Role): string[] {
  return Array.from(new Set([...(INHERITED_MENU_KEYS[role] ?? []), ...MENU_KEYS_BY_ROLE[role]]));
}

interface PermissionRow extends RowDataPacket {
  role: string;
  menu_key: string;
  enabled: number;
}

/**
 * Resolve a role's effective permission map.
 * Keys absent from the table default to enabled (deny-list semantics).
 * Inherited keys (committee ← admin + registrar) are always on.
 */
export async function getPermissionMap(role: Role): Promise<Record<string, boolean>> {
  const map: Record<string, boolean> = {};
  for (const key of effectiveMenuKeys(role)) {
    map[key] = true;
  }

  const rows = await query<PermissionRow[]>(
    "SELECT role, menu_key, enabled FROM role_permissions WHERE role = ?",
    [role]
  );
  for (const row of rows) {
    if (row.menu_key in map && !isInheritedKey(role, row.menu_key)) {
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
  const allowed = effectiveMenuKeys(role);
  if (!allowed.includes(menuKey)) {
    throw new Error(`Unknown menu key "${menuKey}" for role "${role}".`);
  }
  if (isInheritedKey(role, menuKey)) {
    throw new Error(`"${menuKey}" is inherited and cannot be configured for role "${role}".`);
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
      // Inherited keys are shown too, flagged so the UI can render them locked.
      permissions: await getPermissionMap(role),
      inherited: INHERITED_MENU_KEYS[role] ?? [],
    }))
  );
  return roles;
}
