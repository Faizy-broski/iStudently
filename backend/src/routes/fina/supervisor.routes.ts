import { Router } from 'express'
import * as ctrl from '../../controllers/fina/supervisor.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { finaEnforceScope } from '../../middlewares/fina-enforce-scope.middleware'
import { requireRole } from '../../middlewares/role.middleware'

const router = Router()
router.use(authenticate)
router.use(finaEnforceScope)
// super_admin excluded — spec §12's SYSADMIN row is "operational only" view
// scope, not this aggregate-but-still-content-adjacent supervisor dashboard.
router.use(requireRole('fina_supervisor'))

router.get('/overview', ctrl.getOverview)
router.get('/schools/:schoolId/metrics', ctrl.getSchoolMetrics)

export default router
