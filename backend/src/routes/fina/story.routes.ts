import { Router } from 'express'
import * as ctrl from '../../controllers/fina/story.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { finaEnforceScope } from '../../middlewares/fina-enforce-scope.middleware'
import { requireRole } from '../../middlewares/role.middleware'

const router = Router()
router.use(authenticate)
router.use(finaEnforceScope)

router.get('/', ctrl.listActiveStories)
router.post('/', requireRole('teacher', 'admin', 'media_officer'), ctrl.createStory)

export default router
