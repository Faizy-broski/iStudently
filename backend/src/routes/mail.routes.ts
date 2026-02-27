import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import {
  sendToStudents,
  sendToStaff,
  fetchEmailLog,
  sendTestMail,
  sendDisciplineLogEmail,
  sendReportCardsEmail,
  sendBalancesEmail,
  getNotifSettings,
  saveNotifSettings,
  sendDaysAbsentEmail,
  sendDisciplineLogToParentsEmail,
  sendReportCardsToParentsEmail,
  sendBalancesToParentsEmail,
} from '../controllers/mail.controller'

const router = Router()

router.use(authenticate)

// Email log
router.get('/log', requireAdmin, fetchEmailLog)

// Send to recipients
router.post('/send-students', requireAdmin, sendToStudents)
router.post('/send-staff', requireAdmin, sendToStaff)

// Module-specific emails
router.post('/send-discipline-log', requireAdmin, sendDisciplineLogEmail)
router.post('/send-report-cards', requireAdmin, sendReportCardsEmail)
router.post('/send-balances', requireAdmin, sendBalancesEmail)

// Parent emails
router.post('/send-days-absent', requireAdmin, sendDaysAbsentEmail)
router.post('/send-discipline-log-parents', requireAdmin, sendDisciplineLogToParentsEmail)
router.post('/send-report-cards-parents', requireAdmin, sendReportCardsToParentsEmail)
router.post('/send-balances-parents', requireAdmin, sendBalancesToParentsEmail)

// Notification settings
router.get('/notifications', requireAdmin, getNotifSettings)
router.post('/notifications', requireAdmin, saveNotifSettings)

// Test (kept for convenience)
router.post('/send', sendTestMail)

export default router
