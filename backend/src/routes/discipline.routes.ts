import { Router } from 'express';
import * as disciplineController from '../controllers/discipline.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requireRole, requireTeacher } from '../middlewares/role.middleware';
import { requireRowInSchoolFamily } from '../middlewares/row-school-scope.middleware';

const router = Router();

// Referrals and fields addressed by id must belong to the caller's school family (before, any
// teacher could read, and any admin edit or delete, another school's referral or field by id).
const referralRow = requireRowInSchoolFamily('discipline_referrals');
const fieldRow = requireRowInSchoolFamily('discipline_fields');
// Librarians see and file only library-related referrals (damaged / lost books); the controller
// enforces that for them.
const staffOrLibrarian = requireRole('super_admin', 'admin', 'teacher', 'librarian');


// ============================================================================
// DISCIPLINE FIELDS (Setup — Referral Form)
// ============================================================================

/**
 * GET /api/discipline/fields
 * Query: school_id, include_inactive?
 */
router.get('/discipline/fields', authenticate, staffOrLibrarian, disciplineController.getFields);

/**
 * POST /api/discipline/fields
 * Create a custom discipline field
 */
router.post('/discipline/fields', authenticate, requireAdmin, disciplineController.createField);

/**
 * PATCH /api/discipline/fields/:id
 * Update a discipline field
 */
router.patch('/discipline/fields/:id', authenticate, requireAdmin, fieldRow, disciplineController.updateField);

/**
 * DELETE /api/discipline/fields/:id
 * Delete a discipline field
 */
router.delete('/discipline/fields/:id', authenticate, requireAdmin, fieldRow, disciplineController.deleteField);

// ============================================================================
// DISCIPLINE REFERRALS
// ============================================================================

/**
 * GET /api/discipline/referrals
 * Query: school_id, campus_id?, student_id?, start_date?, end_date?, academic_year_id?, page?, limit?
 */
router.get('/discipline/referrals', authenticate, staffOrLibrarian, disciplineController.getReferrals);

/**
 * GET /api/discipline/referrals/:id
 * Get a single referral
 */
router.get('/discipline/referrals/:id', authenticate, staffOrLibrarian, referralRow, disciplineController.getReferralById);

/**
 * POST /api/discipline/referrals
 * Create a new referral
 */
router.post('/discipline/referrals', authenticate, staffOrLibrarian, disciplineController.createReferral);

/**
 * PATCH /api/discipline/referrals/:id
 * Update a referral (admin only)
 */
router.patch('/discipline/referrals/:id', authenticate, requireAdmin, referralRow, disciplineController.updateReferral);

/**
 * DELETE /api/discipline/referrals/:id
 * Delete a referral (admin only)
 */
router.delete('/discipline/referrals/:id', authenticate, requireAdmin, referralRow, disciplineController.deleteReferral);

// ============================================================================
// DISCIPLINE SCORE
// ============================================================================

/**
/**
 * GET /api/discipline/score/:studentId
 * Query: school_id, campus_id?, academic_year_id?
 */
router.get('/discipline/score/:studentId', authenticate, requireTeacher, disciplineController.getStudentScore);

// ============================================================================
// STRICT ROLE-BASED ENDPOINTS (Zero-Trust)
// ============================================================================


/**
 * TEACHER SCOPE (Staff)
 */
// GET /api/discipline/staff/referrals - Get referrals tied to teacher
router.get('/discipline/staff/referrals', authenticate, requireRole('teacher', 'admin', 'super_admin'), disciplineController.getStaffReferrals);

// POST /api/discipline/staff/referrals - Create referral as a teacher (forces reporter_id = staff_id)
router.post('/discipline/staff/referrals', authenticate, requireRole('teacher', 'admin', 'super_admin'), disciplineController.createStaffReferral);

/**
 * STUDENT SCOPE
 */
router.get('/discipline/student/referrals', authenticate, requireRole('student'), disciplineController.getStudentReferrals);

/**
 * PARENT SCOPE
 */
router.get('/discipline/parent/referrals', authenticate, requireRole('parent'), disciplineController.getParentReferrals);

/**
 * SUPER ADMIN SCOPE — most recent referrals across every school, for the
 * notification bell (super_admin has no staff_id/school_id of its own).
 */
router.get('/discipline/superadmin/referrals', authenticate, requireRole('super_admin'), disciplineController.getSuperAdminReferrals);

/**
 * ADMIN/COUNSELOR SCOPE — most recent referrals for the whole school,
 * regardless of who filed them (a teacher's referral must notify admin).
 */
router.get('/discipline/admin/referrals', authenticate, requireRole('admin', 'counselor'), disciplineController.getAdminReferrals);

export default router;
