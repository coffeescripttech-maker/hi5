import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import { listPredictions, runPrediction } from "../controllers/atRisk.controller";

const router = Router();

router.use(authenticate);

router.get("/", listPredictions);
router.post("/predict", authorize("admin", "teacher", "registrar"), runPrediction);

export default router;
