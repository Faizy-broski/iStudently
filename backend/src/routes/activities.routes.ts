import { Router } from 'express';
import * as activitiesController from '../controllers/activities.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requireTeacher } from '../middlewares/role.middleware';

const router = Router();


// ============================================================================
// ACTIVITIES (Setup)
// ============================================================================

/** GET /api/activities */
router.get('/activities', authenticate, requireTeacher, activitiesController.getActivities);

/** POST /api/activities */
router.post('/activities', authenticate, requireAdmin, activitiesController.createActivity);

/** PATCH /api/activities/:id */
router.patch('/activities/:id', authenticate, requireAdmin, activitiesController.updateActivity);

/** DELETE /api/activities/:id */
router.delete('/activities/:id', authenticate, requireAdmin, activitiesController.deleteActivity);

// ============================================================================
// STUDENT ENROLLMENT
// ============================================================================

/** GET /api/activities/:id/students */
router.get('/activities/:id/students', authenticate, requireTeacher, activitiesController.getActivityStudents);

/** POST /api/activities/:id/students */
router.post('/activities/:id/students', authenticate, requireAdmin, activitiesController.enrollStudents);

/** DELETE /api/activities/:id/students/:studentId */
router.delete('/activities/:id/students/:studentId', authenticate, requireAdmin, activitiesController.unenrollStudent);

// ============================================================================
// ELIGIBILITY
// NOTE: static sub-paths must come before /:id routes
// ============================================================================

/** GET /api/activities/eligibility/student */
router.get('/activities/eligibility/student', authenticate, requireTeacher, activitiesController.getStudentEligibility);

/** GET /api/activities/eligibility */
router.get('/activities/eligibility', authenticate, requireTeacher, activitiesController.getEligibility);

/** POST /api/activities/eligibility */
router.post('/activities/eligibility', authenticate, requireTeacher, activitiesController.saveEligibility);

// ============================================================================
// SETTINGS
// ============================================================================

/** GET /api/activities/settings/entry-times */
router.get('/activities/settings/entry-times', authenticate, requireAdmin, activitiesController.getEntryTimes);

/** POST /api/activities/settings/entry-times */
router.post('/activities/settings/entry-times', authenticate, requireAdmin, activitiesController.saveEntryTimes);

// ============================================================================
// REPORTS
// ============================================================================

/** GET /api/activities/reports/student-list */
router.get('/activities/reports/student-list', authenticate, requireTeacher, activitiesController.getStudentListReport);

/** GET /api/activities/reports/teacher-completion */
router.get('/activities/reports/teacher-completion', authenticate, requireTeacher, activitiesController.getTeacherCompletionReport);

export default router;
