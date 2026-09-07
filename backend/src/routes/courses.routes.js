import express from 'express';
import * as coursesController from '../controllers/courses.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// All course routes require authentication
router.use(authenticate);

// Everyone can view courses
router.get('/', coursesController.getAllCourses);
router.get('/:id', coursesController.getCourseById);

// Admin-only operations
router.post('/', authorize('admin'), coursesController.createCourse);
router.put('/:id', authorize('admin'), coursesController.updateCourse);
router.delete('/:id', authorize('admin'), coursesController.deleteCourse);

export default router;