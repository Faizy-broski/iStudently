import { Router } from 'express'
import * as ctrl from '../../controllers/vault/categories.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { requireVaultAccess } from '../../middlewares/vault-access.middleware'

const router = Router()
router.use(authenticate)
router.use(requireVaultAccess)

router.get('/', ctrl.listCategories)
router.post('/', ctrl.createCategory)
router.patch('/:id', ctrl.updateCategory)
router.delete('/:id', ctrl.deleteCategory)

export default router
