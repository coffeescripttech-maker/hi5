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
import { getFormEdits, saveFormEdits } from "../controllers/formEdits.controller";

const router = Router();

router.use(authenticate);

router.get("/sf1", getSF1);
router.get("/sf5", getSF5);
router.get("/sf9", getSF9);
router.get("/sf10", getSF10);
router.get("/sf9-data", getSF9FormData);
router.put("/sf9-data", saveSF9FormData);

// Saved School Form Edits — the generic store behind every handwritten field
// on SF1/SF5/SF9/SF10 (docs/MAJOR_CHANGES_IN_FORMS.txt). Role/active-year
// gating lives in the controller (rule 10 strict, rule 16 closed-SY).
router.get("/edits", getFormEdits);
router.put("/edits", saveFormEdits);

export default router;
