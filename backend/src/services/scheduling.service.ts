import { supabase } from '../config/supabase'
import type {
  StudentSchedule,
  EnrollStudentDTO,
  DropStudentDTO,
  MassEnrollDTO,
  MassDropDTO,
  ScheduleConflict,
  ClassListResponse,
  ClassListEntry,
  AddDropRecord,
  UpdateCoursePeriodSchedulingDTO,
  TeacherAvailabilityEntry,
  SetTeacherAvailabilityDTO,
} from '../types/scheduling.types'
import type { ApiResponse } from '../types'

// ============================================================================
// SCHEDULING SERVICE
// Individual student enrollment in course_periods + teacher availability
// ============================================================================

const getMainSchoolId = async (schoolId: string): Promise<string> => {
  const { data: school } = await supabase
    .from('schools')
    .select('id, parent_school_id')
    .eq('id', schoolId)
    .single()
  return school?.parent_school_id || schoolId
}

// ──────────────────────────────────────────────────────────────────────────
// INDIVIDUAL ENROLLMENT
// ──────────────────────────────────────────────────────────────────────────

/**
 * Enroll a student in a specific course_period.
 * Checks for conflicts and seat availability.
 */
export const enrollStudent = async (
  schoolId: string,
  dto: EnrollStudentDTO,
  enrolledBy?: string
): Promise<ApiResponse<StudentSchedule>> => {
  try {
    const mainSchoolId = await getMainSchoolId(schoolId)

    // 1. Check seat availability
    const { data: cp } = await supabase
      .from('course_periods')
      .select('id, total_seats, filled_seats')
      .eq('id', dto.course_period_id)
      .single()

    if (!cp) {
      return { success: false, error: 'Course period not found' }
    }

    if (cp.total_seats !== null && cp.filled_seats >= cp.total_seats) {
      return { success: false, error: 'Course period is full — no seats available' }
    }

    // 2. Check for schedule conflicts using DB function
    const { data: conflicts, error: conflictErr } = await supabase
      .rpc('check_student_schedule_conflict', {
        p_student_id: dto.student_id,
        p_course_period_id: dto.course_period_id,
        p_academic_year_id: dto.academic_year_id,
        p_start_date: dto.start_date || new Date().toISOString().split('T')[0],
      })

    if (conflictErr) {
      console.error('Conflict check error:', conflictErr)
      // Don't block on conflict check failure, just warn
    } else if (conflicts && conflicts.length > 0) {
      const conflictMsg = conflicts
        .map((c: ScheduleConflict) => `${c.conflicting_course_title} (Day ${c.conflicting_day_of_week}, ${c.conflicting_period_title})`)
        .join('; ')
      return { success: false, error: `Schedule conflict: ${conflictMsg}` }
    }

    // 3. Check for duplicate enrollment
    const { data: existing } = await supabase
      .from('student_schedules')
      .select('id')
      .eq('student_id', dto.student_id)
      .eq('course_period_id', dto.course_period_id)
      .is('end_date', null)
      .limit(1)

    if (existing && existing.length > 0) {
      return { success: false, error: 'Student is already enrolled in this course period' }
    }

    // 4. Insert enrollment
    const { data, error } = await supabase
      .from('student_schedules')
      .insert({
        school_id: mainSchoolId,
        campus_id: dto.campus_id || null,
        student_id: dto.student_id,
        course_id: dto.course_id,
        course_period_id: dto.course_period_id,
        academic_year_id: dto.academic_year_id,
        marking_period_id: dto.marking_period_id || null,
        start_date: dto.start_date || new Date().toISOString().split('T')[0],
        enrolled_by: enrolledBy,
      })
      .select()
      .single()

    if (error) throw error

    // 5. Recalculate filled seats (MP-aware, like RosarioSIS calcSeats0)
    await supabase.rpc('recalc_filled_seats', {
      cp_id: dto.course_period_id,
      mp_id: dto.marking_period_id || null,
    })

    return { success: true, data: data as StudentSchedule }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Drop a student from a course_period (soft delete via end_date).
 */
export const dropStudent = async (
  dto: DropStudentDTO
): Promise<ApiResponse<StudentSchedule>> => {
  try {
    const endDate = dto.end_date || new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('student_schedules')
      .update({ end_date: endDate })
      .eq('student_id', dto.student_id)
      .eq('course_period_id', dto.course_period_id)
      .is('end_date', null)
      .select()
      .single()

    if (error) throw error

    // Recalculate filled seats (MP-aware)
    await supabase.rpc('recalc_filled_seats', {
      cp_id: dto.course_period_id,
      mp_id: null, // drop doesn't have MP context; the RPC will use the CP's own MP
    })

    return { success: true, data: data as StudentSchedule }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Mass enroll multiple students in one course_period.
 */
export const massEnroll = async (
  schoolId: string,
  dto: MassEnrollDTO,
  enrolledBy?: string
): Promise<ApiResponse<{ enrolled: number; errors: string[] }>> => {
  try {
    const mainSchoolId = await getMainSchoolId(schoolId)
    const startDate = dto.start_date || new Date().toISOString().split('T')[0]
    const errors: string[] = []
    let enrolled = 0

    for (const studentId of dto.student_ids) {
      const result = await enrollStudent(mainSchoolId, {
        student_id: studentId,
        course_id: dto.course_id,
        course_period_id: dto.course_period_id,
        academic_year_id: dto.academic_year_id,
        marking_period_id: dto.marking_period_id,
        start_date: startDate,
        campus_id: dto.campus_id,
      }, enrolledBy)

      if (result.success) {
        enrolled++
      } else {
        errors.push(`Student ${studentId}: ${result.error}`)
      }
    }

    return { success: true, data: { enrolled, errors } }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Mass drop multiple students from one course_period.
 */
export const massDrop = async (
  dto: MassDropDTO
): Promise<ApiResponse<{ dropped: number; errors: string[] }>> => {
  try {
    const endDate = dto.end_date || new Date().toISOString().split('T')[0]
    const errors: string[] = []
    let dropped = 0

    for (const studentId of dto.student_ids) {
      const result = await dropStudent({
        student_id: studentId,
        course_period_id: dto.course_period_id,
        end_date: endDate,
      })

      if (result.success) {
        dropped++
      } else {
        errors.push(`Student ${studentId}: ${result.error}`)
      }
    }

    // Recalculate once at end (MP-aware)
    await supabase.rpc('recalc_filled_seats', {
      cp_id: dto.course_period_id,
      mp_id: null,
    })

    return { success: true, data: { dropped, errors } }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// STUDENT SCHEDULE QUERIES
// ──────────────────────────────────────────────────────────────────────────

/**
 * Get a student's active schedule (all course_periods they're enrolled in).
 */
export const getStudentSchedule = async (
  studentId: string,
  academicYearId: string
): Promise<ApiResponse<StudentSchedule[]>> => {
  try {
    const { data, error } = await supabase
      .from('student_schedules')
      .select(`
        *,
        course:courses(id, title, short_name, credit_hours, subject:subjects(id, name, code)),
        course_period:course_periods(
          id, title, short_name, period_id, section_id, total_seats, filled_seats, room, days,
          teacher:staff!teacher_id(id, profile:profiles!profile_id(first_name, last_name)),
          section:sections(id, name, grade_level:grade_levels(id, name)),
          period:periods(id, period_name, period_number, start_time, end_time)
        )
      `)
      .eq('student_id', studentId)
      .eq('academic_year_id', academicYearId)
      .is('end_date', null)
      .order('created_at')

    if (error) throw error
    return { success: true, data: (data || []) as StudentSchedule[] }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Get full schedule history for a student (including drops).
 */
export const getStudentScheduleHistory = async (
  studentId: string,
  academicYearId: string
): Promise<ApiResponse<StudentSchedule[]>> => {
  try {
    const { data, error } = await supabase
      .from('student_schedules')
      .select(`
        *,
        course:courses(id, title, short_name, subject:subjects(id, name, code)),
        course_period:course_periods(
          id, title, section_id,
          teacher:staff!teacher_id(id, profile:profiles!profile_id(first_name, last_name)),
          section:sections(id, name)
        )
      `)
      .eq('student_id', studentId)
      .eq('academic_year_id', academicYearId)
      .order('start_date', { ascending: false })

    if (error) throw error
    return { success: true, data: (data || []) as StudentSchedule[] }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// CLASS LIST (students enrolled in a course_period)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Get the class list for a course period — all currently enrolled students.
 */
export const getClassList = async (
  coursePeriodId: string
): Promise<ApiResponse<ClassListResponse>> => {
  try {
    // Get course period info
    const { data: cp, error: cpErr } = await supabase
      .from('course_periods')
      .select(`
        id, title, total_seats, filled_seats,
        course:courses(id, title),
        teacher:staff!teacher_id(id, profile:profiles!profile_id(first_name, last_name))
      `)
      .eq('id', coursePeriodId)
      .single()

    if (cpErr) throw cpErr

    // Get enrolled students
    const { data: schedules, error: schedErr } = await supabase
      .from('student_schedules')
      .select(`
        id, student_id, start_date, end_date, scheduler_lock,
        student:students(
          id,
          profile:profiles!students_profile_id_fkey(first_name, last_name),
          section:sections(id, name, grade_level:grade_levels(name))
        )
      `)
      .eq('course_period_id', coursePeriodId)
      .is('end_date', null)
      .order('created_at')

    if (schedErr) throw schedErr

    const students: ClassListEntry[] = (schedules || []).map((s: any) => ({
      schedule_id: s.id,
      student_id: s.student_id,
      student_name: s.student?.profile
        ? `${s.student.profile.last_name}, ${s.student.profile.first_name}`
        : 'Unknown',
      section_name: s.student?.section?.name,
      grade_level: s.student?.section?.grade_level?.name,
      start_date: s.start_date,
      end_date: s.end_date,
      scheduler_lock: s.scheduler_lock,
    }))

    // Sort by last name
    students.sort((a, b) => a.student_name.localeCompare(b.student_name))

    const teacherName = (cp as any).teacher?.profile
      ? `${(cp as any).teacher.profile.first_name} ${(cp as any).teacher.profile.last_name}`
      : 'Unassigned'

    return {
      success: true,
      data: {
        course_period_id: coursePeriodId,
        course_title: (cp as any).course?.title || '',
        teacher_name: teacherName,
        total_seats: cp.total_seats,
        filled_seats: cp.filled_seats || 0,
        students,
      },
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// COURSE PERIOD SCHEDULING FIELDS
// ──────────────────────────────────────────────────────────────────────────

/**
 * Update scheduling-specific fields on a course_period (seats, room, days, gender).
 */
export const updateCoursePeriodScheduling = async (
  coursePeriodId: string,
  dto: UpdateCoursePeriodSchedulingDTO
): Promise<ApiResponse<any>> => {
  try {
    const { data, error } = await supabase
      .from('course_periods')
      .update({
        total_seats: dto.total_seats,
        room: dto.room,
        days: dto.days,
        gender_restriction: dto.gender_restriction,
        updated_at: new Date().toISOString(),
      })
      .eq('id', coursePeriodId)
      .select()
      .single()

    if (error) throw error
    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// ADD/DROP LOG
// ──────────────────────────────────────────────────────────────────────────

/**
 * Get add/drop history for a school within a date range.
 */
export const getAddDropLog = async (
  schoolId: string,
  academicYearId: string,
  startDate?: string,
  endDate?: string,
  campusId?: string
): Promise<ApiResponse<AddDropRecord[]>> => {
  try {
    const mainSchoolId = await getMainSchoolId(schoolId)

    let query = supabase
      .from('student_schedules')
      .select(`
        id, student_id, start_date, end_date, enrolled_by,
        student:students(id, profile:profiles!students_profile_id_fkey(first_name, last_name)),
        course:courses(id, title),
        course_period:course_periods(id, title)
      `)
      .eq('school_id', mainSchoolId)
      .eq('academic_year_id', academicYearId)
      .order('created_at', { ascending: false })
      .limit(500)

    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }
    if (startDate) {
      query = query.gte('start_date', startDate)
    }
    if (endDate) {
      query = query.lte('start_date', endDate)
    }

    const { data, error } = await query
    if (error) throw error

    const records: AddDropRecord[] = []
    for (const row of (data || [])) {
      const studentName = (row as any).student?.profile
        ? `${(row as any).student.profile.first_name} ${(row as any).student.profile.last_name}`
        : undefined

      // Add record
      records.push({
        student_id: row.student_id,
        student_name: studentName,
        course_title: (row as any).course?.title || '',
        course_period_title: (row as any).course_period?.title,
        action: 'add',
        date: row.start_date,
        enrolled_by: row.enrolled_by || undefined,
      })

      // Drop record (if dropped)
      if (row.end_date) {
        records.push({
          student_id: row.student_id,
          student_name: studentName,
          course_title: (row as any).course?.title || '',
          course_period_title: (row as any).course_period?.title,
          action: 'drop',
          date: row.end_date,
        })
      }
    }

    // Sort by date descending
    records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return { success: true, data: records }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// TEACHER AVAILABILITY
// ──────────────────────────────────────────────────────────────────────────

/**
 * Get teacher availability for a given academic year.
 */
export const getTeacherAvailability = async (
  teacherId: string,
  academicYearId: string
): Promise<ApiResponse<TeacherAvailabilityEntry[]>> => {
  try {
    const { data, error } = await supabase
      .from('teacher_availability')
      .select(`
        *,
        period:periods(id, period_name, period_number, start_time, end_time)
      `)
      .eq('teacher_id', teacherId)
      .eq('academic_year_id', academicYearId)
      .order('day_of_week')

    if (error) throw error
    return { success: true, data: (data || []) as TeacherAvailabilityEntry[] }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Set teacher availability — replaces all entries for given teacher + year.
 */
export const setTeacherAvailability = async (
  schoolId: string,
  dto: SetTeacherAvailabilityDTO,
  campusId?: string
): Promise<ApiResponse<TeacherAvailabilityEntry[]>> => {
  try {
    const mainSchoolId = await getMainSchoolId(schoolId)

    // Delete existing entries for this teacher + year
    await supabase
      .from('teacher_availability')
      .delete()
      .eq('teacher_id', dto.teacher_id)
      .eq('academic_year_id', dto.academic_year_id)

    // Insert new entries
    if (dto.entries.length > 0) {
      const rows = dto.entries.map((e) => ({
        school_id: mainSchoolId,
        campus_id: campusId || null,
        teacher_id: dto.teacher_id,
        academic_year_id: dto.academic_year_id,
        day_of_week: e.day_of_week,
        period_id: e.period_id,
        status: e.status,
        reason: e.reason || null,
      }))

      const { data, error } = await supabase
        .from('teacher_availability')
        .insert(rows)
        .select()

      if (error) throw error
      return { success: true, data: (data || []) as TeacherAvailabilityEntry[] }
    }

    return { success: true, data: [] }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Get all teachers' availability at a specific day+period (for scheduler).
 */
export const getAvailableTeachersForSlot = async (
  schoolId: string,
  academicYearId: string,
  dayOfWeek: number,
  periodId: string,
  campusId?: string
): Promise<ApiResponse<{ teacher_id: string; status: string }[]>> => {
  try {
    const mainSchoolId = await getMainSchoolId(schoolId)

    // Get teachers who are NOT unavailable at this slot
    const { data: unavailable } = await supabase
      .from('teacher_availability')
      .select('teacher_id')
      .eq('school_id', mainSchoolId)
      .eq('academic_year_id', academicYearId)
      .eq('day_of_week', dayOfWeek)
      .eq('period_id', periodId)
      .eq('status', 'unavailable')

    const unavailableIds = (unavailable || []).map((u: any) => u.teacher_id)

    // Get all active teachers
    let teacherQuery = supabase
      .from('staff')
      .select('id')
      .eq('school_id', mainSchoolId)
      .eq('is_active', true)

    if (campusId) {
      teacherQuery = teacherQuery.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    const { data: teachers, error } = await teacherQuery
    if (error) throw error

    const result = (teachers || []).map((t: any) => ({
      teacher_id: t.id,
      status: unavailableIds.includes(t.id) ? 'unavailable' : 'available',
    }))

    return { success: true, data: result }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// SCHEDULE CONFLICT CHECK (public helper)
// ──────────────────────────────────────────────────────────────────────────

export const checkConflicts = async (
  studentId: string,
  coursePeriodId: string,
  academicYearId: string
): Promise<ApiResponse<ScheduleConflict[]>> => {
  try {
    const { data, error } = await supabase
      .rpc('check_student_schedule_conflict', {
        p_student_id: studentId,
        p_course_period_id: coursePeriodId,
        p_academic_year_id: academicYearId,
      })

    if (error) throw error
    return { success: true, data: (data || []) as ScheduleConflict[] }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// SCHEDULING DASHBOARD STATS  (mirrors RosarioSIS Dashboard.inc.php)
// ──────────────────────────────────────────────────────────────────────────

export const getSchedulingDashboardStats = async (
  schoolId: string,
  academicYearId: string,
  markingPeriodId?: string
): Promise<ApiResponse<{
  total_courses: number
  total_subjects: number
  total_course_periods: number
  total_students_enrolled: number
  total_seats: number
  total_filled: number
}>> => {
  try {
    const { data, error } = await supabase.rpc('get_scheduling_dashboard_stats', {
      p_school_id: schoolId,
      p_academic_year_id: academicYearId,
      p_marking_period_id: markingPeriodId || null,
    })

    if (error) throw error

    const row = Array.isArray(data) ? data[0] : data
    return {
      success: true,
      data: {
        total_courses: Number(row?.total_courses ?? 0),
        total_subjects: Number(row?.total_subjects ?? 0),
        total_course_periods: Number(row?.total_course_periods ?? 0),
        total_students_enrolled: Number(row?.total_students_enrolled ?? 0),
        total_seats: Number(row?.total_seats ?? 0),
        total_filled: Number(row?.total_filled ?? 0),
      },
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// COURSE PERIOD SCHOOL PERIODS  (multi-period support, like RosarioSIS
//   course_period_school_periods M2M table)
// ──────────────────────────────────────────────────────────────────────────

export const getCoursePeriodSchoolPeriods = async (
  coursePeriodId: string
): Promise<ApiResponse<any[]>> => {
  try {
    const { data, error } = await supabase
      .from('course_period_school_periods')
      .select('*, periods(*)')
      .eq('course_period_id', coursePeriodId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return { success: true, data: data || [] }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export const setCoursePeriodSchoolPeriods = async (
  coursePeriodId: string,
  periodIds: string[],
  days?: string
): Promise<ApiResponse<any>> => {
  try {
    // Remove existing links
    const { error: delErr } = await supabase
      .from('course_period_school_periods')
      .delete()
      .eq('course_period_id', coursePeriodId)

    if (delErr) throw delErr

    // Insert new links
    if (periodIds.length > 0) {
      const rows = periodIds.map((pid) => ({
        course_period_id: coursePeriodId,
        period_id: pid,
        days: days || null,
      }))

      const { error: insErr } = await supabase
        .from('course_period_school_periods')
        .insert(rows)

      if (insErr) throw insErr
    }

    return { success: true, data: { updated: periodIds.length } }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
