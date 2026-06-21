import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  listEnrollments,
  getEnrollmentById,
  createEnrollment,
  updateEnrollment,
  listRequirements,
  updateRequirements,
} from "../controllers/enrollments.controller";

const router = Router();

router.use(authenticate);

router.get("/", listEnrollments);
router.get("/:id", getEnrollmentById);
router.post("/", authorize("admin", "teacher", "registrar"), createEnrollment);
router.put("/:id", authorize("admin", "teacher", "registrar"), updateEnrollment);
router.get("/:id/requirements", listRequirements);
router.put("/:id/requirements", authorize("admin", "teacher", "registrar"), updateRequirements);

export default router;
