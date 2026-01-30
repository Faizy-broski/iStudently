import { supabase } from '../config/supabase'
import {
  AttendanceRecord,
  CreateAttendanceDTO,
  UpdateAttendanceDTO,
  BulkAttendanceUpdate,
  AttendanceStats,
  AttendanceStatus,
  ApiResponse
} from '../types'

// ============================================================================
// STEP 3: AUTO-GENERATE DAILY ATTENDANCE
// ============================================================================

export const generateDailyAttendance = async (
  targetDate?: string
): Promise<ApiResponse<{ generated_count: number; timetable_entries_processed: number }>> => {
  try {
    const date = targetDate || new Date().toISOString().split('T')[0]

    const { data, error } = await supabase.rpc('generate_daily_attendance', {
      target_date: date
    })

    if (error) throw error

    const result = data[0]

    return {
      success: true,
      data: result,
      message: `Generated ${result.generated_count} attendance records for ${result.timetable_entries_processed} classes`
    }
  } catch (error: any) {
    console.error('Error generating daily attendance:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// ============================================================================
// STEP 4: TEACHER ATTENDANCE MARKING
// ============================================================================

/**
 * Generate attendance records for a single class on-demand
 * This is called when teacher opens attendance and no records exist
 */
export const generateClassAttendance = async (
  timetableEntryId: string,
  attendanceDate: string
): Promise<ApiResponse<{ generated_count: number }>> => {
  try {
    const { data, error } = await supabase.rpc('generate_class_attendance', {
      p_timetable_entry_id: timetableEntryId,
      p_date: attendanceDate
    })

    if (error) throw error

    const result = data?.[0] || { generated_count: 0 }

    return {
      success: true,
      data: result,
      message: `Generated ${result.generated_count} attendance records`
    }
  } catch (error: any) {
    console.error('Error generating class attendance:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const getAttendanceForClass = async (
  timetableEntryId: string,
  attendanceDate: string
): Promise<ApiResponse<AttendanceRecord[]>> => {
  try {
    // First, try to get existing records
    let { data, error } = await supabase
      .from('attendance_records')
      .select(`
        *,
        student:students(
          id,
          student_number,
          profile:profiles(first_name, last_name)
        )
      `)
      .eq('timetable_entry_id', timetableEntryId)
      .eq('attendance_date', attendanceDate)

    if (error) throw error

    // If no records exist, generate them on-demand
    if (!data || data.length === 0) {
      const generateResult = await generateClassAttendance(timetableEntryId, attendanceDate)
      
      if (generateResult.success && generateResult.data && generateResult.data.generated_count > 0) {
        // Fetch the newly created records
        const refetch = await supabase
          .from('attendance_records')
          .select(`
            *,
            student:students(
              id,
              student_number,
              profile:profiles(first_name, last_name)
            )
          `)
          .eq('timetable_entry_id', timetableEntryId)
          .eq('attendance_date', attendanceDate)
        
        if (!refetch.error) {
          data = refetch.data
        }
      }
    }

    // Transform and sort data
    const attendance = (data || [])
      .map((item: any) => ({
        ...item,
        student_name: item.student?.profile
          ? `${item.student.profile.first_name} ${item.student.profile.last_name}`.trim()
          : 'Unknown',
        student_number: item.student?.student_number || ''
      }))
      .sort((a: any, b: any) => (a.student_number || '').localeCompare(b.student_number || ''))

    return {
      success: true,
      data: attendance as AttendanceRecord[]
    }
  } catch (error: any) {
    console.error('Error fetching attendance for class:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const getAttendanceForSectionDate = async (
  sectionId: string,
  attendanceDate: string
): Promise<ApiResponse<AttendanceRecord[]>> => {
  try {
    // First, get all students in this section
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select(`
        id,
        student_number,
        profile:profiles(first_name, last_name)
      `)
      .eq('section_id', sectionId)
      .eq('is_active', true)
      .order('student_number', { ascending: true })

    if (studentsError) throw studentsError

    if (!students || students.length === 0) {
      return {
        success: true,
        data: [],
        message: 'No students found in this section'
      }
    }

    const studentIds = students.map(s => s.id)

    // Get or create attendance records for these students
    const { data: existingRecords, error: recordsError } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('attendance_date', attendanceDate)
      .in('student_id', studentIds)

    if (recordsError) throw recordsError

    // If no records exist, create them as 'present' by default
    if (!existingRecords || existingRecords.length === 0) {
      // Create attendance records for all students in the section
      const recordsToCreate = students.map(student => ({
        student_id: student.id,
        attendance_date: attendanceDate,
        status: 'present',
        auto_generated: true,
        timetable_entry_id: null // Will be null if not associated with a specific class
      }))

      const { data: newRecords, error: createError } = await supabase
        .from('attendance_records')
        .insert(recordsToCreate)
        .select('*')

      if (createError) throw createError

      // Map with student info
      const attendance = newRecords.map((record: any) => {
        const student = students.find(s => s.id === record.student_id)
        const profile = Array.isArray(student?.profile) ? student.profile[0] : student?.profile
        return {
          ...record,
          student_name: profile
            ? `${profile.first_name} ${profile.last_name}`.trim()
            : 'Unknown',
          student_number: student?.student_number || ''
        }
      })

      return {
        success: true,
        data: attendance as AttendanceRecord[],
        message: 'Attendance records created for section'
      }
    }

    // Map existing records with student info
    const attendance = existingRecords.map((record: any) => {
      const student = students.find(s => s.id === record.student_id)
      const profile = Array.isArray(student?.profile) ? student.profile[0] : student?.profile
      return {
        ...record,
        student_name: profile
          ? `${profile.first_name} ${profile.last_name}`.trim()
          : 'Unknown',
        student_number: student?.student_number || ''
      }
    })

    return {
      success: true,
      data: attendance as AttendanceRecord[]
    }
  } catch (error: any) {
    console.error('Error fetching attendance for section/date:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const updateAttendanceRecord = async (
  recordId: string,
  dto: UpdateAttendanceDTO
): Promise<ApiResponse<AttendanceRecord>> => {
  try {
    const { data, error } = await supabase
      .from('attendance_records')
      .update({
        status: dto.status,
        remarks: dto.remarks,
        marked_by: dto.marked_by,
        marked_at: new Date().toISOString(),
        auto_generated: false
      })
      .eq('id', recordId)
      .select(`
        *,
        student:students(
          student_number,
          profile:profiles(first_name, last_name)
        )
      `)
      .single()

    if (error) throw error

    return {
      success: true,
      data: data as AttendanceRecord,
      message: 'Attendance updated successfully'
    }
  } catch (error: any) {
    console.error('Error updating attendance:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const bulkUpdateAttendance = async (
  timetableEntryId: string,
  attendanceDate: string,
  updates: BulkAttendanceUpdate[],
  markedBy: string
): Promise<ApiResponse<{ updated_count: number }>> => {
  try {
    let updatedCount = 0

    for (const update of updates) {
      const { error } = await supabase
        .from('attendance_records')
        .update({
          status: update.status,
          remarks: update.remarks,
          marked_by: markedBy,
          marked_at: new Date().toISOString(),
          auto_generated: false
        })
        .eq('timetable_entry_id', timetableEntryId)
        .eq('attendance_date', attendanceDate)
        .eq('student_id', update.student_id)

      if (!error) updatedCount++
    }

    return {
      success: true,
      data: { updated_count: updatedCount },
      message: `Updated ${updatedCount} attendance records`
    }
  } catch (error: any) {
    console.error('Error bulk updating attendance:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// ============================================================================
// ATTENDANCE REPORTING & ANALYTICS
// ============================================================================

export const getAttendanceStats = async (
  timetableEntryId: string,
  attendanceDate: string
): Promise<ApiResponse<AttendanceStats>> => {
  try {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('status')
      .eq('timetable_entry_id', timetableEntryId)
      .eq('attendance_date', attendanceDate)

    if (error) throw error

    const stats: AttendanceStats = {
      total_students: data.length,
      present: data.filter(r => r.status === 'present').length,
      absent: data.filter(r => r.status === 'absent').length,
      late: data.filter(r => r.status === 'late').length,
      excused: data.filter(r => r.status === 'excused').length,
      percentage: 0
    }

    if (stats.total_students > 0) {
      stats.percentage = Math.round(
        ((stats.present + stats.late + stats.excused) / stats.total_students) * 100
      )
    }

    return {
      success: true,
      data: stats
    }
  } catch (error: any) {
    console.error('Error fetching attendance stats:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const getStudentAttendanceHistory = async (
  studentId: string,
  startDate?: string,
  endDate?: string
): Promise<ApiResponse<AttendanceRecord[]>> => {
  try {
    let query = supabase
      .from('attendance_records')
      .select(`
        *,
        timetable_entry:timetable_entries(
          subject:subjects(name),
          teacher:staff!teacher_id(profile:profiles(first_name, last_name))
        )
      `)
      .eq('student_id', studentId)
      .order('attendance_date', { ascending: false })

    if (startDate) query = query.gte('attendance_date', startDate)
    if (endDate) query = query.lte('attendance_date', endDate)

    const { data, error } = await query

    if (error) throw error

    return {
      success: true,
      data: data as AttendanceRecord[]
    }
  } catch (error: any) {
    console.error('Error fetching student attendance history:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const getClassAttendanceSummary = async (
  sectionId: string,
  startDate: string,
  endDate: string
): Promise<ApiResponse<any[]>> => {
  try {
    const { data, error } = await supabase
      .from('attendance_records')
      .select(`
        student_id,
        status,
        student:students(
          student_number,
          profile:profiles(first_name, last_name)
        )
      `)
      .eq('student.section_id', sectionId)
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDate)

    if (error) throw error

    // Group by student and calculate stats
    const studentMap = new Map()

    data.forEach((record: any) => {
      const studentId = record.student_id
      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          student_id: studentId,
          student_number: record.student?.student_number,
          student_name: record.student?.profile
            ? `${record.student.profile.first_name} ${record.student.profile.last_name}`.trim()
            : 'Unknown',
          total_classes: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          percentage: 0
        })
      }

      const stats = studentMap.get(studentId)
      stats.total_classes++
      stats[record.status]++
    })

    // Calculate percentages
    const summary = Array.from(studentMap.values()).map(stats => {
      if (stats.total_classes > 0) {
        stats.percentage = Math.round(
          ((stats.present + stats.late + stats.excused) / stats.total_classes) * 100
        )
      }
      return stats
    })

    // Sort by student number
    summary.sort((a, b) => a.student_number.localeCompare(b.student_number))

    return {
      success: true,
      data: summary
    }
  } catch (error: any) {
    console.error('Error fetching class attendance summary:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const getTeacherAttendanceOverview = async (
  teacherId: string,
  date: string
): Promise<ApiResponse<any[]>> => {
  try {
    // Get all classes for teacher on this date
    const dayOfWeek = (new Date(date).getDay() + 6) % 7

    const { data: academicYear } = await supabase
      .from('academic_years')
      .select('id')
      .eq('is_current', true)
      .single()

    if (!academicYear) {
      return {
        success: true,
        data: [],
        message: 'No current academic year'
      }
    }

    const { data: timetableData, error: timetableError } = await supabase
      .from('timetable_entries')
      .select(`
        id,
        section:sections(name, grade_level:grade_levels(name)),
        subject:subjects(name),
        period:periods(period_number, start_time, end_time)
      `)
      .eq('teacher_id', teacherId)
      .eq('academic_year_id', academicYear.id)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)

    if (timetableError) throw timetableError

    // Sort by period number in-memory
    const timetable = (timetableData || []).sort((a: any, b: any) => {
      const numA = a.period?.period_number || 0
      const numB = b.period?.period_number || 0
      return numA - numB
    })

    if (timetableError) throw timetableError

    // For each timetable entry, get attendance stats
    const overview = await Promise.all(
      timetable.map(async (entry: any) => {
        const statsResult = await getAttendanceStats(entry.id, date)

        return {
          timetable_entry_id: entry.id,
          period_number: entry.period.period_number,
          start_time: entry.period.start_time,
          end_time: entry.period.end_time,
          section_name: entry.section.name,
          grade_name: entry.section.grade_level.name,
          subject_name: entry.subject.name,
          stats: statsResult.data || {
            total_students: 0,
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
            percentage: 0
          }
        }
      })
    )

    return {
      success: true,
      data: overview
    }
  } catch (error: any) {
    console.error('Error fetching teacher attendance overview:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
