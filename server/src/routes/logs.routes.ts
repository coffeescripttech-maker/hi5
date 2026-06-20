import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import { listLogs } from "../controllers/logs.controller";

const router = Router();

router.use(authenticate, authorize("admin"));

router.get("/", listLogs);

export default router;
