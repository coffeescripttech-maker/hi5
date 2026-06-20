import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  listEnrollments,
  getEnrollmentById,
  createEnrollment,
  updateEnrollment,
} from "../controllers/enrollments.controller";

const router = Router();

router.use(authenticate);

router.get("/", listEnrollments);
router.get("/:id", getEnrollmentById);
router.post("/", authorize("admin", "teacher", "registrar"), createEnrollment);
router.put("/:id", authorize("admin", "teacher", "registrar"), updateEnrollment);

export default router;
