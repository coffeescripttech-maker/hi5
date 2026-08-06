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
} from "../controllers/subjects.controller";

const router = Router();

router.use(authenticate);

router.get("/", listSubjects);
router.post("/populate", authorize("admin"), populateSubjects);
router.get("/:id", getSubjectById);
router.post("/", authorize("admin"), createSubject);
router.put("/:id", authorize("admin"), updateSubject);
router.delete("/:id", authorize("admin"), deleteSubject);

export default router;
