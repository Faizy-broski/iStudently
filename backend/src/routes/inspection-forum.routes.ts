import { Router } from 'express'
import * as ctrl from '../controllers/inspection-forum.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

const router = Router()
router.use(authenticate)

router.post('/', requireRole('teacher', 'inspector'), ctrl.createThread)
router.get('/school/:schoolId', requireRole('teacher', 'admin', 'inspector'), ctrl.listThreadsForSchool)
router.get('/:id', requireRole('teacher', 'admin', 'inspector'), ctrl.getThread)
router.post('/:id/posts', requireRole('teacher', 'admin', 'inspector'), ctrl.addPost)

export default router
