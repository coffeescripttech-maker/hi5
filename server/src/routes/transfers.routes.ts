import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  listTransfers,
  getTransferById,
  createTransfer,
  reviewTransfer,
  cancelTransfer,
} from "../controllers/transfers.controller";

const router = Router();

router.use(authenticate);

// Registrar files the request; Committee (and Admin) approves or rejects it.
// Teachers keep a read-only view so they can see outcomes for their learners.
router.get("/", authorize("admin", "registrar", "principal", "enrollment_committee", "teacher"), listTransfers);
router.get("/:id", authorize("admin", "registrar", "principal", "enrollment_committee", "teacher"), getTransferById);
router.post("/", authorize("admin", "registrar"), createTransfer);
router.put("/:id/decision", authorize("admin", "enrollment_committee"), reviewTransfer);
router.put("/:id/cancel", authorize("admin", "registrar", "enrollment_committee"), cancelTransfer);

export default router;