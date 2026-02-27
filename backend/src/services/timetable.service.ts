import { supabase } from '../config/supabase'
import {
  TimetableEntry,
  CreateTimetableEntryDTO,
  UpdateTimetableEntryDTO,
  TimetableConflict,
  TeacherSchedule,
  DayOfWeek,
  ApiResponse
} from '../types'

// ============================================================================
// HELPER: Get main school ID (handles campus hierarchy)
// ============================================================================

const getMainSchoolId = async (schoolId: string): Promise<string> => {
  const { data: school } = await supabase
    .from('schools')
    .select('id, parent_school_id')
    .eq('id', schoolId)
    .single()
  
  // If this school has a parent, return the parent (main school)
  // Otherwise, this is already the main school
  return school?.parent_school_id || schoolId
}

// ============================================================================
// STEP 2: TIMETABLE CONSTRUCTION (Section ↔ Period ↔ Subject with Schedule)
// ============================================================================

export const getTimetableBySection = async (
  sectionId: string,
  academicYearId: string
): Promise<ApiResponse<TimetableEntry[]>> => {
  try {
    const { data, error } = await supabase
      .from('timetable_entries')
      .select(`
        *,
        section:sections(id, name, grade_level:grade_levels(name)),
        subject:subjects(id, name, code),
        teacher:staff!teacher_id(id, profile:profiles!staff_profile_id_fkey(first_name, last_name)),
        period:periods(id, period_number, period_name, start_time, end_time, is_break, sort_order)
      `)
      .eq('section_id', sectionId)
      .eq('academic_year_id', academicYearId)
      .eq('is_active', true)
      .order('day_of_week', { ascending: true })

    if (error) throw error

    // Transform data to flatten joined fields
    const timetable = data.map((item: any) => ({
      ...item,
      section_name: item.section?.name,
      grade_name: item.section?.grade_level?.name,
      subject_name: item.subject?.name,
      teacher_name: item.teacher?.profile
        ? `${item.teacher.profile.first_name} ${item.teacher.profile.last_name}`.trim()
        : 'Unassigned',
      period_number: item.period?.period_number,
      period_sort_order: item.period?.sort_order,
      start_time: item.period?.start_time,
      end_time: item.period?.end_time
    }))

    // Sort by day_of_week then period sort_order
    timetable.sort((a: any, b: any) => {
      if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week
      return (a.period_sort_order || 0) - (b.period_sort_order || 0)
    })

    return {
      success: true,
      data: timetable as TimetableEntry[]
    }
  } catch (error: any) {
    console.error('Error fetching timetable by section:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const getTimetableByTeacher = async (
  teacherId: string,
  academicYearId: string
): Promise<ApiResponse<TimetableEntry[]>> => {
  try {
    // Fetch timetable entries directly by teacher_id (no school_id filter needed)
    // Teacher ID is unique, so no need to filter by school
    // This supports campus structure where teacher belongs to campus but entries are at main school
    const { data, error } = await supabase
      .from('timetable_entries')
      .select(`
        *,
        section:sections(id, name, grade_level:grade_levels(name)),
        subject:subjects(id, name, code),
        teacher:staff!teacher_id(id, profile:profiles!staff_profile_id_fkey(first_name, last_name)),
        period:periods(id, period_number, period_name, start_time, end_time, is_break, sort_order)
      `)
      .eq('teacher_id', teacherId)
      .eq('academic_year_id', academicYearId)
      .eq('is_active', true)
      .order('day_of_week', { ascending: true })

    if (error) throw error

    const timetable = data.map((item: any) => ({
      ...item,
      section_name: item.section?.name,
      grade_name: item.section?.grade_level?.name,
      subject_name: item.subject?.name,
      teacher_name: item.teacher?.profile
        ? `${item.teacher.profile.first_name} ${item.teacher.profile.last_name}`.trim()
        : 'Unassigned',
      period_number: item.period?.period_number,
      period_sort_order: item.period?.sort_order,
      start_time: item.period?.start_time,
      end_time: item.period?.end_time
    }))

    // Sort by day_of_week then period sort_order
    timetable.sort((a: any, b: any) => {
      if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week
      return (a.period_sort_order || 0) - (b.period_sort_order || 0)
    })

    return {
      success: true,
      data: timetable as TimetableEntry[]
    }
  } catch (error: any) {
    console.error('Error fetching timetable by teacher:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const getAvailableSubjectsForSection = async (
  sectionId: string,
  academicYearId: string
): Promise<ApiResponse<any[]>> => {
  try {
    // Get all subjects assigned to teachers for this section
    const { data, error } = await supabase
      .from('teacher_subject_assignments')
      .select(`
        subject:subjects(id, name, code),
        teacher:staff!teacher_id(id, profile:profiles!staff_profile_id_fkey(first_name, last_name))
      `)
      .eq('section_id', sectionId)
      .eq('academic_year_id', academicYearId)

    if (error) throw error

    // Transform to unique subjects with their assigned teachers
    const subjects = data.map((item: any) => ({
      subject_id: item.subject.id,
      subject_name: item.subject.name,
      subject_code: item.subject.code,
      teacher_id: item.teacher.id,
      teacher_name: `${item.teacher.profile.first_name} ${item.teacher.profile.last_name}`.trim()
    }))

    return {
      success: true,
      data: subjects
    }
  } catch (error: any) {
    console.error('Error fetching available subjects:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const checkTeacherConflict = async (
  teacherId: string,
  dayOfWeek: DayOfWeek,
  periodId: string,
  academicYearId: string,
  excludeEntryId?: string
): Promise<ApiResponse<TimetableConflict>> => {
  try {
    const { data, error } = await supabase.rpc('check_teacher_conflict', {
      p_teacher_id: teacherId,
      p_day_of_week: dayOfWeek,
      p_period_id: periodId,
      p_academic_year_id: academicYearId,
      p_exclude_entry_id: excludeEntryId || null
    })

    if (error) throw error

    const result = data[0] as TimetableConflict

    return {
      success: true,
      data: result
    }
  } catch (error: any) {
    console.error('Error checking teacher conflict:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const createTimetableEntry = async (
  dto: CreateTimetableEntryDTO
): Promise<ApiResponse<TimetableEntry>> => {
  try {
    // Get the section's school_id to determine campus
    const { data: sectionData, error: sectionError } = await supabase
      .from('sections')
      .select('school_id')
      .eq('id', dto.section_id)
      .single()

    if (sectionError) throw sectionError
    
    // campus_id = section's school (the campus where class happens)
    const campusId = sectionData?.school_id || dto.campus_id

    // Get main school_id (parent school if campus, otherwise use campus as school)
    let mainSchoolId = dto.school_id
    if (campusId) {
      const { data: schoolData } = await supabase
        .from('schools')
        .select('id, parent_school_id')
        .eq('id', campusId)
        .single()
      
      // If this is a campus (has parent), use parent as main school
      // Otherwise, use the campus itself as the main school
      mainSchoolId = schoolData?.parent_school_id || campusId
    }

    // Check for teacher conflict
    const conflictCheck = await checkTeacherConflict(
      dto.teacher_id,
      dto.day_of_week,
      dto.period_id,
      dto.academic_year_id
    )

    if (!conflictCheck.success) {
      return conflictCheck as any
    }

    if (conflictCheck.data?.has_conflict) {
      return {
        success: false,
        error: `Teacher conflict: ${conflictCheck.data.conflict_details}`,
        data: undefined
      } as any
    }

    const { data, error } = await supabase
      .from('timetable_entries')
      .insert({
        school_id: mainSchoolId,
        campus_id: campusId,
        academic_year_id: dto.academic_year_id,
        section_id: dto.section_id,
        subject_id: dto.subject_id,
        teacher_id: dto.teacher_id,
        period_id: dto.period_id,
        day_of_week: dto.day_of_week,
        room_number: dto.room_number,
        created_by: dto.created_by
      })
      .select(`
        *,
        section:sections(name, grade_level:grade_levels(name)),
        subject:subjects(name),
        teacher:staff!teacher_id(profile:profiles!staff_profile_id_fkey(first_name, last_name)),
        period:periods(period_number, start_time, end_time)
      `)
      .single()

    if (error) throw error

    return {
      success: true,
      data: data as TimetableEntry,
      message: 'Timetable entry created successfully'
    }
  } catch (error: any) {
    console.error('Error creating timetable entry:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const updateTimetableEntry = async (
  entryId: string,
  dto: UpdateTimetableEntryDTO
): Promise<ApiResponse<TimetableEntry>> => {
  try {
    // If updating teacher, day, or period, check for conflicts
    if (dto.teacher_id || dto.day_of_week !== undefined || dto.period_id) {
      const { data: existing } = await supabase
        .from('timetable_entries')
        .select('teacher_id, day_of_week, period_id, academic_year_id')
        .eq('id', entryId)
        .single()

      if (existing) {
        const teacherId = dto.teacher_id || existing.teacher_id
        const dayOfWeek = dto.day_of_week !== undefined ? dto.day_of_week : existing.day_of_week
        const periodId = dto.period_id || existing.period_id

        const conflictCheck = await checkTeacherConflict(
          teacherId,
          dayOfWeek as DayOfWeek,
          periodId,
          existing.academic_year_id,
          entryId
        )

        if (conflictCheck.data?.has_conflict) {
          return {
            success: false,
            error: `Teacher conflict: ${conflictCheck.data.conflict_details}`
          }
        }
      }
    }

    const { data, error } = await supabase
      .from('timetable_entries')
      .update(dto)
      .eq('id', entryId)
      .select(`
        *,
        section:sections(name, grade_level:grade_levels(name)),
        subject:subjects(name),
        teacher:staff!teacher_id(profile:profiles!staff_profile_id_fkey(first_name, last_name)),
        period:periods(period_number, start_time, end_time)
      `)
      .single()

    if (error) throw error

    return {
      success: true,
      data: data as TimetableEntry,
      message: 'Timetable entry updated successfully'
    }
  } catch (error: any) {
    console.error('Error updating timetable entry:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const deleteTimetableEntry = async (entryId: string): Promise<ApiResponse<void>> => {
  try {
    // Use hard delete instead of soft delete to avoid unique constraint conflicts
    // The unique constraint (unique_teacher_period_campus) doesn't account for is_active,
    // so soft-deleted records would block new assignments for the same teacher/period/day
    const { error } = await supabase
      .from('timetable_entries')
      .delete()
      .eq('id', entryId)

    if (error) throw error

    return {
      success: true,
      message: 'Timetable entry deleted successfully'
    }
  } catch (error: any) {
    console.error('Error deleting timetable entry:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// ============================================================================
// BULK TIMETABLE IMPORT
// ============================================================================

type DayName = 'monday'|'tuesday'|'wednesday'|'thursday'|'friday'|'saturday'|'sunday'
const DAY_MAP: Record<string, DayOfWeek> = {
  monday: 0, mon: 0, '0': 0,
  tuesday: 1, tue: 1, '1': 1,
  wednesday: 2, wed: 2, '2': 2,
  thursday: 3, thu: 3, '3': 3,
  friday: 4, fri: 4, '4': 4,
  saturday: 5, sat: 5, '5': 5,
  sunday: 6, sun: 6, '6': 6
}

function parseDayOfWeek(value: string | number): DayOfWeek | null {
  if (typeof value === 'number') return (value >= 0 && value <= 6) ? value as DayOfWeek : null
  const key = value.toString().toLowerCase().trim()
  return key in DAY_MAP ? DAY_MAP[key] : null
}

export interface BulkTimetableRow {
  grade_name?: string
  section_name: string
  subject_name?: string
  subject_code?: string
  teacher_email?: string
  teacher_name?: string
  day_of_week: string | number
  period_number: string | number
  room_number?: string
}

export interface BulkTimetableResult {
  success_count: number
  error_count: number
  errors: Array<{ row: number; error: string }>
  created_entries: any[]
}

/**
 * Bulk import timetable entries.
 * Strategy:
 *   1. Fetch all lookup data (sections, subjects, staff, periods) once
 *   2. Load existing entries to build in-memory conflict index
 *   3. Validate each row and check conflicts (teacher + section)
 *   4. Insert all valid rows in one Supabase call
 */
export const bulkImportTimetable = async (
  rows: BulkTimetableRow[],
  schoolId: string,
  academicYearId: string,
  userId: string
): Promise<ApiResponse<BulkTimetableResult>> => {
  try {
    if (!rows.length) {
      return { success: false, error: 'No rows provided' }
    }
    if (rows.length > 500) {
      return { success: false, error: 'Maximum 500 entries per import' }
    }

    // Determine main school ID (handle campus hierarchy)
    const mainSchoolId = await getMainSchoolId(schoolId)

    // ── Fetch all lookup data at once ────────────────────────────────────────
    const [
      { data: sections },
      { data: subjects },
      { data: staffData },
      { data: periodsData },
      { data: existingEntries }
    ] = await Promise.all([
      supabase
        .from('sections')
        .select('id, name, school_id, grade_level:grade_levels(id, name)')
        .or(`school_id.eq.${mainSchoolId},school_id.eq.${schoolId}`),
      supabase
        .from('subjects')
        .select('id, name, code')
        .or(`school_id.eq.${mainSchoolId},school_id.eq.${schoolId}`),
      supabase
        .from('staff')
        .select('id, profile:profiles!staff_profile_id_fkey(id, first_name, last_name, email)')
        .or(`school_id.eq.${mainSchoolId},school_id.eq.${schoolId}`),
      supabase
        .from('periods')
        .select('id, period_number, period_name')
        .or(`school_id.eq.${mainSchoolId},school_id.eq.${schoolId}`)
        .eq('is_break', false),
      supabase
        .from('timetable_entries')
        .select('teacher_id, section_id, period_id, day_of_week')
        .eq('school_id', mainSchoolId)
        .eq('academic_year_id', academicYearId)
        .eq('is_active', true)
    ])

    // Build lookup maps
    const sectionMap = new Map<string, { id: string; school_id: string }>()
    sections?.forEach((s: any) => {
      const gradeName = Array.isArray(s.grade_level) ? s.grade_level[0]?.name : s.grade_level?.name
      sectionMap.set(s.name.toLowerCase(), { id: s.id, school_id: s.school_id })
      if (gradeName) {
        sectionMap.set(`${s.name.toLowerCase()}|${gradeName.toLowerCase()}`, { id: s.id, school_id: s.school_id })
      }
    })

    const subjectMap = new Map<string, string>() // name/code lower → id
    subjects?.forEach((s: any) => {
      subjectMap.set(s.name.toLowerCase(), s.id)
      if (s.code) subjectMap.set(s.code.toLowerCase(), s.id)
    })

    const staffByEmail = new Map<string, string>()   // email lower → staff id
    const staffByName = new Map<string, string>()    // "first last" lower → staff id
    staffData?.forEach((s: any) => {
      const profile = Array.isArray(s.profile) ? s.profile[0] : s.profile
      if (profile?.email) staffByEmail.set(profile.email.toLowerCase(), s.id)
      if (profile?.first_name && profile?.last_name) {
        staffByName.set(`${profile.first_name} ${profile.last_name}`.toLowerCase(), s.id)
      }
    })

    const periodMap = new Map<number, string>() // period_number → period id
    periodsData?.forEach((p: any) => periodMap.set(Number(p.period_number), p.id))

    // Build in-memory conflict index from existing entries
    const teacherOccupied = new Set<string>() // "teacher_id|day|period_id"
    const sectionOccupied = new Set<string>() // "section_id|day|period_id"
    existingEntries?.forEach((e: any) => {
      teacherOccupied.add(`${e.teacher_id}|${e.day_of_week}|${e.period_id}`)
      sectionOccupied.add(`${e.section_id}|${e.day_of_week}|${e.period_id}`)
    })

    // ── Validate rows ────────────────────────────────────────────────────────
    const result: BulkTimetableResult = {
      success_count: 0,
      error_count: 0,
      errors: [],
      created_entries: []
    }

    const toInsert: any[] = []

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2
      const raw = rows[i]
      const rowErrors: string[] = []

      // Required field checks
      if (!raw.section_name?.toString().trim()) rowErrors.push('section_name is required')
      if (!raw.subject_name?.toString().trim() && !raw.subject_code?.toString().trim()) rowErrors.push('subject_name or subject_code is required')
      if (!raw.teacher_email?.toString().trim() && !raw.teacher_name?.toString().trim()) rowErrors.push('teacher_email or teacher_name is required')
      if (raw.day_of_week === undefined || raw.day_of_week === null || raw.day_of_week === '') rowErrors.push('day_of_week is required')
      if (!raw.period_number?.toString().trim()) rowErrors.push('period_number is required')

      if (rowErrors.length > 0) {
        result.errors.push({ row: rowNum, error: rowErrors.join('; ') })
        result.error_count++
        continue
      }

      // Resolve section
      const sectionKey = raw.grade_name
        ? `${raw.section_name.toLowerCase()}|${raw.grade_name.toLowerCase()}`
        : raw.section_name.toLowerCase()
      const sectionInfo = sectionMap.get(sectionKey) || sectionMap.get(raw.section_name.toLowerCase())
      if (!sectionInfo) {
        result.errors.push({ row: rowNum, error: `Section not found: "${raw.section_name}"${raw.grade_name ? ` (grade: "${raw.grade_name}")` : ''}` })
        result.error_count++
        continue
      }

      // Resolve subject
      const subjectKey = (raw.subject_name || raw.subject_code || '').toLowerCase().trim()
      const subjectId = subjectMap.get(subjectKey)
      if (!subjectId) {
        result.errors.push({ row: rowNum, error: `Subject not found: "${raw.subject_name || raw.subject_code}"` })
        result.error_count++
        continue
      }

      // Resolve teacher
      const teacherEmail = raw.teacher_email?.toString().trim().toLowerCase()
      const teacherName = raw.teacher_name?.toString().trim().toLowerCase()
      const teacherId = (teacherEmail ? staffByEmail.get(teacherEmail) : undefined) ||
                        (teacherName ? staffByName.get(teacherName) : undefined)
      if (!teacherId) {
        result.errors.push({ row: rowNum, error: `Teacher not found: "${raw.teacher_email || raw.teacher_name}"` })
        result.error_count++
        continue
      }

      // Resolve period
      const periodNumber = Number(raw.period_number)
      if (isNaN(periodNumber)) {
        result.errors.push({ row: rowNum, error: `Invalid period_number: "${raw.period_number}"` })
        result.error_count++
        continue
      }
      const periodId = periodMap.get(periodNumber)
      if (!periodId) {
        result.errors.push({ row: rowNum, error: `Period not found: period_number ${periodNumber}` })
        result.error_count++
        continue
      }

      // Resolve day of week
      const dayOfWeek = parseDayOfWeek(raw.day_of_week)
      if (dayOfWeek === null) {
        result.errors.push({ row: rowNum, error: `Invalid day_of_week: "${raw.day_of_week}". Use 0-6 or Monday-Sunday` })
        result.error_count++
        continue
      }

      // Conflict checks (teacher)
      const teacherKey = `${teacherId}|${dayOfWeek}|${periodId}`
      if (teacherOccupied.has(teacherKey)) {
        result.errors.push({ row: rowNum, error: `Teacher "${raw.teacher_email || raw.teacher_name}" already has a class on ${raw.day_of_week} period ${periodNumber}` })
        result.error_count++
        continue
      }

      // Conflict checks (section)
      const sectionConflictKey = `${sectionInfo.id}|${dayOfWeek}|${periodId}`
      if (sectionOccupied.has(sectionConflictKey)) {
        result.errors.push({ row: rowNum, error: `Section "${raw.section_name}" already has a class on ${raw.day_of_week} period ${periodNumber}` })
        result.error_count++
        continue
      }

      // Mark occupied for subsequent rows in this batch
      teacherOccupied.add(teacherKey)
      sectionOccupied.add(sectionConflictKey)

      toInsert.push({
        school_id: mainSchoolId,
        campus_id: sectionInfo.school_id,
        academic_year_id: academicYearId,
        section_id: sectionInfo.id,
        subject_id: subjectId,
        teacher_id: teacherId,
        period_id: periodId,
        day_of_week: dayOfWeek,
        room_number: raw.room_number?.toString().trim() || null,
        created_by: userId,
        is_active: true
      })
    }

    // ── Batch insert all valid entries ───────────────────────────────────────
    if (toInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('timetable_entries')
        .insert(toInsert)
        .select('*')

      if (insertError) {
        return {
          success: false,
          error: `Database insert failed: ${insertError.message}`
        }
      }

      result.success_count = inserted?.length || toInsert.length
      result.created_entries = inserted || []
    }

    return {
      success: true,
      data: result,
      message: `Imported ${result.success_count} timetable entry/entries with ${result.error_count} error(s)`
    }
  } catch (error: any) {
    console.error('Error bulk importing timetable:', error)
    return { success: false, error: error.message }
  }
}

// ============================================================================
// STEP 4: TEACHER'S CURRENT SCHEDULE VIEW
// ============================================================================

export const getTeacherScheduleForDate = async (
  teacherId: string,
  date: string = new Date().toISOString().split('T')[0]
): Promise<ApiResponse<TeacherSchedule[]>> => {
  try {
    const { data, error } = await supabase.rpc('get_teacher_schedule', {
      p_teacher_id: teacherId,
      p_date: date
    })

    if (error) throw error

    return {
      success: true,
      data: data as TeacherSchedule[]
    }
  } catch (error: any) {
    console.error('Error fetching teacher schedule:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const getCurrentClassForTeacher = async (
  teacherId: string
): Promise<ApiResponse<TimetableEntry | null>> => {
  try {
    const now = new Date()
    const dayOfWeek = (now.getDay() + 6) % 7 // Convert Sunday=0 to Monday=0
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5)

    const { data: academicYear } = await supabase
      .from('academic_years')
      .select('id')
      .eq('is_current', true)
      .single()

    if (!academicYear) {
      return {
        success: true,
        data: null,
        message: 'No current academic year found'
      }
    }

    const { data, error } = await supabase
      .from('timetable_entries')
      .select(`
        *,
        section:sections(id, name, grade_level:grade_levels(name)),
        subject:subjects(id, name),
        period:periods(id, period_number, start_time, end_time)
      `)
      .eq('teacher_id', teacherId)
      .eq('academic_year_id', academicYear.id)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .lte('period.start_time', currentTime)
      .gte('period.end_time', currentTime)
      .maybeSingle()

    if (error) throw error

    if (data) {
      const entry: any = {
        ...data,
        section_name: data.section?.name,
        grade_name: data.section?.grade_level?.name,
        subject_name: data.subject?.name,
        period_number: data.period?.period_number,
        start_time: data.period?.start_time,
        end_time: data.period?.end_time
      }

      return {
        success: true,
        data: entry as TimetableEntry
      }
    }

    return {
      success: true,
      data: null,
      message: 'No class scheduled at this time'
    }
  } catch (error: any) {
    console.error('Error fetching current class:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const getNextClassForTeacher = async (
  teacherId: string
): Promise<ApiResponse<TimetableEntry | null>> => {
  try {
    const now = new Date()
    const dayOfWeek = (now.getDay() + 6) % 7
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5)

    const { data: academicYear } = await supabase
      .from('academic_years')
      .select('id')
      .eq('is_current', true)
      .single()

    if (!academicYear) {
      return {
        success: true,
        data: null
      }
    }

    const { data: allEntries, error } = await supabase
      .from('timetable_entries')
      .select(`
        *,
        section:sections(id, name, grade_level:grade_levels(name)),
        subject:subjects(id, name),
        period:periods(id, period_number, start_time, end_time)
      `)
      .eq('teacher_id', teacherId)
      .eq('academic_year_id', academicYear.id)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)

    if (error) throw error

    // Filter by time and sort in-memory
    const futureEntries = (allEntries || []).filter((entry: any) => 
      entry.period?.start_time && entry.period.start_time > currentTime
    )
    
    futureEntries.sort((a: any, b: any) => {
      const timeA = a.period?.start_time || ''
      const timeB = b.period?.start_time || ''
      return timeA.localeCompare(timeB)
    })

    const data = futureEntries[0] || null

    if (error) throw error

    if (data) {
      const entry: any = {
        ...data,
        section_name: data.section?.name,
        grade_name: data.section?.grade_level?.name,
        subject_name: data.subject?.name,
        period_number: data.period?.period_number,
        start_time: data.period?.start_time,
        end_time: data.period?.end_time
      }

      return {
        success: true,
        data: entry as TimetableEntry
      }
    }

    return {
      success: true,
      data: null
    }
  } catch (error: any) {
    console.error('Error fetching next class:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
