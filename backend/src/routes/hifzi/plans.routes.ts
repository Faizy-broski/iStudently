import { Router } from 'express'
import * as ctrl from '../../controllers/hifzi/plans.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { requireHifziEnabled } from '../../middlewares/hifzi-enabled.middleware'
import { requireAdmin, requireTeacher, requireRole } from '../../middlewares/role.middleware'

const router = Router()
router.use(authenticate)
router.use(requireHifziEnabled)

router.post('/', requireTeacher, ctrl.createPlan)
router.patch('/:id', requireTeacher, ctrl.updatePlan)
router.delete('/:id', requireTeacher, ctrl.deactivatePlan)
router.get('/', requireRole('student', 'parent', 'teacher', 'admin'), ctrl.listPlans)
router.get('/assignments', requireRole('student', 'parent', 'teacher', 'admin'), ctrl.getAssignment)
router.post('/assignments/generate', requireAdmin, ctrl.generateAssignment)

export default router
