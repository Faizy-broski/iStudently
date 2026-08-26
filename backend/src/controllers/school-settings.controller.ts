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

      const formattedSettings = settings ? {
        ...settings,
        enable_payment_reminder: settings.enable_payment_reminder ?? true,
        auto_dismiss_seconds: settings.auto_dismiss_seconds ?? 5,
        preferred_date_format: settings.preferred_date_format || 'MMMM d yyyy',
      } : {
        school_id: schoolId,
        campus_id: campusId || null,
        diary_reminder_enabled: false,
        diary_reminder_time: '07:00',
        diary_reminder_days: [1, 2, 3, 4, 5],
        auto_remove_inactive: false,
        default_payment_method: 'cash',
        preferred_date_format: 'MMMM d yyyy',
        auto_attendance_enabled: true,
        auto_attendance_hour: '18:00',
        auto_attendance_days: [1, 2, 3, 4, 5],
        absent_on_first_absence: false,
        student_list_append_config: null,
        assignment_max_points: null,
        hijri_offset: 0,
        allowed_modules: null,
        enable_payment_reminder: true,
        auto_dismiss_seconds: 5,
      }

      res.json({
        success: true,
        data: formattedSettings,
      })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * GET /api/school-settings/allowed-modules?school_id=xxx
   * Super-admin-only: read the module allow-list for any school.
   */
  async getAllowedModules(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.query.school_id as string | undefined
      if (!schoolId) {
        res.status(400).json({ success: false, error: 'school_id is required' })
        return
      }

      const allowedModules = await this.reminderService.getAllowedModules(schoolId)
      res.json({ success: true, data: { school_id: schoolId, allowed_modules: allowedModules } })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * PUT /api/school-settings/allowed-modules
   * Super-admin-only: set the module allow-list for any school.
   * Body: { school_id, allowed_modules: string[] | null }
   */
  async updateAllowedModules(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { school_id, allowed_modules } = req.body

      if (!school_id) {
        res.status(400).json({ success: false, error: 'school_id is required' })
        return
      }

      if (allowed_modules !== null && !Array.isArray(allowed_modules)) {
        res.status(400).json({ success: false, error: 'allowed_modules must be an array of strings or null' })
        return
      }
      if (Array.isArray(allowed_modules) && allowed_modules.some((m: unknown) => typeof m !== 'string')) {
        res.status(400).json({ success: false, error: 'allowed_modules must contain only strings' })
        return
      }

      const result = await this.reminderService.setAllowedModules(school_id, allowed_modules)
      res.json({ success: true, data: { school_id, allowed_modules: result } })
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
        default_currency,
        hijri_offset,
        auto_attendance_enabled,
        auto_attendance_hour,
        auto_attendance_days,
        absent_on_first_absence,
        student_list_append_config,
        assignment_max_points,
        active_plugins,
        social_login_config,
        enable_payment_reminder,
        auto_dismiss_seconds,
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

      if (auto_dismiss_seconds !== undefined) {
        const secs = Number(auto_dismiss_seconds)
        if (isNaN(secs) || secs < 1 || secs > 60) {
          res.status(400).json({ success: false, error: 'auto_dismiss_seconds must be a number between 1 and 60' })
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
        default_currency,
        hijri_offset: hijri_offset != null ? Number(hijri_offset) : undefined,
        auto_attendance_enabled,
        auto_attendance_hour,
        auto_attendance_days,
        absent_on_first_absence,
        student_list_append_config,
        assignment_max_points: assignment_max_points != null ? Number(assignment_max_points) : null,
        active_plugins,
        social_login_config,
        enable_payment_reminder,
        auto_dismiss_seconds: auto_dismiss_seconds !== undefined ? Number(auto_dismiss_seconds) : undefined,
      }, campusId)

      res.json({ success: true, data: settings })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * GET /api/school-settings/payment-reminder-status
   * Check if current logged-in user has an overdue payment reminder to display
   */
  async getPaymentReminderStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.json({
          success: true,
          data: {
            enable_payment_reminder: false,
            auto_dismiss_seconds: 5,
            has_overdue_balance: false,
            balance: 0,
            currency: 'LYD'
          }
        })
        return
      }

      const campusId = req.query.campus_id as string | undefined
      const settings = await this.reminderService.getSettings(schoolId, campusId || null)

      const enableReminder = settings?.enable_payment_reminder ?? true
      const autoDismissSeconds = settings?.auto_dismiss_seconds ?? 5
      const currency = settings?.default_currency || 'LYD'

      if (!enableReminder) {
        res.json({
          success: true,
          data: {
            enable_payment_reminder: false,
            auto_dismiss_seconds: autoDismissSeconds,
            has_overdue_balance: false,
            balance: 0,
            currency
          }
        })
        return
      }

      const role = (req.profile?.role || '').toLowerCase()
      const profileId = req.profile?.id

      let hasOverdueBalance = false
      let totalBalance = 0
      let studentName = ''

      const today = new Date().toISOString().split('T')[0]

      if (role === 'parent' && profileId) {
        const { data: parent } = await supabase
          .from('parents')
          .select('id')
          .eq('profile_id', profileId)
          .maybeSingle()

        if (parent?.id) {
          const { data: children } = await supabase
            .from('parent_student_links')
            .select(`
              student:students!inner(
                id,
                profile:profiles!students_profile_id_fkey(first_name, last_name)
              )
            `)
            .eq('parent_id', parent.id)

          if (children && children.length > 0) {
            const studentIds = children.map((c: any) => c.student.id)
            const { data: fees } = await supabase
              .from('student_fees')
              .select('final_amount, amount_paid, balance, due_date, status')
              .in('student_id', studentIds)
              .in('status', ['pending', 'partial', 'overdue'])

            if (fees && fees.length > 0) {
              const overdueFees = fees.filter(f => f.status === 'overdue' || (f.due_date && f.due_date < today))
              if (overdueFees.length > 0) {
                hasOverdueBalance = true
                totalBalance = fees.reduce((sum, f) => {
                  const b = parseFloat(f.balance)
                  if (!isNaN(b) && b > 0) return sum + b
                  const rem = (parseFloat(f.final_amount) || 0) - (parseFloat(f.amount_paid) || 0)
                  return sum + Math.max(0, rem)
                }, 0)
                const firstChild = (children[0] as any)?.student?.profile
                if (firstChild) {
                  studentName = `${firstChild.first_name || ''} ${firstChild.last_name || ''}`.trim()
                }
              }
            }
          }
        }
      } else if (role === 'student' && profileId) {
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('profile_id', profileId)
          .maybeSingle()

        const studentId = student?.id || (req.profile as any)?.student_id

        if (studentId) {
          const { data: fees } = await supabase
            .from('student_fees')
            .select('final_amount, amount_paid, balance, due_date, status')
            .eq('student_id', studentId)
            .in('status', ['pending', 'partial', 'overdue'])

          if (fees && fees.length > 0) {
            const overdueFees = fees.filter(f => f.status === 'overdue' || (f.due_date && f.due_date < today))
            if (overdueFees.length > 0) {
              hasOverdueBalance = true
              totalBalance = fees.reduce((sum, f) => {
                const b = parseFloat(f.balance)
                if (!isNaN(b) && b > 0) return sum + b
                const rem = (parseFloat(f.final_amount) || 0) - (parseFloat(f.amount_paid) || 0)
                return sum + Math.max(0, rem)
              }, 0)
            }
          }
        }
      }

      res.json({
        success: true,
        data: {
          enable_payment_reminder: enableReminder,
          auto_dismiss_seconds: autoDismissSeconds,
          has_overdue_balance: hasOverdueBalance,
          balance: totalBalance,
          currency,
          student_name: studentName
        }
      })
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
   * GET /api/school-settings/jitsi
   * Get the custom Jitsi Meet domain for the current school/campus
   */
  async getJitsiSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' }); return }

      const campusId = req.query.campus_id as string | undefined

      let query = supabase
        .from('school_settings')
        .select('jitsi_domain')
        .eq('school_id', schoolId)

      if (campusId) {
        query = query.eq('campus_id', campusId)
      } else {
        query = query.is('campus_id', null)
      }

      const { data } = await query.maybeSingle()

      res.json({
        success: true,
        data: { jitsi_domain: data?.jitsi_domain || '' },
      })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * PUT /api/school-settings/jitsi
   * Save the custom Jitsi Meet domain for the current school/campus
   */
  async updateJitsiSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' }); return }

      const campusId = (req.query.campus_id as string | undefined) || req.body.campus_id || null
      const { jitsi_domain } = req.body

      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
        jitsi_domain: jitsi_domain || null,
      }

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

      res.json({ success: true, message: 'Jitsi settings saved' })
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

  // ─── Social Login Credentials (mirrors SMTP pattern) ──────────────────────

  /**
   * GET /api/school-settings/social-login
   * Get social login credentials (secrets masked).
   */
  async getSocialLoginSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' }); return }

      const campusId = req.query.campus_id as string | undefined

      let query = supabase
        .from('school_settings')
        .select('social_login_config, active_plugins')
        .eq('school_id', schoolId)

      query = campusId ? query.eq('campus_id', campusId) : query.is('campus_id', null)

      const { data } = await query.maybeSingle()

      const cfg = data?.social_login_config ?? {}
      const plugins = data?.active_plugins ?? {}

      res.json({
        success: true,
        data: {
          google_enabled: plugins.google_social_login === true,
          google_client_id: cfg.google_client_id || '',
          google_client_secret: cfg.google_client_secret ? '••••••••' : '',
          google_hosted_domain: cfg.google_hosted_domain || '',
          has_google_secret: !!cfg.google_client_secret,
          microsoft_enabled: plugins.microsoft_social_login === true,
          microsoft_client_id: cfg.microsoft_client_id || '',
          microsoft_client_secret: cfg.microsoft_client_secret ? '••••••••' : '',
          microsoft_tenant: cfg.microsoft_tenant || '',
          has_microsoft_secret: !!cfg.microsoft_client_secret,
        },
      })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * PUT /api/school-settings/social-login
   * Save social login credentials.
   */
  async updateSocialLoginSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' }); return }

      const campusId = (req.query.campus_id as string | undefined) || req.body.campus_id || null
      const {
        google_enabled,
        google_client_id,
        google_client_secret,
        google_hosted_domain,
        microsoft_enabled,
        microsoft_client_id,
        microsoft_client_secret,
        microsoft_tenant,
      } = req.body

      // Build active_plugins update
      let query = supabase
        .from('school_settings')
        .select('active_plugins, social_login_config')
        .eq('school_id', schoolId)
      query = campusId ? query.eq('campus_id', campusId) : query.is('campus_id', null)
      const { data: existing } = await query.maybeSingle()

      const currentPlugins = existing?.active_plugins ?? {}
      const currentConfig = existing?.social_login_config ?? {}

      // Only update provided fields
      const updatedPlugins: Record<string, any> = { ...currentPlugins }
      if (google_enabled !== undefined) updatedPlugins.google_social_login = google_enabled
      if (microsoft_enabled !== undefined) updatedPlugins.microsoft_social_login = microsoft_enabled

      const updatedConfig: Record<string, any> = { ...currentConfig }
      if (google_client_id !== undefined) updatedConfig.google_client_id = google_client_id || null
      if (google_client_secret !== undefined && google_client_secret !== '••••••••' && google_client_secret !== '') {
        updatedConfig.google_client_secret = google_client_secret
      }
      if (google_hosted_domain !== undefined) updatedConfig.google_hosted_domain = google_hosted_domain || null
      if (microsoft_client_id !== undefined) updatedConfig.microsoft_client_id = microsoft_client_id || null
      if (microsoft_client_secret !== undefined && microsoft_client_secret !== '••••••••' && microsoft_client_secret !== '') {
        updatedConfig.microsoft_client_secret = microsoft_client_secret
      }
      if (microsoft_tenant !== undefined) updatedConfig.microsoft_tenant = microsoft_tenant || null

      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
        active_plugins: updatedPlugins,
        social_login_config: updatedConfig,
      }

      // Upsert pattern (same as SMTP)
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

      res.json({ success: true, message: 'Social login settings saved' })
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

  // ─── Custom Menu Order ─────────────────────────────────────────────────────

  /**
   * GET /api/school-settings/custom-menu-order
   * Get the custom sidebar section order for the current school/campus.
   */
  async getCustomMenuOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' }); return }

      const campusId = req.query.campus_id as string | undefined

      let query = supabase
        .from('school_settings')
        .select('custom_menu_order')
        .eq('school_id', schoolId)

      query = campusId ? query.eq('campus_id', campusId) : query.is('campus_id', null)

      const { data } = await query.maybeSingle()

      res.json({ success: true, data: data?.custom_menu_order ?? {} })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * PUT /api/school-settings/custom-menu-order
   * Save sidebar section order. Body: { role: string, order: string[] }
   */
  async updateCustomMenuOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' }); return }

      const campusId = (req.query.campus_id as string | undefined) || req.body.campus_id || null
      const { role, order } = req.body

      const VALID_ROLES = ['admin', 'teacher', 'student', 'parent', 'librarian']
      if (!role || !VALID_ROLES.includes(role)) {
        res.status(400).json({ success: false, error: 'Invalid role' })
        return
      }
      if (!Array.isArray(order) || !order.every((t: unknown) => typeof t === 'string')) {
        res.status(400).json({ success: false, error: 'order must be an array of strings' })
        return
      }

      // Get existing menu order
      let existQuery = supabase
        .from('school_settings')
        .select('id, custom_menu_order')
        .eq('school_id', schoolId)
      existQuery = campusId ? existQuery.eq('campus_id', campusId) : existQuery.is('campus_id', null)
      const { data: existing } = await existQuery.maybeSingle()

      const currentOrder = existing?.custom_menu_order ?? {}
      const updatedOrder = { ...currentOrder, [role]: order }

      const updates = {
        custom_menu_order: updatedOrder,
        updated_at: new Date().toISOString(),
      }

      if (existing?.id) {
        const { error } = await supabase
          .from('school_settings')
          .update(updates)
          .eq('id', existing.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase
          .from('school_settings')
          .insert({ school_id: schoolId, campus_id: campusId ?? null, ...updates })
        if (error) throw new Error(error.message)
      }

      res.json({ success: true, data: updatedOrder })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
}
