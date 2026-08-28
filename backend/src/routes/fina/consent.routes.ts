import { Router } from 'express'
import * as ctrl from '../../controllers/fina/consent.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { finaEnforceScope } from '../../middlewares/fina-enforce-scope.middleware'
import { requireRole } from '../../middlewares/role.middleware'

const router = Router()
router.use(authenticate)
router.use(finaEnforceScope)

// Literal-segment route before the generic '/:id' routes — Express matches
// in registration order.
router.get('/text/current', requireRole('parent', 'admin'), ctrl.getCurrentConsentText)
router.get('/my-wards', requireRole('parent'), ctrl.listMyWards)
router.post('/', requireRole('parent'), ctrl.createConsent)
router.post('/:id/withdraw', requireRole('parent'), ctrl.withdrawConsent)
router.get('/:id/certificate', requireRole('parent', 'admin'), ctrl.getConsentCertificate)

export default router
