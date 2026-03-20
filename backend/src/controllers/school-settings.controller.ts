import { Request, Response } from 'express'
import { DiaryReminderService } from '../services/diary-reminder.service'
import { supabase } from '../config/supabase'
import { createTransporter, SmtpConfig } from '../config/mail'

interface AuthRequest extends Request {
  user?: {
    id: string
    email?: string
  }
  profile?: {
    id: string
    school_id?: string
    role?: string
    is_active?: boolean
    email?: string
  }
}

export class SchoolSettingsController {
  private reminderService: DiaryReminderService

  constructor() {
    this.reminderService = new DiaryReminderService()
  }

  /**
   * GET /api/school-settings
   * Get school settings for the current user's school
   */
  async getSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const campusId = req.query.campus_id as string | undefined

      const settings = await this.reminderService.getSettings(schoolId, campusId || null)

      res.json({
        success: true,
        data: settings || {
          school_id: schoolId,
          campus_id: campusId || null,
          diary_reminder_enabled: false,
          diary_reminder_time: '07:00',
          diary_reminder_days: [1, 2, 3, 4, 5],
          auto_remove_inactive: false,
          default_payment_method: 'cash',
          auto_attendance_enabled: true,
          auto_attendance_hour: '18:00',
          auto_attendance_days: [1, 2, 3, 4, 5],
          absent_on_first_absence: false,
          student_list_append_config: null,
          assignment_max_points: null,
        },
      })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * PUT /api/school-settings
   * Update school settings
   */
  async updateSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const {
        diary_reminder_enabled,
        diary_reminder_time,
        diary_reminder_days,
        auto_remove_inactive,
        default_payment_method,
        auto_attendance_enabled,
        auto_attendance_hour,
        auto_attendance_days,
        absent_on_first_absence,
        student_list_append_config,
        assignment_max_points,
        active_plugins,
        campus_id: bodyCampusId,
      } = req.body

      const campusId = (req.query.campus_id as string | undefined) || bodyCampusId || null

      // Validate time format (diary)
      if (diary_reminder_time && !/^\d{2}:\d{2}$/.test(diary_reminder_time)) {
        res.status(400).json({ success: false, error: 'Invalid time format. Use HH:MM (24h)' })
        return
      }

      // Validate time format (auto-attendance)
      if (auto_attendance_hour && !/^\d{2}:\d{2}$/.test(auto_attendance_hour)) {
        res.status(400).json({ success: false, error: 'Invalid auto_attendance_hour format. Use HH:MM (24h)' })
        return
      }

      // Validate days array (diary)
      if (diary_reminder_days) {
        if (!Array.isArray(diary_reminder_days) || diary_reminder_days.some((d: number) => d < 0 || d > 6)) {
          res.status(400).json({ success: false, error: 'Invalid days. Must be array of 0-6 (Mon=0, Sun=6)' })
          return
        }
      }

      // Validate days array (auto-attendance)
      if (auto_attendance_days) {
        if (!Array.isArray(auto_attendance_days) || auto_attendance_days.some((d: number) => d < 0 || d > 6)) {
          res.status(400).json({ success: false, error: 'Invalid auto_attendance_days. Must be array of 0-6 (Mon=0, Sun=6)' })
          return
        }
      }

      // Validate active_plugins: must be a plain object of {string: boolean}
      if (active_plugins !== undefined) {
        if (typeof active_plugins !== 'object' || Array.isArray(active_plugins)) {
          res.status(400).json({ success: false, error: 'active_plugins must be an object' })
          return
        }
      }

      const settings = await this.reminderService.updateSettings(schoolId, {
        diary_reminder_enabled,
        diary_reminder_time,
        diary_reminder_days,
        hostel: {
          auto_remove_inactive,
        },
        default_payment_method,
        auto_attendance_enabled,
        auto_attendance_hour,
        auto_attendance_days,
        absent_on_first_absence,
        student_list_append_config,
        assignment_max_points: assignment_max_points != null ? Number(assignment_max_points) : null,
        active_plugins,
      }, campusId)

      res.json({ success: true, data: settings })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * POST /api/school-settings/test-diary-reminder
   * Send a test diary reminder email to the current admin's email
   */
  async sendTestReminder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const toEmail = req.body.email || req.profile?.email || req.user?.email
      if (!toEmail) {
        res.status(400).json({ success: false, error: 'No email address available. Please provide one.' })
        return
      }

      const result = await this.reminderService.sendTestReminder(schoolId, toEmail)
      res.json({ success: true, data: result })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * POST /api/school-settings/trigger-diary-reminders
   * Manually trigger diary reminders (for testing/debugging)
   */
  async triggerReminders(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await this.reminderService.sendDiaryReminders()
      res.json({ success: true, data: result })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * GET /api/school-settings/smtp
   * Get SMTP settings for the current school (password masked)
   */
  async getSmtpSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' }); return }

      const campusId = req.query.campus_id as string | undefined

      let query = supabase
        .from('school_settings')
        .select('smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_from_email, smtp_from_name')
        .eq('school_id', schoolId)

      if (campusId) {
        query = query.eq('campus_id', campusId)
      } else {
        query = query.is('campus_id', null)
      }

      const { data } = await query.maybeSingle()

      res.json({
        success: true,
        data: {
          smtp_host: data?.smtp_host || '',
          smtp_port: data?.smtp_port || 465,
          smtp_secure: data?.smtp_secure !== false,
          smtp_user: data?.smtp_user || '',
          smtp_pass: data?.smtp_pass ? '••••••••' : '',
          smtp_from_email: data?.smtp_from_email || '',
          smtp_from_name: data?.smtp_from_name || '',
          has_password: !!data?.smtp_pass,
        },
      })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * PUT /api/school-settings/smtp
   * Save SMTP settings for the current school/campus
   */
  async updateSmtpSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' }); return }

      const campusId = (req.query.campus_id as string | undefined) || req.body.campus_id || null

      const { smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_from_email, smtp_from_name } = req.body

      const updates: Record<string, any> = { updated_at: new Date().toISOString() }
      if (smtp_host !== undefined) updates.smtp_host = smtp_host || null
      if (smtp_port !== undefined) updates.smtp_port = parseInt(smtp_port, 10) || 465
      if (smtp_secure !== undefined) updates.smtp_secure = smtp_secure === true || smtp_secure === 'true'
      if (smtp_user !== undefined) updates.smtp_user = smtp_user || null
      if (smtp_pass !== undefined && smtp_pass !== '••••••••' && smtp_pass !== '') {
        updates.smtp_pass = smtp_pass
      }
      if (smtp_from_email !== undefined) updates.smtp_from_email = smtp_from_email || null
      if (smtp_from_name !== undefined) updates.smtp_from_name = smtp_from_name || null

      // UPDATE first and check how many rows were affected via returned data
      let updateQ = supabase.from('school_settings').update(updates).eq('school_id', schoolId)
      updateQ = campusId ? updateQ.eq('campus_id', campusId) : updateQ.is('campus_id', null)
      const { data: updatedRows, error: updateError } = await updateQ.select('id')
      if (updateError) throw new Error(updateError.message)

      if (!updatedRows || updatedRows.length === 0) {
        // No row existed yet — insert one
        const { error: insertError } = await supabase
          .from('school_settings')
          .insert({ school_id: schoolId, campus_id: campusId ?? null, ...updates })
        if (insertError) throw new Error(insertError.message)
      }

      res.json({ success: true, message: 'SMTP settings saved' })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * GET /api/school-settings/pdf-header-footer
   * Get PDF header/footer settings for the current school/campus
   */
  async getPdfHeaderFooter(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' }); return }

      const campusId = req.query.campus_id as string | undefined

      let query = supabase
        .from('school_settings')
        .select('pdf_header_html, pdf_footer_html, pdf_margin_top, pdf_margin_bottom, pdf_exclude_print')
        .eq('school_id', schoolId)

      if (campusId) {
        query = query.eq('campus_id', campusId)
      } else {
        query = query.is('campus_id', null)
      }

      const { data } = await query.maybeSingle()

      res.json({
        success: true,
        data: {
          pdf_header_html: data?.pdf_header_html || '',
          pdf_footer_html: data?.pdf_footer_html || '',
          pdf_margin_top: data?.pdf_margin_top ?? 20,
          pdf_margin_bottom: data?.pdf_margin_bottom ?? 18,
          pdf_exclude_print: data?.pdf_exclude_print ?? false,
        },
      })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * PUT /api/school-settings/pdf-header-footer
   * Save PDF header/footer settings for the current school/campus
   */
  async updatePdfHeaderFooter(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' }); return }

      const campusId = (req.query.campus_id as string | undefined) || req.body.campus_id || null

      const { pdf_header_html, pdf_footer_html, pdf_margin_top, pdf_margin_bottom, pdf_exclude_print } = req.body

      const updates: Record<string, any> = { updated_at: new Date().toISOString() }
      if (pdf_header_html !== undefined) updates.pdf_header_html = pdf_header_html || null
      if (pdf_footer_html !== undefined) updates.pdf_footer_html = pdf_footer_html || null
      if (pdf_margin_top !== undefined) updates.pdf_margin_top = parseInt(pdf_margin_top, 10) || 20
      if (pdf_margin_bottom !== undefined) updates.pdf_margin_bottom = parseInt(pdf_margin_bottom, 10) || 18
      if (pdf_exclude_print !== undefined) updates.pdf_exclude_print = pdf_exclude_print === true || pdf_exclude_print === 'true'

      // UPDATE first, INSERT if no row existed
      let updateQ = supabase.from('school_settings').update(updates).eq('school_id', schoolId)
      updateQ = campusId ? updateQ.eq('campus_id', campusId) : updateQ.is('campus_id', null)
      const { data: updatedRows, error: updateError } = await updateQ.select('id')
      if (updateError) throw new Error(updateError.message)

      if (!updatedRows || updatedRows.length === 0) {
        const { error: insertError } = await supabase
          .from('school_settings')
          .insert({ school_id: schoolId, campus_id: campusId ?? null, ...updates })
        if (insertError) throw new Error(insertError.message)
      }

      res.json({ success: true, message: 'PDF header/footer settings saved' })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * POST /api/school-settings/convert-names-titlecase
   * Convert first_name, last_name, father_name, grandfather_name in profiles
   * to titlecase (first letter of each word uppercase) for the current campus.
   * Mirrors RosarioSIS "Convert Names To Titlecase" plugin using INITCAP().
   */
  async convertNamesTitlecase(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      // Use PostgreSQL INITCAP via a direct update expression.
      // Supabase JS client doesn't support column expressions in update(),
      // so we fetch → transform in Node.js → batch update (idiomatic Supabase approach).
      const FIELDS = ['first_name', 'last_name', 'father_name', 'grandfather_name'] as const

      const { data: profiles, error: fetchError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, father_name, grandfather_name')
        .eq('school_id', schoolId)

      if (fetchError) {
        res.status(500).json({ success: false, error: fetchError.message })
        return
      }

      if (!profiles || profiles.length === 0) {
        res.json({ success: true, data: { converted: 0 } })
        return
      }

      // Apply titlecase: mirrors PostgreSQL INITCAP() — first letter of each word uppercase
      const toTitleCase = (str: string | null): string | null => {
        if (!str) return str
        return str.replace(/\S+/g, word =>
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
      }

      const updates = profiles
        .map(p => {
          const changed: Record<string, string | null> = { id: p.id }
          let hasChange = false
          for (const field of FIELDS) {
            const converted = toTitleCase(p[field] as string | null)
            if (converted !== p[field]) {
              changed[field] = converted
              hasChange = true
            }
          }
          return hasChange ? changed : null
        })
        .filter(Boolean) as Record<string, string | null>[]

      if (updates.length === 0) {
        res.json({ success: true, data: { converted: 0 } })
        return
      }

      // Batch upsert in chunks of 100
      const CHUNK = 100
      for (let i = 0; i < updates.length; i += CHUNK) {
        const chunk = updates.slice(i, i + CHUNK)
        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert(chunk, { onConflict: 'id' })
        if (upsertError) {
          res.status(500).json({ success: false, error: upsertError.message })
          return
        }
      }

      res.json({ success: true, data: { converted: updates.length } })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * POST /api/school-settings/smtp/test
   * Test SMTP connection and send a test email
   */
  async testSmtpSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' }); return }

      const campusId = (req.query.campus_id as string | undefined) || req.body.campus_id || null
      const toEmail = req.body.test_email || req.profile?.email || req.user?.email
      if (!toEmail) { res.status(400).json({ success: false, error: 'Provide a test_email address' }); return }

      let bodyPass = req.body.smtp_pass
      if (bodyPass === '••••••••' || !bodyPass) {
        let q = supabase.from('school_settings').select('smtp_pass').eq('school_id', schoolId)
        q = campusId ? q.eq('campus_id', campusId) : q.is('campus_id', null)
        const { data } = await q.maybeSingle()
        bodyPass = data?.smtp_pass || ''
      }

      let config: SmtpConfig | undefined
      const bodyHost = req.body.smtp_host
      const bodyUser = req.body.smtp_user
      if (bodyHost && bodyUser && bodyPass) {
        config = {
          host: bodyHost,
          port: parseInt(req.body.smtp_port, 10) || 465,
          secure: req.body.smtp_secure === true || req.body.smtp_secure === 'true',
          user: bodyUser,
          pass: bodyPass,
        }
      }

      const transporter = createTransporter(config)
      await transporter.verify()

      const fromName = req.body.smtp_from_name || 'Studently'
      const fromEmail = req.body.smtp_from_email || process.env.EMAIL_USER || ''
      const from = fromEmail ? `${fromName} <${fromEmail}>` : (process.env.EMAIL_FROM ?? 'Studently')

      await transporter.sendMail({
        from,
        to: toEmail,
        subject: 'Studently — SMTP Test Email',
        html: '<p>Your SMTP configuration is working correctly. This is a test email sent from Studently.</p>',
        text: 'Your SMTP configuration is working correctly.',
      })

      res.json({ success: true, message: `Test email sent to ${toEmail}` })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
}
