import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  getCertificateOfEnrollment,
  getGoodMoralCertificate,
} from "../controllers/certificates.controller";

const router = Router();

router.use(authenticate);

router.get("/enrollment", getCertificateOfEnrollment);
router.get("/good-moral", getGoodMoralCertificate);

export default router;
