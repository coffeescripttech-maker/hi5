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
router.get('/thresholds', getThresholds);
router.get('/backup', getBackupSettings);
router.get('/log-retention', getLogRetentionSettings);
// Write — admin/teacher/registrar only
router.put('/', authorize('admin', 'teacher', 'registrar'), updateSettings);
router.put('/thresholds', authorize('admin', 'teacher', 'registrar'), updateThresholds);
router.put('/backup', authorize('admin', 'teacher', 'registrar'), updateBackupSettings);
router.put('/log-retention', authorize('admin', 'teacher', 'registrar'), updateLogRetentionSettings);

export default router;
