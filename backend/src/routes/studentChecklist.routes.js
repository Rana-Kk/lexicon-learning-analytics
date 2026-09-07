import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { getStudentChecklist, saveStudentChecklist } from '../controllers/studentChecklist.controller.js';

const router = Router();
router.use(authenticate, authorize('admin', 'teacher'));
router.get('/:studentId', getStudentChecklist);
router.put('/:studentId/assessments/:assessmentId', saveStudentChecklist);
export default router;
