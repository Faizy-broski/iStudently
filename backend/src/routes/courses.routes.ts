import express from 'express'
import * as coursesController from '../controllers/courses.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin, requireTeacher } from '../middlewares/role.middleware'

const router = express.Router()

// All routes require authentication
router.use(authenticate)

// ============================================================================
// COURSES ROUTES
// ============================================================================

// GET /courses                          - List all courses for school
router.get('/', coursesController.getCourses)

// GET /courses/:id                      - Get course by ID with course_periods
router.get('/:id', coursesController.getCourseById)

// POST /courses                         - Create course (admin)
router.post('/', requireAdmin, coursesController.createCourse)

// POST /courses/sync                    - Sync from teacher_subject_assignments (admin)
router.post('/sync', requireAdmin, coursesController.syncFromTeacherAssignments)

// PUT /courses/:id                      - Update course (admin)
router.put('/:id', requireAdmin, coursesController.updateCourse)

// DELETE /courses/:id                   - Delete course (admin)
router.delete('/:id', requireAdmin, coursesController.deleteCourse)

// ============================================================================
// COURSE PERIODS ROUTES (nested under course)
// ============================================================================

// GET /courses/:courseId/periods             - List course periods for a course
router.get('/:courseId/periods', coursesController.getCoursePeriods)

// GET /courses/:courseId/periods/:cpId       - Get single course period
router.get('/:courseId/periods/:cpId', coursesController.getCoursePeriodById)

// POST /courses/:courseId/periods            - Create course period (admin)
router.post('/:courseId/periods', requireAdmin, coursesController.createCoursePeriod)

// PUT /courses/:courseId/periods/:cpId       - Update course period (admin)
router.put('/:courseId/periods/:cpId', requireAdmin, coursesController.updateCoursePeriod)

// DELETE /courses/:courseId/periods/:cpId    - Delete course period (admin)
router.delete('/:courseId/periods/:cpId', requireAdmin, coursesController.deleteCoursePeriod)

// ============================================================================
// QUERY HELPER ROUTES
// ============================================================================

// GET /courses/teacher/:teacherId           - Course periods for a teacher
router.get('/teacher/:teacherId', requireTeacher, coursesController.getCoursePeriodsByTeacher)

// GET /courses/student/:studentId           - Course periods for a student
router.get('/student/:studentId', coursesController.getCoursePeriodsByStudent)

export default router
