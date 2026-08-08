import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  listStudents,
  getTeacherStudents,
  listGraduates,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  updateClassifications,
} from "../controllers/students.controller";

const router = Router();

// All student routes require authentication
router.use(authenticate);

router.get("/", listStudents);
router.get("/my-students", authorize("teacher"), getTeacherStudents);
// Specific routes must be registered before "/:id" so "graduates" is not parsed as an id.
router.get("/graduates", authorize("registrar", "principal"), listGraduates);
router.get("/:id", getStudentById);
router.post("/", authorize("admin", "teacher", "registrar"), createStudent);
router.put("/:id", authorize("admin", "teacher", "registrar"), updateStudent);
router.delete("/:id", authorize("admin"), deleteStudent);
router.post("/:id/classifications", authorize("admin", "teacher"), updateClassifications);

export default router;
