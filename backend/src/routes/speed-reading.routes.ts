import { Router } from 'express'
import { speedReadingController } from '../controllers/speed-reading.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin, requireTeacher, requireRole } from '../middlewares/role.middleware'
import { requireRowInSchoolFamily } from '../middlewares/row-school-scope.middleware'

const router = Router()
router.use(authenticate)

// Texts are looked up by id alone in the service; keep them inside the caller's school family.
const textInFamily = requireRowInSchoolFamily('reading_texts')

// Any authenticated user can list/read texts; only teachers can create/edit/delete
router.get('/texts',         (req, res) => speedReadingController.getTexts(req, res))
router.post('/texts',        requireTeacher, (req, res) => speedReadingController.createText(req, res))
router.get('/texts/:id',     textInFamily, (req, res) => speedReadingController.getText(req, res))
router.put('/texts/:id',     requireTeacher, textInFamily, (req, res) => speedReadingController.updateText(req, res))
router.delete('/texts/:id',  requireAdmin,   textInFamily, (req, res) => speedReadingController.deleteText(req, res))

// Any authenticated user: submit session, view leaderboard, view own stats
router.post('/logs',       (req, res) => speedReadingController.submitLog(req, res))
router.get('/leaderboard', (req, res) => speedReadingController.getLeaderboard(req, res))
router.get('/stats/me',    (req, res) => speedReadingController.getMyStats(req, res))

// Session log review — IMPORTANT: /logs/student/me must come before /logs/:id
router.get('/logs/student/me', (req, res) => speedReadingController.getStudentLogs(req, res))
router.get('/logs/:id',        (req, res) => speedReadingController.getSessionLog(req, res))
router.delete('/logs/:id',     requireRole('admin', 'teacher'), (req, res) => speedReadingController.deleteSessionLog(req, res))
router.get('/logs',            requireRole('admin', 'teacher'), (req, res) => speedReadingController.listSessionLogs(req, res))

// Dashboard stats — teachers see full stats, students see their school's aggregates
router.get('/dashboard-stats', (req, res) => speedReadingController.getDashboardStats(req, res))

export default router
