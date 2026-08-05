import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  getGrades,
  upsertGrade,
  batchUpsertGrades,
  lockGrades,
  unlockGrades,
  computeAverages,
  getGradeHistory,
  getGradeDistribution,
  getGradeSubmissionStatus,
} from "../controllers/grades.controller";

const router = Router();

router.use(authenticate);

// Grade queries — all authenticated roles can view
router.get("/", getGrades);
router.get("/distribution", getGradeDistribution);
router.get("/history", getGradeHistory);
router.get("/compute/averages", computeAverages);
router.get("/submission-status", getGradeSubmissionStatus);

// Grade mutations — teachers, registrars, and admin
router.post("/", authorize("admin", "teacher", "registrar"), upsertGrade);
router.post("/batch", authorize("admin", "teacher", "registrar"), batchUpsertGrades);
router.post("/lock", authorize("admin", "teacher"), lockGrades);
router.post("/unlock", authorize("admin"), unlockGrades);

export default router;
