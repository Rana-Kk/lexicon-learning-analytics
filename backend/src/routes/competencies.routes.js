import {
  listCompetencies,
  createCompetency,
  updateCompetency,
  deleteCompetency,
  getCourseCompetencies,
  getCompetencyGroups,
  syncCompetencyGroups,
  getStudentCompetencies,
  upsertStudentCompetency,
  getCompetencyHistory,
  getGroupCompetencies,
  addGroupCompetency,
  removeGroupCompetency,
  upsertGroupCompetencyOverride,
  removeGroupCompetencyOverride,
} from '../controllers/competencies.controller.js';
const r = Router();
r.use(authenticate);

r.get('/', listCompetencies);
r.post('/', authorize('admin', 'teacher'), createCompetency);

r.get('/student/:studentId', getStudentCompetencies);
r.get('/student/:studentId/history', getCompetencyHistory);
r.get('/me', getStudentCompetencies);
r.put('/student', authorize('admin', 'teacher'), upsertStudentCompetency);

// Course-level master competency list + edit (affects every group without its own override)

r.get('/group/:groupId', authorize('admin', 'teacher'), getGroupCompetencies);
r.post('/group', authorize('admin', 'teacher'), addGroupCompetency);
r.delete('/group/:groupId/:competencyId', authorize('admin', 'teacher'), removeGroupCompetency);
r.put('/group/:groupId/:competencyId/override', authorize('admin', 'teacher'), upsertGroupCompetencyOverride);
r.delete('/group/:groupId/:competencyId/override', authorize('admin', 'teacher'), removeGroupCompetencyOverride);

// course-level master
r.get('/:competencyId/groups', authorize('admin', 'teacher'), getCompetencyGroups);
r.put('/:competencyId/groups', authorize('admin', 'teacher'), syncCompetencyGroups);
r.put('/:competencyId', authorize('admin', 'teacher'), updateCompetency);
r.delete('/:competencyId', authorize('admin', 'teacher'), deleteCompetency);
export default r;