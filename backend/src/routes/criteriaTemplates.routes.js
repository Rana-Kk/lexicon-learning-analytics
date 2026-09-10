import { Router } from 'express'

import {
  authenticate,
  authorize,
} from '../middleware/auth.js'

import {
  getAllCriteriaTemplates,
  getCriteriaTemplateById,
} from '../controllers/criteriaTemplates.controller.js'

const router = Router()

router.use(authenticate)

router.get('/', authorize('admin', 'teacher'), getAllCriteriaTemplates)
router.get('/:id', authorize('admin', 'teacher'), getCriteriaTemplateById)

export default router