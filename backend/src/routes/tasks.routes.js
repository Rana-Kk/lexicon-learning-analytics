import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  getTasks, getTaskById, createTask, updateTaskNote, closeTask,
} from '../controllers/tasks.controller.js';
import {
  submitPeerEvaluations, getMyPeerEvaluations, getAllPeerEvaluations,
} from '../controllers/peerEvaluations.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', getTasks);
router.get('/:id', getTaskById);
router.post('/', authorize('teacher', 'admin'), createTask);
router.patch('/:id', authorize('teacher', 'admin'), updateTaskNote);
router.patch('/:id/close', authorize('teacher', 'admin'), closeTask);

router.post('/:id/peer-evaluations', authorize('student'), submitPeerEvaluations('task'));
router.get('/:id/peer-evaluations/me', authorize('student'), getMyPeerEvaluations('task'));
router.get('/:id/peer-evaluations', authorize('teacher', 'admin'), getAllPeerEvaluations('task'));

export default router;