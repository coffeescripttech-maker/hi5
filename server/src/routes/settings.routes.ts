import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import { getSettings, updateSettings, getThresholds, updateThresholds } from "../controllers/settings.controller";

const router = Router();

router.use(authenticate, authorize("admin"));

router.get("/", getSettings);
router.put("/", updateSettings);
router.get("/thresholds", getThresholds);
router.put("/thresholds", updateThresholds);

export default router;
