import { Router } from 'express'
import * as ctrl from '../controllers/human-resources.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin, requireTeacher } from '../middlewares/role.middleware'
import { requireBodyRowsInSchoolFamily, requireRowInSchoolFamily } from '../middlewares/row-school-scope.middleware'

const router = Router()
router.use(authenticate)

// Qualification rows and the person they belong to must be in the caller's school family (before,
// any admin could read, change or delete another school's staff qualifications by id).
const profileParam = requireRowInSchoolFamily('profiles', 'profile_id')
const bodyProfile = requireBodyRowsInSchoolFamily('profiles', 'profile_id')
const row = (table: string) => requireRowInSchoolFamily(table)

// All qualifications for a profile (read)
router.get('/qualifications/:profile_id', requireTeacher, profileParam, ctrl.getQualifications)

// Skills
router.post('/skills', requireAdmin, bodyProfile, ctrl.createSkill)
router.put('/skills/:id', requireAdmin, row('hr_skills'), ctrl.updateSkill)
router.delete('/skills/:id', requireAdmin, row('hr_skills'), ctrl.deleteSkill)

// Education
router.post('/education', requireAdmin, bodyProfile, ctrl.createEducation)
router.put('/education/:id', requireAdmin, row('hr_education'), ctrl.updateEducation)
router.delete('/education/:id', requireAdmin, row('hr_education'), ctrl.deleteEducation)

// Certifications
router.post('/certifications', requireAdmin, bodyProfile, ctrl.createCertification)
router.put('/certifications/:id', requireAdmin, row('hr_certifications'), ctrl.updateCertification)
router.delete('/certifications/:id', requireAdmin, row('hr_certifications'), ctrl.deleteCertification)

// Languages
router.post('/languages', requireAdmin, bodyProfile, ctrl.createLanguage)
router.put('/languages/:id', requireAdmin, row('hr_languages'), ctrl.updateLanguage)
router.delete('/languages/:id', requireAdmin, row('hr_languages'), ctrl.deleteLanguage)

export default router
