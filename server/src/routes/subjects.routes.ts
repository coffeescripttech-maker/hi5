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

const router = Router();

router.use(authenticate);

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
