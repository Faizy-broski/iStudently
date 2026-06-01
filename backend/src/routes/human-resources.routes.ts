import { Router } from 'express'
import * as ctrl from '../controllers/human-resources.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin, requireTeacher } from '../middlewares/role.middleware'

const router = Router()
router.use(authenticate)

// All qualifications for a profile (read)
router.get('/qualifications/:profile_id', requireTeacher, ctrl.getQualifications)

// Skills
router.post('/skills', requireAdmin, ctrl.createSkill)
router.put('/skills/:id', requireAdmin, ctrl.updateSkill)
router.delete('/skills/:id', requireAdmin, ctrl.deleteSkill)

// Education
router.post('/education', requireAdmin, ctrl.createEducation)
router.put('/education/:id', requireAdmin, ctrl.updateEducation)
router.delete('/education/:id', requireAdmin, ctrl.deleteEducation)

// Certifications
router.post('/certifications', requireAdmin, ctrl.createCertification)
router.put('/certifications/:id', requireAdmin, ctrl.updateCertification)
router.delete('/certifications/:id', requireAdmin, ctrl.deleteCertification)

// Languages
router.post('/languages', requireAdmin, ctrl.createLanguage)
router.put('/languages/:id', requireAdmin, ctrl.updateLanguage)
router.delete('/languages/:id', requireAdmin, ctrl.deleteLanguage)

export default router
