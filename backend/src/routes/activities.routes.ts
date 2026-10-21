import { Router } from 'express';
import * as activitiesController from '../controllers/activities.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireOwnCoursePeriods } from '../middlewares/own-course-period.middleware';
import { requireAdmin, requireTeacher } from '../middlewares/role.middleware';
import { requireBodyRowsInSchoolFamily, requireRowInSchoolFamily } from '../middlewares/row-school-scope.middleware';

const router = Router();


// ============================================================================
// ACTIVITIES (Setup)
// ============================================================================

/** GET /api/activities */
// Activities, students and course periods given by id must belong to the caller's school family.
const activityRow = requireRowInSchoolFamily('activities');
const studentParam = requireRowInSchoolFamily('students', 'studentId');
const bodyStudents = requireBodyRowsInSchoolFamily('students', 'student_ids');
const queryCp = requireRowInSchoolFamily('course_periods', 'course_period_id', 'school_id', 'query');
const queryStudent = requireRowInSchoolFamily('students', 'student_id', 'school_id', 'query');
const bodyCp = requireBodyRowsInSchoolFamily('course_periods', 'course_period_id');
const bodyRecordStudents = requireBodyRowsInSchoolFamily('students', (b) => (Array.isArray(b.records) ? b.records.map((r: { student_id?: unknown }) => r?.student_id) : undefined));

router.get('/activities', authenticate, requireTeacher, activitiesController.getActivities);

/** POST /api/activities */
router.post('/activities', authenticate, requireAdmin, activitiesController.createActivity);

/** PATCH /api/activities/:id */
router.patch('/activities/:id', authenticate, requireAdmin, activityRow, activitiesController.updateActivity);

/** DELETE /api/activities/:id */
router.delete('/activities/:id', authenticate, requireAdmin, activityRow, activitiesController.deleteActivity);

// ============================================================================
// STUDENT ENROLLMENT
// ============================================================================

/** GET /api/activities/:id/students */
router.get('/activities/:id/students', authenticate, requireTeacher, activityRow, activitiesController.getActivityStudents);

/** POST /api/activities/:id/students */
router.post('/activities/:id/students', authenticate, requireAdmin, activityRow, bodyStudents, activitiesController.enrollStudents);

/** DELETE /api/activities/:id/students/:studentId */
router.delete('/activities/:id/students/:studentId', authenticate, requireAdmin, activityRow, studentParam, activitiesController.unenrollStudent);

// ============================================================================
// ELIGIBILITY
// NOTE: static sub-paths must come before /:id routes
// ============================================================================

/** GET /api/activities/eligibility/student */
router.get('/activities/eligibility/student', authenticate, requireTeacher, queryStudent, activitiesController.getStudentEligibility);

/** GET /api/activities/eligibility */
router.get('/activities/eligibility', authenticate, requireTeacher, queryCp, requireOwnCoursePeriods((req) => req.query.course_period_id), activitiesController.getEligibility);

/** POST /api/activities/eligibility */
router.post('/activities/eligibility', authenticate, requireTeacher, bodyCp, requireOwnCoursePeriods((req) => req.body?.course_period_id), bodyRecordStudents, activitiesController.saveEligibility);

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
