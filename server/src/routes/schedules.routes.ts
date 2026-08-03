import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  listSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from "../controllers/schedules.controller";

const router = Router();

router.use(authenticate);

// Read — all authenticated roles
router.get("/", listSchedules);
router.get("/:id", getScheduleById);

// Write — admin/registrar only
router.post("/", authorize("admin", "registrar"), createSchedule);
router.put("/:id", authorize("admin", "registrar"), updateSchedule);
router.delete("/:id", authorize("admin", "registrar"), deleteSchedule);

export default router;
