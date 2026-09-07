import express from 'express';
import * as usersController from '../controllers/users.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.patch('/profile/github', usersController.updateMyGithubUsername);

router.get('/', authorize('admin', 'teacher'), usersController.getUsers);

// Keep specific routes before '/:id'.
router.get(
  '/:id/academic-overview',
  authorize('teacher', 'admin'),
  usersController.getStudentAcademicOverview
);

router.put(
  '/:id/final-grade',
  authorize('teacher', 'admin'),
  usersController.saveFinalGrade
);

router.get('/:id', usersController.getUserById);

router.post('/', authorize('admin'), usersController.createUser);
router.post('/import-students', authorize('admin'), usersController.importStudents);
router.post('/import-students/excel', authorize('admin'), usersController.importStudentsFile);
router.put('/:id', usersController.updateUser);
router.delete('/:id', authorize('admin'), usersController.deleteUser);

export default router;