import { Request, Response, NextFunction } from "express";

/**
 * Restrict access to specific roles
 * Usage: router.get("/users", authorize("admin"), handler)
 *
 * The Enrollment Committee is configured with Admin-equivalent permissions, so
 * any guard that allows "admin" also admits "enrollment_committee". Keeping that
 * promotion here (rather than editing every admin guard) means new admin-only
 * routes are automatically available to the committee and cannot drift.
 */
export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }

    const role = req.user.role;
    const permitted =
      allowedRoles.includes(role) ||
      (role === "enrollment_committee" && allowedRoles.includes("admin"));

    if (!permitted) {
      res.status(403).json({
        error: "Access denied. You do not have permission for this action.",
        yourRole: role,
        requiredRoles: allowedRoles,
      });
      return;
    }

    next();
  };
}
