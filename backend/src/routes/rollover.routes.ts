import { Router } from 'express';
import * as rolloverController from '../controllers/rollover.controller';
import * as enrollmentController from '../controllers/enrollment.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requireTeacher } from '../middlewares/role.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// ROLLOVER ROUTES
// ============================================================================

/**
 * POST /api/rollover/preview
 * Preview rollover operation (dry-run)
 */
router.post(
  '/rollover/preview',
  requireAdmin,
  rolloverController.previewRollover
);

/**
 * POST /api/rollover/check
 * Check rollover prerequisites
 */
router.post(
  '/rollover/check',
  requireAdmin,
  rolloverController.checkPrerequisites
);

/**
 * POST /api/rollover/execute
 * Execute rollover operation
 */
router.post(
  '/rollover/execute',
  requireAdmin,
  rolloverController.executeRollover
);

// ============================================================================
// ENROLLMENT ROUTES
// ============================================================================

/**
 * GET /api/enrollment/student/:id/current
 * Get student's current enrollment
 */
router.get(
  '/enrollment/student/:id/current',
  requireTeacher,
  enrollmentController.getCurrentEnrollment
);

/**
 * GET /api/enrollment/student/:id/history
 * Get student's enrollment history
 */
router.get(
  '/enrollment/student/:id/history',
  requireTeacher,
  enrollmentController.getEnrollmentHistory
);

/**
 * POST /api/enrollment
 * Create new enrollment record
 */
router.post(
  '/enrollment',
  requireAdmin,
  enrollmentController.createEnrollment
);

/**
 * PATCH /api/enrollment/:id
 * Update enrollment record
 */
router.patch(
  '/enrollment/:id',
  requireAdmin,
  enrollmentController.updateEnrollment
);

/**
 * PATCH /api/enrollment/student/:id/rollover-status
 * Set student rollover status
 */
router.patch(
  '/enrollment/student/:id/rollover-status',
  requireAdmin,
  enrollmentController.setRolloverStatus
);

/**
 * PATCH /api/enrollment/bulk-rollover-status
 * Bulk set rollover status for multiple students
 */
router.patch(
  '/enrollment/bulk-rollover-status',
  requireAdmin,
  enrollmentController.bulkSetRolloverStatus
);

/**
 * GET /api/enrollment/statistics
 * Get enrollment statistics for academic year
 */
router.get(
  '/enrollment/statistics',
  requireTeacher,
  enrollmentController.getStatistics
);

/**
 * GET /api/enrollment/by-status
 * Get students by rollover status
 */
router.get(
  '/enrollment/by-status',
  requireTeacher,
  enrollmentController.getStudentsByStatus
);

// ============================================================================
// GRADE PROGRESSION ROUTES
// ============================================================================

/**
 * GET /api/grades/progression
 * Get grade progression chain
 */
router.get(
  '/grades/progression',
  requireTeacher,
  enrollmentController.getGradeProgression
);

export default router;
