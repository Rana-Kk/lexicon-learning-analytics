import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  listCompetencies,
  createCompetency,
  getStudentCompetencies,
  upsertStudentCompetency,
  getCompetencyHistory,
  getGroupCompetencies,
  addGroupCompetency,
  removeGroupCompetency,
} from '../controllers/competencies.controller.js';

const r = Router();
r.use(authenticate);

r.get('/', listCompetencies);
r.post('/', authorize('admin', 'teacher'), createCompetency);

r.get('/student/:studentId', getStudentCompetencies);
r.get('/student/:studentId/history', getCompetencyHistory);
r.get('/me', getStudentCompetencies);
r.put('/student', authorize('admin', 'teacher'), upsertStudentCompetency);

r.get('/group/:groupId', authorize('admin', 'teacher'), getGroupCompetencies);
r.post('/group', authorize('admin', 'teacher'), addGroupCompetency);
r.delete('/group/:groupId/:competencyId', authorize('admin', 'teacher'), removeGroupCompetency);

export default r;