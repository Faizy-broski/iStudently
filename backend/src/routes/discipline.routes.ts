import { Router } from 'express';
import * as disciplineController from '../controllers/discipline.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requireTeacher } from '../middlewares/role.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// DISCIPLINE FIELDS (Setup — Referral Form)
// ============================================================================

/**
 * GET /api/discipline/fields
 * Query: school_id, include_inactive?
 */
router.get('/discipline/fields', requireTeacher, disciplineController.getFields);

/**
 * POST /api/discipline/fields
 * Create a custom discipline field
 */
router.post('/discipline/fields', requireAdmin, disciplineController.createField);

/**
 * PATCH /api/discipline/fields/:id
 * Update a discipline field
 */
router.patch('/discipline/fields/:id', requireAdmin, disciplineController.updateField);

/**
 * DELETE /api/discipline/fields/:id
 * Delete a discipline field
 */
router.delete('/discipline/fields/:id', requireAdmin, disciplineController.deleteField);

// ============================================================================
// DISCIPLINE REFERRALS
// ============================================================================

/**
 * GET /api/discipline/referrals
 * Query: school_id, campus_id?, student_id?, start_date?, end_date?, academic_year_id?, page?, limit?
 */
router.get('/discipline/referrals', requireTeacher, disciplineController.getReferrals);

/**
 * GET /api/discipline/referrals/:id
 * Get a single referral
 */
router.get('/discipline/referrals/:id', requireTeacher, disciplineController.getReferralById);

/**
 * POST /api/discipline/referrals
 * Create a new referral
 */
router.post('/discipline/referrals', requireTeacher, disciplineController.createReferral);

/**
 * PATCH /api/discipline/referrals/:id
 * Update a referral (admin only)
 */
router.patch('/discipline/referrals/:id', requireAdmin, disciplineController.updateReferral);

/**
 * DELETE /api/discipline/referrals/:id
 * Delete a referral (admin only)
 */
router.delete('/discipline/referrals/:id', requireAdmin, disciplineController.deleteReferral);

// ============================================================================
// DISCIPLINE SCORE
// ============================================================================

/**
 * GET /api/discipline/score/:studentId
 * Query: school_id, campus_id?, academic_year_id?
 */
router.get('/discipline/score/:studentId', requireTeacher, disciplineController.getStudentScore);

export default router;
