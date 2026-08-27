import { Router } from 'express'
import * as ctrl from '../controllers/inspector-directory.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin, requireInspector } from '../middlewares/role.middleware'

const router = Router()
router.use(authenticate)

// Admin: manage inspector accounts and their campus assignments
router.get('/', requireAdmin, ctrl.listInspectors)
router.post('/', requireAdmin, ctrl.createInspector)
router.patch('/:id', requireAdmin, ctrl.updateInspector)
router.post('/:id/deactivate', requireAdmin, ctrl.deactivateInspector)
router.post('/:id/reactivate', requireAdmin, ctrl.reactivateInspector)
// Permanently deletes the login + cascades campus assignments (irreversible —
// see inspector-directory.service.ts::deleteInspectorPermanently).
router.delete('/:id', requireAdmin, ctrl.deleteInspectorPermanently)
router.get('/:inspectorId/assignments', requireAdmin, ctrl.listAssignmentsForInspector)
router.post('/assignments', requireAdmin, ctrl.assignCampus)
router.post('/assignments/:id/revoke', requireAdmin, ctrl.unassignCampus)

// Inspector: read own assigned campuses (for the portal shell / campus switcher)
router.get('/me/schools', requireInspector, ctrl.getMyAssignedSchools)

export default router
