import { supabase } from '../config/supabase'

// Helper: Get main school ID (handles campus hierarchy)
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

export class StudentDashboardService {
  /**
   * Get comprehensive dashboard overview for student
   * Includes: today's timetable, due assignments, recent feedback
   */
  async getDashboardOverview(studentId: string) {
    const [todayTimetable, dueAssignments, recentFeedback, attendanceSummary] = await Promise.all([
      this.getTodayTimetable(studentId),
      this.getDueAssignments(studentId),
      this.getRecentFeedback(studentId, 3),
      this.getAttendanceSummary(studentId)
    ])

    return {
      todayTimetable,
      dueAssignments,
      recentFeedback,
      attendanceSummary
    }
  }

  /**
   * Get today's timetable for student
   */
  async getTodayTimetable(studentId: string) {
    console.log('📅 Getting today timetable for student:', studentId)
    
    // Get student's section and current academic year
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('section_id, school_id')
      .eq('id', studentId)
      .single()

    if (studentError) {
      console.error('❌ Error fetching student:', studentError)
      return []
    }

    if (!student?.section_id) {
      console.warn('⚠️ Student has no section assigned:', studentId)
      return []
    }

    // Get main school ID (handles campus hierarchy - academic years are on main school)
    const mainSchoolId = await getMainSchoolId(student.school_id)
    console.log('📚 Student section_id:', student.section_id, 'school_id:', student.school_id, 'mainSchoolId:', mainSchoolId)

    // Get current academic year from main school
    const { data: academicYear, error: academicYearError } = await supabase
      .from('academic_years')
      .select('id')
      .eq('school_id', mainSchoolId)
      .eq('is_current', true)
      .maybeSingle()

    if (academicYearError) {
      console.error('❌ Error fetching academic year:', academicYearError)
      return []
    }

    if (!academicYear) {
      console.warn('⚠️ No current academic year found for school:', mainSchoolId)
      return []
    }

    console.log('📆 Current academic year:', academicYear.id)

    const today = new Date()
    const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, etc.
    
    // Map to database format (Monday = 1, Sunday = 7)
    const dbDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek
    console.log('📅 Day of week:', dbDayOfWeek)

    const { data: timetable, error } = await supabase
      .from('timetable_entries')
      .select(`
        id,
        day_of_week,
        room_number,
        subject:subjects(id, name, code),
        teacher:staff!teacher_id(
          id,
          profile:profiles!staff_profile_id_fkey(first_name, last_name)
        ),
        period:periods(id, period_number, period_name, start_time, end_time)
      `)
      .eq('section_id', student.section_id)
      .eq('academic_year_id', academicYear.id)
      .eq('day_of_week', dbDayOfWeek)
      .eq('is_active', true)
      .order('period_id', { ascending: true })

    if (error) {
      console.error('❌ Error fetching today timetable:', error)
      return []
    }

    console.log('✅ Today timetable entries found:', timetable?.length || 0)

    // Transform to include start_time and end_time from period
    return (timetable || []).map((item: any) => ({
      id: item.id,
      day_of_week: item.day_of_week,
      start_time: item.period?.start_time,
      end_time: item.period?.end_time,
      room_number: item.room_number,
      subject: item.subject,
      teacher: item.teacher,
      period: item.period
    }))
  }

  /**
   * Get weekly timetable for student
   */
  async getWeeklyTimetable(studentId: string) {
    console.log('📅 Getting weekly timetable for student:', studentId)
    
    // Get student's section
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('section_id, school_id')
      .eq('id', studentId)
      .single()

    if (studentError) {
      console.error('❌ Error fetching student:', studentError)
      return []
    }

    if (!student?.section_id) {
      console.warn('⚠️ Student has no section assigned:', studentId)
      return []
    }

    // Get main school ID (handles campus hierarchy - academic years are on main school)
    const mainSchoolId = await getMainSchoolId(student.school_id)
    console.log('📚 Student section_id:', student.section_id, 'school_id:', student.school_id, 'mainSchoolId:', mainSchoolId)

    // Get current academic year from main school
    const { data: academicYear, error: academicYearError } = await supabase
      .from('academic_years')
      .select('id')
      .eq('school_id', mainSchoolId)
      .eq('is_current', true)
      .maybeSingle()

    if (academicYearError) {
      console.error('❌ Error fetching academic year:', academicYearError)
      return []
    }

    if (!academicYear) {
      console.warn('⚠️ No current academic year found for school:', mainSchoolId)
      return []
    }

    console.log('📆 Current academic year:', academicYear.id)

    const { data: timetable, error } = await supabase
      .from('timetable_entries')
      .select(`
        id,
        day_of_week,
        room_number,
        subject:subjects(id, name, code),
        teacher:staff!teacher_id(
          id,
          profile:profiles!staff_profile_id_fkey(first_name, last_name)
        ),
        period:periods(id, period_number, period_name, start_time, end_time)
      `)
      .eq('section_id', student.section_id)
      .eq('academic_year_id', academicYear.id)
      .eq('is_active', true)
      .order('day_of_week', { ascending: true })
      .order('period_id', { ascending: true })

    if (error) {
      console.error('❌ Error fetching weekly timetable:', error)
      return []
    }

    console.log('✅ Weekly timetable entries found:', timetable?.length || 0)

    // Transform to include start_time and end_time from period
    return (timetable || []).map((item: any) => ({
      id: item.id,
      day_of_week: item.day_of_week,
      start_time: item.period?.start_time,
      end_time: item.period?.end_time,
      room_number: item.room_number,
      subject: item.subject,
      teacher: item.teacher,
      period: item.period
    }))
  }

  /**
   * Get assignments due in next 48 hours
   */
  async getDueAssignments(studentId: string) {
    // Get student's section
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('section_id, school_id')
      .eq('id', studentId)
      .single()

    if (studentError || !student?.section_id) {
      return []
    }

    const now = new Date()
    const fortyEightHoursLater = new Date(now.getTime() + 48 * 60 * 60 * 1000)

    const { data: assignments, error } = await supabase
      .from('assignments')
      .select(`
        id,
        title,
        description,
        instructions,
        attachments,
        due_date,
        max_score,
        subject:subjects(id, name, code),
        teacher:staff!teacher_id(
          id,
          profile:profiles!staff_profile_id_fkey(first_name, last_name)
        ),
        submission:assignment_submissions!left(
          id,
          submitted_at,
          score,
          feedback,
          status
        )
      `)
      .eq('section_id', student.section_id)
      .gte('due_date', now.toISOString())
      .lte('due_date', fortyEightHoursLater.toISOString())
      .order('due_date', { ascending: true })

    if (error) {
      console.error('Error fetching due assignments:', error)
      return []
    }

    // Filter submission to only current student
    return (assignments || []).map((assignment: any) => ({
      ...assignment,
      submission: assignment.submission?.find((s: any) => s.student_id === studentId) || null
    }))
  }

  /**
   * Get all student assignments with optional status filter
   */
  async getStudentAssignments(studentId: string, status?: string) {
    // Get student's section and school
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('section_id, school_id')
      .eq('id', studentId)
      .single()

    if (studentError || !student?.section_id) {
      return {
        todo: [],
        submitted: [],
        graded: []
      }
    }

    const { data: assignments, error } = await supabase
      .from('assignments')
      .select(`
        id,
        title,
        description,
        instructions,
        attachments,
        due_date,
        max_score,
        is_graded,
        allow_late_submission,
        created_at,
        academic_year_id,
        subject:subjects(id, name, code),
        teacher:staff!teacher_id(
          id,
          profile:profiles!staff_profile_id_fkey(first_name, last_name)
        )
      `)
      .eq('section_id', student.section_id)
      .eq('is_published', true)
      .eq('is_archived', false)
      .order('due_date', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching student assignments:', error)
      return { todo: [], submitted: [], graded: [] }
    }

    // Get submissions for this student
    const assignmentIds = (assignments || []).map((a: any) => a.id)
    const { data: submissions } = await supabase
      .from('assignment_submissions')
      .select('*')
      .in('assignment_id', assignmentIds)
      .eq('student_id', studentId)

    const submissionsMap = new Map(
      (submissions || []).map((s: any) => [s.assignment_id, s])
    )

    // Categorize assignments
    const todo: any[] = [];
    const submitted: any[] = [];
    const graded: any[] = [];

    (assignments || []).forEach((assignment: any) => {
      const submission = submissionsMap.get(assignment.id)
      const assignmentWithSubmission = {
        ...assignment,
        submission: submission || null
      }

      if (!submission) {
        todo.push(assignmentWithSubmission)
      } else if (submission.status === 'graded') {
        graded.push(assignmentWithSubmission)
      } else {
        submitted.push(assignmentWithSubmission)
      }
    })

    // Return based on status filter
    if (status === 'todo') return { todo, submitted: [], graded: [] }
    if (status === 'submitted') return { todo: [], submitted, graded: [] }
    if (status === 'graded') return { todo: [], submitted: [], graded }

    return { todo, submitted, graded }
  }

  /**
   * Get recent feedback (graded assignments)
   */
  async getRecentFeedback(studentId: string, limit: number = 5) {
    const { data: submissions, error } = await supabase
      .from('assignment_submissions')
      .select(`
        id,
        submitted_at,
        score,
        feedback,
        graded_at,
        assignment:assignments(
          id,
          title,
          max_score,
          subject:subjects(id, name, code),
          teacher:staff!teacher_id(
            id,
            profile:profiles!staff_profile_id_fkey(first_name, last_name)
          )
        )
      `)
      .eq('student_id', studentId)
      .eq('status', 'graded')
      .not('score', 'is', null)
      .order('graded_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching recent feedback:', error)
      return []
    }

    return submissions || []
  }

  /**
   * Get attendance summary for student
   */
  async getAttendanceSummary(studentId: string) {
    // Get current academic year
    const { data: student } = await supabase
      .from('students')
      .select('school_id, section_id')
      .eq('id', studentId)
      .single()

    if (!student) {
      return {
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        lateDays: 0,
        percentage: 0
      }
    }

    // Get attendance records for current academic year
    const { data: attendance, error } = await supabase
      .from('attendance_records')
      .select('status, attendance_date')
      .eq('student_id', studentId)
      .gte('attendance_date', new Date(new Date().getFullYear(), 0, 1).toISOString())
      .lte('attendance_date', new Date().toISOString())

    if (error) {
      console.error('Error fetching attendance:', error)
      return {
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        lateDays: 0,
        percentage: 0
      }
    }

    const totalDays = (attendance || []).length
    const presentDays = (attendance || []).filter((a: any) => a.status === 'present').length
    const absentDays = (attendance || []).filter((a: any) => a.status === 'absent').length
    const lateDays = (attendance || []).filter((a: any) => a.status === 'late').length

    const percentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0

    return {
      totalDays,
      presentDays,
      absentDays,
      lateDays,
      percentage
    }
  }

  /**
   * Get subject-wise attendance breakdown for student
   */
  async getSubjectWiseAttendance(studentId: string) {
    const { data: student } = await supabase
      .from('students')
      .select('school_id, section_id')
      .eq('id', studentId)
      .single()

    if (!student) {
      return []
    }

    // Get attendance records with timetable entry (subject) details
    const { data: records, error } = await supabase
      .from('attendance_records')
      .select(`
        id,
        status,
        attendance_date,
        timetable_entry:timetable_entries(
          id,
          subject:subjects(id, name, code)
        )
      `)
      .eq('student_id', studentId)
      .gte('attendance_date', new Date(new Date().getFullYear(), 0, 1).toISOString())
      .lte('attendance_date', new Date().toISOString())

    if (error) {
      console.error('Error fetching subject-wise attendance:', error)
      return []
    }

    // Group by subject
    const subjectMap = new Map<string, {
      subject_id: string
      subject_name: string
      subject_code: string
      total: number
      present: number
      absent: number
      late: number
      excused: number
      percentage: number
    }>()

    records?.forEach((record: any) => {
      const subject = record.timetable_entry?.subject
      if (!subject) return

      const key = subject.id
      if (!subjectMap.has(key)) {
        subjectMap.set(key, {
          subject_id: subject.id,
          subject_name: subject.name,
          subject_code: subject.code,
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          percentage: 0
        })
      }

      const stats = subjectMap.get(key)!
      stats.total++
      
      if (record.status === 'present') stats.present++
      else if (record.status === 'absent') stats.absent++
      else if (record.status === 'late') stats.late++
      else if (record.status === 'excused') stats.excused++
    })

    // Calculate percentages and convert to array
    return Array.from(subjectMap.values()).map(stats => ({
      ...stats,
      percentage: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0
    })).sort((a, b) => b.percentage - a.percentage)
  }

  /**
   * Get detailed attendance records with date, period, and subject info
   */
  async getDetailedAttendance(studentId: string, month?: number, year?: number) {
    const { data: student } = await supabase
      .from('students')
      .select('school_id, section_id')
      .eq('id', studentId)
      .single()

    if (!student) {
      return []
    }

    // Set date range based on month/year or default to current academic year
    const currentDate = new Date()
    const startDate = month && year 
      ? new Date(year, month - 1, 1) 
      : new Date(currentDate.getFullYear(), 0, 1)
    
    const endDate = month && year
      ? new Date(year, month, 0) // Last day of the month
      : currentDate

    // Get detailed attendance records
    const { data: records, error } = await supabase
      .from('attendance_records')
      .select(`
        id,
        status,
        attendance_date,
        marked_at,
        remarks,
        timetable_entry:timetable_entries(
          id,
          day_of_week,
          room_number,
          subject:subjects(id, name, code),
          period:periods(id, period_number, period_name, start_time, end_time)
        )
      `)
      .eq('student_id', studentId)
      .gte('attendance_date', startDate.toISOString())
      .lte('attendance_date', endDate.toISOString())
      .order('attendance_date', { ascending: false })

    if (error) {
      console.error('Error fetching detailed attendance:', error)
      return []
    }

    return records || []
  }

  /**
   * Get upcoming exams for student
   */
  async getUpcomingExams(studentId: string) {
    // Get student's section and grade
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('section_id, grade_level, school_id')
      .eq('id', studentId)
      .single()

    if (studentError || !student) {
      return []
    }

    const now = new Date()

    const { data: exams, error } = await supabase
      .from('exams')
      .select(`
        id,
        title,
        exam_date,
        start_time,
        end_time,
        total_marks,
        exam_type,
        room_number,
        instructions,
        subject:subjects(id, name, code),
        section:sections(id, name, grade_level)
      `)
      .eq('section_id', student.section_id)
      .gte('exam_date', now.toISOString())
      .order('exam_date', { ascending: true })
      .limit(10)

    if (error) {
      console.error('Error fetching upcoming exams:', error)
      return []
    }

    return exams || []
  }

  /**
   * Get digital ID card information for student
   */
  async getDigitalIdCard(studentId: string) {
    // First get student basic info with section_id and school_id
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select(`
        id,
        student_number,
        grade_level,
        section_id,
        school_id,
        profile_id,
        created_at
      `)
      .eq('id', studentId)
      .single()

    if (studentError || !student) {
      console.error('Error fetching student:', studentError)
      throw new Error('Failed to fetch student ID card')
    }

    // Get profile information
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, phone, date_of_birth, gender, address, profile_photo_url')
      .eq('id', student.profile_id)
      .single()

    // Get section information with grade level
    const { data: section } = await supabase
      .from('sections')
      .select(`
        id,
        name,
        grade_level_id
      `)
      .eq('id', student.section_id)
      .single()

    // Get grade level if section exists
    let gradeLevel = null
    if (section?.grade_level_id) {
      const { data: gl } = await supabase
        .from('grade_levels')
        .select('id, name, level_order')
        .eq('id', section.grade_level_id)
        .single()
      gradeLevel = gl
    }

    // Get school information
    const { data: school } = await supabase
      .from('schools')
      .select('id, name, logo_url, address, phone')
      .eq('id', student.school_id)
      .single()

    // Construct the response
    return {
      id: student.id,
      student_number: student.student_number,
      admission_date: student.created_at, // Using created_at as admission date
      grade_level: student.grade_level,
      status: 'active', // Default status
      profile: profile ? {
        ...profile,
        photo_url: profile.profile_photo_url
      } : null,
      section: section && gradeLevel ? {
        id: section.id,
        name: section.name,
        grade_level: gradeLevel
      } : null,
      school: school || null
    }
  }
}
