import { Router } from 'express'
import * as ctrl from '../../controllers/fina/audit.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { finaEnforceScope } from '../../middlewares/fina-enforce-scope.middleware'
import { requireRole } from '../../middlewares/role.middleware'

const router = Router()
router.use(authenticate)
router.use(finaEnforceScope)
// super_admin excluded — spec §12 gives SYSADMIN only "technical" audit
// access (e.g. hash-chain integrity), not this human moderation/content
// audit-log search screen.
router.use(requireRole('admin', 'fina_supervisor'))

router.get('/', ctrl.search)

export default router
