import { Router } from 'express'
import { StudentController } from '../controllers/student.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

const router = Router()
const studentController = new StudentController()

// All routes require authentication
router.use(authenticate)

/**
 * GET /api/students/stats
 * Get student statistics for the school
 * Admin only
 */
router.get('/stats', requireRole('admin'), (req, res) =>
  studentController.getStudentStats(req, res)
)

/**
 * GET /api/students/report
 * Get students report with proper joins for advanced reporting
 * Admin only
 */
router.get('/report', requireRole('admin'), (req, res) =>
  studentController.getStudentsReport(req, res)
)

/**
 * GET /api/students/grade/:gradeLevel
 * Get students by grade level
 * Admin and teacher can access
 */
router.get('/grade/:gradeLevel', requireRole('admin', 'teacher'), (req, res) =>
  studentController.getStudentsByGrade(req, res)
)

/**
 * GET /api/students/number/:studentNumber
 * Get student by student number
 * Admin and teacher can access
 */
router.get('/number/:studentNumber', requireRole('admin', 'teacher'), (req, res) =>
  studentController.getStudentByNumber(req, res)
)

/**
 * GET /api/students/:id
 * Get a single student by ID
 * Admin and teacher can access
 */
router.get('/:id', requireRole('admin', 'teacher'), (req, res) =>
  studentController.getStudentById(req, res)
)

/**
 * GET /api/students
 * Get all students with pagination and search
 * Admin, teacher, and librarian can access
 */
router.get('/', requireRole('admin', 'teacher', 'librarian'), (req, res) =>
  studentController.getStudents(req, res)
)

/**
 * POST /api/students
 * Create a new student
 * Admin only
 */
router.post('/', requireRole('admin'), (req, res) =>
  studentController.createStudent(req, res)
)

/**
 * POST /api/students/print-info
 * Get students info for printing with selected categories
 * Admin only
 */
router.post('/print-info', requireRole('admin'), (req, res) =>
  studentController.getStudentsPrintInfo(req, res)
)

/**
 * PUT /api/students/:id
 * Update a student
 * Admin only
 */
router.put('/:id', requireRole('admin'), (req, res) =>
  studentController.updateStudent(req, res)
)

/**
 * DELETE /api/students/:id
 * Delete a student
 * Admin only
 */
router.delete('/:id', requireRole('admin'), (req, res) =>
  studentController.deleteStudent(req, res)
)

export default router
