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
} from "../controllers/promotions.controller";

const router = Router();

router.use(authenticate);

router.get("/", listPromotions);
router.get("/preview", authorize("admin", "teacher", "registrar"), previewSection);
router.get("/:id", getPromotionById);
router.post("/", authorize("admin", "teacher", "registrar"), promoteSection);
router.post("/complete", authorize("admin", "teacher", "registrar"), completeSection);
router.post("/:id/rollback", authorize("admin", "teacher", "registrar"), rollbackCompletion);
router.post("/bulk-promote", authorize("admin"), bulkPromote);

export default router;
