import { Router } from 'express';

import { authenticate, authorize } from '../middleware/auth.js';

import {
  recordBulkAttendance,
  getAttendance,
  getStudentAttendanceSummary,
  getGroupAttendanceSummary,
  createAttendanceAppeal,
  getMyAttendanceAppeals,
  getPendingAttendanceAppeals,
  reviewAttendanceAppeal,
} from '../controllers/attendance.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', getAttendance);

router.get('/student/:studentId/summary', getStudentAttendanceSummary);

router.get(
  '/group/:groupId/summary',
  authorize('admin', 'teacher'),
  getGroupAttendanceSummary
);

router.post('/bulk', authorize('admin', 'teacher'), recordBulkAttendance);

router.get('/appeals', getMyAttendanceAppeals);
router.post('/appeals', createAttendanceAppeal);

router.get('/appeals/pending', authorize('admin', 'teacher'), getPendingAttendanceAppeals);
router.put('/appeals/:id/review', authorize('admin', 'teacher'), reviewAttendanceAppeal);

export default router;