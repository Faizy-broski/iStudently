import { Router } from 'express'
import * as ctrl from '../controllers/staff-absences.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin, requireTeacher } from '../middlewares/role.middleware'

const router = Router()

router.use(authenticate)

// -----------------------------------------------------------------------
// Setup > Absence Fields
// -----------------------------------------------------------------------
router.get('/fields', requireTeacher, ctrl.getAbsenceFields)
router.post('/fields', requireAdmin, ctrl.createAbsenceField)
router.put('/fields/:id', requireAdmin, ctrl.updateAbsenceField)
router.delete('/fields/:id', requireAdmin, ctrl.deleteAbsenceField)

// -----------------------------------------------------------------------
// Absences CRUD
// -----------------------------------------------------------------------
router.get('/', requireTeacher, ctrl.getAbsences)
router.get('/:id', requireTeacher, ctrl.getAbsenceById)
router.post('/', requireTeacher, ctrl.createAbsence)
router.put('/:id', requireTeacher, ctrl.updateAbsence)
router.delete('/:id', requireAdmin, ctrl.deleteAbsence)

// -----------------------------------------------------------------------
// Reports
// -----------------------------------------------------------------------
router.get('/reports/cancelled-classes', requireAdmin, ctrl.getCancelledClasses)
router.get('/reports/breakdown', requireAdmin, ctrl.getAbsenceBreakdown)

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
router.get('/helpers/staff', requireAdmin, ctrl.getStaffList)
router.get('/helpers/staff/:staff_id/course-periods', requireTeacher, ctrl.getStaffCoursePeriods)

export default router
