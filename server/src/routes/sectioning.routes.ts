import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  getPendingStudents,
  getPendingQueue,
  confirmAssignments,
  getCarryOverPreview,
  runAutoSectioning,
} from "../controllers/sectioning.controller";

const router = Router();

router.use(authenticate);

// Legacy: pending students (status = 'pending')
router.get("/pending", authorize("admin", "teacher", "registrar"), getPendingStudents);
router.post("/assign", authorize("admin", "teacher"), runAutoSectioning);

// New: Pending Section Queue (enrolled but section_id IS NULL)
router.get("/pending-queue", authorize("admin", "registrar"), getPendingQueue);
router.post("/confirm-assignments", authorize("admin", "registrar"), confirmAssignments);
router.get("/carry-over-preview", authorize("admin", "registrar"), getCarryOverPreview);

export default router;
