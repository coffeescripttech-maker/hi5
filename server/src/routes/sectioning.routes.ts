import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  getPendingStudents,
  runAutoSectioning,
} from "../controllers/sectioning.controller";

const router = Router();

router.use(authenticate);

router.get("/pending", authorize("admin", "teacher", "registrar"), getPendingStudents);
router.post("/assign", authorize("admin", "teacher"), runAutoSectioning);

export default router;
