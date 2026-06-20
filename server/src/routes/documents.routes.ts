import { Router } from "express";
import multer from "multer";
import path from "path";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import {
  listDocuments,
  downloadDocument,
  uploadDocument,
  updateDocumentStatus,
} from "../controllers/documents.controller";

const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".xlsx", ".xls", ".docx"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type "${ext}". Allowed: ${allowed.join(", ")}`));
    }
  },
});

const router = Router();

router.use(authenticate);

router.get("/", listDocuments);
router.get("/:id/download", downloadDocument);
router.post("/upload", authorize("admin", "teacher", "registrar"), upload.single("file"), uploadDocument);
router.put("/:id/status", authorize("admin"), updateDocumentStatus);

export default router;
