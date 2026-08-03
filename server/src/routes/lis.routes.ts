import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  downloadLearnerProfile,
  downloadGrades,
  downloadEnrolledList,
} from "../controllers/lis.controller";

const router = Router();

router.use(authenticate);

router.get("/learner-profile", authorize("admin", "registrar"), downloadLearnerProfile);
router.get("/grades", authorize("admin", "registrar"), downloadGrades);
router.get("/enrolled-list", authorize("admin", "registrar"), downloadEnrolledList);

export default router;
