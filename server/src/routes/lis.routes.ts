import { Router } from "express";
import multer from "multer";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  downloadLearnerProfile,
  downloadGrades,
  downloadEnrolledList,
  downloadLearnerProfileXlsx,
  downloadGradesXlsx,
  downloadEnrolledListXlsx,
  lisData,
} from "../controllers/lis.controller";
import {
  lisImportPreview,
  lisImportApply,
} from "../controllers/lisImport.controller";

const router = Router();

router.use(authenticate);

// LIS Import — Registrar/Administrator only (personal data for many learners).
// In-memory processing: the file is parsed and discarded, never stored.
const lisUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = (file.originalname.split(".").pop() || "").toLowerCase();
    if (["xlsx", "xls", "csv"].includes(ext)) cb(null, true);
    else cb(new Error(`Invalid file type "${ext}". Allowed: .xlsx, .xls, .csv.`));
  }
});

// JSON dataset (used by the official PDF composer)
router.get("/data", authorize("registrar"), lisData);
// Official Excel workbooks
router.get("/learner-profile.xlsx", authorize("registrar"), downloadLearnerProfileXlsx);
router.get("/grades.xlsx", authorize("registrar"), downloadGradesXlsx);
router.get("/enrolled-list.xlsx", authorize("registrar"), downloadEnrolledListXlsx);
// Legacy CSV exports (unchanged, kept for DepEd LIS upload compatibility)
router.get("/learner-profile", authorize("registrar"), downloadLearnerProfile);
router.get("/grades", authorize("registrar"), downloadGrades);
router.get("/enrolled-list", authorize("registrar"), downloadEnrolledList);

// Import (client revision) — preview never writes; apply runs one transaction
router.post(
  "/import/preview",
  authorize("registrar", "admin"),
  lisUpload.single("file"),
  lisImportPreview
);
router.post(
  "/import/apply",
  authorize("registrar", "admin"),
  lisUpload.single("file"),
  lisImportApply
);

export default router;
