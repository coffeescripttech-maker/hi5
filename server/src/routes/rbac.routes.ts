import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  getMyAccess,
  getRbacMatrix,
  updatePermission,
  resetRolePermissions,
} from "../controllers/rbac.controller";

const router = Router();

// Every endpoint requires authentication
router.use(authenticate);

// Any authenticated user — used by the sidebar to filter visible modules
router.get("/my-access", getMyAccess);

// Admin-only: permission matrix + toggles (RBAC control panel)
router.get("/matrix", authorize("admin"), getRbacMatrix);
router.put("/permissions", authorize("admin"), updatePermission);
router.put("/reset", authorize("admin"), resetRolePermissions);

export default router;
