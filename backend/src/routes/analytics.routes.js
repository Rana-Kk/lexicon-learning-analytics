import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { overview, groupComparison, studentComparison } from '../controllers/analytics.controller.js';

const r = Router();
r.use(authenticate);

r.get('/overview', overview);

r.get('/groups', authorize('admin', 'teacher'), groupComparison);
r.get('/students', authorize('admin', 'teacher'), studentComparison);

export default r;
