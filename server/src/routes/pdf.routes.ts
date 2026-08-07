import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { renderPdf } from "../controllers/pdf.controller";

const router = Router();

router.use(authenticate);

router.post("/render", renderPdf);

export default router;
