import { supabase } from '../config/supabase'
import { gradebookService } from './gradebook.service'
import { markingPeriodsService, type MarkingPeriod, type MarkingPeriodType } from './marking-periods.service'
import type {
  StudentFinalGrade,
  GradesCompleted,
  SaveFinalGradeDTO,
} from '../types/grades.types'

// ============================================================================
// FINAL GRADES SERVICE
// InputFinalGrades + TeacherCompletion + GradeBreakdown
// ============================================================================

class FinalGradesService {

  // Helper: resolve campus_id from course_period
  private async getCampusId(coursePeriodId: string): Promise<string | null> {
    const { data } = await supabase
      .from('course_periods')
      .select('campus_id')
      .eq('id', coursePeriodId)
      .single()
    return data?.campus_id || null
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FINAL GRADES
  // ──────────────────────────────────────────────────────────────────────────

  async getFinalGrades(
    coursePeriodId: string,
    markingPeriodId?: string
  ): Promise<StudentFinalGrade[]> {
    let query = supabase
      .from('student_final_grades')
      .select(`
        *,
        student:students(id, student_number, profile:profiles(first_name, last_name)),
        course_period:course_periods(id, title, course:courses(id, title, credit_hours))
      `)
      .eq('course_period_id', coursePeriodId)

    if (markingPeriodId) {
      query = query.eq('marking_period_id', markingPeriodId)
    }

    const { data, error } = await query.order('created_at')
    if (error) throw new Error(`Failed to fetch final grades: ${error.message}`)
    return (data || []) as StudentFinalGrade[]
  }

  async getStudentFinalGrades(
    studentId: string,
    academicYearId?: string
  ): Promise<StudentFinalGrade[]> {
    let query = supabase
      .from('student_final_grades')
      .select(`
        *,
        course_period:course_periods(
          id, title,
          course:courses(id, title, short_name, credit_hours, subject:subjects(id, name, code)),
          teacher_id
        ),
        marking_period:marking_periods(id, title, start_date, end_date)
      `)
      .eq('student_id', studentId)

    if (academicYearId) {
      query = query.eq('academic_year_id', academicYearId)
    }

    const { data, error } = await query.order('created_at')
    if (error) throw new Error(`Failed to fetch student final grades: ${error.message}`)
    return (data || []) as StudentFinalGrade[]
  }

  async saveFinalGrade(schoolId: string, dto: SaveFinalGradeDTO, gradedBy?: string): Promise<StudentFinalGrade> {
    const campusId = dto.campus_id || await this.getCampusId(dto.course_period_id)
    const { data, error } = await supabase
      .from('student_final_grades')
      .upsert({
        school_id: schoolId,
        campus_id: campusId,
        student_id: dto.student_id,
        course_period_id: dto.course_period_id,
        marking_period_id: dto.marking_period_id,
        academic_year_id: dto.academic_year_id,
        percent_grade: dto.percent_grade,
        letter_grade: dto.letter_grade,
        gpa_value: dto.gpa_value,
        grade_points: dto.grade_points,
        credit_earned: dto.credit_earned,
        credit_attempted: dto.credit_attempted,
        gradebook_percent: dto.gradebook_percent,
        exam_percent: dto.exam_percent,
        exam_weight: dto.exam_weight,
        comment: dto.comment,
        is_override: dto.is_override || false,
        grade_source: dto.grade_source || 'calculated',
        graded_by: gradedBy,
        graded_at: new Date().toISOString(),
      }, { onConflict: 'student_id,course_period_id,marking_period_id' })
      .select()
      .single()

    if (error) throw new Error(`Failed to save final grade: ${error.message}`)
    return data as StudentFinalGrade
  }

  /**
   * Auto-calculate and save final grades for all students in a course_period.
   * Combines gradebook average + exam results based on exam_weight config.
   */
  async calculateAndSaveFinalGrades(
    schoolId: string,
    coursePeriodId: string,
    markingPeriodId: string,
    academicYearId: string,
    gradedBy?: string
  ): Promise<{ saved: number; errors: string[] }> {
    // Get section from course period
    const { data: cp } = await supabase
      .from('course_periods')
      .select('section_id, course:courses(credit_hours)')
      .eq('id', coursePeriodId)
      .single()

    if (!cp?.section_id) throw new Error('Course period has no section')

    // Get students in section
    const { data: students } = await supabase
      .from('students')
      .select('id')
      .eq('section_id', cp.section_id)

    if (!students || students.length === 0) {
      return { saved: 0, errors: [] }
    }

    // Get exam weight config (default 0 = gradebook only)
    const config = await gradebookService.getConfig(schoolId, coursePeriodId)
    const examWeight = parseFloat(config['exam_weight'] || '0')
    const creditHours = (cp.course as any)?.credit_hours || 1

    let saved = 0
    const errors: string[] = []

    for (const student of students) {
      try {
        // Calculate gradebook average
        const gradebookResult = await gradebookService.calculateStudentAverage(student.id, coursePeriodId)
        const gradebookPercent = gradebookResult.percentage

        // Get exam average for this student/course_period if exam_weight > 0
        let examPercent: number | null = null
        if (examWeight > 0) {
          const { data: examResults } = await supabase
            .from('exam_results')
            .select('marks_obtained, total_marks')
            .eq('student_id', student.id)
            .eq('exam_id', coursePeriodId) // This would need to be mapped
          // Simplified — real impl would join through exams table
          if (examResults && examResults.length > 0) {
            const totalObtained = examResults.reduce((s, r) => s + (r.marks_obtained || 0), 0)
            const totalMarks = examResults.reduce((s, r) => s + (r.total_marks || 0), 0)
            examPercent = totalMarks > 0 ? (totalObtained / totalMarks) * 100 : null
          }
        }

        // Compute final percentage
        let finalPercent: number | null = null
        let gradeSource = 'calculated'

        if (gradebookPercent !== null && examPercent !== null && examWeight > 0) {
          finalPercent = gradebookPercent * (1 - examWeight / 100) + examPercent * (examWeight / 100)
          gradeSource = 'combined'
        } else if (gradebookPercent !== null) {
          finalPercent = gradebookPercent
          gradeSource = 'calculated'
        } else if (examPercent !== null) {
          finalPercent = examPercent
          gradeSource = 'exam_only'
        }

        if (finalPercent === null) continue

        await this.saveFinalGrade(schoolId, {
          student_id: student.id,
          course_period_id: coursePeriodId,
          marking_period_id: markingPeriodId,
          academic_year_id: academicYearId,
          percent_grade: Math.round(finalPercent * 100) / 100,
          letter_grade: gradebookResult.letter_grade,
          gpa_value: gradebookResult.gpa_value,
          grade_points: gradebookResult.gpa_value ? gradebookResult.gpa_value * creditHours : undefined,
          credit_attempted: creditHours,
          credit_earned: (finalPercent >= 50) ? creditHours : 0, // pass = 50%+ (configurable)
          gradebook_percent: gradebookPercent,
          exam_percent: examPercent,
          exam_weight: examWeight,
          grade_source: gradeSource,
        }, gradedBy)

        saved++
      } catch (err: any) {
        errors.push(`Student ${student.id}: ${err.message}`)
      }
    }

    return { saved, errors }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SEMESTER / FULL YEAR GRADE CASCADING
  // RosarioSIS-style: SEM grades are averaged from child QTR grades,
  // FY grades are averaged from child SEM grades.
  // Uses equal weighting by default across child marking periods.
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Calculate and save Semester final grades for a course period by averaging
   * its child Quarter final grades.
   *
   * RosarioSIS equivalent: FinalGradesSemOrFYCalculate()
   *
   * @param schoolId - School ID
   * @param coursePeriodId - Course Period to cascade grades for
   * @param semesterMpId - The Semester marking period ID
   * @param academicYearId - Academic year
   * @param gradedBy - User performing the action
   */
  async calculateSemFinalGrades(
    schoolId: string,
    coursePeriodId: string,
    semesterMpId: string,
    academicYearId: string,
    gradedBy?: string
  ): Promise<{ saved: number; errors: string[] }> {
    // 1. Verify this is a SEM marking period
    const semMp = await markingPeriodsService.getById(semesterMpId)
    if (!semMp || semMp.mp_type !== 'SEM') {
      throw new Error('Provided marking_period_id is not a Semester')
    }

    // 2. Get child QTR marking periods
    const qtrChildren = await markingPeriodsService.getChildren(semesterMpId)
    const qtrMps = qtrChildren.filter((mp: MarkingPeriod) => mp.mp_type === 'QTR' && mp.does_grades)
    if (qtrMps.length === 0) {
      return { saved: 0, errors: ['No Quarter marking periods with does_grades=true found under this Semester'] }
    }

    return this.cascadeGradesFromChildren(
      schoolId, coursePeriodId, semesterMpId, academicYearId, qtrMps, gradedBy
    )
  }

  /**
   * Calculate and save Full Year final grades for a course period by averaging
   * its child Semester final grades.
   *
   * RosarioSIS equivalent: FinalGradesSemOrFYCalculate() for FY
   *
   * @param schoolId - School ID
   * @param coursePeriodId - Course Period to cascade grades for
   * @param fyMpId - The Full Year marking period ID
   * @param academicYearId - Academic year
   * @param gradedBy - User performing the action
   */
  async calculateFYFinalGrades(
    schoolId: string,
    coursePeriodId: string,
    fyMpId: string,
    academicYearId: string,
    gradedBy?: string
  ): Promise<{ saved: number; errors: string[] }> {
    // 1. Verify this is a FY marking period
    const fyMp = await markingPeriodsService.getById(fyMpId)
    if (!fyMp || fyMp.mp_type !== 'FY') {
      throw new Error('Provided marking_period_id is not a Full Year')
    }

    // 2. Get child SEM marking periods
    const semChildren = await markingPeriodsService.getChildren(fyMpId)
    const semMps = semChildren.filter((mp: MarkingPeriod) => mp.mp_type === 'SEM' && mp.does_grades)
    if (semMps.length === 0) {
      return { saved: 0, errors: ['No Semester marking periods with does_grades=true found under this Full Year'] }
    }

    return this.cascadeGradesFromChildren(
      schoolId, coursePeriodId, fyMpId, academicYearId, semMps, gradedBy
    )
  }

  /**
   * Auto-cascade all marking periods for a course period.
   * Given a QTR marking_period_id, automatically calculates:
   *   1. The parent SEM (if does_grades)
   *   2. The grandparent FY (if does_grades)
   *
   * RosarioSIS equivalent: the cascade inside FinalGradesAllMPSave()
   */
  async cascadeAllMPGrades(
    schoolId: string,
    coursePeriodId: string,
    qtrMpId: string,
    academicYearId: string,
    gradedBy?: string
  ): Promise<{ sem_result?: { saved: number; errors: string[] }; fy_result?: { saved: number; errors: string[] } }> {
    const result: { sem_result?: { saved: number; errors: string[] }; fy_result?: { saved: number; errors: string[] } } = {}

    // Get parent chain: QTR → SEM → FY
    const qtrMp = await markingPeriodsService.getById(qtrMpId)
    if (!qtrMp || qtrMp.mp_type !== 'QTR') {
      return result // Nothing to cascade if not a QTR
    }

    // Check if parent SEM exists and does_grades
    if (qtrMp.parent_id) {
      const semMp = await markingPeriodsService.getById(qtrMp.parent_id)
      if (semMp && semMp.mp_type === 'SEM' && semMp.does_grades) {
        try {
          result.sem_result = await this.calculateSemFinalGrades(
            schoolId, coursePeriodId, semMp.id, academicYearId, gradedBy
          )
        } catch (err: any) {
          result.sem_result = { saved: 0, errors: [err.message] }
        }

        // Check if grandparent FY exists and does_grades
        if (semMp.parent_id) {
          const fyMp = await markingPeriodsService.getById(semMp.parent_id)
          if (fyMp && fyMp.mp_type === 'FY' && fyMp.does_grades) {
            try {
              result.fy_result = await this.calculateFYFinalGrades(
                schoolId, coursePeriodId, fyMp.id, academicYearId, gradedBy
              )
            } catch (err: any) {
              result.fy_result = { saved: 0, errors: [err.message] }
            }
          }
        }
      }
    }

    return result
  }

  /**
   * Internal: Cascade grades from child marking periods into a parent MP.
   * Averages the percent_grade across child MPs (equal weighting).
   * Then looks up letter grade + GPA from the course period's grading scale.
   */
  private async cascadeGradesFromChildren(
    schoolId: string,
    coursePeriodId: string,
    parentMpId: string,
    academicYearId: string,
    childMps: MarkingPeriod[],
    gradedBy?: string
  ): Promise<{ saved: number; errors: string[] }> {
    const childMpIds = childMps.map((mp: MarkingPeriod) => mp.id)

    // 1. Get all final grades for this course_period across the child MPs
    const { data: childGrades, error: cgErr } = await supabase
      .from('student_final_grades')
      .select('student_id, marking_period_id, percent_grade, gpa_value, credit_earned, credit_attempted')
      .eq('course_period_id', coursePeriodId)
      .in('marking_period_id', childMpIds)

    if (cgErr) throw new Error(`Failed to fetch child grades: ${cgErr.message}`)
    if (!childGrades || childGrades.length === 0) {
      return { saved: 0, errors: ['No child marking period grades found for this course period'] }
    }

    // 2. Group grades by student
    const studentMap = new Map<string, Array<{ percent_grade: number | null; gpa_value: number | null; credit_earned: number | null; credit_attempted: number | null }>>()
    for (const g of childGrades) {
      if (!studentMap.has(g.student_id)) studentMap.set(g.student_id, [])
      studentMap.get(g.student_id)!.push({
        percent_grade: g.percent_grade,
        gpa_value: g.gpa_value,
        credit_earned: g.credit_earned,
        credit_attempted: g.credit_attempted,
      })
    }

    // 3. Get grading scale for letter grade lookup
    const { data: cp } = await supabase
      .from('course_periods')
      .select('grading_scale_id, course:courses(credit_hours, grading_scale_id)')
      .eq('id', coursePeriodId)
      .single()

    const scaleId = cp?.grading_scale_id || (cp?.course as any)?.grading_scale_id
    const creditHours = (cp?.course as any)?.credit_hours || 1

    let saved = 0
    const errors: string[] = []

    // 4. Average each student's grades and save the parent MP grade
    for (const [studentId, grades] of studentMap) {
      try {
        // Filter out null percent grades
        const validGrades = grades.filter((g) => g.percent_grade !== null && g.percent_grade !== undefined)
        if (validGrades.length === 0) continue

        // Equal-weight average of percent grades (RosarioSIS style)
        const avgPercent = Math.round(
          (validGrades.reduce((sum, g) => sum + g.percent_grade!, 0) / validGrades.length) * 100
        ) / 100

        // Lookup letter grade + GPA from scale
        let letterGrade: string | null = null
        let gpaValue: number | null = null

        if (scaleId) {
          const { data: gradeEntry } = await supabase
            .from('grading_scale_grades')
            .select('title, gpa_value')
            .eq('grading_scale_id', scaleId)
            .eq('is_active', true)
            .lte('break_off', avgPercent)
            .order('break_off', { ascending: false })
            .limit(1)
            .single()

          if (gradeEntry) {
            letterGrade = gradeEntry.title
            gpaValue = gradeEntry.gpa_value
          }
        }

        // Sum credits across child MPs
        const totalCreditAttempted = grades.reduce((s, g) => s + (g.credit_attempted || 0), 0) || creditHours
        const totalCreditEarned = grades.reduce((s, g) => s + (g.credit_earned || 0), 0)

        await this.saveFinalGrade(schoolId, {
          student_id: studentId,
          course_period_id: coursePeriodId,
          marking_period_id: parentMpId,
          academic_year_id: academicYearId,
          percent_grade: avgPercent,
          letter_grade: letterGrade,
          gpa_value: gpaValue,
          grade_points: gpaValue ? gpaValue * creditHours : undefined,
          credit_attempted: totalCreditAttempted,
          credit_earned: totalCreditEarned,
          grade_source: 'cascaded',
        }, gradedBy)

        saved++
      } catch (err: any) {
        errors.push(`Student ${studentId}: ${err.message}`)
      }
    }

    return { saved, errors }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEACHER COMPLETION
  // ──────────────────────────────────────────────────────────────────────────

  async getCompletionStatus(
    schoolId: string,
    markingPeriodId: string,
    academicYearId?: string,
    schoolPeriodId?: string,
    campusId?: string
  ): Promise<any[]> {
    // ── Resolve academic year if not provided ──
    if (!academicYearId) {
      const { data: mp } = await supabase
        .from('marking_periods')
        .select('id, school_id')
        .eq('id', markingPeriodId)
        .single()
      if (mp) {
        const { data: ay } = await supabase
          .from('academic_years')
          .select('id')
          .eq('school_id', mp.school_id || schoolId)
          .eq('is_active', true)
          .limit(1)
          .single()
        academicYearId = ay?.id
      }
    }

    // ── Build the list of school_ids to query course_periods ──
    // course_periods.school_id may be stored as the campus UUID (from profile.school_id)
    // rather than the parent school UUID, so we need to check both.
    const cpSchoolIds: string[] = [schoolId]
    if (campusId && campusId !== schoolId) {
      cpSchoolIds.push(campusId)
    }
    if (!campusId) {
      // No campus specified — look up all campuses under this school
      const { data: campuses } = await supabase
        .from('schools')
        .select('id')
        .eq('parent_school_id', schoolId)
      if (campuses) {
        cpSchoolIds.push(...campuses.map((c: any) => c.id))
      }
    }

    // ── 1) Get school periods for column headers ──
    let periodsQuery = supabase
      .from('periods')
      .select('id, title, short_name, sort_order')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    if (campusId) {
      periodsQuery = periodsQuery.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    const { data: allPeriods } = await periodsQuery
    let activePeriods = allPeriods || []

    if (schoolPeriodId) {
      activePeriods = activePeriods.filter(p => p.id === schoolPeriodId)
    }
    if (activePeriods.length === 0) return []

    const periodIds = activePeriods.map(p => p.id)

    // ── 2) Get course_periods with teachers ──
    // Query using all possible school_ids (parent + campuses)
    let cpQuery = supabase
      .from('course_periods')
      .select(`
        id, title, period_id, teacher_id,
        course:courses(id, title, subject:subjects(id, name))
      `)
      .in('school_id', cpSchoolIds)
      .eq('is_active', true)
      .not('teacher_id', 'is', null)

    // Filter by period_id if we have periods, but don't require it—
    // some course_periods may have period_id = null
    if (periodIds.length > 0) {
      cpQuery = cpQuery.in('period_id', periodIds)
    }
    if (academicYearId) {
      cpQuery = cpQuery.eq('academic_year_id', academicYearId)
    }

    const { data: coursePeriods, error: cpErr } = await cpQuery
    if (cpErr) throw new Error(`Failed to fetch course periods: ${cpErr.message}`)

    if (!coursePeriods || coursePeriods.length === 0) {
      // Fallback: try without period_id filter (period_id may be null on course_periods)
      let cpNoPeriodFilter = supabase
        .from('course_periods')
        .select(`
          id, title, period_id, teacher_id,
          course:courses(id, title, subject:subjects(id, name))
        `)
        .in('school_id', cpSchoolIds)
        .eq('is_active', true)
        .not('teacher_id', 'is', null)

      if (academicYearId) {
        cpNoPeriodFilter = cpNoPeriodFilter.eq('academic_year_id', academicYearId)
      }

      const { data: cpNoFilter } = await cpNoPeriodFilter
      if (!cpNoFilter || cpNoFilter.length === 0) return []

      return this.buildTeacherCompletion(
        cpNoFilter, activePeriods, cpSchoolIds, markingPeriodId, academicYearId
      )
    }

    return this.buildTeacherCompletion(
      coursePeriods, activePeriods, cpSchoolIds, markingPeriodId, academicYearId
    )
  }

  private async buildTeacherCompletion(
    coursePeriods: any[],
    activePeriods: any[],
    cpSchoolIds: string[],
    markingPeriodId: string,
    academicYearId?: string
  ): Promise<any[]> {
    // Get unique teacher IDs and fetch profiles
    const teacherIds = [...new Set(coursePeriods.map((cp: any) => cp.teacher_id).filter(Boolean))]
    if (teacherIds.length === 0) return []

    const { data: staffList } = await supabase
      .from('staff')
      .select('id, profile:profiles!profile_id(first_name, last_name)')
      .in('id', teacherIds)

    const staffMap = new Map<string, string>()
    for (const s of (staffList || [])) {
      const p = Array.isArray(s.profile) ? s.profile[0] : s.profile
      staffMap.set(s.id, `${(p as any)?.first_name || ''} ${(p as any)?.last_name || ''}`.trim())
    }

    // Get completion records — also check both school_ids
    let compQuery = supabase
      .from('grades_completed')
      .select('course_period_id, teacher_id, is_completed')
      .in('school_id', cpSchoolIds)
      .eq('marking_period_id', markingPeriodId)

    if (academicYearId) {
      compQuery = compQuery.eq('academic_year_id', academicYearId)
    }

    const { data: completions } = await compQuery
    const completionSet = new Set<string>()
    for (const c of (completions || [])) {
      if (c.is_completed) {
        completionSet.add(`${c.teacher_id}__${c.course_period_id}`)
      }
    }

    // Build period title map
    const periodTitleMap = new Map<string, string>()
    for (const p of activePeriods) {
      periodTitleMap.set(p.id, p.title || p.short_name || 'Period')
    }

    // Aggregate by teacher → { staff_id, teacher_name, periods: Record<period_id, ...> }
    const teacherMap = new Map<string, {
      staff_id: string
      teacher_name: string
      periods: Record<string, {
        period_title: string
        completed: boolean
        course_period_title: string
      }>
    }>()

    for (const cp of coursePeriods) {
      const teacherId = cp.teacher_id
      if (!teacherId) continue

      let periodId = cp.period_id
      // If no period_id on the course_period, assign to first active period
      if (!periodId && activePeriods.length > 0) {
        periodId = activePeriods[0].id
      }
      if (!periodId) continue

      const teacherName = staffMap.get(teacherId) || 'Unknown'
      if (!teacherMap.has(teacherId)) {
        teacherMap.set(teacherId, {
          staff_id: teacherId,
          teacher_name: teacherName,
          periods: {},
        })
      }

      const entry = teacherMap.get(teacherId)!
      const cpTitle = cp.course?.title || cp.title || ''
      const completed = completionSet.has(`${teacherId}__${cp.id}`)

      entry.periods[periodId] = {
        period_title: periodTitleMap.get(periodId) || periodId,
        completed,
        course_period_title: cpTitle,
      }
    }

    return Array.from(teacherMap.values())
  }

  async markCompleted(
    schoolId: string,
    coursePeriodId: string,
    teacherId: string,
    markingPeriodId: string,
    academicYearId: string
  ): Promise<GradesCompleted> {
    const campusId = await this.getCampusId(coursePeriodId)
    const { data, error } = await supabase
      .from('grades_completed')
      .upsert({
        school_id: schoolId,
        campus_id: campusId,
        course_period_id: coursePeriodId,
        teacher_id: teacherId,
        marking_period_id: markingPeriodId,
        academic_year_id: academicYearId,
        is_completed: true,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'course_period_id,teacher_id,marking_period_id' })
      .select()
      .single()

    if (error) throw new Error(`Failed to mark completed: ${error.message}`)
    return data as GradesCompleted
  }

  async unmarkCompleted(
    coursePeriodId: string,
    teacherId: string,
    markingPeriodId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('grades_completed')
      .update({ is_completed: false, completed_at: null })
      .eq('course_period_id', coursePeriodId)
      .eq('teacher_id', teacherId)
      .eq('marking_period_id', markingPeriodId)

    if (error) throw new Error(`Failed to unmark completed: ${error.message}`)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GRADE BREAKDOWN (progress report style)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get a detailed grade breakdown for a student across all their course periods.
   * This is the data for Progress Reports.
   */
  async getGradeBreakdown(
    studentId: string,
    academicYearId: string,
    markingPeriodId?: string
  ): Promise<Array<{
    course_period_id: string
    course_title: string
    subject_name: string
    teacher_name: string
    final_grade: StudentFinalGrade | null
    breakdown: Array<{
      category: string
      earned: number
      possible: number
      percentage: number
      weight: number
    }>
    current_average: number | null
  }>> {
    // Get student's course periods for the year
    const { data: enrollments } = await supabase
      .from('course_periods')
      .select(`
        id, title,
        course:courses(id, title, subject:subjects(id, name)),
        teacher:staff(id, profile:profiles!profile_id(first_name, last_name))
      `)
      .eq('academic_year_id', academicYearId)
      .eq('is_active', true)

    // Filter to course_periods the student is enrolled in (via section)
    const { data: student } = await supabase
      .from('students')
      .select('section_id')
      .eq('id', studentId)
      .single()

    if (!student?.section_id || !enrollments) return []

    const studentCPs = enrollments.filter((cp: any) => {
      // Must be filtered by section — but course_periods may not have section loaded
      return true // simplified; will filter below
    })

    const { data: cps } = await supabase
      .from('course_periods')
      .select(`
        id, title,
        course:courses(id, title, subject:subjects(id, name)),
        teacher:staff(id, profile:profiles!profile_id(first_name, last_name))
      `)
      .eq('section_id', student.section_id)
      .eq('academic_year_id', academicYearId)
      .eq('is_active', true)

    if (!cps || cps.length === 0) return []

    const results = []

    for (const cp of cps) {
      // Get final grade if exists
      let finalGradeQuery = supabase
        .from('student_final_grades')
        .select('*')
        .eq('student_id', studentId)
        .eq('course_period_id', cp.id)

      if (markingPeriodId) {
        finalGradeQuery = finalGradeQuery.eq('marking_period_id', markingPeriodId)
      }

      const { data: finalGrades } = await finalGradeQuery.limit(1).single()

      // Get current average with breakdown
      const avgResult = await gradebookService.calculateStudentAverage(studentId, cp.id)

      results.push({
        course_period_id: cp.id,
        course_title: (cp as any).course?.title || cp.title,
        subject_name: (cp as any).course?.subject?.name || '',
        teacher_name: `${(cp as any).teacher?.profile?.first_name || ''} ${(cp as any).teacher?.profile?.last_name || ''}`.trim(),
        final_grade: (finalGrades as StudentFinalGrade) || null,
        breakdown: avgResult.breakdown,
        current_average: avgResult.percentage,
      })
    }

    return results
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GRADE LIST GENERATION (batch, for printing)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Generate final grade list data for multiple students.
   * Returns data shaped like ReportCardData[] for the frontend print flow.
   */
  async generateGradeLists(
    studentIds: string[],
    markingPeriodIds: string[],
    options: Record<string, any> = {}
  ): Promise<{ grade_lists: any[] }> {
    // Get active academic year
    let academicYearId = options.academic_year_id
    if (!academicYearId) {
      const { data: ay } = await supabase
        .from('academic_years')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .single()
      academicYearId = ay?.id
    }
    if (!academicYearId) throw new Error('No active academic year found')

    // Get academic year & marking periods
    const [ayResult, mpResult] = await Promise.all([
      supabase.from('academic_years').select('*').eq('id', academicYearId).single(),
      supabase.from('marking_periods').select('*').in('id', markingPeriodIds),
    ])

    const gradeLists: any[] = []

    for (const studentId of studentIds) {
      for (const mpId of markingPeriodIds) {
        try {
          const card = await this.generateStudentGradeListCard(
            studentId, mpId, academicYearId, options
          )
          gradeLists.push({
            ...card,
            marking_period: mpResult.data?.find((mp: any) => mp.id === mpId) || null,
            academic_year: ayResult.data || null,
            options,
          })
        } catch (err: any) {
          console.error(`Error generating grade list for student ${studentId}, MP ${mpId}:`, err.message)
          gradeLists.push({ student_id: studentId, marking_period_id: mpId, error: err.message })
        }
      }
    }

    return { grade_lists: gradeLists }
  }

  private async generateStudentGradeListCard(
    studentId: string,
    markingPeriodId: string,
    academicYearId: string,
    options: Record<string, any> = {}
  ): Promise<any> {
    // Fetch student info
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select(`
        id, student_number, grade_level, admission_date,
        profile:profiles(first_name, father_name, grandfather_name, last_name, email, phone, profile_photo_url, is_active),
        section:sections(id, name, grade_level:grade_levels(id, name)),
        school:schools(id, name, address, logo_url, phone)
      `)
      .eq('id', studentId)
      .single()

    if (studentErr) throw new Error(`Student not found: ${studentErr.message}`)

    // Get final grades for this student + marking period
    const allFinalGrades = await this.getStudentFinalGrades(studentId, academicYearId)
    const mpGrades = allFinalGrades.filter((g) => g.marking_period_id === markingPeriodId)

    // Fetch teacher names
    const teacherIds = [...new Set(mpGrades.map((g) => (g.course_period as any)?.teacher_id).filter(Boolean))]
    const teacherMap: Record<string, string> = {}
    if (teacherIds.length > 0) {
      const { data: staffRows } = await supabase
        .from('staff')
        .select('id, profile:profiles!profile_id(first_name, last_name)')
        .in('id', teacherIds)
      for (const s of staffRows || []) {
        const p = Array.isArray(s.profile) ? s.profile[0] : s.profile
        teacherMap[s.id] = `${(p as any)?.first_name || ''} ${(p as any)?.last_name || ''}`.trim()
      }
    }

    // Build grades
    const grades = mpGrades.map((fg) => {
      const cp = fg.course_period as any
      return {
        course_title: cp?.course?.title || cp?.title || '',
        subject_name: cp?.course?.subject?.name || '',
        teacher_name: cp?.teacher_id ? (teacherMap[cp.teacher_id] || '') : '',
        percent_grade: fg.percent_grade,
        letter_grade: fg.letter_grade,
        gpa_value: fg.gpa_value,
        credit_hours: cp?.course?.credit_hours || 1,
        comments: [],
      }
    })

    // Summary
    let totalCreditsAttempted = 0
    let totalCreditsEarned = 0
    let totalGradePoints = 0
    for (const fg of mpGrades) {
      const credits = (fg.course_period as any)?.course?.credit_hours || 1
      totalCreditsAttempted += fg.credit_attempted || credits
      totalCreditsEarned += fg.credit_earned || 0
      totalGradePoints += (fg.gpa_value || 0) * credits
    }
    const gpa = totalCreditsAttempted > 0
      ? Math.round((totalGradePoints / totalCreditsAttempted) * 100) / 100
      : null

    return {
      student,
      school: (student as any)?.school,
      grades,
      summary: {
        total_credits_attempted: totalCreditsAttempted,
        total_credits_earned: totalCreditsEarned,
        gpa,
      },
    }
  }
}

export const finalGradesService = new FinalGradesService()
