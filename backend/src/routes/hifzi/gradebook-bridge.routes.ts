import { Router } from 'express'
import * as ctrl from '../../controllers/hifzi/gradebook-bridge.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { requireHifziEnabled } from '../../middlewares/hifzi-enabled.middleware'
import { requireAdmin } from '../../middlewares/role.middleware'

const router = Router()
router.use(authenticate)
router.use(requireHifziEnabled)
router.use(requireAdmin)

router.get('/links', ctrl.getLink)
router.post('/links', ctrl.linkGradeLevelSubject)
router.get('/bridge/preview', ctrl.previewTermBridge)
router.post('/bridge/run', ctrl.runTermBridge)

export default router
