import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import { listRooms, getRoomById, createRoom, updateRoom, deleteRoom } from "../controllers/rooms.controller";

const router = Router();

router.use(authenticate);

// Read — all authenticated roles
router.get("/", listRooms);
router.get("/:id", getRoomById);

// Write — admin/registrar only
router.post("/", authorize("admin", "registrar"), createRoom);
router.put("/:id", authorize("admin", "registrar"), updateRoom);
router.delete("/:id", authorize("admin", "registrar"), deleteRoom);

export default router;
