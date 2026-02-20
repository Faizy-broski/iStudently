import { supabase } from '../config/supabase'
import {
  AddAbsencesDTO,
  AttendanceOverrideDTO,
  AttendanceDailyRecord,
  AttendanceCompletionRecord,
  TeacherCompletionStatus,
  ADAReportRow,
  ADAGradeRow,
  AttendanceChartData,
  AttendanceSummaryRow,
  DuplicateAttendanceRecord,
  DailySummaryGridResponse,
  ApiResponse
} from '../types'

// ============================================================================
// ATTENDANCE ADMIN SERVICE
// Handles: Add Absences, Teacher Completion, ADA, Chart, Summary,
//          Recalculate Daily, Delete Duplicates, Administration
// ============================================================================

// ============================================================================
// ADD ABSENCES (Admin adds absences for multiple students/periods at once)
// Mirrors RosarioSIS "Add Absences" menu item
// ============================================================================

/**
 * Admin-add absences for multiple students across multiple periods
 * Creates attendance_records with the given attendance_code, marks as admin_override
 */
export const addAbsences = async (
  dto: AddAbsencesDTO
): Promise<ApiResponse<{ created: number; updated: number }>> => {
  try {
    let created = 0
    let updated = 0

    for (const studentId of dto.student_ids) {
      for (const periodId of dto.period_ids) {
        // Find the timetable_entry for this student's section + period + date
        // We need the timetable_entry_id that matches
        let timetableQ = supabase
          .from('timetable_entries')
          .select('id, section_id')
          .eq('period_id', periodId)
          .eq('school_id', dto.school_id)
        if (dto.campus_id) timetableQ = timetableQ.eq('campus_id', dto.campus_id)
        const { data: timetableEntry } = await timetableQ.limit(1)

        // Get the student's section
        const { data: student } = await supabase
          .from('students')
          .select('section_id')
          .eq('id', studentId)
          .single()

        if (!student?.section_id) continue

        // Find the matching timetable entry for the student's section and period
        let matchQ = supabase
          .from('timetable_entries')
          .select('id')
          .eq('period_id', periodId)
          .eq('section_id', student.section_id)
          .eq('school_id', dto.school_id)
        if (dto.campus_id) matchQ = matchQ.eq('campus_id', dto.campus_id)
        const { data: matchingEntry } = await matchQ.limit(1).single()

        if (!matchingEntry) continue

        // Check if record already exists
        const { data: existing } = await supabase
          .from('attendance_records')
          .select('id')
          .eq('student_id', studentId)
          .eq('timetable_entry_id', matchingEntry.id)
          .eq('attendance_date', dto.attendance_date)
          .single()

        // Determine legacy status from attendance_code's state_code
        const { data: code } = await supabase
          .from('attendance_codes')
          .select('state_code')
          .eq('id', dto.attendance_code_id)
          .single()

        const legacyStatus = code?.state_code === 'P' ? 'present'
          : code?.state_code === 'H' ? 'late'
          : 'absent'

        if (existing) {
          // Update existing record
          await supabase
            .from('attendance_records')
            .update({
              attendance_code_id: dto.attendance_code_id,
              status: legacyStatus,
              admin_override: dto.admin_override ?? true,
              override_by: dto.override_by || null,
              override_reason: dto.reason || null,
              remarks: dto.reason || null,
              marked_at: new Date().toISOString()
            })
            .eq('id', existing.id)
          updated++
        } else {
          // Create new record
          await supabase
            .from('attendance_records')
            .insert({
              school_id: dto.school_id,
              campus_id: dto.campus_id || null,
              student_id: studentId,
              timetable_entry_id: matchingEntry.id,
              attendance_date: dto.attendance_date,
              attendance_code_id: dto.attendance_code_id,
              status: legacyStatus,
              admin_override: dto.admin_override ?? true,
              override_by: dto.override_by || null,
              override_reason: dto.reason || null,
              remarks: dto.reason || null,
              marked_by: dto.override_by || null,
              auto_generated: false
            })
          created++
        }
      }
    }

    return { success: true, data: { created, updated }, error: null }
  } catch (error: any) {
    console.error('Error adding absences:', error)
    return { success: false, data: null, error: error.message }
  }
}

/**
 * Override a single attendance record (admin changes teacher's entry)
 */
export const overrideAttendanceRecord = async (
  dto: AttendanceOverrideDTO
): Promise<ApiResponse<{ success: boolean }>> => {
  try {
    // Get state_code for the new code to map to legacy status
    const { data: code } = await supabase
      .from('attendance_codes')
      .select('state_code')
      .eq('id', dto.attendance_code_id)
      .single()

    const legacyStatus = code?.state_code === 'P' ? 'present'
      : code?.state_code === 'H' ? 'late'
      : 'absent'

    const { error } = await supabase
      .from('attendance_records')
      .update({
        attendance_code_id: dto.attendance_code_id,
        status: legacyStatus,
        admin_override: true,
        override_by: dto.override_by,
        override_reason: dto.override_reason,
        marked_at: new Date().toISOString()
      })
      .eq('id', dto.attendance_record_id)

    if (error) throw error

    return { success: true, data: { success: true }, error: null }
  } catch (error: any) {
    console.error('Error overriding attendance record:', error)
    return { success: false, data: null, error: error.message }
  }
}

// ============================================================================
// TEACHER COMPLETION (REPORTS > Teacher Completion)
// Queries attendance_completed table to show which teachers have submitted
// Mirrors RosarioSIS TeacherCompletion.php
// ============================================================================

/**
 * Get teacher completion status for a specific date
 * Only returns teachers who actually take attendance (have timetable entries).
 * Campus-aware: filters staff, periods, and completions by campus.
 */
export const getTeacherCompletion = async (
  schoolId: string,
  date: string,
  campusId?: string,
  periodFilter?: string
): Promise<ApiResponse<TeacherCompletionStatus[]>> => {
  try {
    // Get all active periods for the school (optionally filtered by campus)
    let periodsQuery = supabase
      .from('periods')
      .select('id, period_name, period_number, campus_id')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .eq('is_break', false)
      .order('period_number', { ascending: true })

    if (campusId) {
      periodsQuery = periodsQuery.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    const { data: periods, error: periodsError } = await periodsQuery
    if (periodsError) throw periodsError

    // Optionally filter to a single period
    let activePeriods = periods || []
    if (periodFilter) {
      activePeriods = activePeriods.filter(p => p.id === periodFilter)
    }

    if (activePeriods.length === 0) {
      return { success: true, data: [], error: null }
    }

    // Get staff who have timetable entries for these periods (teachers who take attendance)
    const periodIds = activePeriods.map(p => p.id)
    let timetableQuery = supabase
      .from('timetable_entries')
      .select('teacher_id, period_id, subjects(name), sections(name)')
      .eq('school_id', schoolId)
      .in('period_id', periodIds)
      .not('teacher_id', 'is', null)

    if (campusId) {
      timetableQuery = timetableQuery.eq('campus_id', campusId)
    }

    const { data: timetableEntries, error: ttError } = await timetableQuery
    if (ttError) throw ttError

    // Build set of teacher IDs who actually take attendance + which periods they teach
    // Also collect subject + section names per teacher-period for hover tooltips
    const teacherPeriodMap = new Map<string, Set<string>>()
    // key: "teacher_id:period_id" → array of { subject_name, section_name }
    const teacherPeriodCourses = new Map<string, { subject_name: string; section_name: string }[]>()
    for (const entry of (timetableEntries || [])) {
      if (!entry.teacher_id) continue
      if (!teacherPeriodMap.has(entry.teacher_id)) {
        teacherPeriodMap.set(entry.teacher_id, new Set())
      }
      teacherPeriodMap.get(entry.teacher_id)!.add(entry.period_id)

      const courseKey = `${entry.teacher_id}:${entry.period_id}`
      const subjectName = (entry as any).subjects?.name || ''
      const sectionName = (entry as any).sections?.name || ''
      if (!teacherPeriodCourses.has(courseKey)) {
        teacherPeriodCourses.set(courseKey, [])
      }
      // Avoid duplicate entries for same subject+section
      const existing = teacherPeriodCourses.get(courseKey)!
      if (!existing.some(c => c.subject_name === subjectName && c.section_name === sectionName)) {
        existing.push({ subject_name: subjectName, section_name: sectionName })
      }
    }

    const teacherIds = [...teacherPeriodMap.keys()]
    if (teacherIds.length === 0) {
      return { success: true, data: [], error: null }
    }

    // Get staff profiles
    // Note: staff.school_id = campus UUID (not parent school), so we don't filter
    // by school_id here. The teacherIds list is already scoped from the timetable query.
    const { data: staffList, error: staffError } = await supabase
      .from('staff')
      .select(`id, profiles!profile_id(first_name, last_name)`)
      .eq('is_active', true)
      .in('id', teacherIds)

    if (staffError) throw staffError

    // Get completion records
    let compQuery = supabase
      .from('attendance_completed')
      .select('staff_id, period_id')
      .eq('school_id', schoolId)
      .eq('school_date', date)

    const { data: completions, error: compError } = await compQuery
    if (compError) throw compError

    const completionLookup = new Set(
      (completions || []).map(c => `${c.staff_id}:${c.period_id}`)
    )

    // Build result — only show periods each teacher is assigned to
    const result: TeacherCompletionStatus[] = (staffList || [])
      .map((staff: any) => {
        const profile = staff.profiles
        const assignedPeriodIds = teacherPeriodMap.get(staff.id) || new Set()

        return {
          staff_id: staff.id,
          staff_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
          date,
          periods: activePeriods.map(p => ({
            period_id: p.id,
            period_name: p.period_name || `Period ${p.period_number}`,
            period_number: p.period_number,
            completed: completionLookup.has(`${staff.id}:${p.id}`),
            assigned: assignedPeriodIds.has(p.id),
            courses: teacherPeriodCourses.get(`${staff.id}:${p.id}`) || []
          }))
        }
      })
      .sort((a, b) => a.staff_name.localeCompare(b.staff_name))

    return { success: true, data: result, error: null }
  } catch (error: any) {
    console.error('Error fetching teacher completion:', error)
    return { success: false, data: null, error: error.message }
  }
}

// ============================================================================
// AVERAGE DAILY ATTENDANCE (REPORTS > Average Daily Attendance)
// Calculates ADA from attendance_daily table
// Mirrors RosarioSIS Average Daily Attendance report
// ============================================================================

/**
 * Get Average Daily Attendance for a date range
 * Aggregates from attendance_daily: state_value 1.0=present, 0.5=half, 0.0=absent
 */
export const getAverageDailyAttendance = async (
  schoolId: string,
  startDate: string,
  endDate: string,
  campusId?: string,
  gradeId?: string,
  sectionId?: string
): Promise<ApiResponse<ADAReportRow[]>> => {
  try {
    // Get daily records grouped by date
    let query = supabase
      .from('attendance_daily')
      .select(`
        attendance_date,
        state_value,
        total_minutes,
        minutes_present,
        student_id
      `)
      .eq('school_id', schoolId)
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDate)

    if (campusId) {
      query = query.eq('campus_id', campusId)
    }

    const { data: dailyRecords, error } = await query
    if (error) throw error

    // If filtering by grade/section, get student IDs
    let studentFilter: Set<string> | null = null
    if (gradeId || sectionId) {
      let studentQuery = supabase
        .from('students')
        .select('id')
        .eq('school_id', schoolId)

      if (sectionId) {
        studentQuery = studentQuery.eq('section_id', sectionId)
      } else if (gradeId) {
        // Get sections for this grade, then students
        const { data: sections } = await supabase
          .from('sections')
          .select('id')
          .eq('grade_id', gradeId)

        if (sections && sections.length > 0) {
          studentQuery = studentQuery.in('section_id', sections.map(s => s.id))
        }
      }

      const { data: students } = await studentQuery
      studentFilter = new Set((students || []).map(s => s.id))
    }

    // Group by date
    const dateMap = new Map<string, {
      total: number
      present: number
      absent: number
      half: number
      totalMinutes: number
      minutesPresent: number
    }>()

    for (const record of (dailyRecords || [])) {
      if (studentFilter && !studentFilter.has(record.student_id)) continue

      const entry = dateMap.get(record.attendance_date) || {
        total: 0, present: 0, absent: 0, half: 0,
        totalMinutes: 0, minutesPresent: 0
      }

      entry.total++
      if (record.state_value === 1.0) entry.present++
      else if (record.state_value === 0.5) entry.half++
      else entry.absent++

      entry.totalMinutes += record.total_minutes || 0
      entry.minutesPresent += record.minutes_present || 0

      dateMap.set(record.attendance_date, entry)
    }

    // Convert to result rows
    const result: ADAReportRow[] = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({
        date,
        total_enrolled: stats.total,
        total_present: stats.present,
        total_absent: stats.absent,
        total_half_day: stats.half,
        total_minutes_available: stats.totalMinutes,
        total_minutes_present: stats.minutesPresent,
        ada_percentage: stats.total > 0
          ? Math.round(((stats.present + stats.half * 0.5) / stats.total) * 10000) / 100
          : 0
      }))

    return { success: true, data: result, error: null }
  } catch (error: any) {
    console.error('Error fetching ADA report:', error)
    return { success: false, data: null, error: error.message }
  }
}

/**
 * Get Average Daily Attendance grouped by grade level (matches RosarioSIS).
 * Returns one row per grade + a Total row.
 */
export const getADAByGrade = async (
  schoolId: string,
  startDate: string,
  endDate: string,
  campusId?: string
): Promise<ApiResponse<ADAGradeRow[]>> => {
  try {
    // 1. Get school days count in range
    let calQ = supabase
      .from('attendance_calendar')
      .select('school_date', { count: 'exact' })
      .eq('school_id', schoolId)
      .eq('is_school_day', true)
      .gte('school_date', startDate)
      .lte('school_date', endDate)

    if (campusId) {
      calQ = calQ.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }
    const { count: schoolDays, error: calErr } = await calQ
    if (calErr) throw calErr
    const numSchoolDays = schoolDays || 0

    // 2. Get grades for school
    const { data: grades, error: gErr } = await supabase
      .from('grade_levels')
      .select('id, name, order_index')
      .eq('school_id', schoolId)
      .order('order_index', { ascending: true })
    if (gErr) throw gErr

    // 3. Get sections per grade
    const { data: sections, error: sErr } = await supabase
      .from('sections')
      .select('id, grade_id')
      .eq('school_id', schoolId)
    if (sErr) throw sErr

    const gradeToSections = new Map<string, string[]>()
    for (const s of (sections || [])) {
      const arr = gradeToSections.get(s.grade_id) || []
      arr.push(s.id)
      gradeToSections.set(s.grade_id, arr)
    }

    // 4. Get students and map to grade
    let studentsQ = supabase
      .from('students')
      .select('id, section_id')
      .eq('school_id', schoolId)
      .eq('is_active', true)

    if (campusId) {
      studentsQ = studentsQ.eq('campus_id', campusId)
    }

    const { data: students, error: stErr } = await studentsQ
    if (stErr) throw stErr

    // Map section -> grade
    const sectionToGrade = new Map<string, string>()
    for (const s of (sections || [])) {
      sectionToGrade.set(s.id, s.grade_id)
    }

    const studentToGrade = new Map<string, string>()
    for (const st of (students || [])) {
      if (st.section_id) {
        const gid = sectionToGrade.get(st.section_id)
        if (gid) studentToGrade.set(st.id, gid)
      }
    }

    // 5. Get daily records in range
    let query = supabase
      .from('attendance_daily')
      .select('student_id, state_value')
      .eq('school_id', schoolId)
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDate)

    if (campusId) query = query.eq('campus_id', campusId)

    const { data: records, error: rErr } = await query
    if (rErr) throw rErr

    // 6. Aggregate per grade
    const gradeStats = new Map<string, { students: Set<string>; present: number; absent: number; half: number }>()

    for (const g of (grades || [])) {
      gradeStats.set(g.id, { students: new Set(), present: 0, absent: 0, half: 0 })
    }

    // Count enrolled students per grade
    for (const st of (students || [])) {
      const gid = studentToGrade.get(st.id)
      if (gid && gradeStats.has(gid)) {
        gradeStats.get(gid)!.students.add(st.id)
      }
    }

    // Tally records
    for (const rec of (records || [])) {
      const gid = studentToGrade.get(rec.student_id)
      if (!gid || !gradeStats.has(gid)) continue
      const gs = gradeStats.get(gid)!
      if (rec.state_value === 1.0) gs.present++
      else if (rec.state_value === 0.5) gs.half++
      else gs.absent++
    }

    // 7. Build rows
    let totalStudents = 0, totalPossible = 0, totalPresent = 0, totalAbsent = 0

    const rows: ADAGradeRow[] = (grades || []).map(g => {
      const gs = gradeStats.get(g.id)!
      const numStudents = gs.students.size
      const daysPossible = numStudents * numSchoolDays
      const daysPresent = gs.present + gs.half * 0.5
      const daysAbsent = gs.absent + gs.half * 0.5
      const ada = daysPossible > 0 ? Math.round((daysPresent / daysPossible) * 10000) / 100 : 0
      const avgAttendance = numSchoolDays > 0 ? Math.round((daysPresent / numSchoolDays) * 100) / 100 : 0
      const avgAbsent = numSchoolDays > 0 ? Math.round((daysAbsent / numSchoolDays) * 100) / 100 : 0

      totalStudents += numStudents
      totalPossible += daysPossible
      totalPresent += daysPresent
      totalAbsent += daysAbsent

      return {
        grade_id: g.id,
        grade_name: g.name,
        students: numStudents,
        days_possible: daysPossible,
        days_present: Math.round(daysPresent * 100) / 100,
        days_absent: Math.round(daysAbsent * 100) / 100,
        ada,
        avg_attendance: avgAttendance,
        avg_absent: avgAbsent
      }
    })

    // Add total row
    const totalAda = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 10000) / 100 : 0
    rows.push({
      grade_id: '__total__',
      grade_name: 'Total',
      students: totalStudents,
      days_possible: totalPossible,
      days_present: Math.round(totalPresent * 100) / 100,
      days_absent: Math.round(totalAbsent * 100) / 100,
      ada: totalAda,
      avg_attendance: numSchoolDays > 0 ? Math.round((totalPresent / numSchoolDays) * 100) / 100 : 0,
      avg_absent: numSchoolDays > 0 ? Math.round((totalAbsent / numSchoolDays) * 100) / 100 : 0
    })

    return { success: true, data: rows, error: null }
  } catch (error: any) {
    console.error('Error fetching ADA by grade:', error)
    return { success: false, data: null, error: error.message }
  }
}

// ============================================================================
// DAILY SUMMARY GRID (Attendance Chart / DailySummary)
// Student × Date grid with per-date attendance state_value
// ============================================================================

/**
 * Get daily summary grid: students with per-date attendance.
 * Matches RosarioSIS DailySummary.php (the "Attendance Chart" page).
 * filterMode: 'daily' = attendance_daily state_value,
 *             or a period_id = attendance_records for that period.
 */
export const getDailySummaryGrid = async (
  schoolId: string,
  startDate: string,
  endDate: string,
  campusId?: string,
  filterMode: string = 'daily',
  gradeId?: string,
  sectionId?: string
): Promise<ApiResponse<DailySummaryGridResponse>> => {
  try {
    // 1. Get calendar school dates in range
    let calQ = supabase
      .from('attendance_calendar')
      .select('school_date')
      .eq('school_id', schoolId)
      .eq('is_school_day', true)
      .gte('school_date', startDate)
      .lte('school_date', endDate)
      .order('school_date', { ascending: true })

    if (campusId) {
      calQ = calQ.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    const { data: calDays, error: calErr } = await calQ
    if (calErr) throw calErr

    const schoolDates = (calDays || []).map(c => c.school_date)

    // 2. Get students
    let studentQuery = supabase
      .from('students')
      .select(`
        id,
        admission_number,
        profiles!inner(first_name, last_name),
        sections!inner(name, grades!inner(name))
      `)
      .eq('school_id', schoolId)
      .eq('is_active', true)

    if (campusId) studentQuery = studentQuery.eq('campus_id', campusId)

    if (sectionId) {
      studentQuery = studentQuery.eq('section_id', sectionId)
    } else if (gradeId) {
      const { data: secs } = await supabase
        .from('sections')
        .select('id')
        .eq('grade_id', gradeId)
      if (secs && secs.length > 0) {
        studentQuery = studentQuery.in('section_id', secs.map(s => s.id))
      }
    }

    const { data: students, error: stErr } = await studentQuery
    if (stErr) throw stErr

    if (!students || students.length === 0) {
      return { success: true, data: { school_dates: schoolDates, students: [] }, error: null }
    }

    const studentIds = students.map((s: any) => s.id)

    // 3. Get attendance data
    if (filterMode === 'daily') {
      // Use attendance_daily (aggregated daily state)
      let dailyQ = supabase
        .from('attendance_daily')
        .select('student_id, attendance_date, state_value')
        .eq('school_id', schoolId)
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate)
        .in('student_id', studentIds)
      if (campusId) dailyQ = dailyQ.eq('campus_id', campusId)
      const { data: dailyRecs, error: dErr } = await dailyQ

      if (dErr) throw dErr

      // Build lookup: student -> date -> state_value
      const lookup = new Map<string, Map<string, number>>()
      for (const rec of (dailyRecs || [])) {
        if (!lookup.has(rec.student_id)) lookup.set(rec.student_id, new Map())
        lookup.get(rec.student_id)!.set(rec.attendance_date, rec.state_value)
      }

      const result: DailySummaryGridResponse = {
        school_dates: schoolDates,
        students: students.map((s: any) => {
          const studentDates = lookup.get(s.id)
          const dates: Record<string, number | null> = {}
          for (const d of schoolDates) {
            dates[d] = studentDates?.get(d) ?? null
          }
          return {
            student_id: s.id,
            student_name: `${s.profiles?.first_name || ''} ${s.profiles?.last_name || ''}`.trim(),
            student_number: s.admission_number,
            grade_name: s.sections?.grades?.name,
            dates
          }
        })
      }

      return { success: true, data: result, error: null }
    } else {
      // Per-period: use attendance_records for this period_id
      let periodQ = supabase
        .from('attendance_records')
        .select(`
          student_id,
          attendance_date,
          attendance_codes(state_code)
        `)
        .eq('school_id', schoolId)
        .eq('period_id', filterMode)
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate)
        .in('student_id', studentIds)
      if (campusId) periodQ = periodQ.eq('campus_id', campusId)
      const { data: periodRecs, error: pErr } = await periodQ

      if (pErr) throw pErr

      // Map state_code -> state_value
      const stateMap: Record<string, number> = { 'P': 1.0, 'H': 0.5, 'A': 0.0 }

      const lookup = new Map<string, Map<string, number>>()
      for (const rec of (periodRecs || []) as any[]) {
        const stateCode = rec.attendance_codes?.state_code || 'P'
        const stateVal = stateMap[stateCode] ?? 1.0
        if (!lookup.has(rec.student_id)) lookup.set(rec.student_id, new Map())
        lookup.get(rec.student_id)!.set(rec.attendance_date, stateVal)
      }

      const result: DailySummaryGridResponse = {
        school_dates: schoolDates,
        students: students.map((s: any) => {
          const studentDates = lookup.get(s.id)
          const dates: Record<string, number | null> = {}
          for (const d of schoolDates) {
            dates[d] = studentDates?.get(d) ?? null
          }
          return {
            student_id: s.id,
            student_name: `${s.profiles?.first_name || ''} ${s.profiles?.last_name || ''}`.trim(),
            student_number: s.admission_number,
            grade_name: s.sections?.grades?.name,
            dates
          }
        })
      }

      return { success: true, data: result, error: null }
    }
  } catch (error: any) {
    console.error('Error fetching daily summary grid:', error)
    return { success: false, data: null, error: error.message }
  }
}

// ============================================================================
// ATTENDANCE CHART (REPORTS > Attendance Chart)
// Returns time-series data for charting
// ============================================================================

/**
 * Get chart data for attendance trends
 */
export const getAttendanceChart = async (
  schoolId: string,
  startDate: string,
  endDate: string,
  campusId?: string,
  groupBy: 'day' | 'week' | 'month' = 'day'
): Promise<ApiResponse<AttendanceChartData>> => {
  try {
    const { data: adaData, error } = await getAverageDailyAttendance(
      schoolId, startDate, endDate, campusId
    )

    if (error || !adaData) throw new Error(error || 'No data')

    if (groupBy === 'day') {
      return {
        success: true,
        data: {
          labels: adaData.map(r => r.date),
          present: adaData.map(r => r.total_present),
          absent: adaData.map(r => r.total_absent),
          half_day: adaData.map(r => r.total_half_day),
          ada: adaData.map(r => r.ada_percentage)
        },
        error: null
      }
    }

    // Group by week or month
    const groups = new Map<string, ADAReportRow[]>()
    for (const row of adaData) {
      const d = new Date(row.date)
      let key: string
      if (groupBy === 'week') {
        // ISO week: get Monday of that week
        const day = d.getDay()
        const diff = d.getDate() - day + (day === 0 ? -6 : 1)
        const monday = new Date(d)
        monday.setDate(diff)
        key = monday.toISOString().split('T')[0]
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      }

      const group = groups.get(key) || []
      group.push(row)
      groups.set(key, group)
    }

    const labels: string[] = []
    const present: number[] = []
    const absent: number[] = []
    const half_day: number[] = []
    const ada: number[] = []

    for (const [key, rows] of Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))) {
      labels.push(key)
      present.push(rows.reduce((s, r) => s + r.total_present, 0))
      absent.push(rows.reduce((s, r) => s + r.total_absent, 0))
      half_day.push(rows.reduce((s, r) => s + r.total_half_day, 0))
      const totalEnrolled = rows.reduce((s, r) => s + r.total_enrolled, 0)
      const totalPresent = rows.reduce((s, r) => s + r.total_present + r.total_half_day * 0.5, 0)
      ada.push(totalEnrolled > 0 ? Math.round((totalPresent / totalEnrolled) * 10000) / 100 : 0)
    }

    return { success: true, data: { labels, present, absent, half_day, ada }, error: null }
  } catch (error: any) {
    console.error('Error fetching attendance chart:', error)
    return { success: false, data: null, error: error.message }
  }
}

// ============================================================================
// ATTENDANCE SUMMARY (REPORTS > Attendance Summary)
// Per-student summary with code breakdown
// ============================================================================

/**
 * Get attendance summary per student for a date range
 */
export const getAttendanceSummary = async (
  schoolId: string,
  startDate: string,
  endDate: string,
  campusId?: string,
  gradeId?: string,
  sectionId?: string
): Promise<ApiResponse<AttendanceSummaryRow[]>> => {
  try {
    // Get students
    let studentQuery = supabase
      .from('students')
      .select(`
        id,
        admission_number,
        profiles!inner(first_name, last_name),
        sections!inner(name, grades!inner(name))
      `)
      .eq('school_id', schoolId)
      .eq('is_active', true)

    if (campusId) {
      studentQuery = studentQuery.eq('campus_id', campusId)
    }

    if (sectionId) {
      studentQuery = studentQuery.eq('section_id', sectionId)
    } else if (gradeId) {
      const { data: sections } = await supabase
        .from('sections')
        .select('id')
        .eq('grade_id', gradeId)
      if (sections && sections.length > 0) {
        studentQuery = studentQuery.in('section_id', sections.map(s => s.id))
      }
    }

    const { data: students, error: studentsError } = await studentQuery
    if (studentsError) throw studentsError

    if (!students || students.length === 0) {
      return { success: true, data: [], error: null }
    }

    // Get daily records for these students
    const studentIds = students.map(s => s.id)
    let dailyQ = supabase
      .from('attendance_daily')
      .select('student_id, state_value, total_minutes, minutes_present')
      .eq('school_id', schoolId)
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDate)
      .in('student_id', studentIds)
    if (campusId) dailyQ = dailyQ.eq('campus_id', campusId)
    const { data: dailyRecords, error: dailyError } = await dailyQ

    if (dailyError) throw dailyError

    // Get period-level records for code breakdown
    let periodQ = supabase
      .from('attendance_records')
      .select(`
        student_id,
        attendance_code_id,
        status,
        attendance_codes(short_name, state_code)
      `)
      .eq('school_id', schoolId)
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDate)
      .in('student_id', studentIds)
    if (campusId) periodQ = periodQ.eq('campus_id', campusId)
    const { data: periodRecords, error: periodError } = await periodQ

    if (periodError) throw periodError

    // Build per-student summaries
    const dailyMap = new Map<string, typeof dailyRecords>()
    for (const rec of (dailyRecords || [])) {
      const list = dailyMap.get(rec.student_id) || []
      list.push(rec)
      dailyMap.set(rec.student_id, list)
    }

    const codeMap = new Map<string, Record<string, number>>()
    for (const rec of (periodRecords || []) as any[]) {
      const codeName = rec.attendance_codes?.short_name || rec.status || 'unknown'
      const breakdown = codeMap.get(rec.student_id) || {}
      breakdown[codeName] = (breakdown[codeName] || 0) + 1
      codeMap.set(rec.student_id, breakdown)
    }

    const result: AttendanceSummaryRow[] = students.map((s: any) => {
      const daily = dailyMap.get(s.id) || []
      const totalDays = daily.length
      const daysPresent = daily.filter(d => d.state_value === 1.0).length
      const daysAbsent = daily.filter(d => d.state_value === 0.0).length
      const daysHalf = daily.filter(d => d.state_value === 0.5).length
      const totalMinutes = daily.reduce((sum, d) => sum + (d.total_minutes || 0), 0)
      const minutesPresent = daily.reduce((sum, d) => sum + (d.minutes_present || 0), 0)

      return {
        student_id: s.id,
        student_name: `${s.profiles?.first_name || ''} ${s.profiles?.last_name || ''}`.trim(),
        student_number: s.admission_number,
        section_name: s.sections?.name,
        grade_name: s.sections?.grades?.name,
        total_days: totalDays,
        days_present: daysPresent,
        days_absent: daysAbsent,
        days_half: daysHalf,
        total_minutes: totalMinutes,
        minutes_present: minutesPresent,
        attendance_percentage: totalDays > 0
          ? Math.round(((daysPresent + daysHalf * 0.5) / totalDays) * 10000) / 100
          : 0,
        state_code_breakdown: codeMap.get(s.id) || {}
      }
    })

    return { success: true, data: result, error: null }
  } catch (error: any) {
    console.error('Error fetching attendance summary:', error)
    return { success: false, data: null, error: error.message }
  }
}

// ============================================================================
// RECALCULATE DAILY ATTENDANCE (UTILITIES > Recalculate Daily Attendance)
// Batch-recalculates attendance_daily from attendance_records
// ============================================================================

/**
 * Recalculate daily attendance for a date range
 * Calls calculate_daily_attendance for each student on each date
 */
export const recalculateDailyAttendance = async (
  schoolId: string,
  startDate: string,
  endDate: string,
  campusId?: string
): Promise<ApiResponse<{ recalculated: number }>> => {
  try {
    // Get distinct student+date combinations from attendance_records in the range
    let query = supabase
      .from('attendance_records')
      .select('student_id, attendance_date')
      .eq('school_id', schoolId)
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDate)

    if (campusId) {
      query = query.eq('campus_id', campusId)
    }

    const { data: records, error } = await query
    if (error) throw error

    // Deduplicate student+date pairs
    const pairs = new Set<string>()
    for (const rec of (records || [])) {
      pairs.add(`${rec.student_id}:${rec.attendance_date}`)
    }

    let recalculated = 0
    for (const pair of pairs) {
      const [studentId, date] = pair.split(':')

      const { error: calcError } = await supabase.rpc('calculate_daily_attendance', {
        p_student_id: studentId,
        p_date: date
      })

      if (calcError) {
        console.error(`Error recalculating for ${studentId} on ${date}:`, calcError)
        continue
      }
      recalculated++
    }

    return { success: true, data: { recalculated }, error: null }
  } catch (error: any) {
    console.error('Error recalculating daily attendance:', error)
    return { success: false, data: null, error: error.message }
  }
}

// ============================================================================
// DELETE DUPLICATE ATTENDANCE (UTILITIES > Delete Duplicate Attendance)
// Finds and removes duplicate attendance_records (same student+period+date)
// ============================================================================

/**
 * Find duplicate attendance records
 */
export const findDuplicateAttendance = async (
  schoolId: string,
  startDate?: string,
  endDate?: string,
  campusId?: string
): Promise<ApiResponse<DuplicateAttendanceRecord[]>> => {
  try {
    // Query to find duplicates grouped by student+timetable_entry+date
    // The unique constraint should prevent this, but data migrations may create them
    let query = supabase
      .from('attendance_records')
      .select(`
        id,
        student_id,
        timetable_entry_id,
        attendance_date,
        marked_at,
        students(profiles(first_name, last_name)),
        timetable_entries(periods(period_name, period_number, id))
      `)
      .eq('school_id', schoolId)
      .order('student_id', { ascending: true })
      .order('attendance_date', { ascending: true })
      .order('marked_at', { ascending: false })

    if (campusId) {
      query = query.eq('campus_id', campusId)
    }
    if (startDate) {
      query = query.gte('attendance_date', startDate)
    }
    if (endDate) {
      query = query.lte('attendance_date', endDate)
    }

    const { data: records, error } = await query
    if (error) throw error

    // Group by student+timetable_entry+date to find duplicates
    const groups = new Map<string, any[]>()
    for (const rec of (records || [])) {
      const key = `${rec.student_id}:${rec.timetable_entry_id}:${rec.attendance_date}`
      const group = groups.get(key) || []
      group.push(rec)
      groups.set(key, group)
    }

    // Filter to only groups with duplicates
    const duplicates: DuplicateAttendanceRecord[] = []
    for (const [, group] of groups) {
      if (group.length <= 1) continue

      const first = group[0]
      const profile = (first.students as any)?.profiles
      const period = (first.timetable_entries as any)?.periods

      duplicates.push({
        student_id: first.student_id,
        student_name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : undefined,
        attendance_date: first.attendance_date,
        period_id: period?.id || first.timetable_entry_id,
        period_name: period?.period_name || `Period ${period?.period_number}`,
        count: group.length,
        record_ids: group.map((r: any) => r.id)
      })
    }

    return { success: true, data: duplicates, error: null }
  } catch (error: any) {
    console.error('Error finding duplicate attendance:', error)
    return { success: false, data: null, error: error.message }
  }
}

/**
 * Delete duplicate attendance records (keeps the most recent one)
 */
export const deleteDuplicateAttendance = async (
  schoolId: string,
  startDate?: string,
  endDate?: string,
  campusId?: string
): Promise<ApiResponse<{ deleted: number }>> => {
  try {
    const { data: duplicates, error: findError } = await findDuplicateAttendance(
      schoolId, startDate, endDate, campusId
    )

    if (findError || !duplicates) throw new Error(findError || 'Failed to find duplicates')

    let deleted = 0
    for (const dup of duplicates) {
      // Keep the first ID (most recent due to order by marked_at desc), delete rest
      const idsToDelete = dup.record_ids.slice(1)
      if (idsToDelete.length === 0) continue

      const { error: delError } = await supabase
        .from('attendance_records')
        .delete()
        .in('id', idsToDelete)

      if (delError) {
        console.error('Error deleting duplicates:', delError)
        continue
      }
      deleted += idsToDelete.length
    }

    return { success: true, data: { deleted }, error: null }
  } catch (error: any) {
    console.error('Error deleting duplicate attendance:', error)
    return { success: false, data: null, error: error.message }
  }
}

// ============================================================================
// ADMINISTRATION (Administration menu item)
// View/edit daily attendance records with admin override capability
// ============================================================================

/**
 * Get attendance records for a date with full details (admin view)
 */
export const getAdminAttendanceView = async (
  schoolId: string,
  date: string,
  sectionId?: string,
  gradeId?: string,
  campusId?: string
): Promise<ApiResponse<AttendanceDailyRecord[]>> => {
  try {
    let query = supabase
      .from('attendance_daily')
      .select(`
        *,
        students!inner(
          id,
          admission_number,
          section_id,
          profiles!inner(first_name, last_name),
          sections!inner(name, grades!inner(name))
        )
      `)
      .eq('school_id', schoolId)
      .eq('attendance_date', date)

    if (campusId) {
      query = query.eq('campus_id', campusId)
    }

    const { data, error } = await query
    if (error) throw error

    // Apply section/grade filter and transform
    let records = (data || []).map((rec: any) => ({
      ...rec,
      student_name: `${rec.students?.profiles?.first_name || ''} ${rec.students?.profiles?.last_name || ''}`.trim(),
      student_number: rec.students?.admission_number,
      section_name: rec.students?.sections?.name,
      grade_name: rec.students?.sections?.grades?.name,
      _section_id: rec.students?.section_id
    }))

    if (sectionId) {
      records = records.filter((r: any) => r._section_id === sectionId)
    } else if (gradeId) {
      // Need to get section IDs for grade
      const { data: sections } = await supabase
        .from('sections')
        .select('id')
        .eq('grade_id', gradeId)

      const sectionIds = new Set((sections || []).map(s => s.id))
      records = records.filter((r: any) => sectionIds.has(r._section_id))
    }

    // Clean up internal field
    records.forEach((r: any) => delete r._section_id)

    return { success: true, data: records, error: null }
  } catch (error: any) {
    console.error('Error fetching admin attendance view:', error)
    return { success: false, data: null, error: error.message }
  }
}

/**
 * Bulk admin inline grid: returns ALL students with their period-level records
 * for a given date + school. Used by the Administration inline grid view.
 * Mirrors RosarioSIS's Administration.php student list with period columns.
 */
export const getAdminPeriodGrid = async (
  schoolId: string,
  date: string,
  sectionId?: string,
  gradeId?: string,
  campusId?: string
): Promise<ApiResponse<any[]>> => {
  try {
    // 1. Get all attendance records for this school + date with student + period info
    let query = supabase
      .from('attendance_records')
      .select(`
        id,
        student_id,
        status,
        attendance_code_id,
        attendance_date,
        admin_override,
        override_reason,
        remarks,
        attendance_codes(id, title, short_name, state_code, color),
        timetable_entries!inner(
          id,
          section_id,
          periods!inner(id, period_name, period_number, start_time, end_time, length_minutes, sort_order)
        )
      `)
      .eq('school_id', schoolId)
      .eq('attendance_date', date)

    if (campusId) {
      query = query.eq('campus_id', campusId)
    }

    const { data: records, error: recError } = await query
    if (recError) throw recError

    // 2. Get unique student IDs from the records
    const studentIds = [...new Set((records || []).map((r: any) => r.student_id))]
    if (studentIds.length === 0) {
      return { success: true, data: [], error: null }
    }

    // 3. Get student info
    const { data: students, error: stuError } = await supabase
      .from('students')
      .select(`
        id,
        admission_number,
        section_id,
        profiles!inner(first_name, last_name),
        sections!inner(name, grades!inner(id, name))
      `)
      .in('id', studentIds)

    if (stuError) throw stuError

    // 4. Apply section/grade filters
    let filteredStudents = students || []
    if (sectionId) {
      filteredStudents = filteredStudents.filter((s: any) => s.section_id === sectionId)
    } else if (gradeId) {
      filteredStudents = filteredStudents.filter((s: any) => s.sections?.grades?.id === gradeId)
    }

    const filteredStudentIds = new Set(filteredStudents.map((s: any) => s.id))

    // 5. Get unique periods from records
    const periodsMap = new Map<string, any>()
    for (const rec of (records || [])) {
      const period = (rec as any).timetable_entries?.periods
      if (period && !periodsMap.has(period.id)) {
        periodsMap.set(period.id, period)
      }
    }
    const periods = [...periodsMap.values()].sort((a, b) =>
      (a.sort_order ?? a.period_number) - (b.sort_order ?? b.period_number)
    )

    // 6. Build per-student row with period columns
    const studentMap = new Map<string, any>()
    for (const stu of filteredStudents) {
      studentMap.set(stu.id, {
        student_id: stu.id,
        student_name: `${(stu as any).profiles?.first_name || ''} ${(stu as any).profiles?.last_name || ''}`.trim(),
        student_number: stu.admission_number,
        section_name: (stu as any).sections?.name,
        grade_name: (stu as any).sections?.grades?.name,
        period_records: {} as Record<string, any>
      })
    }

    for (const rec of (records || [])) {
      if (!filteredStudentIds.has((rec as any).student_id)) continue
      const period = (rec as any).timetable_entries?.periods
      if (!period) continue
      const row = studentMap.get((rec as any).student_id)
      if (row) {
        row.period_records[period.id] = {
          record_id: (rec as any).id,
          attendance_code_id: (rec as any).attendance_code_id,
          attendance_code: (rec as any).attendance_codes,
          status: (rec as any).status,
          admin_override: (rec as any).admin_override,
          timetable_entry_id: (rec as any).timetable_entries?.id
        }
      }
    }

    // 7. Get daily record for state_value / comment
    const { data: dailyRecords } = await supabase
      .from('attendance_daily')
      .select('student_id, state_value, comment, minutes_present, total_minutes')
      .eq('school_id', schoolId)
      .eq('attendance_date', date)
      .in('student_id', [...filteredStudentIds])

    const dailyMap = new Map<string, any>()
    for (const dr of (dailyRecords || [])) {
      dailyMap.set(dr.student_id, dr)
    }

    const result = [...studentMap.values()].map(row => ({
      ...row,
      state_value: dailyMap.get(row.student_id)?.state_value ?? null,
      comment: dailyMap.get(row.student_id)?.comment ?? '',
      minutes_present: dailyMap.get(row.student_id)?.minutes_present ?? 0,
      total_minutes: dailyMap.get(row.student_id)?.total_minutes ?? 0,
    }))

    return {
      success: true,
      data: { students: result, periods } as any,
      error: null
    }
  } catch (error: any) {
    console.error('Error fetching admin period grid:', error)
    return { success: false, data: null, error: error.message }
  }
}

/**
 * Bulk override: save multiple attendance code changes at once.
 * Used by the administration inline grid UPDATE button.
 * Each change specifies a record_id + new attendance_code_id.
 */
export const bulkOverrideAttendanceRecords = async (
  changes: { record_id: string; attendance_code_id: string }[],
  overrideBy: string
): Promise<ApiResponse<{ updated: number }>> => {
  try {
    let updated = 0

    for (const change of changes) {
      const { data: code } = await supabase
        .from('attendance_codes')
        .select('state_code')
        .eq('id', change.attendance_code_id)
        .single()

      const legacyStatus = code?.state_code === 'P' ? 'present'
        : code?.state_code === 'H' ? 'late'
        : 'absent'

      const { error } = await supabase
        .from('attendance_records')
        .update({
          attendance_code_id: change.attendance_code_id,
          status: legacyStatus,
          admin_override: true,
          override_by: overrideBy,
          marked_at: new Date().toISOString()
        })
        .eq('id', change.record_id)

      if (!error) updated++
    }

    return { success: true, data: { updated }, error: null }
  } catch (error: any) {
    console.error('Error bulk overriding attendance:', error)
    return { success: false, data: null, error: error.message }
  }
}

/**
 * Update the day-level comment in attendance_daily
 */
export const updateDailyComment = async (
  schoolId: string,
  studentId: string,
  date: string,
  comment: string
): Promise<ApiResponse<{ success: boolean }>> => {
  try {
    const { error } = await supabase
      .from('attendance_daily')
      .update({ comment })
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .eq('attendance_date', date)

    if (error) throw error
    return { success: true, data: { success: true }, error: null }
  } catch (error: any) {
    console.error('Error updating daily comment:', error)
    return { success: false, data: null, error: error.message }
  }
}

/**
 * Get detailed period-level records for a student on a date (drill-down)
 */
export const getStudentPeriodAttendance = async (
  studentId: string,
  date: string
): Promise<ApiResponse<any[]>> => {
  try {
    const { data, error } = await supabase
      .from('attendance_records')
      .select(`
        id,
        status,
        attendance_code_id,
        admin_override,
        override_by,
        override_reason,
        remarks,
        marked_at,
        marked_by,
        attendance_codes(id, title, short_name, state_code, color),
        timetable_entries!inner(
          id,
          periods!inner(id, period_name, period_number, start_time, end_time, length_minutes)
        )
      `)
      .eq('student_id', studentId)
      .eq('attendance_date', date)
      .order('timetable_entries(periods(period_number))', { ascending: true })

    if (error) throw error

    return { success: true, data: data || [], error: null }
  } catch (error: any) {
    console.error('Error fetching student period attendance:', error)
    return { success: false, data: null, error: error.message }
  }
}

// ============================================================================
// MARK ATTENDANCE COMPLETION (called when teacher saves attendance)
// Inserts into attendance_completed table
// ============================================================================

/**
 * Mark that a teacher has completed attendance for a period on a date
 */
export const markAttendanceCompleted = async (
  schoolId: string,
  staffId: string,
  schoolDate: string,
  periodId: string,
  tableName: number = 0,
  campusId?: string
): Promise<ApiResponse<AttendanceCompletionRecord>> => {
  try {
    const upsertData: any = {
      school_id: schoolId,
      staff_id: staffId,
      school_date: schoolDate,
      period_id: periodId,
      table_name: tableName
    }
    if (campusId) upsertData.campus_id = campusId

    const { data, error } = await supabase
      .from('attendance_completed')
      .upsert(upsertData, {
        onConflict: 'staff_id,school_date,period_id,table_name'
      })
      .select()
      .single()

    if (error) throw error

    return { success: true, data, error: null }
  } catch (error: any) {
    console.error('Error marking attendance completed:', error)
    return { success: false, data: null, error: error.message }
  }
}

// ============================================================================
// COURSE PERIODS LIST (for Print Attendance Sheets)
// Returns unique subject+period+teacher combinations from timetable
// ============================================================================

export interface CoursePeriodItem {
  id: string // timetable_entry id (or composite key)
  section_id: string
  section_name: string
  grade_name: string
  subject_name: string
  subject_code: string
  period_name: string
  period_id: string
  teacher_id: string | null
  teacher_name: string
  label: string // e.g. "Period 1 - Math6A - Teacher Name"
}

/**
 * Get course periods (timetable entries) for the school.
 * In RosarioSIS this is the list of course_periods the admin can select
 * to generate attendance sheets for.
 */
export const getCoursePeriods = async (
  schoolId: string,
  campusId?: string,
  includeInactive?: boolean
): Promise<ApiResponse<CoursePeriodItem[]>> => {
  try {
    let query = supabase
      .from('timetable_entries')
      .select(`
        id,
        section_id,
        period_id,
        teacher_id,
        sections!inner(name, grade_levels!inner(name)),
        subjects!inner(name, code),
        periods!inner(period_name, period_number),
        staff:staff!teacher_id(profiles:profiles!staff_profile_id_fkey(first_name, last_name))
      `)
      .eq('school_id', schoolId)
      .eq('is_active', true)

    if (campusId) {
      query = query.eq('campus_id', campusId)
    }

    const { data: entries, error } = await query
    if (error) throw error

    // Deduplicate by section+subject+period+teacher combo
    const seen = new Map<string, CoursePeriodItem>()

    for (const e of (entries || []) as any[]) {
      const key = `${e.section_id}:${e.period_id}:${e.teacher_id || 'none'}`
      if (seen.has(key)) continue

      const sectionName = e.sections?.name || ''
      const gradeName = e.sections?.grade_levels?.name || ''
      const subjectName = e.subjects?.name || ''
      const subjectCode = e.subjects?.code || ''
      const periodName = e.periods?.period_name || `Period ${e.periods?.period_number}`
      const teacherFirst = e.staff?.profiles?.first_name || ''
      const teacherLast = e.staff?.profiles?.last_name || ''
      const teacherName = `${teacherFirst} ${teacherLast}`.trim()

      const label = `${periodName} - ${subjectCode || subjectName}${sectionName ? `(${sectionName})` : ''} - ${teacherName || 'No Teacher'}`

      seen.set(key, {
        id: e.id,
        section_id: e.section_id,
        section_name: sectionName,
        grade_name: gradeName,
        subject_name: subjectName,
        subject_code: subjectCode,
        period_name: periodName,
        period_id: e.period_id,
        teacher_id: e.teacher_id,
        teacher_name: teacherName,
        label
      })
    }

    const result = Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label))
    return { success: true, data: result, error: null }
  } catch (error: any) {
    console.error('Error fetching course periods:', error)
    return { success: false, data: null, error: error.message }
  }
}
