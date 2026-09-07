import { Router } from 'express'
import {
  getTeams,
  getMyTeam,
  createTeam,
  updateTeam,
  deleteTeam,
  addMember,
  removeMember
} from '../controllers/teams.controller.js'

import {
  authenticate,
  authorize
} from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

router.get('/', authorize('admin', 'teacher'), getTeams)
router.get('/my', getMyTeam)

router.post(
  '/',
  authorize('admin', 'teacher'),
  createTeam
)

router.put(
  '/:id',
  authorize('admin', 'teacher'),
  updateTeam
)

router.delete(
  '/:id',
  authorize('admin', 'teacher'),
  deleteTeam
)

router.post(
  '/:id/members',
  authorize('admin', 'teacher'),
  addMember
)

router.delete(
  '/:id/members/:studentId',
  authorize('admin', 'teacher'),
  removeMember
)

export default router