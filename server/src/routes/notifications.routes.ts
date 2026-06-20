import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  listNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
} from "../controllers/notifications.controller";

const router = Router();

router.use(authenticate);

router.get("/", listNotifications);
router.post("/", authorize("admin"), createNotification);
router.post("/read-all", markAllAsRead);
router.post("/:id/read", markAsRead);

export default router;
