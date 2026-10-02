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
  getDashboardStats,
  batchListRequirements,
  getEnrollmentFlags,
} from "../controllers/enrollments.controller";

const router = Router();

router.use(authenticate);

router.get("/stats", getDashboardStats);
router.get("/requirements/batch", batchListRequirements);
router.get("/flags", getEnrollmentFlags);
router.get("/", listEnrollments);
router.get("/:id", getEnrollmentById);
// Enrollment is an Enrollment Committee / Registrar duty — teachers no longer
// create or change enrollments.
router.post("/", authorize("admin", "registrar", "enrollment_committee"), createEnrollment);
router.put("/:id", authorize("admin", "registrar", "enrollment_committee"), updateEnrollment);
router.get("/:id/requirements", listRequirements);
router.put("/:id/requirements", authorize("admin", "registrar", "enrollment_committee"), updateRequirements);

export default router;
