import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/roleGuard';
import {
  getSettings,
  updateSettings,
  getThresholds,
  updateThresholds,
  getBackupSettings,
  updateBackupSettings,
  getLogRetentionSettings,
  updateLogRetentionSettings
} from '../controllers/settings.controller';

const router = Router();

router.use(authenticate);
// Read — all authenticated roles (including principal)
router.get('/', getSettings);
router.get('/backup', getBackupSettings);
router.get('/log-retention', getLogRetentionSettings);
// Admin + Enrollment Committee (which inherits admin) — other roles cannot
// configure or view the sectioning eligibility minimums.
router.get('/thresholds', authorize('admin'), getThresholds);
// Write — admin/teacher/registrar only
router.put('/', authorize('admin', 'teacher', 'registrar'), updateSettings);
router.put('/thresholds', authorize('admin'), updateThresholds);
router.put('/backup', authorize('admin', 'teacher', 'registrar'), updateBackupSettings);
router.put('/log-retention', authorize('admin', 'teacher', 'registrar'), updateLogRetentionSettings);

export default router;
