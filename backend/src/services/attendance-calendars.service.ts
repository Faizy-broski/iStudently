import { supabase } from '../config/supabase'

// ---- Interfaces ----

export interface AttendanceCalendar {
  id: string
  school_id: string
  campus_id?: string | null
  title: string
  is_default: boolean
  calendar_type: 'gregorian' | 'hijri'
  start_date: string
  end_date: string
  weekdays: boolean[]
  default_minutes: number
  academic_year_id?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface CreateCalendarDTO {
  school_id: string
  campus_id?: string | null
  title: string
  is_default?: boolean
  calendar_type: 'gregorian' | 'hijri'
  start_date: string
  end_date: string
  weekdays?: boolean[]
  default_minutes?: number
  academic_year_id?: string | null
  created_by?: string | null
  copy_from_calendar_id?: string | null
}

export interface UpdateCalendarDTO {
  title?: string
  is_default?: boolean
  calendar_type?: 'gregorian' | 'hijri'
  start_date?: string
  end_date?: string
  weekdays?: boolean[]
  default_minutes?: number
  academic_year_id?: string | null
}

export interface CalendarDaySummary {
  total_days: number
  school_days: number
  non_school_days: number
  total_minutes: number
}

// ---- Service ----

export class AttendanceCalendarsService {

  /**
   * Get all named calendars for a school
   */
  async getCalendars(schoolId: string, campusId?: string): Promise<AttendanceCalendar[]> {
    let query = supabase
      .from('attendance_calendars')
      .select('*')
      .eq('school_id', schoolId)
      .order('is_default', { ascending: false })
      .order('title', { ascending: true })

    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  }

  /**
   * Get a single calendar by ID
   */
  async getCalendarById(id: string): Promise<AttendanceCalendar | null> {
    const { data, error } = await supabase
      .from('attendance_calendars')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data
  }

  /**
   * Create a new named calendar and generate its days
   */
  async createCalendar(dto: CreateCalendarDTO): Promise<AttendanceCalendar> {
    const { copy_from_calendar_id, ...insertData } = dto

    // Insert the named calendar
    const { data: calendar, error } = await supabase
      .from('attendance_calendars')
      .insert({
        ...insertData,
        weekdays: insertData.weekdays || [false, true, true, true, true, true, false],
        default_minutes: insertData.default_minutes || 360,
      })
      .select()
      .single()

    if (error) throw error

    // Generate calendar days
    if (copy_from_calendar_id) {
      await this.copyCalendarDays(copy_from_calendar_id, calendar.id, calendar.school_id, calendar.campus_id)
    } else {
      await this.generateCalendarDays(calendar)
    }

    return calendar
  }

  /**
   * Update a named calendar
   */
  async updateCalendar(id: string, dto: UpdateCalendarDTO): Promise<AttendanceCalendar> {
    const { data, error } = await supabase
      .from('attendance_calendars')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Delete a named calendar (cascades to its days)
   */
  async deleteCalendar(id: string): Promise<void> {
    const { error } = await supabase
      .from('attendance_calendars')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  /**
   * Generate calendar days for a named calendar based on date range and weekday config
   */
  async generateCalendarDays(calendar: AttendanceCalendar): Promise<number> {
    const startDate = new Date(calendar.start_date)
    const endDate = new Date(calendar.end_date)
    const weekdays = calendar.weekdays || [false, true, true, true, true, true, false]

    const days: any[] = []
    const currentDate = new Date(startDate)

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
      const isSchoolDay = weekdays[dayOfWeek] || false

      days.push({
        school_id: calendar.school_id,
        campus_id: calendar.campus_id || null,
        calendar_id: calendar.id,
        school_date: currentDate.toISOString().split('T')[0],
        is_school_day: isSchoolDay,
        minutes: isSchoolDay ? (calendar.default_minutes || 360) : 0,
        academic_year_id: calendar.academic_year_id || null,
      })

      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Batch insert in chunks of 500
    const chunkSize = 500
    let totalInserted = 0

    for (let i = 0; i < days.length; i += chunkSize) {
      const chunk = days.slice(i, i + chunkSize)
      const { error } = await supabase
        .from('attendance_calendar')
        .insert(chunk)

      if (error) throw error
      totalInserted += chunk.length
    }

    return totalInserted
  }

  /**
   * Copy days from one calendar to another
   */
  async copyCalendarDays(
    sourceCalendarId: string,
    targetCalendarId: string,
    schoolId: string,
    campusId?: string | null
  ): Promise<number> {
    // Get source days
    const { data: sourceDays, error: fetchError } = await supabase
      .from('attendance_calendar')
      .select('school_date, is_school_day, minutes, block, notes, academic_year_id')
      .eq('calendar_id', sourceCalendarId)
      .order('school_date')

    if (fetchError) throw fetchError
    if (!sourceDays || sourceDays.length === 0) return 0

    // Insert as new days for target calendar
    const newDays = sourceDays.map(day => ({
      school_id: schoolId,
      campus_id: campusId || null,
      calendar_id: targetCalendarId,
      school_date: day.school_date,
      is_school_day: day.is_school_day,
      minutes: day.minutes,
      block: day.block,
      notes: day.notes,
      academic_year_id: day.academic_year_id,
    }))

    const chunkSize = 500
    let totalInserted = 0

    for (let i = 0; i < newDays.length; i += chunkSize) {
      const chunk = newDays.slice(i, i + chunkSize)
      const { error } = await supabase
        .from('attendance_calendar')
        .insert(chunk)

      if (error) throw error
      totalInserted += chunk.length
    }

    return totalInserted
  }

  /**
   * Get all days for a named calendar in a given month
   */
  async getCalendarDays(
    calendarId: string,
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    const { data, error } = await supabase
      .from('attendance_calendar')
      .select('*')
      .eq('calendar_id', calendarId)
      .gte('school_date', startDate)
      .lte('school_date', endDate)
      .order('school_date')

    if (error) throw error
    return data || []
  }

  /**
   * Get all days for a named calendar (full range)
   */
  async getAllCalendarDays(calendarId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('attendance_calendar')
      .select('*')
      .eq('calendar_id', calendarId)
      .order('school_date')

    if (error) throw error
    return data || []
  }

  /**
   * Toggle a single day's school day status
   */
  async toggleCalendarDay(dayId: string, isSchoolDay: boolean, minutes?: number): Promise<any> {
    const updateData: any = {
      is_school_day: isSchoolDay,
    }
    if (minutes !== undefined) {
      updateData.minutes = minutes
    } else {
      // If toggling off, set minutes to 0; if toggling on, keep existing or default
      if (!isSchoolDay) updateData.minutes = 0
    }

    const { data, error } = await supabase
      .from('attendance_calendar')
      .update(updateData)
      .eq('id', dayId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Update a calendar day (minutes, notes, etc.)
   */
  async updateCalendarDay(dayId: string, updates: {
    is_school_day?: boolean
    minutes?: number
    notes?: string
    block?: string
  }): Promise<any> {
    const { data, error } = await supabase
      .from('attendance_calendar')
      .update(updates)
      .eq('id', dayId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Regenerate days for a calendar (delete existing + generate new)
   */
  async regenerateCalendarDays(calendarId: string): Promise<number> {
    // Get the calendar
    const calendar = await this.getCalendarById(calendarId)
    if (!calendar) throw new Error('Calendar not found')

    // Delete existing days
    const { error: deleteError } = await supabase
      .from('attendance_calendar')
      .delete()
      .eq('calendar_id', calendarId)

    if (deleteError) throw deleteError

    // Generate new days
    return this.generateCalendarDays(calendar)
  }

  /**
   * Get calendar day summary (counts)
   */
  async getCalendarDaySummary(calendarId: string): Promise<CalendarDaySummary> {
    const { data, error } = await supabase
      .from('attendance_calendar')
      .select('is_school_day, minutes')
      .eq('calendar_id', calendarId)

    if (error) throw error

    const days = data || []
    const schoolDays = days.filter(d => d.is_school_day)

    return {
      total_days: days.length,
      school_days: schoolDays.length,
      non_school_days: days.length - schoolDays.length,
      total_minutes: schoolDays.reduce((sum, d) => sum + (d.minutes || 0), 0),
    }
  }
}
