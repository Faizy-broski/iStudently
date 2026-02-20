import { supabase } from '../config/supabase'
import { finalGradesService } from './final-grades.service'
import type {
  ClassRankEntry,
  StudentTranscript,
} from '../types/grades.types'

// ============================================================================
// GRADES REPORTS SERVICE
// Honor Roll (RosarioSIS-style), Class Rank, Transcripts
// ============================================================================

/**
 * Honor Roll student returned from getHonorRollStudents.
 * honor_level = 'high_honor' | 'honor' based on per-grade threshold checks.
 */
export interface HonorRollStudentResult {
  student_id: string
  student_number?: string
  first_name: string
  last_name: string
  grade_level: string
  section: string
  teacher?: string
  honor_level: 'high_honor' | 'honor'
}

class GradesReportsService {

  // ──────────────────────────────────────────────────────────────────────────
  // HONOR ROLL  (RosarioSIS approach — per-grade threshold, no rules table)
  //
  // Logic:
  //   1. Get all student_final_grades for the marking period where the
  //      course_period has does_honor_roll = true.
  //   2. For each grade, look up the grading scale's hr_gpa_value and
  //      hhr_gpa_value thresholds.
  //   3. A student is on Honor Roll if ALL their honor-roll grades have
  //      gpa_value >= hr_gpa_value, but at least one grade < hhr_gpa_value.
  //   4. A student is on High Honor Roll if ALL their honor-roll grades have
  //      gpa_value >= hhr_gpa_value.
  //   5. Students with ANY grade below hr_gpa_value are excluded entirely.
  // ──────────────────────────────────────────────────────────────────────────

  async getHonorRollStudents(
    schoolId: string,
    markingPeriodId: string,
    _academicYearId?: string,
    campusId?: string
  ): Promise<HonorRollStudentResult[]> {
    // Step 1: Fetch all final grades for honor-roll courses in this marking period.
    // Join through course_periods to check does_honor_roll and get grading_scale_id,
    // then join through grading_scales to get thresholds.
    let query = supabase
      .from('student_final_grades')
      .select(`
        student_id,
        gpa_value,
        course_period:course_periods!inner(
          id,
          does_honor_roll,
          grading_scale_id,
          grading_scale:grading_scales(hr_gpa_value, hhr_gpa_value),
          teacher:staff!teacher_id(profile:profiles(first_name, last_name))
        ),
        student:students!inner(
          id,
          student_number,
          school_id,
          profile:profiles(first_name, last_name),
          section:sections(name, grade_level:grade_levels(name))
        )
      `)
      .eq('school_id', schoolId)
      .eq('marking_period_id', markingPeriodId)
      .eq('course_period.does_honor_roll', true)

    if (campusId) {
      query = query.eq('student.school_id', campusId)
    }

    const { data: grades, error } = await query
    if (error) throw new Error(`Failed to fetch honor roll grades: ${error.message}`)
    if (!grades || grades.length === 0) return []

    // Step 2: Group grades by student, then check thresholds.
    const studentGrades = new Map<string, {
      studentInfo: any
      grades: Array<{ gpa_value: number; hr_threshold: number; hhr_threshold: number }>
      teacher?: string
    }>()

    for (const g of grades) {
      const sid = g.student_id
      const cp = g.course_period as any
      const scale = cp?.grading_scale

      // Skip if grading scale has no honor roll thresholds configured
      if (!scale?.hr_gpa_value) continue

      const hrThreshold = Number(scale.hr_gpa_value)
      const hhrThreshold = Number(scale.hhr_gpa_value) || hrThreshold
      const gradeGpa = Number(g.gpa_value) || 0

      if (!studentGrades.has(sid)) {
        // Get teacher name
        const teacherProfile = cp?.teacher?.profile
        const teacherName = teacherProfile
          ? `${teacherProfile.first_name} ${teacherProfile.last_name}`
          : undefined

        studentGrades.set(sid, {
          studentInfo: g.student,
          grades: [],
          teacher: teacherName,
        })
      }

      studentGrades.get(sid)!.grades.push({
        gpa_value: gradeGpa,
        hr_threshold: hrThreshold,
        hhr_threshold: hhrThreshold,
      })
    }

    // Step 3: Determine honor level for each student.
    const results: HonorRollStudentResult[] = []

    for (const [studentId, entry] of studentGrades) {
      const { studentInfo, grades: studentGradeList, teacher } = entry

      if (studentGradeList.length === 0) continue

      // Check if ALL grades meet at least Honor Roll threshold
      const allMeetHR = studentGradeList.every((g) => g.gpa_value >= g.hr_threshold)
      if (!allMeetHR) continue // Not on honor roll at all

      // Check if ALL grades meet High Honor Roll threshold
      const allMeetHHR = studentGradeList.every((g) => g.gpa_value >= g.hhr_threshold)

      const profile = Array.isArray(studentInfo?.profile)
        ? studentInfo.profile[0]
        : studentInfo?.profile
      const section = Array.isArray(studentInfo?.section)
        ? studentInfo.section[0]
        : studentInfo?.section
      const gradeLevel = section?.grade_level
      const gradeLevelName = Array.isArray(gradeLevel) ? gradeLevel[0]?.name : gradeLevel?.name

      results.push({
        student_id: studentId,
        student_number: studentInfo?.student_number,
        first_name: profile?.first_name || '',
        last_name: profile?.last_name || '',
        grade_level: gradeLevelName || '',
        section: section?.name || '',
        teacher,
        honor_level: allMeetHHR ? 'high_honor' : 'honor',
      })
    }

    // Sort: High Honor first, then by last name
    results.sort((a, b) => {
      if (a.honor_level !== b.honor_level) {
        return a.honor_level === 'high_honor' ? -1 : 1
      }
      return a.last_name.localeCompare(b.last_name)
    })

    return results
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CLASS RANK
  // ──────────────────────────────────────────────────────────────────────────

  async getClassRanks(
    schoolId: string,
    academicYearId: string,
    filters?: {
      marking_period_id?: string
      section_id?: string
      grade_level_id?: string
      campus_id?: string
    }
  ): Promise<ClassRankEntry[]> {
    let query = supabase
      .from('class_rank_cache')
      .select(`
        *,
        student:students!inner(id, student_number, school_id, profile:profiles(first_name, last_name),
          section:sections(id, name, grade_level:grade_levels(id, name)))
      `)
      .eq('school_id', schoolId)
      .eq('academic_year_id', academicYearId)

    if (filters?.marking_period_id) query = query.eq('marking_period_id', filters.marking_period_id)
    if (filters?.section_id) query = query.eq('section_id', filters.section_id)
    if (filters?.grade_level_id) query = query.eq('grade_level_id', filters.grade_level_id)
    if (filters?.campus_id) query = query.eq('student.school_id', filters.campus_id)

    const { data, error } = await query.order('rank_in_school')
    if (error) throw new Error(`Failed to fetch class ranks: ${error.message}`)
    return (data || []) as ClassRankEntry[]
  }

  async recalculateRanks(
    schoolId: string,
    academicYearId: string,
    markingPeriodId?: string
  ): Promise<number> {
    const { data, error } = await supabase.rpc('recalculate_class_ranks', {
      p_school_id: schoolId,
      p_academic_year_id: academicYearId,
      p_marking_period_id: markingPeriodId || null,
    })

    if (error) throw new Error(`Failed to recalculate ranks: ${error.message}`)
    return data as number
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PER-COURSE CLASS RANK
  // RosarioSIS-style: Rank students within a specific course period by
  // their percent_grade in a given marking period.
  // Equivalent to GetClassRank() → COUNT(*)+1 of students with higher %.
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get ranked list of students within a specific course period for a marking period.
   *
   * RosarioSIS equivalent: GetClassRank() — (SELECT COUNT(*)+1 FROM student_report_card_grades
   *   WHERE GRADE_PERCENT > sg.GRADE_PERCENT AND COURSE_PERIOD_ID = sg.COURSE_PERIOD_ID
   *   AND MARKING_PERIOD_ID = sg.MARKING_PERIOD_ID)
   *
   * @returns Array of students sorted by rank with their percentage, letter grade, and rank number
   */
  async getCourseClassRank(
    schoolId: string,
    coursePeriodId: string,
    markingPeriodId: string
  ): Promise<Array<{
    student_id: string
    student_name: string
    student_number: string | null
    percent_grade: number | null
    letter_grade: string | null
    gpa_value: number | null
    course_rank: number
    total_students: number
  }>> {
    // Get all final grades for this course period + marking period
    const { data: grades, error } = await supabase
      .from('student_final_grades')
      .select(`
        student_id,
        percent_grade,
        letter_grade,
        gpa_value,
        student:students!inner(
          id,
          student_number,
          profile:profiles(first_name, last_name)
        )
      `)
      .eq('course_period_id', coursePeriodId)
      .eq('marking_period_id', markingPeriodId)
      .not('percent_grade', 'is', null)

    if (error) throw new Error(`Failed to fetch course grades: ${error.message}`)
    if (!grades || grades.length === 0) return []

    // Sort by percent_grade descending
    const sorted = [...grades].sort((a, b) => (b.percent_grade || 0) - (a.percent_grade || 0))

    // Assign ranks (same percentage = same rank, RosarioSIS COUNT(*)+1 style)
    const totalStudents = sorted.length
    const result: Array<{
      student_id: string
      student_name: string
      student_number: string | null
      percent_grade: number | null
      letter_grade: string | null
      gpa_value: number | null
      course_rank: number
      total_students: number
    }> = []

    for (let i = 0; i < sorted.length; i++) {
      const g = sorted[i]
      const student = g.student as any
      const profile = student?.profile

      // RosarioSIS-style rank: count how many have a strictly higher percentage + 1
      const rank = sorted.filter((s) => (s.percent_grade || 0) > (g.percent_grade || 0)).length + 1

      result.push({
        student_id: g.student_id,
        student_name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Unknown',
        student_number: student?.student_number || null,
        percent_grade: g.percent_grade,
        letter_grade: g.letter_grade,
        gpa_value: g.gpa_value,
        course_rank: rank,
        total_students: totalStudents,
      })
    }

    // Sort by rank ascending for output
    result.sort((a, b) => a.course_rank - b.course_rank)
    return result
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TRANSCRIPTS
  // ──────────────────────────────────────────────────────────────────────────

  async getTranscript(studentId: string): Promise<StudentTranscript[]> {
    const { data, error } = await supabase
      .from('student_transcripts')
      .select(`
        *,
        academic_year:academic_years(id, name, start_date, end_date),
        marking_period:marking_periods(id, title)
      `)
      .eq('student_id', studentId)
      .order('created_at')

    if (error) throw new Error(`Failed to fetch transcript: ${error.message}`)
    return (data || []) as StudentTranscript[]
  }

  /**
   * Generate transcript records from final grades.
   * Copies final grade data into the transcript table for historical permanence.
   */
  async generateTranscriptFromFinalGrades(
    studentId: string,
    academicYearId: string,
    markingPeriodId?: string
  ): Promise<number> {
    // Get final grades
    let query = supabase
      .from('student_final_grades')
      .select(`
        *,
        course_period:course_periods(
          id, title,
          course:courses(id, title, credit_hours, subject:subjects(id, name))
        )
      `)
      .eq('student_id', studentId)
      .eq('academic_year_id', academicYearId)

    if (markingPeriodId) {
      query = query.eq('marking_period_id', markingPeriodId)
    }

    const { data: finalGrades, error } = await query
    if (error) throw new Error(`Failed to fetch final grades: ${error.message}`)
    if (!finalGrades || finalGrades.length === 0) return 0

    const records = finalGrades.map((fg: any) => ({
      school_id: fg.school_id,
      student_id: fg.student_id,
      academic_year_id: fg.academic_year_id,
      marking_period_id: fg.marking_period_id,
      course_title: fg.course_period?.course?.title || fg.course_period?.title || 'Unknown',
      subject_name: fg.course_period?.course?.subject?.name || '',
      credit_hours: fg.course_period?.course?.credit_hours || 1,
      credit_earned: fg.credit_earned || 0,
      percent_grade: fg.percent_grade,
      letter_grade: fg.letter_grade,
      gpa_value: fg.gpa_value,
      grade_points: fg.grade_points,
      is_transfer: false,
      campus_id: fg.campus_id || null,
    }))

    const { error: insertErr } = await supabase
      .from('student_transcripts')
      .upsert(records, { onConflict: 'student_id,academic_year_id,marking_period_id' })

    if (insertErr) throw new Error(`Failed to generate transcript: ${insertErr.message}`)
    return records.length
  }

  async addTransferCredit(schoolId: string, dto: {
    student_id: string
    academic_year_id: string
    course_title: string
    subject_name?: string
    credit_hours: number
    credit_earned: number
    percent_grade?: number
    letter_grade?: string
    gpa_value?: number
    transfer_school: string
    campus_id?: string
  }): Promise<StudentTranscript> {
    const { data, error } = await supabase
      .from('student_transcripts')
      .insert({
        school_id: schoolId,
        student_id: dto.student_id,
        academic_year_id: dto.academic_year_id,
        course_title: dto.course_title,
        subject_name: dto.subject_name,
        credit_hours: dto.credit_hours,
        credit_earned: dto.credit_earned,
        percent_grade: dto.percent_grade,
        letter_grade: dto.letter_grade,
        gpa_value: dto.gpa_value,
        grade_points: dto.gpa_value ? dto.gpa_value * dto.credit_hours : null,
        is_transfer: true,
        transfer_school: dto.transfer_school,
        campus_id: dto.campus_id || null,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to add transfer credit: ${error.message}`)
    return data as StudentTranscript
  }

  /**
   * Calculate cumulative GPA from transcript records.
   */
  async getCumulativeGPA(studentId: string): Promise<{
    cumulative_gpa: number | null
    total_credits_attempted: number
    total_credits_earned: number
    total_grade_points: number
  }> {
    const { data, error } = await supabase
      .from('student_transcripts')
      .select('credit_hours, credit_earned, gpa_value, grade_points')
      .eq('student_id', studentId)

    if (error) throw new Error(`Failed to calculate GPA: ${error.message}`)
    if (!data || data.length === 0) {
      return { cumulative_gpa: null, total_credits_attempted: 0, total_credits_earned: 0, total_grade_points: 0 }
    }

    let totalCreditsAttempted = 0
    let totalCreditsEarned = 0
    let totalGradePoints = 0

    for (const row of data) {
      totalCreditsAttempted += row.credit_hours || 0
      totalCreditsEarned += row.credit_earned || 0
      totalGradePoints += row.grade_points || ((row.gpa_value || 0) * (row.credit_hours || 0))
    }

    const cumulativeGpa = totalCreditsAttempted > 0
      ? Math.round((totalGradePoints / totalCreditsAttempted) * 100) / 100
      : null

    return {
      cumulative_gpa: cumulativeGpa,
      total_credits_attempted: totalCreditsAttempted,
      total_credits_earned: totalCreditsEarned,
      total_grade_points: Math.round(totalGradePoints * 100) / 100,
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // BATCH TRANSCRIPT GENERATION (for printing)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Generate transcript print data for multiple students.
   * Returns data shaped like ReportCardData[] for the frontend print flow.
   */
  async generateTranscripts(
    studentIds: string[],
    options: Record<string, any> = {}
  ): Promise<{ transcripts: any[] }> {
    const transcripts: any[] = []

    for (const studentId of studentIds) {
      try {
        const card = await this.generateStudentTranscriptCard(studentId, options)
        transcripts.push({ ...card, options })
      } catch (err: any) {
        console.error(`Error generating transcript for student ${studentId}:`, err.message)
        transcripts.push({ student_id: studentId, error: err.message })
      }
    }

    return { transcripts }
  }

  /**
   * Build a single student's transcript card (all years).
   */
  private async generateStudentTranscriptCard(
    studentId: string,
    options: Record<string, any> = {}
  ): Promise<any> {
    // Fetch student + school + all transcript records
    const [studentResult, transcriptRecords, cumulativeGpa] = await Promise.all([
      supabase
        .from('students')
        .select(`
          id, student_number, grade_level, admission_date,
          profile:profiles(first_name, father_name, grandfather_name, last_name, email, phone, profile_photo_url, is_active),
          section:sections(id, name, grade_level:grade_levels(id, name)),
          school:schools(id, name, address, logo_url, phone)
        `)
        .eq('id', studentId)
        .single(),
      this.getTranscript(studentId),
      this.getCumulativeGPA(studentId),
    ])

    if (studentResult.error)
      throw new Error(`Student not found: ${studentResult.error.message}`)

    // If no transcript records, try generating from final grades
    let records = transcriptRecords
    if (records.length === 0) {
      // Get all academic years the student has final grades in
      const { data: fgYears } = await supabase
        .from('student_final_grades')
        .select('academic_year_id')
        .eq('student_id', studentId)

      const uniqueYears = [...new Set((fgYears || []).map((r: any) => r.academic_year_id))]
      for (const ayId of uniqueYears) {
        await this.generateTranscriptFromFinalGrades(studentId, ayId)
      }
      records = await this.getTranscript(studentId)
    }

    // Build grades array from transcript records
    const grades = records.map((r: any) => ({
      course_title: r.course_title || '',
      subject_name: r.subject_name || '',
      teacher_name: '',
      percent_grade: r.percent_grade,
      letter_grade: r.letter_grade,
      gpa_value: r.gpa_value,
      credit_hours: r.credit_hours || 1,
      comments: [],
    }))

    return {
      student: studentResult.data,
      school: (studentResult.data as any)?.school,
      academic_year: (records[0] as any)?.academic_year || null,
      marking_period: null,
      grades,
      summary: {
        total_credits_attempted: cumulativeGpa.total_credits_attempted,
        total_credits_earned: cumulativeGpa.total_credits_earned,
        gpa: cumulativeGpa.cumulative_gpa,
      },
    }
  }
}

export const gradesReportsService = new GradesReportsService()
