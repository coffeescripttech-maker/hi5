import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  listSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
  populateSubjects,
  getAssignedSubjects,
  listTeacherAssignments,
  assignTeacherToSubject,
  unassignTeacherFromSubject,
} from "../controllers/subjects.controller";
import {
  listSpecialSubjects,
  createSpecialSubject,
  updateSpecialSubject,
  deleteSpecialSubject,
} from "../controllers/specialSubjects.controller";

const router = Router();

router.use(authenticate);

// SF9 special subject rows. Declared before `/:id` so "special" is never
// swallowed as an id. Registrar may manage these; committee comes along as
// Admin-equivalent via authorize().
router.get("/special", authorize("admin", "registrar"), listSpecialSubjects);
router.post("/special", authorize("admin", "registrar"), createSpecialSubject);
router.put("/special/:id", authorize("admin", "registrar"), updateSpecialSubject);
router.delete("/special/:id", authorize("admin", "registrar"), deleteSpecialSubject);

router.get("/", listSubjects);
router.get("/me/assigned", authorize("teacher"), getAssignedSubjects);
router.get("/teachers/assignments", authorize("admin"), listTeacherAssignments);
router.post("/populate", authorize("admin"), populateSubjects);
router.get("/:id", getSubjectById);
router.post("/", authorize("admin"), createSubject);
router.put("/:id", authorize("admin"), updateSubject);
router.delete("/:id", authorize("admin"), deleteSubject);
router.post("/:id/teachers", authorize("admin"), assignTeacherToSubject);
router.delete("/:id/teachers/:teacherId", authorize("admin"), unassignTeacherFromSubject);

export default router;
