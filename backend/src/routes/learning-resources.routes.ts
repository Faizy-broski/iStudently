import express from 'express'
import * as learningResourcesController from '../controllers/learning-resources.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireTeacher } from '../middlewares/role.middleware'
import { requireBodyRowsInSchoolFamily, requireRequestSchoolsInFamily, requireRowInSchoolFamily } from '../middlewares/row-school-scope.middleware'
import { requireOwnStudent } from '../middlewares/student-access.middleware'
import { requireOwnRow, requireSelfTeacherId } from '../middlewares/own-course-period.middleware'

const router = express.Router()

// All routes require authentication
router.use(authenticate)

// Sections, resources and students addressed by id must belong to the caller's school family;
// a student records views only as themselves.
const querySection = requireRowInSchoolFamily('sections', 'section_id', 'school_id', 'query')
const resourceRow = requireRowInSchoolFamily('learning_resources')
// Teachers may only manage their own resources (admins: any of the school family).
const ownResource = requireOwnRow('learning_resources')
const teacherInQuery = requireRowInSchoolFamily('staff', 'teacher_id', 'school_id', 'query')
// A new resource's school / campus, teacher, section and subject come from the body as given.
const createRefs = [
  requireRequestSchoolsInFamily,
  requireBodyRowsInSchoolFamily('staff', 'teacher_id'),
  requireBodyRowsInSchoolFamily('sections', 'section_id'),
  requireBodyRowsInSchoolFamily('subjects', 'subject_id'),
]
const viewRefs = [
  requireBodyRowsInSchoolFamily('learning_resources', 'resource_id'),
  requireBodyRowsInSchoolFamily('students', 'student_id'),
  requireOwnStudent((req) => req.body?.student_id),
]

// ============================================================================
// LEARNING RESOURCES ROUTES
// ============================================================================

// Get resources (by teacher or section)
router.get('/teacher', requireTeacher, teacherInQuery, requireSelfTeacherId('query'), learningResourcesController.getTeacherResources)
router.get('/section', querySection, learningResourcesController.getSectionResources)

// CRUD operations
router.get('/:id', resourceRow, learningResourcesController.getResource)
router.post('/', requireTeacher, ...createRefs, requireSelfTeacherId('body'), learningResourcesController.createResource)
router.put('/:id', requireTeacher, resourceRow, ownResource, ...createRefs, requireSelfTeacherId('body'), learningResourcesController.updateResource)
router.delete('/:id', requireTeacher, resourceRow, ownResource, learningResourcesController.deleteResource)

// View tracking
router.post('/view', ...viewRefs, learningResourcesController.recordView)
router.get('/:id/stats', requireTeacher, resourceRow, ownResource, learningResourcesController.getViewStats)

export default router
