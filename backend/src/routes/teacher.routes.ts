import { Router } from 'express'
import * as teacherController from '../controllers/teacher.controller'
import * as reportCardsController from '../controllers/report-cards.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin, requireTeacher } from '../middlewares/role.middleware'

const router = Router()

// All routes require authentication
router.use(authenticate)

// ============================================================================
// TEACHER / STAFF ROUTES
// ============================================================================

// IMPORTANT: Specific paths must come BEFORE parameterized paths (:id)

// STEP 1: WORKLOAD ALLOCATION ROUTES
router.get('/assignments', requireTeacher, teacherController.getTeacherAssignments)
router.post('/assignments', requireAdmin, teacherController.createTeacherAssignment)
router.delete('/assignments/:id', requireAdmin, teacherController.deleteTeacherAssignment)

// ACADEMIC YEAR ROUTES
router.get('/academic-years/current', requireTeacher, teacherController.getCurrentAcademicYear)
router.get('/academic-years', requireTeacher, teacherController.getAcademicYears)
router.post('/academic-years', requireAdmin, teacherController.createAcademicYear)
router.put('/academic-years/:id', requireAdmin, teacherController.updateAcademicYear)

// PERIOD ROUTES
router.get('/periods', requireTeacher, teacherController.getPeriods)
router.post('/periods', requireAdmin, teacherController.createPeriod)
router.put('/periods/:id', requireAdmin, teacherController.updatePeriod)
router.delete('/periods/:id', requireAdmin, teacherController.deletePeriod)

// COURSE PERIOD ROUTES (teacher sees own course periods)
router.get('/my-course-periods', requireTeacher, teacherController.getMyCoursePeriods)
router.get('/my-course-periods/:cpId/students', requireTeacher, teacherController.getMyCoursePeriodStudents)

// TEACHER SETUP — COMMENT CODES (teacher's own scoped codes)
router.get('/setup/comment-codes', requireTeacher, reportCardsController.getTeacherCodeScales)
router.post('/setup/comment-codes/scales', requireTeacher, reportCardsController.createTeacherCodeScale)
router.put('/setup/comment-codes/scales/:id', requireTeacher, reportCardsController.updateTeacherCodeScale)
router.delete('/setup/comment-codes/scales/:id', requireTeacher, reportCardsController.deleteTeacherCodeScale)
router.post('/setup/comment-codes/scales/:scaleId/codes', requireTeacher, reportCardsController.createTeacherCode)
router.put('/setup/comment-codes/:id', requireTeacher, reportCardsController.updateTeacherCode)
router.delete('/setup/comment-codes/:id', requireTeacher, reportCardsController.deleteTeacherCode)

// TEACHER CRUD ROUTES (must come after specific routes)
router.get('/', requireTeacher, teacherController.getAllTeachers)
router.get('/:id', requireTeacher, teacherController.getTeacherById)
router.post('/', requireAdmin, teacherController.createTeacher)
router.put('/:id', requireAdmin, teacherController.updateTeacher)
router.delete('/:id', requireAdmin, teacherController.deleteTeacher)

export default router
