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
router.post("/", authorize("admin", "registrar"), createSectionType);
router.put("/:id", authorize("admin", "registrar"), updateSectionType);
router.delete("/:id", authorize("admin", "registrar"), deleteSectionType);

export default router;
