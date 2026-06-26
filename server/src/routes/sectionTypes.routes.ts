import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  listSectionTypes,
  createSectionType,
  updateSectionType,
  deleteSectionType,
} from "../controllers/sectionTypes.controller";

const router = Router();

router.use(authenticate);

router.get("/", listSectionTypes);
router.post("/", authorize("admin"), createSectionType);
router.put("/:id", authorize("admin"), updateSectionType);
router.delete("/:id", authorize("admin"), deleteSectionType);

export default router;
