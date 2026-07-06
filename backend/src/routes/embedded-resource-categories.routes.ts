import { Router } from 'express'
import * as controller from '../controllers/embedded-resource-categories.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = Router()

router.use(authenticate)

router.get('/', requireAdmin, controller.list)
router.post('/', requireAdmin, controller.create)
router.put('/:id', requireAdmin, controller.update)
router.delete('/:id', requireAdmin, controller.remove)

export default router
