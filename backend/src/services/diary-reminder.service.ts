import { supabase } from '../config/supabase'
import { sendEmail } from './mail'

interface TeacherMissingEntry {
  teacher_id: string
  teacher_name: string
  teacher_email: string
  missing_classes: {
    section_name: string
    subject_name: string
    period_number: number
    start_time: string
    end_time: string
  }[]
}

interface ReminderResult {
  school_id: string
  school_name: string
  teachers_notified: number
  emails_sent: number
  errors: string[]
}

export class DiaryReminderService {
  /**
   * Get school settings, with optional campus-specific override.
   * If campusId is provided, tries campus-specific row first, then falls back to school-wide.
   * If campusId is not provided, returns the school-wide row.
   */
  async getSettings(schoolId: string, campusId?: string | null) {
    try {
      // Campus-specific lookup first
      if (campusId) {
        const { data: campusData, error: campusError } = await supabase
          .from('school_settings')
          .select('*')
          .eq('school_id', schoolId)
          .eq('campus_id', campusId)
          .maybeSingle()

        if (campusError && campusError.code !== 'PGRST116') {
          if (campusError.message?.includes('schema cache') || campusError.message?.includes('table')) {
            throw new Error('School settings table not found; please run database migrations.')
          }
          throw new Error(`Failed to fetch school settings: ${campusError.message}`)
        }

        if (campusData) {
          return campusData
        }
        // Fall through to school-wide lookup
      }

      // School-wide (campus_id IS NULL)
      const { data, error } = await supabase
        .from('school_settings')
        .select('*')
        .eq('school_id', schoolId)
        .is('campus_id', null)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        if (error.message?.includes('schema cache') || error.message?.includes('table')) {
          throw new Error('School settings table not found; please run database migrations.')
        }
        throw new Error(`Failed to fetch school settings: ${error.message}`)
      }

      return data || null
    } catch (err: any) {
      throw err
    }
  }

  /**
   * Update diary reminder / school settings for a school.
   * Pass campusId to save a campus-specific row; omit for the school-wide default.
   */
  async updateSettings(schoolId: string, settings: {
    diary_reminder_enabled?: boolean
    diary_reminder_time?: string
    diary_reminder_days?: number[]
    hostel?: {
      auto_remove_inactive?: boolean
    }
    default_payment_method?: string
    default_currency?: string
    hijri_offset?: number
    auto_attendance_enabled?: boolean
    auto_attendance_hour?: string
    auto_attendance_days?: number[]
    absent_on_first_absence?: boolean
    student_list_append_config?: Record<string, unknown> | null
    assignment_max_points?: number | null
    active_plugins?: Record<string, boolean>
    social_login_config?: Record<string, unknown> | null
  }, campusId?: string | null) {
    const VALID_PAYMENT_METHODS = ['cash', 'online', 'bank_deposit', 'cheque']
    const now = new Date().toISOString()
    const updates: any = { updated_at: now }

    if (settings.diary_reminder_enabled !== undefined) updates.diary_reminder_enabled = settings.diary_reminder_enabled
    if (settings.diary_reminder_time !== undefined) updates.diary_reminder_time = settings.diary_reminder_time
    if (settings.diary_reminder_days !== undefined) updates.diary_reminder_days = settings.diary_reminder_days
    if (settings.hostel && settings.hostel.auto_remove_inactive !== undefined) {
      updates.auto_remove_inactive = settings.hostel.auto_remove_inactive
    }
    if (settings.default_payment_method !== undefined) {
      const method = settings.default_payment_method.toLowerCase()
      updates.default_payment_method = VALID_PAYMENT_METHODS.includes(method) ? method : 'cash'
    }
    if (settings.default_currency !== undefined) {
      updates.default_currency = settings.default_currency.toUpperCase().slice(0, 10)
    }
    if (settings.hijri_offset !== undefined) {
      const offset = Math.round(Number(settings.hijri_offset))
      updates.hijri_offset = isNaN(offset) ? 0 : Math.max(-30, Math.min(30, offset))
    }
    if (settings.auto_attendance_enabled !== undefined) updates.auto_attendance_enabled = settings.auto_attendance_enabled
    if (settings.auto_attendance_hour !== undefined) updates.auto_attendance_hour = settings.auto_attendance_hour
    if (settings.auto_attendance_days !== undefined) updates.auto_attendance_days = settings.auto_attendance_days
    if (settings.absent_on_first_absence !== undefined) updates.absent_on_first_absence = settings.absent_on_first_absence
    if (settings.student_list_append_config !== undefined) updates.student_list_append_config = settings.student_list_append_config
    if (settings.assignment_max_points !== undefined) updates.assignment_max_points = settings.assignment_max_points
    if (settings.active_plugins !== undefined) {
      // Merge incoming plugin states with existing — never replace entire object
      updates.active_plugins = settings.active_plugins
    }
    if (settings.social_login_config !== undefined) updates.social_login_config = settings.social_login_config

    // Check if a row already exists for this school + campus combination
    const existingQuery = supabase
      .from('school_settings')
      .select('id')
      .eq('school_id', schoolId)

    if (campusId) {
      existingQuery.eq('campus_id', campusId)
    } else {
      existingQuery.is('campus_id', null)
    }

    const { data: existing } = await existingQuery.maybeSingle()

    let query
    if (existing?.id) {
      // Update existing row
      query = supabase
        .from('school_settings')
        .update(updates)
        .eq('id', existing.id)
    } else {
      // Insert new row
      query = supabase
        .from('school_settings')
        .insert({ school_id: schoolId, campus_id: campusId || null, created_at: now, ...updates })
    }

    const { data, error } = await query
      .select()
      .single()

    if (error) {
      if (error.message?.includes('schema cache') || error.message?.includes('table')) {
        throw new Error('School settings table not found; please run database migrations.');
      }
      throw new Error(`Failed to update settings: ${error.message}`)
    }

    return data
  }

  /**
   * Find teachers who did not add diary entries for yesterday's classes
   * and send them email reminders
   */
  async sendDiaryReminders(): Promise<ReminderResult[]> {
    const results: ReminderResult[] = []

    try {
      // Get all schools with diary reminders enabled
      const { data: enabledSchools, error: settingsError } = await supabase
        .from('school_settings')
        .select('school_id')
        .eq('diary_reminder_enabled', true)

      if (settingsError) {
        console.error('❌ Failed to fetch school settings:', settingsError)
        return results
      }

      if (!enabledSchools || enabledSchools.length === 0) {
        console.log('📓 No schools have diary reminders enabled')
        return results
      }

      // Get school IDs
      const schoolIds = enabledSchools.map(s => s.school_id)

      // Get school names
      const { data: schools } = await supabase
        .from('schools')
        .select('id, name')
        .in('id', schoolIds)
        .eq('is_active', true)

      if (!schools || schools.length === 0) {
        console.log('📓 No active schools with diary reminders')
        return results
      }

      // Calculate yesterday's date and day_of_week
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]
      const jsDay = yesterday.getDay() // 0=Sun
      const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1 // Convert to 0=Mon

      console.log(`📓 Checking diary entries for ${yesterdayStr} (day_of_week=${dayOfWeek})`)

      for (const school of schools) {
        const result = await this.processSchool(school.id, school.name, yesterdayStr, dayOfWeek)
        results.push(result)
      }
    } catch (error: any) {
      console.error('❌ Critical error in diary reminders:', error.message)
    }

    return results
  }

  /**
   * Process a single school: find missing entries and send emails
   */
  private async processSchool(
    schoolId: string,
    schoolName: string,
    dateStr: string,
    dayOfWeek: number
  ): Promise<ReminderResult> {
    const result: ReminderResult = {
      school_id: schoolId,
      school_name: schoolName,
      teachers_notified: 0,
      emails_sent: 0,
      errors: [],
    }

    try {
      // Check if yesterday's day is in the reminder days
      const { data: settings } = await supabase
        .from('school_settings')
        .select('diary_reminder_days')
        .eq('school_id', schoolId)
        .single()

      if (settings?.diary_reminder_days && !settings.diary_reminder_days.includes(dayOfWeek)) {
        console.log(`   ⏭️ ${schoolName}: Skipping — ${dayOfWeek} not in reminder days`)
        return result
      }

      // Get current academic year for this school
      const { data: academicYear } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', schoolId)
        .eq('is_current', true)
        .single()

      if (!academicYear) {
        console.log(`   ⚠️ ${schoolName}: No current academic year found`)
        return result
      }

      // Get all timetable entries for yesterday's day
      const { data: timetableEntries, error: ttError } = await supabase
        .from('timetable_entries')
        .select(`
          id,
          teacher_id,
          section_id,
          subject_id,
          period_id,
          day_of_week,
          section:sections!section_id(id, name),
          subject:subjects!subject_id(id, name),
          period:periods!period_id(id, period_number, start_time, end_time),
          teacher:staff!teacher_id(
            id,
            profile:profiles(id, first_name, last_name, email)
          )
        `)
        .eq('school_id', schoolId)
        .eq('academic_year_id', academicYear.id)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)

      if (ttError) {
        result.errors.push(`Failed to fetch timetable: ${ttError.message}`)
        return result
      }

      if (!timetableEntries || timetableEntries.length === 0) {
        console.log(`   ℹ️ ${schoolName}: No timetable entries for day ${dayOfWeek}`)
        return result
      }

      // Get all diary entries for yesterday
      const { data: diaryEntries, error: deError } = await supabase
        .from('class_diary_entries')
        .select('id, teacher_id, section_id, subject_id, timetable_entry_id')
        .eq('school_id', schoolId)
        .eq('diary_date', dateStr)

      if (deError) {
        result.errors.push(`Failed to fetch diary entries: ${deError.message}`)
        return result
      }

      // Build a set of timetable_entry_ids that have diary entries
      // Also match on teacher_id + section_id + subject_id for entries not linked via timetable_entry_id
      const coveredTimetableIds = new Set<string>()
      const coveredTeacherSectionSubject = new Set<string>()

      for (const de of (diaryEntries || [])) {
        if (de.timetable_entry_id) {
          coveredTimetableIds.add(de.timetable_entry_id)
        }
        // Also track by teacher+section+subject combo
        const key = `${de.teacher_id}|${de.section_id}|${de.subject_id || ''}`
        coveredTeacherSectionSubject.add(key)
      }

      // Find timetable entries without diary entries
      const missingByTeacher = new Map<string, TeacherMissingEntry>()

      for (const te of timetableEntries) {
        // Check if this slot is covered
        if (coveredTimetableIds.has(te.id)) continue
        const comboKey = `${te.teacher_id}|${te.section_id}|${te.subject_id || ''}`
        if (coveredTeacherSectionSubject.has(comboKey)) continue

        // Teacher hasn't written a diary entry for this class
        const teacherProfile = (te.teacher as any)?.profile
        if (!teacherProfile?.email) continue // Skip if no email

        const teacherId = te.teacher_id
        if (!missingByTeacher.has(teacherId)) {
          missingByTeacher.set(teacherId, {
            teacher_id: teacherId,
            teacher_name: `${teacherProfile.first_name || ''} ${teacherProfile.last_name || ''}`.trim(),
            teacher_email: teacherProfile.email,
            missing_classes: [],
          })
        }

        missingByTeacher.get(teacherId)!.missing_classes.push({
          section_name: (te.section as any)?.name || 'Unknown Section',
          subject_name: (te.subject as any)?.name || 'Unknown Subject',
          period_number: (te.period as any)?.period_number || 0,
          start_time: (te.period as any)?.start_time || '',
          end_time: (te.period as any)?.end_time || '',
        })
      }

      if (missingByTeacher.size === 0) {
        console.log(`   ✅ ${schoolName}: All teachers have diary entries for ${dateStr}`)
        return result
      }

      console.log(`   📧 ${schoolName}: ${missingByTeacher.size} teacher(s) missing diary entries`)

      // Send emails
      for (const [, teacher] of missingByTeacher) {
        try {
          await this.sendReminderEmail(teacher, dateStr, schoolName)
          result.emails_sent++
          result.teachers_notified++
        } catch (emailError: any) {
          result.errors.push(`Failed to email ${teacher.teacher_email}: ${emailError.message}`)
        }
      }
    } catch (error: any) {
      result.errors.push(`Processing error: ${error.message}`)
    }

    return result
  }

  /**
   * Send reminder email to a teacher
   */
  private async sendReminderEmail(
    teacher: TeacherMissingEntry,
    dateStr: string,
    schoolName: string
  ) {
    const formattedDate = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const classListHtml = teacher.missing_classes
      .sort((a, b) => a.period_number - b.period_number)
      .map(c => `
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${c.section_name}</td>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${c.subject_name}</td>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">Period ${c.period_number}</td>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${c.start_time || '—'} – ${c.end_time || '—'}</td>
        </tr>
      `).join('')

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #022172; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 20px;">📓 Class Diary Reminder</h1>
        </div>
        
        <div style="padding: 24px; background-color: #f9fafb;">
          <p style="font-size: 16px; color: #1f2937;">
            Dear <strong>${teacher.teacher_name}</strong>,
          </p>
          
          <p style="font-size: 14px; color: #4b5563;">
            This is a friendly reminder that you have not yet added a Class Diary entry for the following class(es) on <strong>${formattedDate}</strong>:
          </p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
            <thead>
              <tr style="background-color: #e5e7eb;">
                <th style="padding: 8px 12px; border: 1px solid #d1d5db; text-align: left;">Section</th>
                <th style="padding: 8px 12px; border: 1px solid #d1d5db; text-align: left;">Subject</th>
                <th style="padding: 8px 12px; border: 1px solid #d1d5db; text-align: left;">Period</th>
                <th style="padding: 8px 12px; border: 1px solid #d1d5db; text-align: left;">Time</th>
              </tr>
            </thead>
            <tbody>
              ${classListHtml}
            </tbody>
          </table>
          
          <p style="font-size: 14px; color: #4b5563;">
            Please log in to the system and add your diary entries at your earliest convenience.
          </p>
          
          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 12px; color: #9ca3af; text-align: center;">
              This is an automated reminder from <strong>${schoolName}</strong>.<br/>
              You received this because Class Diary email reminders are enabled. Contact your administrator to adjust this setting.
            </p>
          </div>
        </div>
      </div>
    `

    const text = `Class Diary Reminder\n\nDear ${teacher.teacher_name},\n\nYou have not added a Class Diary entry for the following classes on ${formattedDate}:\n\n${teacher.missing_classes.map(c => `• ${c.section_name} — ${c.subject_name} (Period ${c.period_number})`).join('\n')}\n\nPlease log in and add your diary entries.\n\n— ${schoolName}`

    await sendEmail({
      to: teacher.teacher_email,
      subject: `📓 Class Diary Reminder — ${formattedDate}`,
      html,
      text,
    })

    console.log(`      ✉️ Sent reminder to ${teacher.teacher_email} (${teacher.missing_classes.length} classes)`)
  }

  /**
   * Send a test reminder email to an admin
   */
  async sendTestReminder(schoolId: string, toEmail: string) {
    const { data: school } = await supabase
      .from('schools')
      .select('name')
      .eq('id', schoolId)
      .single()

    const schoolName = school?.name || 'Your School'

    const testTeacher: TeacherMissingEntry = {
      teacher_id: 'test',
      teacher_name: 'Test Teacher',
      teacher_email: toEmail,
      missing_classes: [
        { section_name: 'Section A', subject_name: 'Mathematics', period_number: 1, start_time: '08:00', end_time: '08:45' },
        { section_name: 'Section B', subject_name: 'English', period_number: 3, start_time: '10:00', end_time: '10:45' },
      ],
    }

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateStr = yesterday.toISOString().split('T')[0]

    await this.sendReminderEmail(testTeacher, dateStr, schoolName)
    return { success: true, message: `Test reminder sent to ${toEmail}` }
  }
}

export const diaryReminderService = new DiaryReminderService()
