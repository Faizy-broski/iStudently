import { Router } from 'express'
import * as ctrl from '../../controllers/vault/field-definitions.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { requireVaultAccess } from '../../middlewares/vault-access.middleware'

const router = Router()
router.use(authenticate)
router.use(requireVaultAccess)

router.get('/', ctrl.listFieldDefinitions)
router.post('/', ctrl.createFieldDefinition)
router.delete('/:id', ctrl.deleteFieldDefinition)

export default router
