import { Router } from 'express'
import { login, register, me, changePassword } from '../controllers/auth.controller.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.post('/register', authenticate, authorize('admin'), register)
router.post('/change-password', authenticate, changePassword)
router.post('/login', login)
router.get('/me', authenticate, me)

export default router


