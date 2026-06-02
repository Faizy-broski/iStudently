import { supabase } from '../config/supabase'

// ============================================================================
// Types
// ============================================================================

export interface ScheduleViewEntry {
  id: string
  day_of_week: number        // 0=Mon … 6=Sun
  section_id: string
  section_name: string
  grade_name: string
  subject_name: string
  subject_code: string
  teacher_name: string
  period_number: number
  period_name: string | null
  start_time: string
  end_time: string
  room_number: string | null
  sort_order: number
}

export interface CalendarDaySchedule {
  id: string
  date: string               // YYYY-MM-DD
  is_school_day: boolean
  minutes: number
  block: string | null
  notes: string | null
  entries: ScheduleViewEntry[] // timetable entries for this day's day_of_week
}

export interface ScheduleViewResponse {
  calendar_days: Record<string, CalendarDaySchedule> // keyed by "YYYY-MM-DD"
  schedule_by_dow: Record<number, ScheduleViewEntry[]> // keyed by day_of_week
}

// ============================================================================
// Helper: JS Date.getDay() (0=Sun) → our dow (0=Mon)
// ============================================================================
const jsDowToOurDow = (jsDow: number): number => (jsDow === 0 ? 6 : jsDow - 1)

// ============================================================================
// Service
// ============================================================================

export async function getCalendarScheduleView(params: {
  calendarId: string
  academicYearId: string
  month: string         // "YYYY-MM"
  schoolId: string
  campusId?: string | null
  profileId?: string    // logged-in user's profile id
  userRole?: string     // 'admin' | 'teacher' | 'student' | 'parent'
  sectionId?: string    // explicit section filter (for student role)
}): Promise<ScheduleViewResponse> {
  const { calendarId, academicYearId, month, schoolId, campusId, profileId, userRole, sectionId } = params

  // Validate month format
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('Invalid month format. Use YYYY-MM')
  }

  // ── 1. Plugin check ────────────────────────────────────────────────────────
  // Try campus-specific settings first, fall back to school-wide
  let pluginActive = false

  if (campusId) {
    const { data: campusSettings } = await supabase
      .from('school_settings')
      .select('active_plugins')
      .eq('school_id', schoolId)
      .eq('campus_id', campusId)
      .maybeSingle()
    pluginActive = !!campusSettings?.active_plugins?.calendar_schedule_view
  }

  if (!pluginActive) {
    const { data: schoolSettings } = await supabase
      .from('school_settings')
      .select('active_plugins')
      .eq('school_id', schoolId)
      .is('campus_id', null)
      .maybeSingle()
    pluginActive = !!schoolSettings?.active_plugins?.calendar_schedule_view
  }

  if (!pluginActive) {
    throw new Error('PLUGIN_INACTIVE')
  }

  // ── 2. Calendar days for the month (one query) ─────────────────────────────
  const [yearStr, monthStr] = month.split('-')
  const year = parseInt(yearStr, 10)
  const monthNum = parseInt(monthStr, 10)
  const startDate = `${month}-01`
  const lastDay = new Date(year, monthNum, 0).getDate()
  const endDate = `${month}-${String(lastDay).padStart(2, '0')}`

  const { data: calendarDays, error: calDaysError } = await supabase
    .from('attendance_calendar')
    .select('id, school_date, is_school_day, minutes, block, notes')
    .eq('calendar_id', calendarId)
    .gte('school_date', startDate)
    .lte('school_date', endDate)
    .order('school_date')

  if (calDaysError) throw calDaysError

  // ── 3. Resolve teacher staff_id if needed ─────────────────────────────────
  let teacherStaffId: string | null = null
  if (userRole === 'teacher' && profileId) {
    const { data: staffRow } = await supabase
      .from('staff')
      .select('id')
      .eq('profile_id', profileId)
      .eq('school_id', schoolId)
      .maybeSingle()
    teacherStaffId = staffRow?.id || null
  }

  // ── 4. Timetable entries – single optimized query ─────────────────────────
  // Fetches ALL entries for the academic year grouped by day_of_week.
  // Role-based filtering applied here so each role only sees what's relevant.
  let timetableQuery = supabase
    .from('timetable_entries')
    .select(`
      id, day_of_week, room_number, section_id,
      section:sections(id, name, grade_level:grade_levels(name)),
      subject:subjects(id, name, code),
      teacher:staff!teacher_id(id, profile:profiles!staff_profile_id_fkey(first_name, last_name)),
      period:periods(id, period_number, period_name, start_time, end_time, sort_order)
    `)
    .eq('academic_year_id', academicYearId)
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('day_of_week', { ascending: true })

  // Campus filter
  if (campusId) {
    timetableQuery = timetableQuery.eq('campus_id', campusId)
  }

  // Teacher sees only their own classes
  if (userRole === 'teacher' && teacherStaffId) {
    timetableQuery = timetableQuery.eq('teacher_id', teacherStaffId)
  }

  // Student/parent see only their section
  if ((userRole === 'student' || userRole === 'parent') && sectionId) {
    timetableQuery = timetableQuery.eq('section_id', sectionId)
  }

  const { data: timetableEntries, error: ttError } = await timetableQuery
  if (ttError) throw ttError

  // ── 5. Group entries by day_of_week in memory (O(n)) ──────────────────────
  const scheduleDow: Record<number, ScheduleViewEntry[]> = {}

  for (const entry of (timetableEntries || [])) {
    const dow: number = entry.day_of_week
    if (!scheduleDow[dow]) scheduleDow[dow] = []

    const teacherProfile = (entry as any).teacher?.profile
    scheduleDow[dow].push({
      id: entry.id,
      day_of_week: dow,
      section_id: entry.section_id,
      section_name: (entry as any).section?.name || '',
      grade_name: (entry as any).section?.grade_level?.name || '',
      subject_name: (entry as any).subject?.name || '',
      subject_code: (entry as any).subject?.code || '',
      teacher_name: teacherProfile
        ? `${teacherProfile.first_name || ''} ${teacherProfile.last_name || ''}`.trim()
        : 'Unassigned',
      period_number: (entry as any).period?.period_number || 0,
      period_name: (entry as any).period?.period_name || null,
      start_time: (entry as any).period?.start_time || '',
      end_time: (entry as any).period?.end_time || '',
      room_number: entry.room_number || null,
      sort_order: (entry as any).period?.sort_order ?? 0,
    })
  }

  // Sort each bucket by period sort_order
  for (const dow of Object.keys(scheduleDow)) {
    scheduleDow[Number(dow)].sort((a, b) => a.sort_order - b.sort_order)
  }

  // ── 6. Build date-keyed map: each date → its day_of_week entries ───────────
  const calendarDaysMap: Record<string, CalendarDaySchedule> = {}

  for (const day of (calendarDays || [])) {
    const date = new Date(`${day.school_date}T00:00:00`)
    const ourDow = jsDowToOurDow(date.getDay())

    calendarDaysMap[day.school_date] = {
      id: day.id,
      date: day.school_date,
      is_school_day: day.is_school_day,
      minutes: day.minutes || 0,
      block: day.block || null,
      notes: day.notes || null,
      entries: day.is_school_day ? (scheduleDow[ourDow] || []) : [],
    }
  }

  return {
    calendar_days: calendarDaysMap,
    schedule_by_dow: scheduleDow,
  }
}
