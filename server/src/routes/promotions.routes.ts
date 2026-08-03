import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  listPromotions,
  getPromotionById,
  promoteSection,
  completeSection,
} from "../controllers/promotions.controller";

const router = Router();

router.use(authenticate);

router.get("/", listPromotions);
router.get("/:id", getPromotionById);
router.post("/", authorize("admin", "teacher", "registrar"), promoteSection);
router.post("/complete", authorize("admin", "teacher", "registrar"), completeSection);

export default router;
