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
  /**
   * True only when a past year was selected, totalStudents came back 0, and
   * that's because NO student_enrollment rows exist for this school in that
   * year at all — i.e. a genuine data-availability gap (never backfilled),
   * not an actually-empty year. Lets the frontend show "no enrollment
   * records for this year" instead of a bare 0 that reads as "0 students
   * were ever here," which is a different and more alarming claim.
   */
  noEnrollmentDataForYear: boolean
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
  async getSchoolStats(schoolId: string, campusId?: string, academicYearId?: string): Promise<SchoolDashboardStats> {
    // Campus-scoped tables use campusId when provided; school-wide tables always use schoolId
    const effectiveId = campusId || schoolId

    try {
      // Get student count — active only, so this matches the roster shown on
      // the student list page (which defaults to active students) instead of
      // also counting withdrawn/inactive students. When an academic year is
      // selected, further restrict to students who actually have an
      // enrollment record for that year (student_enrollment), so switching
      // years reflects real per-year enrollment instead of the school's
      // all-time active student count.
      //
      // Past years must be FROZEN HISTORY: a student's enrollment row for a
      // past year is never touched by later actions (see
      // student.service.ts's closeCurrentYearEnrollment/
      // reopenCurrentYearEnrollment, which only ever write to the CURRENT
      // year's row), so for a non-current year, "were they enrolled" is
      // answered purely by "does a student_enrollment row exist for that
      // year" — no end_date filter, no profiles.is_active check (that flag
      // reflects the student's status TODAY, not back then).
      //
      // The current year is different: student_enrollment rows are created
      // best-effort at student-creation time (enrollInCurrentYear —
      // deliberately never throws, e.g. when no academic year was configured
      // yet) and a one-time backfill (migration 292) covers students that
      // existed before that write path did. A narrow grandfather fallback is
      // kept for the current year only, as a safety net against any future
      // code path that might still fail to create an enrollment row — an
      // active student with zero enrollment rows at all is still counted.
      // This fallback must NOT extend to past years, since that's exactly
      // what caused every student to show up in every year.
      let eligibleStudentIds: string[] | null = null
      let noEnrollmentDataForYear = false
      if (academicYearId) {
        const { data: yearRow, error: yearErr } = await supabase
          .from('academic_years')
          .select('is_current')
          .eq('id', academicYearId)
          .maybeSingle()
        if (yearErr) console.error('Academic year lookup error:', yearErr)
        const isCurrentYear = !!yearRow?.is_current

        if (isCurrentYear) {
          const { data: activeStudents, error: activeErr } = await supabase
            .from('students')
            .select('id, profile:profiles!inner(is_active)')
            .eq('school_id', effectiveId)
            .eq('profile.is_active', true)
          if (activeErr) console.error('Students query error:', activeErr)

          const activeIds = (activeStudents || []).map((s: any) => s.id as string)
          if (activeIds.length === 0) {
            eligibleStudentIds = []
          } else {
            const { data: enrollmentRows, error: enrollErr } = await supabase
              .from('student_enrollment')
              .select('student_id, academic_year_id, end_date')
              .in('student_id', activeIds)
            if (enrollErr) console.error('Enrollment query error:', enrollErr)

            const enrolledThisYear = new Set(
              (enrollmentRows || [])
                .filter((e: any) => e.academic_year_id === academicYearId && e.end_date === null)
                .map((e: any) => e.student_id as string)
            )
            const hasAnyEnrollment = new Set((enrollmentRows || []).map((e: any) => e.student_id as string))

            eligibleStudentIds = activeIds.filter((id) => enrolledThisYear.has(id) || !hasAnyEnrollment.has(id))
          }
        } else {
          // Past (or future) year: frozen history — presence of a row is the
          // only signal, regardless of end_date or today's profiles.is_active.
          const { data: enrollmentRows, error: enrollErr } = await supabase
            .from('student_enrollment')
            .select('student_id')
            .eq('academic_year_id', academicYearId)
            .eq('campus_id', effectiveId)
          if (enrollErr) console.error('Enrollment query error:', enrollErr)

          eligibleStudentIds = Array.from(new Set((enrollmentRows || []).map((e: any) => e.student_id as string)))

          // Distinguish "genuinely 0 students this year" from "no
          // historical data was ever recorded for this year" — only the
          // latter gets the distinct empty-state message. A second, cheap
          // existence check unscoped by student: any row at all for this
          // academic_year_id/campus means real (if sparse) history exists.
          if (eligibleStudentIds.length === 0) {
            const { count: anyRowCount, error: anyRowErr } = await supabase
              .from('student_enrollment')
              .select('student_id', { count: 'exact', head: true })
              .eq('academic_year_id', academicYearId)
              .eq('campus_id', effectiveId)
            if (anyRowErr) console.error('Enrollment existence check error:', anyRowErr)
            noEnrollmentDataForYear = (anyRowCount ?? 0) === 0
          }
        }
      }

      // Calculate attendance rate (last 30 days) and today's present count
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const todayStr = new Date().toISOString().split('T')[0]

      // The remaining ~10 lookups below have no data dependency on each other
      // (only on eligibleStudentIds, already resolved above) — running them
      // sequentially was pure added latency. Fired concurrently instead.
      const [
        studentsRes,
        staffCountRes,
        staffWithProfilesRes,
        coursesRes,
        eventsRes,
        booksRes,
        transactionsRes,
        attendanceRes,
        studentGenderRes,
        staffGenderRes,
        parentsRes,
      ] = await Promise.all([
        eligibleStudentIds !== null
          ? Promise.resolve({ count: eligibleStudentIds.length, error: null as unknown })
          : supabase
              .from('students')
              .select('*, profile:profiles!inner(is_active)', { count: 'exact', head: true })
              .eq('school_id', effectiveId)
              .eq('profile.is_active', true),
        supabase
          .from('staff')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', effectiveId),
        supabase
          .from('staff')
          .select(`
            id,
            profile:profiles!staff_profile_id_fkey(role)
          `)
          .eq('school_id', effectiveId),
        supabase
          .from('sections')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', effectiveId),
        supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', effectiveId)
          .gte('end_date', new Date().toISOString()),
        supabase
          .from('books')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', effectiveId),
        supabase
          .from('book_transactions')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', effectiveId)
          .eq('status', 'borrowed'),
        supabase
          .from('attendance_records')
          .select('status, attendance_date')
          .eq('school_id', effectiveId)
          .gte('attendance_date', thirtyDaysAgo.toISOString().split('T')[0]),
        eligibleStudentIds !== null
          ? (eligibleStudentIds.length === 0
              ? Promise.resolve({ data: [] as { custom_fields: any }[], error: null as unknown })
              : supabase.from('students').select('custom_fields').in('id', eligibleStudentIds))
          : supabase
              .from('students')
              .select('custom_fields, profile:profiles!inner(is_active)')
              .eq('school_id', effectiveId)
              .eq('profile.is_active', true),
        supabase
          .from('staff')
          .select('custom_fields, profile:profiles!staff_profile_id_fkey(gender)')
          .eq('school_id', effectiveId),
        // Parents belong to the main school, so we count all registered parents (schoolId, not effectiveId)
        supabase
          .from('parents')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', schoolId),
      ])

      if (studentsRes.error) console.error('Students query error:', studentsRes.error)
      if (staffCountRes.error) console.error('Staff query error:', staffCountRes.error)
      if (staffWithProfilesRes.error) console.error('Teachers query error:', staffWithProfilesRes.error)
      if (coursesRes.error) console.error('Sections query error:', coursesRes.error)
      if (eventsRes.error) console.error('Events query error:', eventsRes.error)
      if (booksRes.error) console.error('Books query error:', booksRes.error)
      if (transactionsRes.error) console.error('Transactions query error:', transactionsRes.error)
      if (attendanceRes.error) console.error('Attendance query error:', attendanceRes.error)
      if (studentGenderRes.error) console.error('Student gender query error:', studentGenderRes.error)
      if (staffGenderRes.error) console.error('Staff gender query error:', staffGenderRes.error)
      if (parentsRes.error) console.error('Parents query error:', parentsRes.error)

      const totalStudents = studentsRes.count || 0
      const totalStaff = staffCountRes.count || 0

      // Filter to only count staff where profile.role = 'teacher'
      const staffWithProfiles = (staffWithProfilesRes as any).data as { id: string; profile: { role: string } | null }[] | null
      const totalTeachers = staffWithProfiles?.filter((staff: any) =>
        staff.profile?.role === 'teacher'
      ).length || 0

      const activeCourses = coursesRes.count || 0
      const activeEvents = eventsRes.count || 0
      const libraryBooks = booksRes.count || 0
      const borrowedBooks = transactionsRes.count || 0

      const attendanceRecords = (attendanceRes as any).data as { status: string; attendance_date: string }[] | null
      const presentCount = attendanceRecords?.filter(r => r.status === 'present').length || 0
      const totalRecords = attendanceRecords?.length || 1
      const attendanceRate = (presentCount / totalRecords) * 100
      const todayPresentStudents = attendanceRecords?.filter(
        r => r.status === 'present' && r.attendance_date === todayStr
      ).length || 0

      // Student gender breakdown — same eligible-student set as totalStudents
      // above (see the grandfathering note there).
      const studentCustomFields = (studentGenderRes as any).data as { custom_fields: any }[] | null
      const maleStudents = studentCustomFields?.filter((s: any) => s.custom_fields?.personal?.gender === 'male').length || 0
      const femaleStudents = studentCustomFields?.filter((s: any) => s.custom_fields?.personal?.gender === 'female').length || 0

      // Staff gender breakdown
      const staffProfiles = (staffGenderRes as any).data as { custom_fields: any; profile: { gender: string } | null }[] | null
      const maleStaff = staffProfiles?.filter((s: any) =>
        (s.profile?.gender || s.custom_fields?.personal?.gender) === 'male'
      ).length || 0
      const femaleStaff = staffProfiles?.filter((s: any) =>
        (s.profile?.gender || s.custom_fields?.personal?.gender) === 'female'
      ).length || 0

      const totalParents = parentsRes.count || 0

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
        femaleStaff,
        noEnrollmentDataForYear
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
  async getClassBreakdown(schoolId: string, campusId?: string, academicYearId?: string) {
    const effectiveId = campusId || schoolId

    // When a specific academic year is selected, read grade/section off that
    // year's student_enrollment record rather than the students table's
    // grade_level_id/section_id snapshot - the latter is kept in sync with
    // the *current* year only (see sync_student_current_enrollment trigger),
    // so it would show today's placement even while looking at a past or
    // future year.
    //
    // Past years are FROZEN HISTORY (see the matching note in getSchoolStats
    // above): presence of a student_enrollment row for that year is the only
    // signal — no end_date filter, no profiles.is_active check, no
    // grandfathering. Only the CURRENT year keeps the legacy-grandfather
    // fallback (a student with zero enrollment rows at all still counts),
    // since migration 292 backfilled existing students for the current year
    // and this stays purely as a safety net going forward.
    let rows: { grade: any; section: any }[] | null = null
    let error: any = null

    if (academicYearId) {
      const { data: yearRow, error: yearErr } = await supabase
        .from('academic_years')
        .select('is_current')
        .eq('id', academicYearId)
        .maybeSingle()
      if (yearErr) console.error('Academic year lookup error:', yearErr)
      const isCurrentYear = !!yearRow?.is_current

      if (isCurrentYear) {
        const enrolledResult = await supabase
          .from('student_enrollment')
          .select('student_id, grade:grade_levels!student_enrollment_grade_level_id_fkey(name, order_index), section:sections(name), student:students!inner(school_id, profile:profiles!inner(is_active))')
          .eq('academic_year_id', academicYearId)
          .eq('campus_id', effectiveId)
          .is('end_date', null)
          .eq('student.school_id', effectiveId)
          .eq('student.profile.is_active', true)
        error = enrolledResult.error

        const { data: activeStudents } = await supabase
          .from('students')
          .select('id, grade:grade_levels(name, order_index), section:sections(name), profile:profiles!inner(is_active)')
          .eq('school_id', effectiveId)
          .eq('profile.is_active', true)
        const activeIds = (activeStudents || []).map((s: any) => s.id as string)

        const hasAnyEnrollment = new Set<string>()
        if (activeIds.length > 0) {
          const { data: enrollmentRows } = await supabase
            .from('student_enrollment')
            .select('student_id')
            .in('student_id', activeIds)
          ;(enrollmentRows || []).forEach((e: any) => hasAnyEnrollment.add(e.student_id))
        }
        const legacyRows = (activeStudents || []).filter((s: any) => !hasAnyEnrollment.has(s.id))

        rows = [...(enrolledResult.data || []), ...legacyRows]
      } else {
        const pastResult = await supabase
          .from('student_enrollment')
          .select('student_id, grade:grade_levels!student_enrollment_grade_level_id_fkey(name, order_index), section:sections(name)')
          .eq('academic_year_id', academicYearId)
          .eq('campus_id', effectiveId)
        rows = pastResult.data as any
        error = pastResult.error
      }
    } else {
      const result = await supabase
        .from('students')
        .select('grade:grade_levels(name, order_index), section:sections(name), profile:profiles!inner(is_active)')
        .eq('school_id', effectiveId)
        .eq('profile.is_active', true)
      rows = result.data as any
      error = result.error
    }

    if (error) {
      console.error('Class breakdown query error:', error)
    }

    const grades = new Map<
      string,
      { grade: string; gradeOrder: number; total: number; sections: Map<string, number> }
    >()

    rows?.forEach((row: any) => {
      const grade = row.grade?.name || 'Unassigned'
      const gradeOrder = row.grade?.order_index ?? Number.MAX_SAFE_INTEGER
      const section = row.section?.name || 'Unassigned'

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
