import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  listSections,
  getSectionById,
  createSection,
  updateSection,
  deleteSection,
} from "../controllers/sections.controller";

const router = Router();

router.use(authenticate);

router.get("/", listSections);
router.get("/:id", getSectionById);
router.post("/", authorize("admin"), createSection);
router.put("/:id", authorize("admin"), updateSection);
router.delete("/:id", authorize("admin"), deleteSection);

export default router;
