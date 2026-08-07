import { Request, Response } from "express";
import { logActivity } from "../utils/activityLogger";
import {
  Role,
  CONFIGURABLE_ROLES,
  getEnabledKeys,
  setPermission,
  resetRole,
  getAllMatrix,
} from "../services/permissions";

/**
 * GET /api/rbac/my-access — Enabled menu keys for the signed-in user.
 * The Layout filters each role's sidebar and blocks direct-URL access
 * to disabled modules using this list.
 */
export async function getMyAccess(req: Request, res: Response): Promise<void> {
  try {
    const role = req.user!.role as Role;
    const menu_keys = await getEnabledKeys(role);
    res.json({ role, menu_keys });
  } catch (error) {
    console.error("Get my access error:", error);
    res.status(500).json({ error: "Failed to load access permissions." });
  }
}

/**
 * GET /api/rbac/matrix — Permission matrix for the configurable roles
 * (admin role is always full-access and excluded).
 */
export async function getRbacMatrix(_req: Request, res: Response): Promise<void> {
  try {
    const roles = await getAllMatrix();
    res.json({ roles });
  } catch (error) {
    console.error("Get RBAC matrix error:", error);
    res.status(500).json({ error: "Failed to load role permissions." });
  }
}

/**
 * PUT /api/rbac/permissions — Toggle one module for one role.
 * Body: { role, menu_key, enabled }
 */
export async function updatePermission(req: Request, res: Response): Promise<void> {
  try {
    const { role, menu_key, enabled } = req.body;

    if (!role || !menu_key) {
      res.status(400).json({ error: "role and menu_key are required." });
      return;
    }
    if (!CONFIGURABLE_ROLES.includes(role as Role)) {
      res.status(400).json({
        error: "That role cannot be configured. Administrator always has full access.",
      });
      return;
    }
    if (typeof enabled !== "boolean") {
      res.status(400).json({ error: "enabled must be a boolean." });
      return;
    }

    await setPermission(role as Role, menu_key as string, enabled);

    await logActivity(
      req.user!.userId,
      enabled
        ? `Enabled "${menu_key}" for ${role} role`
        : `Disabled "${menu_key}" for ${role} role`,
      "role_permissions",
      null
    );

    res.json({ message: `Permission updated for ${role} (${menu_key} = ${enabled}).` });
  } catch (error: any) {
    console.error("Update permission error:", error);
    res.status(error?.message?.startsWith("Unknown menu key") ? 400 : 500).json({
      error: error?.message || "Failed to update permission.",
    });
  }
}

/**
 * PUT /api/rbac/reset — Restore every module for a role to enabled.
 * Body: { role }
 */
export async function resetRolePermissions(req: Request, res: Response): Promise<void> {
  try {
    const { role } = req.body;

    if (!role) {
      res.status(400).json({ error: "role is required." });
      return;
    }
    if (!CONFIGURABLE_ROLES.includes(role as Role)) {
      res.status(400).json({
        error: "That role cannot be configured. Administrator always has full access.",
      });
      return;
    }

    await resetRole(role as Role);

    await logActivity(
      req.user!.userId,
      `Reset ${role} role permissions to defaults`,
      "role_permissions",
      null
    );

    res.json({ message: `${role} role reset to default permissions.` });
  } catch (error) {
    console.error("Reset role permissions error:", error);
    res.status(500).json({ error: "Failed to reset role permissions." });
  }
}
