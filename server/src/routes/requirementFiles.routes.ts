/**
 * Digital Requirements Upload (client revision §A).
 * Upload/Replace/Delete: Enrollment Committee + Registrar.
 * View: Committee + Registrar + Administrator.
 * Teacher / Principal: no access at all.
 */
import { Router } from "express";
import multer from "multer";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  listRequirementFiles,
  uploadRequirementFile,
  replaceRequirementFile,
  viewRequirementFile,
  deleteRequirementFile
} from "../controllers/requirementFiles.controller";

const router = Router();

router.use(authenticate);

// In-memory (validated by content before it ever touches disk).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// List files grouped by requirement (Committee / Registrar / Administrator)
router.get(
  "/:id/requirement-files",
  authorize("enrollment_committee", "registrar", "admin"),
  listRequirementFiles
);

// Upload (Committee / Registrar only)
router.post(
  "/:id/requirements/:key/files",
  authorize("enrollment_committee", "registrar"),
  upload.single("file"),
  uploadRequirementFile
);

// Replace one file (Committee / Registrar only) — validates the new copy
// before the old file is removed, so a failed upload loses nothing
router.put(
  "/:id/requirements/:key/files/:fileId",
  authorize("enrollment_committee", "registrar"),
  upload.single("file"),
  replaceRequirementFile
);

// View / stream a file (Committee / Registrar / Administrator)
router.get(
  "/:id/requirements/:key/files/:fileId",
  authorize("enrollment_committee", "registrar", "admin"),
  viewRequirementFile
);

// Delete (Committee / Registrar only)
router.delete(
  "/:id/requirements/:key/files/:fileId",
  authorize("enrollment_committee", "registrar"),
  deleteRequirementFile
);

export default router;
