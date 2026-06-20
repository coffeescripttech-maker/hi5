import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  listSchoolYears,
  getCurrentSchoolYear,
  createSchoolYear,
  updateSchoolYear,
  setCurrentSchoolYear,
} from "../controllers/schoolYears.controller";

const router = Router();

router.use(authenticate);

router.get("/", listSchoolYears);
router.get("/current", getCurrentSchoolYear);
router.post("/", authorize("admin"), createSchoolYear);
router.put("/:id", authorize("admin"), updateSchoolYear);
router.post("/:id/set-current", authorize("admin"), setCurrentSchoolYear);

export default router;
