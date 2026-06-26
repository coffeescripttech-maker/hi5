import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/roleGuard';
import {
  listSections,
  getTeacherSections,
  getSectionById,
  createSection,
  updateSection,
  deleteSection,
  listTeachers
} from '../controllers/sections.controller';

const router = Router();

router.use(authenticate);

router.get('/', listSections);
router.get('/teachers', listTeachers);
router.get(
  '/my-sections',
  authorize('teacher', 'registrar'),
  getTeacherSections
);
router.get('/:id', getSectionById);
router.post('/', authorize('admin', 'registrar'), createSection);
router.put('/:id', authorize('admin', 'registrar'), updateSection);
router.delete('/:id', authorize('admin', 'registrar'), deleteSection);

export default router;
