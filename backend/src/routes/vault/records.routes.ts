import { Router } from 'express'
import * as ctrl from '../../controllers/vault/records.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { requireVaultAccess } from '../../middlewares/vault-access.middleware'

const router = Router()
router.use(authenticate)
router.use(requireVaultAccess)

router.get('/', ctrl.listRecords)
router.post('/', ctrl.createRecord)
router.get('/:id', ctrl.getRecord)
router.put('/:id', ctrl.updateRecord)
router.delete('/:id', ctrl.deleteRecord)
router.post('/:id/reveal-secret', ctrl.revealSecret)

export default router
