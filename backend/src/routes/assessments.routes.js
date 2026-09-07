import { Router } from 'express'

import {
  authenticate,
  authorize,
} from '../middleware/auth.js'

import {
  getAllAssessments,
  getStudentAssessments,
  getAssessmentById,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  getAssessmentReport,
} from '../controllers/assessments.controller.js'

const router = Router()

router.use(authenticate)

router.get('/student', getStudentAssessments)

router.get('/', getAllAssessments)

router.get('/:id/report', getAssessmentReport)


router.get('/:id', getAssessmentById)



router.post(
  '/',
  authorize('admin', 'teacher'),
  createAssessment
)

router.put(
  '/:id',
  authorize('admin', 'teacher'),
  updateAssessment
)

router.delete(
  '/:id',
  authorize('admin', 'teacher'),
  deleteAssessment
)

export default router