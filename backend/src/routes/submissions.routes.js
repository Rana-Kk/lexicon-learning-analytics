import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  getAllSubmissions,
  getSubmissionById,
  createSubmission,
  reviewSubmission,
  requestResubmission
} from '../controllers/submissions.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', getAllSubmissions);
router.get('/:id', getSubmissionById);
router.post('/', authorize('student', 'admin'), createSubmission);
router.put('/:id/review', authorize('teacher', 'admin'), reviewSubmission);
router.put('/:id/request-resubmission', authorize('teacher', 'admin'), requestResubmission);

export default router;