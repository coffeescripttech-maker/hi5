import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  getPendingStudents,
  getPendingQueue,
  confirmAssignments,
  undoAssignments,
  getCarryOverPreview,
  runAutoSectioning,
  generateRules,
  updateEligibility,
} from "../controllers/sectioning.controller";

const router = Router();

router.use(authenticate);

// Legacy: pending students (status = 'pending')
router.get("/pending", authorize("admin", "teacher", "registrar"), getPendingStudents);
router.post("/assign", authorize("admin", "teacher"), runAutoSectioning);

// New: Pending Section Queue (enrolled but section_id IS NULL)
router.get("/pending-queue", authorize("admin", "registrar"), getPendingQueue);
router.post("/confirm-assignments", authorize("admin", "registrar"), confirmAssignments);
router.post("/undo", authorize("admin", "registrar"), undoAssignments);
router.get("/carry-over-preview", authorize("admin", "registrar"), getCarryOverPreview);

// Auto-sectioning rules engine
// POST /api/sectioning/rules/generate — run the rules engine and return a
//   reviewable preview (proposals + flagged transfers + gender balance).
//   Re-invoking regenerates; manual overrides happen before confirming.
// PUT  /api/sectioning/eligibility  — record entrance exam / interview results.
router.post("/rules/generate", authorize("admin", "registrar"), generateRules);
router.put("/eligibility", authorize("admin", "registrar"), updateEligibility);

function legacyRulesEndpoint(_req: Request, res: Response): void {
  res.status(410).json({
    error: "The legacy auto-sectioning endpoint is deprecated. Use POST /sectioning/rules/generate instead.",
  });
}

// Legacy endpoint kept for backward compatibility (now a 410 with guidance)
router.post("/rules", authorize("admin", "registrar"), legacyRulesEndpoint);

export default router;