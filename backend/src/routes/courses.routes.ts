import express from 'express'
import * as coursesController from '../controllers/courses.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin, requireTeacher } from '../middlewares/role.middleware'
import { requireRowInSchoolFamily } from '../middlewares/row-school-scope.middleware'

const router = express.Router()

// All routes require authentication
router.use(authenticate)

// Rows addressed by id must belong to the caller's school family (they were reachable from any school).
const course = requireRowInSchoolFamily('courses')
const courseParam = requireRowInSchoolFamily('courses', 'courseId')
const cp = requireRowInSchoolFamily('course_periods', 'cpId')
const teacher = requireRowInSchoolFamily('staff', 'teacherId')
const student = requireRowInSchoolFamily('students', 'studentId')
const section = requireRowInSchoolFamily('sections', 'sectionId')

// ============================================================================
// COURSES ROUTES
// ============================================================================

// GET /courses                          - List all courses for school
router.get('/', coursesController.getCourses)

// GET /courses/:id                      - Get course by ID with course_periods
router.get('/:id', course, coursesController.getCourseById)

// POST /courses                         - Create course (admin)
router.post('/', requireAdmin, coursesController.createCourse)

// POST /courses/sync                    - Sync from teacher_subject_assignments (admin)
router.post('/sync', requireAdmin, coursesController.syncFromTeacherAssignments)

// PUT /courses/:id                      - Update course (admin)
router.put('/:id', requireAdmin, course, coursesController.updateCourse)

// DELETE /courses/:id                   - Delete course (admin)
router.delete('/:id', requireAdmin, course, coursesController.deleteCourse)

// ============================================================================
// COURSE PERIODS ROUTES (nested under course)
// ============================================================================

// GET /courses/:courseId/periods             - List course periods for a course
router.get('/:courseId/periods', courseParam, coursesController.getCoursePeriods)

// GET /courses/:courseId/periods/:cpId       - Get single course period
router.get('/:courseId/periods/:cpId', courseParam, cp, coursesController.getCoursePeriodById)

// POST /courses/:courseId/periods            - Create course period (admin)
router.post('/:courseId/periods', requireAdmin, courseParam, coursesController.createCoursePeriod)

// PUT /courses/:courseId/periods/:cpId       - Update course period (admin)
router.put('/:courseId/periods/:cpId', requireAdmin, courseParam, cp, coursesController.updateCoursePeriod)

// DELETE /courses/:courseId/periods/:cpId    - Delete course period (admin)
router.delete('/:courseId/periods/:cpId', requireAdmin, courseParam, cp, coursesController.deleteCoursePeriod)

// ============================================================================
// QUERY HELPER ROUTES
// ============================================================================

// GET /courses/teacher/:teacherId           - Course periods for a teacher
router.get('/teacher/:teacherId', requireTeacher, teacher, coursesController.getCoursePeriodsByTeacher)

// GET /courses/student/:studentId           - Course periods for a student
router.get('/student/:studentId', student, coursesController.getCoursePeriodsByStudent)

// GET /courses/section/:sectionId           - Course periods for a section (for timetable assignment)
router.get('/section/:sectionId', requireAdmin, section, coursesController.getCoursePeriodsBySection)

export default router
