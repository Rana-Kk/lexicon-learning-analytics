import { Router } from 'express';

import { authenticate, authorize } from '../middleware/auth.js';

import {
  getAllGroups,
  getMyGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  getGroupStudents,
  addStudentToGroup,
  removeStudentFromGroup,
  getGroupTeachers,
  assignTeacherToGroup,
  removeTeacherFromGroup
} from '../controllers/groups.controller.js';

const router = Router();

router.use(authenticate);

// =====================================================
// GROUP ROUTES
// =====================================================

// IMPORTANT:
// /my MUST be before /:id
router.get('/my', authorize('teacher'), getMyGroups);

router.get('/', getAllGroups);

router.get('/:id', getGroupById);

router.post(
  '/',
  authorize('admin', 'teacher'),
  createGroup
);

router.put(
  '/:id',
  authorize('admin', 'teacher'),
  updateGroup
);

router.delete(
  '/:id',
  authorize('admin'),
  deleteGroup
);

// =====================================================
// GROUP STUDENTS
// =====================================================

router.get(
  '/:id/students',
  authorize('admin', 'teacher'),
  getGroupStudents
);

router.post(
  '/:id/students',
  authorize('admin', 'teacher'),
  addStudentToGroup
);

router.delete(
  '/:id/students/:studentId',
  authorize('admin'),
  removeStudentFromGroup
);

// =====================================================
// GROUP TEACHERS
// =====================================================

router.get(
  '/:id/teachers',
  authorize('admin', 'teacher'),
  getGroupTeachers
);

router.post(
  '/:id/teachers',
  authorize('admin'),
  assignTeacherToGroup
);

router.delete(
  '/:id/teachers/:teacherId',
  authorize('admin'),
  removeTeacherFromGroup
);

export default router;