import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { heartbeat } from "../controllers/presence.controller";

const router = Router();

// Any authenticated user may ping presence (admin-only management
// stays behind the /api/users routes).
router.post("/heartbeat", authenticate, heartbeat);

export default router;