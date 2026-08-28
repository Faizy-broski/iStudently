import { Router } from 'express'
import * as ctrl from '../controllers/inspection-coaching.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireInspector, requireRole } from '../middlewares/role.middleware'

const router = Router()
router.use(authenticate)

router.get('/evaluation/:evaluationId', requireRole('inspector', 'admin', 'teacher'), ctrl.listNotes)
router.post('/evaluation/:evaluationId', requireInspector, ctrl.addNote)
router.put('/:id', requireInspector, ctrl.updateNote)
router.delete('/:id', requireInspector, ctrl.deleteNote)

export default router
