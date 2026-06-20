import { Request, Response, NextFunction } from "express";

/**
 * Restrict access to specific roles
 * Usage: router.get("/users", authorize("admin"), handler)
 */
export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: "Access denied. You do not have permission for this action.",
        yourRole: req.user.role,
        requiredRoles: allowedRoles,
      });
      return;
    }

    next();
  };
}
