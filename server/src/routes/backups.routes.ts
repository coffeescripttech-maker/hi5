import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import { listBackups, createBackup } from "../controllers/backups.controller";

const router = Router();

router.use(authenticate, authorize("admin"));

router.get("/", listBackups);
router.post("/", createBackup);

export default router;
