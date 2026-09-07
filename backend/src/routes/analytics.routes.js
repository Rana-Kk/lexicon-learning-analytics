import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { overview, groupComparison, studentComparison } from '../controllers/analytics.controller.js';

const r = Router();
r.use(authenticate);

// overview is also used by students to see their own numbers
r.get('/overview', overview);

// group/student comparisons expose data across a whole class - teachers and
// admins only (a teacher is further scoped to their own groups inside the
// controller).
r.get('/groups', authorize('admin', 'teacher'), groupComparison);
r.get('/students', authorize('admin', 'teacher'), studentComparison);

export default r;
