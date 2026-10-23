import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  getSF1,
  getSF5,
  getSF9,
  getSF10,
  getSF9FormData,
  saveSF9FormData,
} from "../controllers/forms.controller";

const router = Router();

router.use(authenticate);

router.get("/sf1", getSF1);
router.get("/sf5", getSF5);
router.get("/sf9", getSF9);
router.get("/sf10", getSF10);
router.get("/sf9-data", getSF9FormData);
router.put("/sf9-data", saveSF9FormData);

export default router;
