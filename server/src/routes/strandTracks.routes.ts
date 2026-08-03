import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  listStrandTracks,
  getStrandTrackById,
  createStrandTrack,
  updateStrandTrack,
  deleteStrandTrack,
  getTrackSubjects,
  setTrackSubjects,
} from "../controllers/strandTracks.controller";

const router = Router();

router.use(authenticate);

// Read — all authenticated roles (including principal)
router.get("/", listStrandTracks);
router.get("/:id", getStrandTrackById);
router.get("/:id/subjects", getTrackSubjects);

// Write — admin only
router.post("/", authorize("admin"), createStrandTrack);
router.put("/:id", authorize("admin"), updateStrandTrack);
router.delete("/:id", authorize("admin"), deleteStrandTrack);
router.put("/:id/subjects", authorize("admin"), setTrackSubjects);

export default router;
