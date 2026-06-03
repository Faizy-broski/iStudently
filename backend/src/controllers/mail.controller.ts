import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import {
  sendEmailToStudents,
  sendEmailToStaff,
  getEmailLog,
  sendDisciplineLog,
  sendReportCards,
  sendBalances,
  getNotificationSettings,
  saveNotificationSettings,
  sendDaysAbsent,
  sendDisciplineLogToParents,
  sendReportCardsToParents,
  sendBalancesToParents,
} from '../services/email.service'
import { getEffectiveSchoolId } from '../utils/campus-validation'

// ─── Send to Students ────────────────────────────────────────────────────────

export const sendToStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      recipient_ids,
      subject,
      body,
      test_email,
      cc_emails,
      campus_id,
    } = req.body

    if (!recipient_ids?.length) {
      res.status(400).json({ success: false, error: 'No recipients selected' })
      return
    }

    if (!subject?.trim()) {
      res.status(400).json({ success: false, error: 'Subject is required' })
      return
    }

    if (!body?.trim()) {
      res.status(400).json({ success: false, error: 'Email body is required' })
      return
    }

    const adminSchoolId = req.profile.school_id
    const schoolId = await getEffectiveSchoolId(adminSchoolId, campus_id)
    const sentByProfileId = req.profile.id

    const result = await sendEmailToStudents({
      subject: subject.trim(),
      body,
      recipientIds: recipient_ids,
      schoolId,
      sentByProfileId,
      testEmail: test_email?.trim() || undefined,
      ccEmails: cc_emails?.length ? cc_emails : undefined,
    })

    res.json({ success: true, data: result })
  } catch (error) {
    console.error('sendToStudents error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    })
  }
}

// ─── Send to Staff ───────────────────────────────────────────────────────────

export const sendToStaff = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      recipient_ids,
      subject,
      body,
      test_email,
      cc_emails,
      campus_id,
    } = req.body

    if (!recipient_ids?.length) {
      res.status(400).json({ success: false, error: 'No recipients selected' })
      return
    }

    if (!subject?.trim()) {
      res.status(400).json({ success: false, error: 'Subject is required' })
      return
    }

    if (!body?.trim()) {
      res.status(400).json({ success: false, error: 'Email body is required' })
      return
    }

    const adminSchoolId = req.profile.school_id
    const schoolId = await getEffectiveSchoolId(adminSchoolId, campus_id)
    const sentByProfileId = req.profile.id

    const result = await sendEmailToStaff({
      subject: subject.trim(),
      body,
      recipientIds: recipient_ids,
      schoolId,
      sentByProfileId,
      testEmail: test_email?.trim() || undefined,
      ccEmails: cc_emails?.length ? cc_emails : undefined,
    })

    res.json({ success: true, data: result })
  } catch (error) {
    console.error('sendToStaff error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    })
  }
}

// ─── Email Log ───────────────────────────────────────────────────────────────

export const fetchEmailLog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { start_date, end_date, page = '1', limit = '50' } = req.query as Record<string, string>
    const schoolId = req.profile.school_id

    const result = await getEmailLog(
      schoolId,
      start_date,
      end_date,
      parseInt(page, 10),
      parseInt(limit, 10)
    )

    res.json({ success: true, data: result.data, total: result.total, page: result.page, totalPages: result.totalPages })
  } catch (error) {
    console.error('fetchEmailLog error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch email log',
    })
  }
}

// ─── Send Discipline Log ──────────────────────────────────────────────────────

export const sendDisciplineLogEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { recipient_ids, subject, body, test_email, campus_id, include_fields, academic_year_id } = req.body

    if (!recipient_ids?.length) { res.status(400).json({ success: false, error: 'No recipients selected' }); return }
    if (!subject?.trim()) { res.status(400).json({ success: false, error: 'Subject is required' }); return }
    if (!body?.trim()) { res.status(400).json({ success: false, error: 'Email body is required' }); return }

    const schoolId = await getEffectiveSchoolId(req.profile.school_id, campus_id)
    const result = await sendDisciplineLog({
      subject: subject.trim(),
      body,
      recipientIds: recipient_ids,
      schoolId,
      sentByProfileId: req.profile.id,
      testEmail: test_email?.trim() || undefined,
      academicYearId: academic_year_id || undefined,
      includeFields: include_fields || { entryDate: true, reporter: true, violation: true, detention: false, suspension: false, comments: false },
    })

    res.json({ success: true, data: result })
  } catch (error) {
    console.error('sendDisciplineLogEmail error:', error)
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to send email' })
  }
}

// ─── Send Report Cards ────────────────────────────────────────────────────────

export const sendReportCardsEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { recipient_ids, subject, body, test_email, campus_id, include_fields, marking_period_id, academic_year_id } = req.body

    if (!recipient_ids?.length) { res.status(400).json({ success: false, error: 'No recipients selected' }); return }
    if (!subject?.trim()) { res.status(400).json({ success: false, error: 'Subject is required' }); return }
    if (!body?.trim()) { res.status(400).json({ success: false, error: 'Email body is required' }); return }

    const schoolId = await getEffectiveSchoolId(req.profile.school_id, campus_id)
    const result = await sendReportCards({
      subject: subject.trim(),
      body,
      recipientIds: recipient_ids,
      schoolId,
      sentByProfileId: req.profile.id,
      testEmail: test_email?.trim() || undefined,
      markingPeriodId: marking_period_id || undefined,
      academicYearId: academic_year_id || undefined,
      includeFields: include_fields || { teacher: false, comments: true, percents: true, credits: false },
    })

    res.json({ success: true, data: result })
  } catch (error) {
    console.error('sendReportCardsEmail error:', error)
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to send email' })
  }
}

// ─── Send Balances ────────────────────────────────────────────────────────────

export const sendBalancesEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { recipient_ids, subject, body, test_email, campus_id, academic_year } = req.body

    if (!recipient_ids?.length) { res.status(400).json({ success: false, error: 'No recipients selected' }); return }
    if (!subject?.trim()) { res.status(400).json({ success: false, error: 'Subject is required' }); return }
    if (!body?.trim()) { res.status(400).json({ success: false, error: 'Email body is required' }); return }

    const schoolId = await getEffectiveSchoolId(req.profile.school_id, campus_id)
    const result = await sendBalances({
      subject: subject.trim(),
      body,
      recipientIds: recipient_ids,
      schoolId,
      sentByProfileId: req.profile.id,
      testEmail: test_email?.trim() || undefined,
      academicYear: academic_year || undefined,
    })

    res.json({ success: true, data: result })
  } catch (error) {
    console.error('sendBalancesEmail error:', error)
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to send email' })
  }
}

// ─── Notification Settings ────────────────────────────────────────────────────

export const getNotifSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.profile.school_id
    const campusId = (req.query.campus_id as string) || undefined
    const settings = await getNotificationSettings(schoolId, campusId)
    res.json({ success: true, data: settings })
  } catch (error) {
    console.error('getNotifSettings error:', error)
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to get notification settings' })
  }
}

export const saveNotifSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.profile.school_id
    const { type, settings, campus_id } = req.body
    if (!type || !['absences', 'birthday', 'payments'].includes(type)) {
      res.status(400).json({ success: false, error: 'Invalid notification type' })
      return
    }
    await saveNotificationSettings(schoolId, type, settings || {}, campus_id || undefined)
    res.json({ success: true })
  } catch (error) {
    console.error('saveNotifSettings error:', error)
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to save notification settings' })
  }
}

// ─── Send Days Absent to Parents ─────────────────────────────────────────────

export const sendDaysAbsentEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { recipient_ids, subject, body, test_email, campus_id, start_date, end_date } = req.body
    if (!recipient_ids?.length) { res.status(400).json({ success: false, error: 'No recipients selected' }); return }
    if (!subject?.trim()) { res.status(400).json({ success: false, error: 'Subject is required' }); return }
    if (!body?.trim()) { res.status(400).json({ success: false, error: 'Email body is required' }); return }
    if (!start_date || !end_date) { res.status(400).json({ success: false, error: 'Date range is required' }); return }

    const schoolId = await getEffectiveSchoolId(req.profile.school_id, campus_id)
    const result = await sendDaysAbsent({
      subject: subject.trim(), body,
      recipientStudentIds: recipient_ids,
      schoolId, sentByProfileId: req.profile.id,
      testEmail: test_email?.trim() || undefined,
      startDate: start_date, endDate: end_date,
    })
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('sendDaysAbsentEmail error:', error)
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to send email' })
  }
}

// ─── Send Discipline Log to Parents ──────────────────────────────────────────

export const sendDisciplineLogToParentsEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { recipient_ids, subject, body, test_email, campus_id, include_fields, academic_year_id } = req.body
    if (!recipient_ids?.length) { res.status(400).json({ success: false, error: 'No recipients selected' }); return }
    if (!subject?.trim()) { res.status(400).json({ success: false, error: 'Subject is required' }); return }
    if (!body?.trim()) { res.status(400).json({ success: false, error: 'Email body is required' }); return }

    const schoolId = await getEffectiveSchoolId(req.profile.school_id, campus_id)
    const result = await sendDisciplineLogToParents({
      subject: subject.trim(), body, recipientIds: recipient_ids,
      schoolId, sentByProfileId: req.profile.id,
      testEmail: test_email?.trim() || undefined,
      academicYearId: academic_year_id || undefined,
      includeFields: include_fields || { entryDate: true, reporter: true, violation: true, detention: false, suspension: false, comments: false },
    })
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('sendDisciplineLogToParentsEmail error:', error)
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to send email' })
  }
}

// ─── Send Report Cards to Parents ────────────────────────────────────────────

export const sendReportCardsToParentsEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { recipient_ids, subject, body, test_email, campus_id, include_fields, marking_period_id, academic_year_id } = req.body
    if (!recipient_ids?.length) { res.status(400).json({ success: false, error: 'No recipients selected' }); return }
    if (!subject?.trim()) { res.status(400).json({ success: false, error: 'Subject is required' }); return }
    if (!body?.trim()) { res.status(400).json({ success: false, error: 'Email body is required' }); return }

    const schoolId = await getEffectiveSchoolId(req.profile.school_id, campus_id)
    const result = await sendReportCardsToParents({
      subject: subject.trim(), body, recipientIds: recipient_ids,
      schoolId, sentByProfileId: req.profile.id,
      testEmail: test_email?.trim() || undefined,
      markingPeriodId: marking_period_id || undefined,
      academicYearId: academic_year_id || undefined,
      includeFields: include_fields || { teacher: false, comments: true, percents: true, credits: false },
    })
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('sendReportCardsToParentsEmail error:', error)
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to send email' })
  }
}

// ─── Send Balances to Parents ─────────────────────────────────────────────────

export const sendBalancesToParentsEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { recipient_ids, subject, body, test_email, campus_id, academic_year } = req.body
    if (!recipient_ids?.length) { res.status(400).json({ success: false, error: 'No recipients selected' }); return }
    if (!subject?.trim()) { res.status(400).json({ success: false, error: 'Subject is required' }); return }
    if (!body?.trim()) { res.status(400).json({ success: false, error: 'Email body is required' }); return }

    const schoolId = await getEffectiveSchoolId(req.profile.school_id, campus_id)
    const result = await sendBalancesToParents({
      subject: subject.trim(), body, recipientIds: recipient_ids,
      schoolId, sentByProfileId: req.profile.id,
      testEmail: test_email?.trim() || undefined,
      academicYear: academic_year || undefined,
    })
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('sendBalancesToParentsEmail error:', error)
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to send email' })
  }
}

// ─── Test mail (kept for backward compat) ────────────────────────────────────

export const sendTestMail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sendEmail } = await import('../services/mail')
    const { email } = req.body

    await sendEmail({
      to: email,
      subject: 'Test Email - Studently',
      text: 'This is a test email from Studently.',
      html: '<h2>Test Email</h2><p>Your SMTP configuration is working correctly.</p>',
    })

    res.json({ success: true, message: 'Test email sent successfully' })
  } catch (error) {
    console.error('sendTestMail error:', error)
    res.status(500).json({ success: false, error: 'Failed to send test email' })
  }
}
