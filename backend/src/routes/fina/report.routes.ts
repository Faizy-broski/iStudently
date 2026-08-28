import { Router } from 'express'
import * as ctrl from '../../controllers/fina/report.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { finaEnforceScope } from '../../middlewares/fina-enforce-scope.middleware'
import { requireRole } from '../../middlewares/role.middleware'

const router = Router()
router.use(authenticate)
router.use(finaEnforceScope)
// super_admin excluded — compliance reports are PRINCIPAL/SUPERVISOR
// territory per spec §12, not SYSADMIN ("operational only" view scope).
router.use(requireRole('admin', 'fina_supervisor'))

router.get('/', ctrl.listReports)
router.post('/generate', ctrl.generateReport)
router.get('/:id/download', ctrl.downloadReport)

export default router
