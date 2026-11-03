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
  listTeachers,
  getSectionTeachers,
  updateSectionTeachers,
  applyTeacherToSections,
  getTeachingCoverage,
  copyTeacherAssignments,
  getSubjectCatalog
} from '../controllers/sections.controller';

const router = Router();

router.use(authenticate);

router.get('/', authorize('admin', 'registrar', 'principal', 'enrollment_committee', 'teacher'), listSections);
router.get('/teachers', authorize('admin', 'registrar', 'principal', 'enrollment_committee'), listTeachers);
// Subject teachers per section (docs/new_requirement.txt R1-R10).
// /teaching-coverage and /teachers/apply MUST come before /:id so the
// literal paths are not captured by the parameterized route.
router.get('/teaching-coverage', authorize('admin', 'registrar', 'principal'), getTeachingCoverage);
router.get('/subject-catalog', authorize('admin', 'registrar', 'principal', 'enrollment_committee'), getSubjectCatalog);
router.post('/teachers/apply', authorize('admin', 'registrar'), applyTeacherToSections);
router.post('/teachers/copy-previous-year', authorize('admin'), copyTeacherAssignments);
router.get(
  '/my-sections',
  authorize('teacher', 'registrar'),
  getTeacherSections
);
router.get('/:id', authorize('admin', 'registrar', 'principal', 'enrollment_committee', 'teacher'), getSectionById);
router.post('/', authorize('admin', 'registrar'), createSection);
router.put('/:id', authorize('admin', 'registrar'), updateSection);
router.put('/:id/teachers', authorize('admin', 'registrar'), updateSectionTeachers);
router.get('/:id/teachers', authorize('admin', 'registrar', 'principal'), getSectionTeachers);
router.delete('/:id', authorize('admin', 'registrar'), deleteSection);

export default router;
