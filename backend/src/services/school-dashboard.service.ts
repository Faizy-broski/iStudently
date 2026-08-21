import { supabase } from '../config/supabase'

interface SchoolDashboardStats {
  totalStudents: number
  totalTeachers: number
  totalStaff: number
  activeCourses: number
  activeEvents: number
  libraryBooks: number
  borrowedBooks: number
  attendanceRate: number
  todayPresentStudents: number
  totalParents: number
  maleStudents: number
  femaleStudents: number
  maleStaff: number
  femaleStaff: number
}

interface AttendanceData {
  date: string
  present: number
  absent: number
  rate: number
}

interface StudentGrowth {
  month: string
  students: number
}

export class SchoolDashboardService {
  /**
   * Get dashboard statistics for a specific school
   */
  async getSchoolStats(schoolId: string, campusId?: string): Promise<SchoolDashboardStats> {
    // Campus-scoped tables use campusId when provided; school-wide tables always use schoolId
    const effectiveId = campusId || schoolId

    try {
      // Get student count — active only, so this matches the roster shown on
      // the student list page (which defaults to active students) instead of
      // also counting withdrawn/inactive students.
      const { count: totalStudents, error: studentsError } = await supabase
        .from('students')
        .select('*, profile:profiles!inner(is_active)', { count: 'exact', head: true })
        .eq('school_id', effectiveId)
        .eq('profile.is_active', true)

      if (studentsError) {
        console.error('Students query error:', studentsError)
      }

      // Get teacher/staff count
      const { count: totalStaff, error: staffError } = await supabase
        .from('staff')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', effectiveId)

      if (staffError) {
        console.error('Staff query error:', staffError)
      }

      // Get teachers count by joining with profiles table
      const { data: staffWithProfiles, error: teachersError } = await supabase
        .from('staff')
        .select(`
          id,
          profile:profiles!staff_profile_id_fkey(role)
        `)
        .eq('school_id', effectiveId)

      if (teachersError) {
        console.error('Teachers query error:', teachersError)
      }

      // Filter to only count staff where profile.role = 'teacher'
      const totalTeachers = staffWithProfiles?.filter((staff: any) =>
        staff.profile?.role === 'teacher'
      ).length || 0

      // Get active courses/sections
      const { count: activeCourses, error: coursesError } = await supabase
        .from('sections')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', effectiveId)

      if (coursesError) {
        console.error('Sections query error:', coursesError)
      }

      // Get active events
      const { count: activeEvents, error: eventsError } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', effectiveId)
        .gte('end_date', new Date().toISOString())

      if (eventsError) {
        console.error('Events query error:', eventsError)
      }

      // Get library statistics
      const { count: libraryBooks, error: booksError } = await supabase
        .from('books')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', effectiveId)

      if (booksError) {
        console.error('Books query error:', booksError)
      }

      const { count: borrowedBooks, error: transactionsError } = await supabase
        .from('book_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', effectiveId)
        .eq('status', 'borrowed')

      if (transactionsError) {
        console.error('Transactions query error:', transactionsError)
      }

      // Calculate attendance rate (last 30 days) and today's present count
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const todayStr = new Date().toISOString().split('T')[0]

      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('status, attendance_date')
        .eq('school_id', effectiveId)
        .gte('attendance_date', thirtyDaysAgo.toISOString().split('T')[0])

      if (attendanceError) {
        console.error('Attendance query error:', attendanceError)
      }

      const presentCount = attendanceRecords?.filter(r => r.status === 'present').length || 0
      const totalRecords = attendanceRecords?.length || 1
      const attendanceRate = (presentCount / totalRecords) * 100
      const todayPresentStudents = attendanceRecords?.filter(
        r => r.status === 'present' && r.attendance_date === todayStr
      ).length || 0

      // Get student gender breakdown — active only, to match totalStudents above
      const { data: studentCustomFields, error: studentGenderError } = await supabase
        .from('students')
        .select('custom_fields, profile:profiles!inner(is_active)')
        .eq('school_id', effectiveId)
        .eq('profile.is_active', true)

      if (studentGenderError) {
        console.error('Student gender query error:', studentGenderError)
      }

      const maleStudents = studentCustomFields?.filter((s: any) => s.custom_fields?.personal?.gender === 'male').length || 0
      const femaleStudents = studentCustomFields?.filter((s: any) => s.custom_fields?.personal?.gender === 'female').length || 0

      // Get staff gender breakdown
      const { data: staffProfiles, error: staffGenderError } = await supabase
        .from('staff')
        .select('custom_fields, profile:profiles!staff_profile_id_fkey(gender)')
        .eq('school_id', effectiveId)

      if (staffGenderError) {
        console.error('Staff gender query error:', staffGenderError)
      }

      const maleStaff = staffProfiles?.filter((s: any) =>
        (s.profile?.gender || s.custom_fields?.personal?.gender) === 'male'
      ).length || 0
      const femaleStaff = staffProfiles?.filter((s: any) =>
        (s.profile?.gender || s.custom_fields?.personal?.gender) === 'female'
      ).length || 0

      // Get total parents count — parents belong to the main school, so we count all registered parents
      const { count, error: parentsError } = await supabase
        .from('parents')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)

      if (parentsError) {
        console.error('Parents query error:', parentsError)
      }
      const totalParents = count || 0

      const result = {
        totalStudents: totalStudents || 0,
        totalTeachers,
        totalStaff: totalStaff || 0,
        activeCourses: activeCourses || 0,
        activeEvents: activeEvents || 0,
        libraryBooks: libraryBooks || 0,
        borrowedBooks: borrowedBooks || 0,
        attendanceRate: parseFloat(attendanceRate.toFixed(1)),
        todayPresentStudents,
        totalParents: totalParents || 0,
        maleStudents,
        femaleStudents,
        maleStaff,
        femaleStaff
      }

      return result
    } catch (error) {
      console.error('❌ Error fetching school dashboard stats:', error)
      throw error
    }
  }

  /**
   * Get attendance data for the last 7 days
   */
  async getAttendanceData(schoolId: string): Promise<AttendanceData[]> {
    const today = new Date()
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(today.getDate() - 7)

    const { data: attendanceRecords, error } = await supabase
      .from('attendance_records')
      .select('attendance_date, status')
      .eq('school_id', schoolId)
      .gte('attendance_date', sevenDaysAgo.toISOString().split('T')[0])
      .lte('attendance_date', today.toISOString().split('T')[0])
      .order('attendance_date', { ascending: true })

    if (error) {
      console.error('Attendance data query error:', error)
    }

    // Group by date
    const attendanceByDate: Record<string, { present: number; absent: number }> = {}

    attendanceRecords?.forEach(record => {
      if (!attendanceByDate[record.attendance_date]) {
        attendanceByDate[record.attendance_date] = { present: 0, absent: 0 }
      }
      if (record.status === 'present') {
        attendanceByDate[record.attendance_date].present++
      } else if (record.status === 'absent') {
        attendanceByDate[record.attendance_date].absent++
      }
    })

    // Convert to array format
    const result: AttendanceData[] = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(today.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })

      const data = attendanceByDate[dateStr] || { present: 0, absent: 0 }
      const total = data.present + data.absent
      const rate = total > 0 ? (data.present / total) * 100 : 0

      result.push({
        date: dayName,
        present: data.present,
        absent: data.absent,
        rate: parseFloat(rate.toFixed(1))
      })
    }

    return result
  }

  /**
   * Get student enrollment growth for the current year
   */
  async getStudentGrowth(schoolId: string, year?: number): Promise<StudentGrowth[]> {
    const currentYear = year || new Date().getFullYear()
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    // Get all students for this school
    const { data: students } = await supabase
      .from('students')
      .select('created_at')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: true })

    if (!students || students.length === 0) {
      return monthNames.map(month => ({ month, students: 0 }))
    }

    // Count students before this year
    const studentsBeforeYear = students.filter(s =>
      new Date(s.created_at).getFullYear() < currentYear
    ).length

    // Group students by month for current year
    const studentsByMonth: Record<number, number> = {}
    students.forEach(student => {
      const date = new Date(student.created_at)
      if (date.getFullYear() === currentYear) {
        const month = date.getMonth()
        studentsByMonth[month] = (studentsByMonth[month] || 0) + 1
      }
    })

    // Build cumulative data
    let cumulative = studentsBeforeYear
    return monthNames.map((month, index) => {
      cumulative += studentsByMonth[index] || 0
      return { month, students: cumulative }
    })
  }

  /**
   * Get grade-wise student distribution
   */
  async getGradeDistribution(schoolId: string) {
    // Bucket by the live grade_levels name (via grade_level_id), not the
    // legacy grade_level text snapshot — that field is written once at
    // student creation/import and never updated, so renaming a grade level
    // later left old and new names showing as separate buckets here, and
    // "Unassigned" was inflated by every student whose snapshot was blank
    // despite having a real grade_level_id. Active students only, to match
    // the school-wide totalStudents count above.
    const { data: students } = await supabase
      .from('students')
      .select('grade_level, grade:grade_levels(name), profile:profiles!inner(is_active)')
      .eq('school_id', schoolId)
      .eq('profile.is_active', true)

    const distribution: Record<string, number> = {}
    students?.forEach((student: any) => {
      const grade = student.grade?.name || student.grade_level || 'Unassigned'
      distribution[grade] = (distribution[grade] || 0) + 1
    })

    return Object.entries(distribution)
      .map(([grade, count]) => ({ grade, count }))
      .sort((a, b) => {
        // Sort numerically where possible
        const aNum = parseInt(a.grade)
        const bNum = parseInt(b.grade)
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum
        return a.grade.localeCompare(b.grade)
      })
  }

  /**
   * Get student counts per grade and per section within each grade, for the
   * combined "grade distribution + students per class" dashboard widget.
   * Counted directly from the students table (active profiles only) rather
   * than trusting sections.current_strength, to stay consistent with the
   * other dashboard counts above.
   */
  async getClassBreakdown(schoolId: string, campusId?: string) {
    const effectiveId = campusId || schoolId

    const { data: students, error } = await supabase
      .from('students')
      .select('grade:grade_levels(name, order_index), section:sections(name), profile:profiles!inner(is_active)')
      .eq('school_id', effectiveId)
      .eq('profile.is_active', true)

    if (error) {
      console.error('Class breakdown query error:', error)
    }

    const grades = new Map<
      string,
      { grade: string; gradeOrder: number; total: number; sections: Map<string, number> }
    >()

    students?.forEach((student: any) => {
      const grade = student.grade?.name || 'Unassigned'
      const gradeOrder = student.grade?.order_index ?? Number.MAX_SAFE_INTEGER
      const section = student.section?.name || 'Unassigned'

      let bucket = grades.get(grade)
      if (!bucket) {
        bucket = { grade, gradeOrder, total: 0, sections: new Map() }
        grades.set(grade, bucket)
      }
      bucket.total++
      bucket.sections.set(section, (bucket.sections.get(section) || 0) + 1)
    })

    return Array.from(grades.values())
      .sort((a, b) => a.gradeOrder - b.gradeOrder)
      .map(({ grade, total, sections }) => ({
        grade,
        total,
        sections: Array.from(sections.entries())
          .map(([section, count]) => ({ section, count }))
          .sort((a, b) => a.section.localeCompare(b.section)),
      }))
  }
}
