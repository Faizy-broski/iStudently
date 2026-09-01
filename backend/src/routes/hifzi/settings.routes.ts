import { Router } from 'express'
import * as ctrl from '../../controllers/hifzi/settings.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { requireHifziEnabled } from '../../middlewares/hifzi-enabled.middleware'
import { requireAdmin } from '../../middlewares/role.middleware'

const router = Router()
router.use(authenticate)
router.use(requireHifziEnabled)

router.get('/', ctrl.getSettings)
router.patch('/', requireAdmin, ctrl.updateSettings)

export default router
