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
   * Resolve course_period IDs for a student via their timetable.
   * course_periods.section_id is NULL in this school's data, so we bridge through:
   * timetable_entries (section→subject+teacher) → courses → course_periods
   */
  private async resolveStudentCoursePeriodIds(sectionId: string, schoolId: string): Promise<string[]> {
    // Step 1: Get subject+teacher pairs from the student's timetable
    // No academic_year_id filter — timetable entries may use campus-specific year IDs
    const { data: timetableEntries } = await supabase
      .from('timetable_entries')
      .select('subject_id, teacher_id')
      .eq('section_id', sectionId)
      .eq('is_active', true)

    if (!timetableEntries?.length) return []

    const subjectIds = [...new Set(timetableEntries.map((e: any) => e.subject_id).filter(Boolean))]
    const teacherIds = [...new Set(timetableEntries.map((e: any) => e.teacher_id).filter(Boolean))]

    if (!subjectIds.length) return []

    // Step 2: Find courses whose subject matches the student's timetable subjects
    const { data: courses } = await supabase
      .from('courses')
      .select('id')
      .in('subject_id', subjectIds)

    const courseIds = (courses || []).map((c: any) => c.id)
    if (!courseIds.length) return []

    // Step 3: Find active course_periods for those courses
    // Filter by teacher_id if we have them (narrows to this student's actual teachers)
    let cpQuery = supabase
      .from('course_periods')
      .select('id')
      .in('course_id', courseIds)
      .eq('is_active', true)

    if (teacherIds.length > 0) {
      cpQuery = cpQuery.in('teacher_id', teacherIds)
    }

    const { data: coursePeriods } = await cpQuery
    return (coursePeriods || []).map((cp: any) => cp.id)
  }

  /**
   * Get assignments due in next 48 hours (Rosario gradebook_assignments)
   */
  async getDueAssignments(studentId: string) {
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('section_id, school_id')
      .eq('id', studentId)
      .single()

    if (studentError || !student?.section_id) return []

    const cpIds = await this.resolveStudentCoursePeriodIds(student.section_id, student.school_id)
    if (cpIds.length === 0) return []

    const now = new Date()
    const fortyEightHoursLater = new Date(now.getTime() + 48 * 60 * 60 * 1000)

    const { data: assignments, error } = await supabase
      .from('gradebook_assignments')
      .select(`
        id, title, description, assigned_date, due_date, points,
        assignment_type:gradebook_assignment_types(id, title),
        course_period:course_periods(
          id, title,
          course:courses!course_id(id, title),
          teacher:staff!teacher_id(
            id,
            profile:profiles!staff_profile_id_fkey(first_name, last_name)
          )
        )
      `)
      .in('course_period_id', cpIds)
      .eq('is_active', true)
      .gte('due_date', now.toISOString())
      .lte('due_date', fortyEightHoursLater.toISOString())
      .order('due_date', { ascending: true })

    if (error) {
      console.error('Error fetching due gradebook assignments:', error)
      return []
    }

    const assignmentIds = (assignments || []).map((a: any) => a.id)
    const { data: submissions } = assignmentIds.length > 0
      ? await supabase.from('student_assignments').select('assignment_id, submitted_at, status').in('assignment_id', assignmentIds).eq('student_id', studentId)
      : { data: [] }
    const { data: grades } = assignmentIds.length > 0
      ? await supabase.from('gradebook_grades').select('assignment_id, points, comment, graded_at').in('assignment_id', assignmentIds).eq('student_id', studentId)
      : { data: [] }

    const submissionsMap = new Map((submissions || []).map((s: any) => [s.assignment_id, s]))
    const gradesMap = new Map((grades || []).map((g: any) => [g.assignment_id, g]))

    return (assignments || []).map((assignment: any) => {
      const cp = assignment.course_period
      const submission = submissionsMap.get(assignment.id) || null
      const grade = gradesMap.get(assignment.id) || null
      return {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        assigned_date: assignment.assigned_date,
        due_date: assignment.due_date,
        max_score: assignment.points,
        subject: { id: cp?.id || '', name: cp?.course?.title || cp?.title || 'Course', code: '' },
        teacher: cp?.teacher || null,
        submission: submission ? {
          id: submission.id,
          submitted_at: submission.submitted_at,
          marks_obtained: grade?.points ?? null,
          feedback: grade?.comment ?? null,
          status: grade ? 'graded' : 'submitted',
        } : null,
      }
    })
  }

  /**
   * Get all student assignments with optional status filter (Rosario gradebook_assignments)
   */
  async getStudentAssignments(studentId: string, status?: string) {
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('section_id, school_id')
      .eq('id', studentId)
      .single()

    if (studentError || !student?.section_id) return { todo: [], submitted: [], graded: [] }

    const cpIds = await this.resolveStudentCoursePeriodIds(student.section_id, student.school_id)
    if (cpIds.length === 0) return { todo: [], submitted: [], graded: [] }

    const { data: assignments, error } = await supabase
      .from('gradebook_assignments')
      .select(`
        id, title, description, assigned_date, due_date, points, enable_submission, file_url,
        assignment_type:gradebook_assignment_types(id, title),
        course_period:course_periods(
          id, title,
          course:courses!course_id(id, title),
          teacher:staff!teacher_id(
            id,
            profile:profiles!staff_profile_id_fkey(first_name, last_name)
          )
        )
      `)
      .in('course_period_id', cpIds)
      .eq('is_active', true)
      .order('due_date', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching gradebook assignments for student:', error)
      return { todo: [], submitted: [], graded: [] }
    }

    const assignmentIds = (assignments || []).map((a: any) => a.id)

    const [{ data: submissions }, { data: grades }] = await Promise.all([
      assignmentIds.length > 0
        ? supabase.from('student_assignments').select('id, assignment_id, submission_text, attachments, submitted_at, status').in('assignment_id', assignmentIds).eq('student_id', studentId)
        : Promise.resolve({ data: [] }),
      assignmentIds.length > 0
        ? supabase.from('gradebook_grades').select('assignment_id, points, letter_grade, comment, graded_at').in('assignment_id', assignmentIds).eq('student_id', studentId)
        : Promise.resolve({ data: [] }),
    ])

    const submissionsMap = new Map((submissions || []).map((s: any) => [s.assignment_id, s]))
    const gradesMap = new Map((grades || []).map((g: any) => [g.assignment_id, g]))

    const todo: any[] = []
    const submitted: any[] = []
    const graded: any[] = []

    for (const assignment of assignments || []) {
      const cp = assignment.course_period as any
      const submission = submissionsMap.get(assignment.id) || null
      const grade = gradesMap.get(assignment.id) || null

      const normalized = {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        assigned_date: assignment.assigned_date,
        due_date: assignment.due_date,
        max_score: assignment.points,
        enable_submission: (assignment as any).enable_submission !== false,
        file_url: (assignment as any).file_url || null,
        assignment_type: assignment.assignment_type,
        subject: { id: cp?.id || '', name: cp?.course?.title || cp?.title || 'Course', code: '' },
        teacher: cp?.teacher || null,
        submission: submission ? {
          id: submission.id,
          submitted_at: submission.submitted_at,
          submission_text: submission.submission_text,
          attachments: submission.attachments,
          score: grade?.points ?? null,
          feedback: grade?.comment ?? null,
          letter_grade: grade?.letter_grade ?? null,
          graded_at: grade?.graded_at ?? null,
          marks_obtained: grade?.points ?? null,
          status: grade ? 'graded' : 'submitted',
        } : null,
      }

      if (grade) graded.push(normalized)
      else if (submission) submitted.push(normalized)
      else todo.push(normalized)
    }

    if (status === 'todo') return { todo, submitted: [], graded: [] }
    if (status === 'submitted') return { todo: [], submitted, graded: [] }
    if (status === 'graded') return { todo: [], submitted: [], graded }
    return { todo, submitted, graded }
  }

  /**
   * Submit a gradebook assignment (Rosario-style)
   * Upserts a record in student_assignments
   */
  async submitGradebookAssignment(
    studentId: string,
    assignmentId: string,
    data: { submission_text?: string; attachments?: any[] }
  ) {
    const { data: student } = await supabase
      .from('students')
      .select('school_id')
      .eq('id', studentId)
      .single()

    const payload = {
      student_id: studentId,
      assignment_id: assignmentId,
      school_id: student?.school_id || null,
      submission_text: data.submission_text || null,
      attachments: data.attachments || [],
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'submitted',
    }

    const { data: existing } = await supabase
      .from('student_assignments')
      .select('id')
      .eq('student_id', studentId)
      .eq('assignment_id', assignmentId)
      .maybeSingle()

    if (existing) {
      const { data: updated, error } = await supabase
        .from('student_assignments')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw new Error(`Failed to update submission: ${error.message}`)
      return updated
    }

    const { data: created, error } = await supabase
      .from('student_assignments')
      .insert(payload)
      .select()
      .single()
    if (error) throw new Error(`Failed to create submission: ${error.message}`)
    return created
  }

  /**
   * Get recent feedback (graded assignments from gradebook_grades)
   */
  async getRecentFeedback(studentId: string, limit: number = 5) {
    const { data: grades, error } = await supabase
      .from('gradebook_grades')
      .select(`
        id,
        points,
        letter_grade,
        comment,
        graded_at,
        assignment:gradebook_assignments(
          id,
          title,
          points,
          course_period:course_periods(
            id, title,
            course:courses!course_id(id, title),
            teacher:staff!teacher_id(
              id,
              profile:profiles!staff_profile_id_fkey(first_name, last_name)
            )
          )
        )
      `)
      .eq('student_id', studentId)
      .not('points', 'is', null)
      .order('graded_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching recent feedback from gradebook:', error)
      return []
    }

    return (grades || []).map((g: any) => {
      const assignment = g.assignment
      const cp = assignment?.course_period
      return {
        id: g.id,
        submitted_at: g.graded_at,
        marks_obtained: g.points,
        feedback: g.comment,
        graded_at: g.graded_at,
        assignment: {
          id: assignment?.id || '',
          title: assignment?.title || '',
          max_score: assignment?.points || 0,
          subject: { id: cp?.id || '', name: cp?.course?.title || cp?.title || 'Course', code: '' },
          teacher: cp?.teacher || null,
        },
      }
    })
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
  async getSubjectWiseAttendance(studentId: string, month?: string) {
    const { data: student } = await supabase
      .from('students')
      .select('school_id, section_id')
      .eq('id', studentId)
      .single()

    if (!student) {
      return []
    }

    // Calculate date range based on month parameter or default to current month
    let startDate: string
    let endDate: string
    
    if (month) {
      // month is in format 'YYYY-MM'
      startDate = `${month}-01`
      const endDateObj = new Date(month + '-01')
      endDateObj.setMonth(endDateObj.getMonth() + 1)
      endDateObj.setDate(0)
      endDate = endDateObj.toISOString().split('T')[0]
    } else {
      // Default to current month
      const now = new Date()
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const endDateObj = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      endDate = endDateObj.toISOString().split('T')[0]
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
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDate)

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
   * Get all grades for student, grouped by subject/course-period.
   * Returns subjects with assignment list + calculated average.
   */
  async getStudentGrades(studentId: string) {
    // Resolve school_id so we can query gradebook_grades
    const { data: student } = await supabase
      .from('students')
      .select('school_id, section_id')
      .eq('id', studentId)
      .single()

    if (!student) return []

    // All graded assignments for this student (across every course period)
    const { data: grades, error } = await supabase
      .from('gradebook_grades')
      .select(`
        id,
        points,
        letter_grade,
        comment,
        is_exempt,
        is_late,
        is_missing,
        graded_at,
        course_period_id,
        assignment:gradebook_assignments(
          id,
          title,
          points,
          due_date,
          assignment_type:gradebook_assignment_types(id, title, final_grade_percent)
        )
      `)
      .eq('student_id', studentId)
      .order('graded_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch grades: ${error.message}`)

    // Group by course_period_id so we can fetch subject names once
    const cpIds = [...new Set((grades || []).map((g: any) => g.course_period_id).filter(Boolean))]

    let coursePeriods: any[] = []
    if (cpIds.length > 0) {
      const { data: cps } = await supabase
        .from('course_periods')
        .select('id, courses(id, title), subjects(id, name, code)')
        .in('id', cpIds)
      coursePeriods = cps || []
    }

    const cpMap = new Map(coursePeriods.map((cp: any) => [cp.id, cp]))

    // Group grades by course period
    const grouped = new Map<string, { subject: any; grades: any[]; average: number | null; letterGrade: string | null }>()

    for (const g of grades || []) {
      const cp = cpMap.get(g.course_period_id)
      const key = g.course_period_id || 'unknown'

      if (!grouped.has(key)) {
        const subject = cp?.subjects || cp?.courses || null
        grouped.set(key, { subject, grades: [], average: null, letterGrade: null })
      }
      grouped.get(key)!.grades.push(g)
    }

    // Calculate average per group
    return Array.from(grouped.entries()).map(([cpId, group]) => {
      const gradedItems = group.grades.filter((g: any) => g.points !== null && !g.is_exempt)
      const totalEarned = gradedItems.reduce((sum: number, g: any) => sum + (g.points || 0), 0)
      const totalPossible = gradedItems.reduce((sum: number, g: any) => sum + (g.assignment?.points || 0), 0)
      const average = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : null
      const letterGrade = gradedItems.find((g: any) => g.letter_grade)?.letter_grade || null

      return {
        course_period_id: cpId,
        subject: group.subject,
        total_assignments: group.grades.length,
        graded_count: gradedItems.length,
        average,
        letter_grade: letterGrade,
        grades: group.grades
      }
    })
  }

  /**
   * Get the generated report card for the student (calls report-card generation).
   * Returns raw report card data (subjects, comments, grades per marking period).
   */
  async getStudentReportCard(studentId: string, markingPeriodId?: string) {
    // Fetch grades grouped by marking period / assignment type for a transcript view
    const { data: grades, error } = await supabase
      .from('gradebook_grades')
      .select(`
        id,
        points,
        letter_grade,
        comment,
        is_exempt,
        graded_at,
        course_period_id,
        assignment:gradebook_assignments(
          id,
          title,
          points,
          assignment_type:gradebook_assignment_types(id, title, final_grade_percent)
        )
      `)
      .eq('student_id', studentId)
      .not('points', 'is', null)

    if (error) throw new Error(`Failed to fetch report card: ${error.message}`)

    // Fetch course periods to get subject names
    const cpIds = [...new Set((grades || []).map((g: any) => g.course_period_id).filter(Boolean))]
    let subjectMap = new Map<string, any>()

    if (cpIds.length > 0) {
      const { data: cps } = await supabase
        .from('course_periods')
        .select('id, subjects(id, name, code)')
        .in('id', cpIds)
      ;(cps || []).forEach((cp: any) => subjectMap.set(cp.id, cp.subjects))
    }

    // Build subject-level summary
    const grouped = new Map<string, any>()
    for (const g of grades || []) {
      const key = g.course_period_id || 'unknown'
      if (!grouped.has(key)) {
        grouped.set(key, {
          subject: subjectMap.get(key) || null,
          course_period_id: key,
          grades: [],
        })
      }
      grouped.get(key)!.grades.push(g)
    }

    const subjects = Array.from(grouped.values()).map((group) => {
      const valid = group.grades.filter((g: any) => !g.is_exempt && g.points !== null)
      const earned = valid.reduce((s: number, g: any) => s + (g.points || 0), 0)
      const possible = valid.reduce((s: number, g: any) => s + (g.assignment?.points || 0), 0)
      const avg = possible > 0 ? Math.round((earned / possible) * 100) : null
      const letter = valid.find((g: any) => g.letter_grade)?.letter_grade || null

      return {
        subject: group.subject,
        course_period_id: group.course_period_id,
        average: avg,
        letter_grade: letter,
        grade_count: valid.length,
      }
    })

    // Fetch teacher comments for this student
    const { data: comments } = await supabase
      .from('student_report_comments')
      .select(`
        id,
        comment:report_card_comments(code, comment),
        marking_period_id,
        course_period_id
      `)
      .eq('student_id', studentId)

    return { subjects, comments: comments || [] }
  }

  /**
   * Get discipline referrals for student (own record)
   */
  async getStudentDisciplineReferrals(studentId: string) {
    const { data, error } = await supabase
      .from('discipline_referrals')
      .select(`
        id,
        incident_date,
        field_values,
        created_at,
        reporter:staff!reporter_id(
          id,
          profile:profiles!staff_profile_id_fkey(first_name, last_name)
        )
      `)
      .eq('student_id', studentId)
      .order('incident_date', { ascending: false })

    if (error) throw new Error(`Failed to fetch discipline referrals: ${error.message}`)
    return data || []
  }

  /**
   * Get activities a student is enrolled in
   */
  async getStudentEnrolledActivities(studentId: string) {
    const { data, error } = await supabase
      .from('student_activities')
      .select(`
        id,
        created_at,
        activity:activities(
          id,
          title,
          start_date,
          end_date,
          comment,
          is_active
        )
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch enrolled activities: ${error.message}`)
    return data || []
  }

  /**
   * Get student's hostel room assignment (if any)
   */
  async getHostelAssignment(studentId: string) {
    const { data, error } = await supabase
      .from('hostel_assignments')
      .select(`
        id,
        check_in_date,
        check_out_date,
        notes,
        room:hostel_rooms(
          id,
          room_number,
          capacity,
          floor,
          room_type,
          building:hostel_buildings(id, name, gender)
        )
      `)
      .eq('student_id', studentId)
      .is('check_out_date', null)
      .order('check_in_date', { ascending: false })
      .limit(1)

    if (error) throw new Error(`Failed to fetch hostel assignment: ${error.message}`)
    const assignment = Array.isArray(data) ? data[0] || null : data
    return assignment
  }

  /**
   * Get class diary entries for student's section (read view)
   */
  async getClassDiaryEntries(studentId: string) {
    // Resolve section_id from student record
    const { data: student } = await supabase
      .from('students')
      .select('section_id')
      .eq('id', studentId)
      .single()

    if (!student?.section_id) return []

    const { data, error } = await supabase
      .from('class_diary_entries')
      .select(`
        id,
        diary_date,
        content,
        enable_comments,
        is_published,
        created_at,
        teacher:staff!teacher_id(
          id,
          profile:profiles!profile_id(first_name, last_name)
        )
      `)
      .eq('section_id', student.section_id)
      .order('diary_date', { ascending: false })
      .limit(50)

    if (error) throw new Error(`Failed to fetch class diary: ${error.message}`)
    return data || []
  }

  /**
   * Get student's fee invoices (own record, zero-trust)
   */
  async getStudentFees(studentId: string) {
    const { data: fees, error } = await supabase
      .from('student_fees')
      .select(`
        id,
        fee_structure:fee_structures!student_fees_fee_structure_id_fkey(
          id,
          period_type,
          period_name,
          fee_category:fee_categories!fee_structures_fee_category_id_fkey(name)
        ),
        academic_year,
        base_amount,
        final_amount,
        amount_paid,
        balance,
        status,
        due_date,
        created_at
      `)
      .eq('student_id', studentId)
      .order('due_date', { ascending: false })

    if (error) throw new Error(`Failed to fetch fees: ${error.message}`)

    return (fees || []).map((fee: any) => {
      const feeStructure = fee.fee_structure
      const categoryName = feeStructure?.fee_category?.name || 'Uncategorized'
      const periodName = feeStructure?.period_name || feeStructure?.period_type || ''
      return {
        id: fee.id,
        fee_name: periodName ? `${categoryName} - ${periodName}` : categoryName,
        category: categoryName,
        academic_year: fee.academic_year,
        base_amount: parseFloat(fee.base_amount || 0),
        final_amount: parseFloat(fee.final_amount || 0),
        amount_paid: parseFloat(fee.amount_paid || 0),
        balance: parseFloat(fee.balance || 0),
        status: fee.status,
        due_date: fee.due_date,
      }
    })
  }

  /**
   * Get student's payment history (own record, zero-trust)
   */
  async getStudentPaymentHistory(studentId: string) {
    const { data: fees, error: feesError } = await supabase
      .from('student_fees')
      .select('id')
      .eq('student_id', studentId)

    if (feesError) throw new Error(`Failed to fetch fee IDs: ${feesError.message}`)
    const feeIds = (fees || []).map((f: any) => f.id)
    if (feeIds.length === 0) return []

    const { data: payments, error } = await supabase
      .from('fee_payments')
      .select(`
        id,
        student_fee_id,
        amount,
        payment_method,
        payment_reference,
        payment_date,
        notes,
        received_by:profiles!fee_payments_received_by_fkey(first_name, last_name)
      `)
      .in('student_fee_id', feeIds)
      .order('payment_date', { ascending: false })

    if (error) throw new Error(`Failed to fetch payments: ${error.message}`)
    return (payments || []).map((p: any) => ({
      id: p.id,
      student_fee_id: p.student_fee_id,
      amount: parseFloat(p.amount || 0),
      payment_method: p.payment_method,
      payment_reference: p.payment_reference,
      payment_date: p.payment_date,
      notes: p.notes,
      received_by: p.received_by
        ? `${(p.received_by as any).first_name} ${(p.received_by as any).last_name}`.trim()
        : null,
    }))
  }

  /**
   * Get courses (unique subjects) for the student's section
   */
  async getStudentCourses(studentId: string) {
    const { data: student } = await supabase
      .from('students')
      .select('section_id, school_id')
      .eq('id', studentId)
      .single()

    if (!student?.section_id) return []

    const mainSchoolId = await getMainSchoolId(student.school_id)

    const { data: academicYear } = await supabase
      .from('academic_years')
      .select('id')
      .eq('school_id', mainSchoolId)
      .eq('is_current', true)
      .maybeSingle()

    if (!academicYear) return []

    const { data: entries, error } = await supabase
      .from('timetable_entries')
      .select(`
        subject:subjects(id, name, code),
        teacher:staff!teacher_id(
          id,
          profile:profiles!staff_profile_id_fkey(first_name, last_name)
        )
      `)
      .eq('section_id', student.section_id)
      .eq('academic_year_id', academicYear.id)
      .eq('is_active', true)

    if (error) return []

    // Deduplicate by subject id
    const seen = new Set<string>()
    const courses: any[] = []
    
    for (const entry of entries || []) {
      const subj = (entry as any).subject
      if (subj && !seen.has(subj.id)) {
        seen.add(subj.id)
        courses.push({
          subject_id: subj.id,
          subject_name: subj.name,
          subject_code: subj.code || '',
          description: '',
          teacher_name: (entry as any).teacher?.profile
            ? `${(entry as any).teacher.profile.first_name || ''} ${(entry as any).teacher.profile.last_name || ''}`.trim()
            : 'Unassigned',
        })
      }
    }
    return courses
  }

  /**
   * Get class pictures: section's course periods with teacher + all classmates + photos
   */
  async getStudentClassPictures(studentId: string) {
    const { data: student, error: sErr } = await supabase
      .from('students')
      .select('section_id, school_id')
      .eq('id', studentId)
      .single()

    if (sErr || !student?.section_id) return { course_periods: [], students: [] }

    const mainSchoolId = await getMainSchoolId(student.school_id)

    const { data: academicYear } = await supabase
      .from('academic_years')
      .select('id')
      .eq('school_id', mainSchoolId)
      .eq('is_current', true)
      .maybeSingle()

    // Get course periods for this section (section_id is campus-scoped UUID)
    const { data: coursePeriods } = await supabase
      .from('course_periods')
      .select(`
        id, title, short_name,
        course:courses!course_id(id, title, short_name),
        period:periods!period_id(id, title, short_name, sort_order),
        teacher:staff!teacher_id(
          id,
          profile:profiles!profile_id(first_name, last_name, profile_photo_url)
        )
      `)
      .eq('section_id', student.section_id)

    // Get all students in the same section with photos
    const { data: classmates } = await supabase
      .from('students')
      .select(`
        id,
        student_number,
        profile:profiles!profile_id(first_name, father_name, last_name, profile_photo_url)
      `)
      .eq('section_id', student.section_id)
      .eq('school_id', student.school_id)

    const cpList = (coursePeriods || []).map((cp: any) => ({
      id: cp.id,
      title: cp.title || cp.short_name || cp.course?.title || 'Course',
      course_title: cp.course?.title || cp.title,
      teacher_name: cp.teacher?.profile
        ? `${cp.teacher.profile.first_name} ${cp.teacher.profile.last_name}`.trim()
        : null,
      teacher_photo_url: cp.teacher?.profile?.profile_photo_url || null,
    }))

    const studentList = (classmates || []).map((s: any) => ({
      id: s.id,
      student_number: s.student_number,
      name: s.profile
        ? `${s.profile.first_name || ''} ${s.profile.last_name || ''}`.trim()
        : 'Unknown',
      photo_url: s.profile?.profile_photo_url || null,
      is_self: s.id === studentId,
    })).sort((a: any, b: any) => a.name.localeCompare(b.name))

    return { course_periods: cpList, students: studentList }
  }

  /**
   * Get published lesson plans for student's enrolled course periods
   */
  async getStudentLessonPlans(studentId: string, coursePeriodId?: string) {
    const { data: student, error: sErr } = await supabase
      .from('students')
      .select('section_id, school_id')
      .eq('id', studentId)
      .single()

    if (sErr || !student?.section_id) return { course_periods: [], lessons: [] }

    const mainSchoolId = await getMainSchoolId(student.school_id)

    // Get student's course periods via their section (section_id is campus-scoped UUID)
    const { data: coursePeriods } = await supabase
      .from('course_periods')
      .select(`
        id, title,
        course:courses!course_id(id, title),
        period:periods!period_id(id, title, short_name),
        teacher:staff!teacher_id(id, profile:profiles!profile_id(first_name, last_name))
      `)
      .eq('section_id', student.section_id)

    const allowedIds = new Set((coursePeriods || []).map((cp: any) => cp.id))

    // If a specific course_period_id is requested, verify enrollment
    const targetCpId = coursePeriodId && allowedIds.has(coursePeriodId) ? coursePeriodId : null
    if (coursePeriodId && !targetCpId) return { course_periods: [], lessons: [] }

    // Fetch published lesson plans
    let query = supabase
      .from('lesson_plan_lessons')
      .select(`
        id, title, on_date, lesson_number, length_minutes,
        learning_objectives, evaluation, inclusiveness,
        course_period_id,
        items:lesson_plan_items(id, sort_order, time_minutes, teacher_activity, learner_activity, formative_assessment, learning_materials),
        files:lesson_plan_files(id, file_name, file_url, file_type)
      `)
      .eq('school_id', mainSchoolId)
      .eq('is_published', true)
      .order('on_date', { ascending: false })
      .order('lesson_number', { ascending: true })

    if (targetCpId) {
      query = query.eq('course_period_id', targetCpId)
    } else {
      query = query.in('course_period_id', Array.from(allowedIds))
    }

    const { data: lessons } = await query

    const cpMap = new Map((coursePeriods || []).map((cp: any) => [cp.id, cp]))

    const lessonList = (lessons || []).map((l: any) => ({
      ...l,
      items: (l.items || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
      course_period: cpMap.get(l.course_period_id) || null,
    }))

    const cpList = (coursePeriods || []).map((cp: any) => ({
      id: cp.id,
      title: cp.title || cp.course?.title || 'Course',
      course_title: cp.course?.title,
      teacher_name: cp.teacher?.profile
        ? `${cp.teacher.profile.first_name} ${cp.teacher.profile.last_name}`.trim()
        : null,
    }))

    return { course_periods: cpList, lessons: lessonList }
  }

  /**
   * Get exam results for student grouped by subject (Final Grades view)
   */
  async getStudentFinalGrades(studentId: string) {
    const { data: results, error } = await supabase
      .from('exam_results')
      .select(`
        id,
        marks_obtained,
        exam:exams!inner(
          id,
          exam_name,
          max_marks,
          exam_date,
          exam_type:exam_types(name),
          subject:subjects(id, name, code)
        )
      `)
      .eq('student_id', studentId)
      .not('marks_obtained', 'is', null)
      .order('exam(exam_date)', { ascending: false })

    if (error) return []

    // Group by subject
    const subjectMap = new Map<string, {
      subject_id: string
      subject_name: string
      subject_code: string
      total_obtained: number
      total_possible: number
      exams: any[]
    }>()

    for (const r of results || []) {
      const exam = (r as any).exam
      const subject = exam?.subject
      if (!subject) continue
      if (!subjectMap.has(subject.id)) {
        subjectMap.set(subject.id, {
          subject_id: subject.id,
          subject_name: subject.name,
          subject_code: subject.code,
          total_obtained: 0,
          total_possible: 0,
          exams: [],
        })
      }
      const entry = subjectMap.get(subject.id)!
      entry.total_obtained += r.marks_obtained
      entry.total_possible += exam.max_marks || 100
      entry.exams.push({
        exam_id: exam.id,
        exam_name: exam.exam_name,
        exam_type: exam.exam_type?.name || 'Exam',
        exam_date: exam.exam_date,
        marks_obtained: r.marks_obtained,
        max_marks: exam.max_marks || 100,
      })
    }

    return Array.from(subjectMap.values()).map(s => ({
      ...s,
      percentage: s.total_possible > 0 ? Math.round((s.total_obtained / s.total_possible) * 1000) / 10 : 0,
      grade: this.calculateGrade(s.total_possible > 0 ? (s.total_obtained / s.total_possible) * 100 : 0),
    }))
  }

  /**
   * Get GPA and class rank for student
   */
  async getStudentGpaRank(studentId: string) {
    const { data: student } = await supabase
      .from('students')
      .select('section_id, school_id')
      .eq('id', studentId)
      .single()

    if (!student?.section_id) return { gpa: null, rank: null, total_students: null, percentage: null }

    // Get this student's average from gradebook
    const { data: myGrades } = await supabase
      .from('gradebook_grades')
      .select('points, assignment:gradebook_assignments(points)')
      .eq('student_id', studentId)
      .not('points', 'is', null)

    const myEarned = (myGrades || []).reduce((s: number, g: any) => s + (g.points || 0), 0)
    const myPossible = (myGrades || []).reduce((s: number, g: any) => s + (g.assignment?.points || 0), 0)
    const myPercent = myPossible > 0 ? (myEarned / myPossible) * 100 : 0

    // Get section roster to compute rank
    const { data: sectionStudents } = await supabase
      .from('students')
      .select('id')
      .eq('section_id', student.section_id)
      .eq('is_active', true)

    const studentIds = (sectionStudents || []).map((s: any) => s.id)

    const { data: allGrades } = await supabase
      .from('gradebook_grades')
      .select('student_id, points, assignment:gradebook_assignments(points)')
      .in('student_id', studentIds)
      .not('points', 'is', null)

    // Compute average per student
    const studentAverages = new Map<string, number>()
    for (const g of allGrades || []) {
      const sid = (g as any).student_id
      if (!studentAverages.has(sid)) studentAverages.set(sid, 0)
    }
    // Calculate each student's percentage
    const earned = new Map<string, number>()
    const possible = new Map<string, number>()
    for (const g of allGrades || []) {
      const sid = (g as any).student_id
      earned.set(sid, (earned.get(sid) || 0) + (g.points || 0))
      possible.set(sid, (possible.get(sid) || 0) + ((g as any).assignment?.points || 0))
    }
    for (const sid of studentIds) {
      const p = possible.get(sid) || 0
      const e = earned.get(sid) || 0
      studentAverages.set(sid, p > 0 ? (e / p) * 100 : 0)
    }

    // Rank (1 = best)
    const sorted = Array.from(studentAverages.entries()).sort((a, b) => b[1] - a[1])
    const rank = sorted.findIndex(([sid]) => sid === studentId) + 1

    const gpa4 = myPercent >= 93 ? 4.0
      : myPercent >= 90 ? 3.7
      : myPercent >= 87 ? 3.3
      : myPercent >= 83 ? 3.0
      : myPercent >= 80 ? 2.7
      : myPercent >= 77 ? 2.3
      : myPercent >= 73 ? 2.0
      : myPercent >= 70 ? 1.7
      : myPercent >= 67 ? 1.3
      : myPercent >= 60 ? 1.0
      : 0.0

    return {
      gpa: Math.round(gpa4 * 100) / 100,
      rank: rank > 0 ? rank : null,
      total_students: studentIds.length,
      percentage: Math.round(myPercent * 10) / 10,
      grade: this.calculateGrade(myPercent),
    }
  }

  private calculateGrade(percentage: number): string {
    if (percentage >= 93) return 'A'
    if (percentage >= 90) return 'A-'
    if (percentage >= 87) return 'B+'
    if (percentage >= 83) return 'B'
    if (percentage >= 80) return 'B-'
    if (percentage >= 77) return 'C+'
    if (percentage >= 73) return 'C'
    if (percentage >= 70) return 'C-'
    if (percentage >= 60) return 'D'
    return 'F'
  }

  /**
   * Get comprehensive student info (General Info + Addresses & Contacts)
   */
  async getStudentInfo(studentId: string) {
    const { data: student, error } = await supabase
      .from('students')
      .select('id, student_number, grade_level, section_id, school_id, profile_id, created_at')
      .eq('id', studentId)
      .single()

    if (error || !student) throw new Error('Student not found')

    const [profileRes, sectionRes, schoolRes] = await Promise.all([
      supabase.from('profiles')
        .select('first_name, father_name, grandfather_name, last_name, email, phone, date_of_birth, gender, address, profile_photo_url')
        .eq('id', student.profile_id)
        .single(),
      supabase.from('sections')
        .select('id, name, grade_level_id')
        .eq('id', student.section_id)
        .maybeSingle(),
      supabase.from('schools')
        .select('id, name, address, phone')
        .eq('id', student.school_id)
        .maybeSingle(),
    ])

    let gradeLevelName: string | null = null
    if (sectionRes.data?.grade_level_id) {
      const { data: gl } = await supabase
        .from('grade_levels')
        .select('name')
        .eq('id', sectionRes.data.grade_level_id)
        .single()
      gradeLevelName = gl?.name || null
    }

    const profile = profileRes.data
    const section = sectionRes.data
    const school = schoolRes.data

    const now = new Date()
    let age: string | null = null
    if (profile?.date_of_birth) {
      const dob = new Date(profile.date_of_birth)
      const years = now.getFullYear() - dob.getFullYear()
      const months = now.getMonth() - dob.getMonth()
      const days = now.getDate() - dob.getDate()
      const adjMonths = days < 0 ? months - 1 : months
      const adjYears = adjMonths < 0 ? years - 1 : years
      const finalMonths = ((adjMonths % 12) + 12) % 12
      const finalDays = days < 0
        ? new Date(now.getFullYear(), now.getMonth(), 0).getDate() + days
        : days
      age = `${adjYears} Years ${finalMonths} Months ${finalDays} Days`
    }

    return {
      id: student.id,
      student_number: student.student_number,
      grade_level: student.grade_level,
      admission_date: student.created_at,
      first_name: profile?.first_name || null,
      father_name: profile?.father_name || null,
      grandfather_name: profile?.grandfather_name || null,
      last_name: profile?.last_name || null,
      email: profile?.email || null,
      phone: profile?.phone || null,
      date_of_birth: profile?.date_of_birth || null,
      age,
      gender: profile?.gender || null,
      address: profile?.address || null,
      profile_photo_url: profile?.profile_photo_url || null,
      section_name: section?.name || null,
      grade_level_name: gradeLevelName,
      school_name: school?.name || null,
      school_address: school?.address || null,
      school_phone: school?.phone || null,
    }
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
