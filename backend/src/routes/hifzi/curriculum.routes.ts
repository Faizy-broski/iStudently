import { Router } from 'express'
import * as ctrl from '../../controllers/hifzi/curriculum.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { requireHifziEnabled } from '../../middlewares/hifzi-enabled.middleware'
import { requireAdmin } from '../../middlewares/role.middleware'

const router = Router()
router.use(authenticate)
router.use(requireHifziEnabled)

router.get('/syllabus-targets', requireAdmin, ctrl.listSyllabusTargets)
router.post('/syllabus-targets', requireAdmin, ctrl.upsertSyllabusTarget)

export default router
