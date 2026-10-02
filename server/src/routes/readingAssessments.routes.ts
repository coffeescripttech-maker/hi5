import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  listReadingAssessments,
  getStudentReadingAssessments,
  createReadingAssessment,
  deleteReadingAssessment,
} from "../controllers/readingAssessments.controller";

const router = Router();

router.use(authenticate);

router.get("/", authorize("admin", "teacher", "registrar", "enrollment_committee"), listReadingAssessments);
router.get("/student/:id", authorize("admin", "teacher", "registrar", "enrollment_committee"), getStudentReadingAssessments);
router.post("/", authorize("admin", "teacher"), createReadingAssessment);
router.delete("/:id", authorize("admin", "teacher"), deleteReadingAssessment);

export default router;