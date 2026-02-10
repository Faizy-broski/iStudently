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
        period:periods(id, period_number, period_name, start_time, end_time, is_break)
      `)
      .eq('section_id', sectionId)
      .eq('academic_year_id', academicYearId)
      .eq('is_active', true)
      .order('day_of_week', { ascending: true })
      .order('period_id', { ascending: true })

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
      start_time: item.period?.start_time,
      end_time: item.period?.end_time
    }))

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
        period:periods(id, period_number, period_name, start_time, end_time, is_break)
      `)
      .eq('teacher_id', teacherId)
      .eq('academic_year_id', academicYearId)
      .eq('is_active', true)
      .order('day_of_week', { ascending: true })
      .order('period_id', { ascending: true })

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
      start_time: item.period?.start_time,
      end_time: item.period?.end_time
    }))

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
