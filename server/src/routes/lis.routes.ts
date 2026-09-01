import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  downloadLearnerProfile,
  downloadGrades,
  downloadEnrolledList,
  downloadLearnerProfileXlsx,
  downloadGradesXlsx,
  downloadEnrolledListXlsx,
  lisData,
} from "../controllers/lis.controller";

const router = Router();

router.use(authenticate);

// JSON dataset (used by the official PDF composer)
router.get("/data", authorize("registrar"), lisData);
// Official Excel workbooks
router.get("/learner-profile.xlsx", authorize("registrar"), downloadLearnerProfileXlsx);
router.get("/grades.xlsx", authorize("registrar"), downloadGradesXlsx);
router.get("/enrolled-list.xlsx", authorize("registrar"), downloadEnrolledListXlsx);
// Legacy CSV exports (unchanged, kept for DepEd LIS upload compatibility)
router.get("/learner-profile", authorize("registrar"), downloadLearnerProfile);
router.get("/grades", authorize("registrar"), downloadGrades);
router.get("/enrolled-list", authorize("registrar"), downloadEnrolledList);

export default router;
