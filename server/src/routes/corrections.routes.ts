import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  listCorrections,
  getCorrectionById,
  createCorrection,
  reviewCorrection,
} from "../controllers/corrections.controller";

const router = Router();

router.use(authenticate);

router.get("/", listCorrections);
router.get("/:id", getCorrectionById);
router.post("/", authorize("admin", "teacher"), createCorrection);
router.put("/:id", authorize("admin", "registrar"), reviewCorrection);

export default router;
