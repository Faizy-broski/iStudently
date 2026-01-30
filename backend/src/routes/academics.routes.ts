import { Router } from 'express'
import * as academicsController from '../controllers/academics.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin, requireTeacher, requireStaff } from '../middlewares/role.middleware'

const router = Router()

// All routes require authentication
router.use(authenticate)

// ============================================================================
// GRADE LEVELS ROUTES
// ============================================================================

// Only admins can manage grade levels (using predefined middleware)
router.post(
  '/grades',
  requireAdmin,
  academicsController.createGradeLevel
)

router.get(
  '/grades',
  requireTeacher, // Allows super_admin, admin, teacher
  academicsController.getGradeLevels
)

router.get(
  '/grades/:id',
  requireTeacher,
  academicsController.getGradeLevelById
)

router.put(
  '/grades/:id',
  requireAdmin,
  academicsController.updateGradeLevel
)

router.delete(
  '/grades/:id',
  requireAdmin,
  academicsController.deleteGradeLevel
)

// ============================================================================
// SECTIONS ROUTES
// ============================================================================

router.post(
  '/sections',
  requireAdmin,
  academicsController.createSection
)

router.get(
  '/sections',
  requireTeacher,
  academicsController.getSections
)

router.get(
  '/sections/:id',
  requireTeacher,
  academicsController.getSectionById
)

router.put(
  '/sections/:id',
  requireAdmin,
  academicsController.updateSection
)

router.delete(
  '/sections/:id',
  requireAdmin,
  academicsController.deleteSection
)

// ============================================================================
// SUBJECTS ROUTES
// ============================================================================

router.post(
  '/subjects',
  requireAdmin,
  academicsController.createSubject
)

router.get(
  '/subjects',
  requireTeacher,
  academicsController.getSubjects
)

router.get(
  '/subjects/:id',
  requireTeacher,
  academicsController.getSubjectById
)

router.put(
  '/subjects/:id',
  requireAdmin,
  academicsController.updateSubject
)

router.delete(
  '/subjects/:id',
  requireAdmin,
  academicsController.deleteSubject
)

// ============================================================================
// ACADEMIC YEAR ROUTES (Global - used across all modules)
// ============================================================================

router.get(
  '/academic-years/current',
  // Allow all authenticated users (including parents) to read current academic year
  academicsController.getCurrentAcademicYear
)

router.get(
  '/academic-years',
  requireStaff, // Only staff can view all academic years
  academicsController.getAcademicYears
)

router.post(
  '/academic-years',
  requireAdmin,
  academicsController.createAcademicYear
)

router.put(
  '/academic-years/:id',
  requireAdmin,
  academicsController.updateAcademicYear
)

router.delete(
  '/academic-years/:id',
  requireAdmin,
  academicsController.deleteAcademicYear
)

export default router
