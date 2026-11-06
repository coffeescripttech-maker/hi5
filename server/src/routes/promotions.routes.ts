import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  listPromotions,
  getPromotionById,
  promoteSection,
  completeSection,
  bulkPromote,
  previewSection,
  rollbackCompletion,
  listPromotionRoster,
  promoteStudentIndividually,
} from "../controllers/promotions.controller";

const router = Router();

router.use(authenticate);

router.get("/", listPromotions);
router.get("/preview", authorize("admin", "teacher", "registrar"), previewSection);
router.get("/roster", authorize("admin", "registrar"), listPromotionRoster);
router.get("/:id", getPromotionById);
router.post("/", authorize("admin", "teacher", "registrar"), promoteSection);
router.post("/complete", authorize("admin", "teacher", "registrar"), completeSection);
router.post("/individual", authorize("admin", "registrar"), promoteStudentIndividually);
router.post("/:id/rollback", authorize("admin", "registrar"), rollbackCompletion);
router.post("/bulk-promote", authorize("admin", "teacher"), bulkPromote);

export default router;
