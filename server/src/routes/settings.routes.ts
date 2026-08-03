import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/roleGuard';
import {
  getSettings,
  updateSettings,
  getThresholds,
  updateThresholds,
  getBackupSettings,
  updateBackupSettings
} from '../controllers/settings.controller';

const router = Router();

router.use(authenticate);
// Read — all authenticated roles (including principal)
router.get('/', getSettings);
router.get('/thresholds', getThresholds);
router.get('/backup', getBackupSettings);
// Write — admin/teacher/registrar only
router.put('/', authorize('admin', 'teacher', 'registrar'), updateSettings);
router.put('/thresholds', authorize('admin', 'teacher', 'registrar'), updateThresholds);
router.put('/backup', authorize('admin', 'teacher', 'registrar'), updateBackupSettings);

export default router;
