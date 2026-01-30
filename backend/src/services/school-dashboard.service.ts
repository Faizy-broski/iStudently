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
  async getSchoolStats(schoolId: string): Promise<SchoolDashboardStats> {
    try {
      // Get student count
      const { count: totalStudents, error: studentsError } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)

      if (studentsError) {
        console.error('Students query error:', studentsError)
      }

      // Get teacher/staff count
      const { count: totalStaff, error: staffError } = await supabase
        .from('staff')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)

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
        .eq('school_id', schoolId)

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
        .eq('school_id', schoolId)

      if (coursesError) {
        console.error('Sections query error:', coursesError)
      }

      // Get active events
      const { count: activeEvents, error: eventsError } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .gte('end_date', new Date().toISOString())

      if (eventsError) {
        console.error('Events query error:', eventsError)
      }

      // Get library statistics
      const { count: libraryBooks, error: booksError } = await supabase
        .from('books')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)

      if (booksError) {
        console.error('Books query error:', booksError)
      }

      const { count: borrowedBooks, error: transactionsError } = await supabase
        .from('book_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('status', 'borrowed')

      if (transactionsError) {
        console.error('Transactions query error:', transactionsError)
      }

      // Calculate attendance rate (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('school_id', schoolId)
        .gte('attendance_date', thirtyDaysAgo.toISOString().split('T')[0])

      if (attendanceError) {
        console.error('Attendance query error:', attendanceError)
      }

      const presentCount = attendanceRecords?.filter(r => r.status === 'present').length || 0
      const totalRecords = attendanceRecords?.length || 1
      const attendanceRate = (presentCount / totalRecords) * 100

      const result = {
        totalStudents: totalStudents || 0,
        totalTeachers,
        totalStaff: totalStaff || 0,
        activeCourses: activeCourses || 0,
        activeEvents: activeEvents || 0,
        libraryBooks: libraryBooks || 0,
        borrowedBooks: borrowedBooks || 0,
        attendanceRate: parseFloat(attendanceRate.toFixed(1))
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
    const { data: students } = await supabase
      .from('students')
      .select('grade_level')
      .eq('school_id', schoolId)

    const distribution: Record<string, number> = {}
    students?.forEach(student => {
      const grade = student.grade_level || 'Unassigned'
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
}
