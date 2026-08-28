import { Router } from 'express'
import * as ctrl from '../controllers/inspector-teacher-profile.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireInspector } from '../middlewares/role.middleware'

const router = Router()
router.use(authenticate)
router.use(requireInspector)

router.get('/school/:schoolId', ctrl.listTeachersForSchool)
router.get('/school/:schoolId/subjects', ctrl.listSubjectsForSchool)
router.get('/:teacherId/portfolio', ctrl.getTeacherPortfolio)

export default router
