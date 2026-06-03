import { supabase } from '../config/supabase'
import {
  AttendanceCalendarDay,
  GenerateCalendarDTO,
  UpdateCalendarDayDTO,
  ApiResponse
} from '../types'

// ============================================================================
// ATTENDANCE CALENDAR SERVICE
// Manages school calendar (which days are school days, full-day minutes)
// Administration menu item in RosarioSIS
// ============================================================================

/**
 * Get calendar for a date range
 */
export const getCalendar = async (
  schoolId: string,
  startDate: string,
  endDate: string,
  campusId?: string
): Promise<ApiResponse<AttendanceCalendarDay[]>> => {
  try {
    let query = supabase
      .from('attendance_calendar')
      .select('*')
      .eq('school_id', schoolId)
      .gte('school_date', startDate)
      .lte('school_date', endDate)
      .order('school_date', { ascending: true })

    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    const { data, error } = await query

    if (error) throw error

    return { success: true, data: data || [], error: null }
  } catch (error: any) {
    console.error('Error fetching attendance calendar:', error)
    return { success: false, data: null, error: error.message }
  }
}

/**
 * Generate calendar from academic year dates
 * Uses the generate_attendance_calendar DB function
 */
export const generateCalendar = async (
  dto: GenerateCalendarDTO
): Promise<ApiResponse<{ days_created: number }>> => {
  try {
    const { data, error } = await supabase.rpc('generate_attendance_calendar', {
      p_school_id: dto.school_id,
      p_academic_year_id: dto.academic_year_id,
      p_campus_id: dto.campus_id || null
    })

    if (error) throw error

    return { success: true, data: { days_created: data || 0 }, error: null }
  } catch (error: any) {
    console.error('Error generating attendance calendar:', error)
    return { success: false, data: null, error: error.message }
  }
}

/**
 * Update a single calendar day (toggle school day, change minutes, etc.)
 */
export const updateCalendarDay = async (
  dayId: string,
  dto: UpdateCalendarDayDTO
): Promise<ApiResponse<AttendanceCalendarDay>> => {
  try {
    const { data, error } = await supabase
      .from('attendance_calendar')
      .update(dto)
      .eq('id', dayId)
      .select()
      .single()

    if (error) throw error

    return { success: true, data, error: null }
  } catch (error: any) {
    console.error('Error updating calendar day:', error)
    return { success: false, data: null, error: error.message }
  }
}

/**
 * Bulk update calendar days (e.g., mark a week as holiday)
 */
export const bulkUpdateCalendarDays = async (
  dayIds: string[],
  dto: UpdateCalendarDayDTO
): Promise<ApiResponse<{ updated: number }>> => {
  try {
    const { data, error } = await supabase
      .from('attendance_calendar')
      .update(dto)
      .in('id', dayIds)
      .select()

    if (error) throw error

    return { success: true, data: { updated: data?.length || 0 }, error: null }
  } catch (error: any) {
    console.error('Error bulk updating calendar days:', error)
    return { success: false, data: null, error: error.message }
  }
}

/**
 * Get school day count for a date range (for ADA calculations)
 */
export const getSchoolDayCount = async (
  schoolId: string,
  startDate: string,
  endDate: string,
  campusId?: string
): Promise<ApiResponse<{ count: number; total_minutes: number }>> => {
  try {
    let query = supabase
      .from('attendance_calendar')
      .select('minutes')
      .eq('school_id', schoolId)
      .eq('is_school_day', true)
      .gte('school_date', startDate)
      .lte('school_date', endDate)

    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    const { data, error } = await query

    if (error) throw error

    const count = data?.length || 0
    const total_minutes = data?.reduce((sum, d) => sum + (d.minutes || 0), 0) || 0

    return { success: true, data: { count, total_minutes }, error: null }
  } catch (error: any) {
    console.error('Error getting school day count:', error)
    return { success: false, data: null, error: error.message }
  }
}
