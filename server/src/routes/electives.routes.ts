import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  getElectiveCatalog,
  getAssignments,
  getAssignmentsBatch,
  saveAssignments,
  excludeElective,
  restoreElective,
  getElectiveRoster,
} from "../controllers/electives.controller";

const router = Router();
router.use(authenticate);

// Catalog + per-learner picks (read), incl. the all-learners batch map.
router.get("/catalog", getElectiveCatalog);
router.get("/assignments/batch", getAssignmentsBatch);
router.get("/assignments", getAssignments);

// Per-learner elective assignment — the Enrollment Committee / Registrar / Admin.
// Teachers must NOT place students or assign electives.
router.put(
  "/assignments",
  authorize("admin", "enrollment_committee", "registrar"),
  saveAssignments
);

// Per-school-year on/off switches (Administrator only).
router.post(
  "/offerings/off",
  authorize("admin"),
  excludeElective
);
router.post(
  "/offerings/on",
  authorize("admin"),
  restoreElective
);

// Elective roster — teachers must be assigned to the elective; other roles read.
router.get("/roster", getElectiveRoster);

export default router;
