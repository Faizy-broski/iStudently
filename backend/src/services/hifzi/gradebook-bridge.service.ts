import { supabase } from '../../config/supabase'
import { finalGradesService } from '../final-grades.service'
import { gradingScalesService } from '../grading-scales.service'

// ============================================================================
// Ministerial Decree 1205 compliance, Phase 2: bridges Hifzi recitation
// scores into the shared platform gradebook (student_final_grades), so
// Quran marks appear in the standard report card alongside every other
// subject — see report-cards.service.ts's generateReportCard, which joins
// student_final_grades -> course_period -> course -> subject and needs no
// changes of its own once rows exist here.
//
// This service never creates or owns subjects/courses/course_periods —
// those are set up through the existing, unmodified admin academics flow
// exactly like any other subject (one course_periods row per real school
// section with a real teacher-of-record). This bridge only READS that
// structure (via each student's own real section_id) to find the right
// course_period_id, then writes to student_final_grades — gradebook
// attribution is per-student, not per-circle, so "a Hifzi circle has no
// sections row" never has to be solved here.
//
// CA/Exam marks are written directly into student_final_grades' existing
// gradebook_percent/exam_percent/exam_weight columns via the existing
// finalGradesService.saveFinalGrade — bypassing gradebook_assignment_types/
// gradebook_assignments entirely (a Hifzi CA mark is a continuous signal
// from hifzi_sessions, not a discrete graded assignment). This also means
// the bridge never calls calculateAndSaveFinalGrades, whose exam_results
// join is explicitly commented in that file as simplified/stubbed — the
// bridge computes its own CA/Exam percentages from Hifzi data instead.
// ============================================================================

export interface HifziGradebookLink {
  id: string
  schoolId: string
  gradeLevelId: string
  academicYearId: string
  subjectId: string
  courseId: string
  caWeightPercent: number
  examWeightPercent: number
}

export interface LinkGradeLevelSubjectDTO {
  gradeLevelId: string
  academicYearId: string
  subjectId: string
  courseId: string
  caWeightPercent?: number
  examWeightPercent?: number
  createdBy?: string | null
}

export interface TermBridgeResult {
  processed: number
  saved: number
  skipped: number
  errors: string[]
}

export interface TermBridgePreviewRow {
  studentId: string
  studentName: string
  caPercent: number | null
  examPercent: number | null
  finalPercent: number | null
  letterGrade: string | null
}

interface SessionAverage {
  percent: number
  sessionCount: number
}

interface ResolvedCoursePeriod {
  id: string
  gradingScaleId: string | null
}

interface MarkingPeriodRange {
  startDate: string
  endDate: string
}

function rowToLink(row: any): HifziGradebookLink {
  return {
    id: row.id,
    schoolId: row.school_id,
    gradeLevelId: row.grade_level_id,
    academicYearId: row.academic_year_id,
    subjectId: row.subject_id,
    courseId: row.course_id,
    caWeightPercent: Number(row.ca_weight_percent),
    examWeightPercent: Number(row.exam_weight_percent),
  }
}

class HifziGradebookBridgeService {
  /** Creates a new active link, deactivating (not deleting) any prior active link for the same (school, grade, year) — same convention as ministry-syllabus.service.ts's upsertSyllabusTarget. */
  async linkGradeLevelSubject(schoolId: string, dto: LinkGradeLevelSubjectDTO): Promise<HifziGradebookLink> {
    const caWeight = dto.caWeightPercent ?? 70
    const examWeight = dto.examWeightPercent ?? 100 - caWeight
    if (Math.round((caWeight + examWeight) * 100) / 100 !== 100) {
      throw new Error('ca_weight_percent + exam_weight_percent must sum to 100')
    }

    await supabase
      .from('hifzi_gradebook_links')
      .update({ is_active: false })
      .eq('school_id', schoolId)
      .eq('grade_level_id', dto.gradeLevelId)
      .eq('academic_year_id', dto.academicYearId)
      .eq('is_active', true)

    const { data, error } = await supabase
      .from('hifzi_gradebook_links')
      .insert({
        school_id: schoolId,
        grade_level_id: dto.gradeLevelId,
        academic_year_id: dto.academicYearId,
        subject_id: dto.subjectId,
        course_id: dto.courseId,
        ca_weight_percent: caWeight,
        exam_weight_percent: examWeight,
        created_by: dto.createdBy ?? null,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to link grade level to gradebook: ${error.message}`)
    return rowToLink(data)
  }

  async getLink(schoolId: string, gradeLevelId: string, academicYearId: string): Promise<HifziGradebookLink | null> {
    const { data, error } = await supabase
      .from('hifzi_gradebook_links')
      .select('*')
      .eq('school_id', schoolId)
      .eq('grade_level_id', gradeLevelId)
      .eq('academic_year_id', academicYearId)
      .eq('is_active', true)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch gradebook link: ${error.message}`)
    return data ? rowToLink(data) : null
  }

  /** Mean of hifzi_sessions.raw_score (0-10, converted to a 0-100 percent) over [fromDate, toDate), excluding session_type='exam'. Null — never zero — if the student has no such sessions this term, so a term with no recitation doesn't silently record a failing mark. */
  async computeStudentCaMark(studentId: string, fromDate: string, toDate: string): Promise<SessionAverage | null> {
    return this.computeSessionAverage(studentId, fromDate, toDate, false)
  }

  /** Same, but session_type='exam' only. */
  async computeStudentExamMark(studentId: string, fromDate: string, toDate: string): Promise<SessionAverage | null> {
    return this.computeSessionAverage(studentId, fromDate, toDate, true)
  }

  private async computeSessionAverage(studentId: string, fromDate: string, toDate: string, examOnly: boolean): Promise<SessionAverage | null> {
    let query = supabase
      .from('hifzi_sessions')
      .select('raw_score')
      .eq('student_id', studentId)
      .is('superseded_by_id', null)
      .gte('created_at', fromDate)
      .lt('created_at', toDate)

    query = examOnly ? query.eq('session_type', 'exam') : query.neq('session_type', 'exam')

    const { data, error } = await query
    if (error) throw new Error(`Failed to compute session average: ${error.message}`)
    if (!data || data.length === 0) return null

    const scores = data.map((r: any) => Number(r.raw_score ?? 0))
    const meanOutOfTen = scores.reduce((a: number, b: number) => a + b, 0) / scores.length
    return { percent: meanOutOfTen * 10, sessionCount: scores.length }
  }

  /** Resolves the course_period_id for a student's real section under a given course — the bridge's only touchpoint with the shared gradebook schema. Null if the student has no section, or no course_period exists for that (course, section) pair — the caller skips, never fails the batch, for either case. */
  async resolveCoursePeriodForStudent(studentId: string, courseId: string): Promise<ResolvedCoursePeriod | null> {
    const { data: student, error: studentError } = await supabase.from('students').select('section_id').eq('id', studentId).single()
    if (studentError || !student?.section_id) return null

    const { data: coursePeriods, error } = await supabase
      .from('course_periods')
      .select('id, grading_scale_id, course:courses(grading_scale_id)')
      .eq('course_id', courseId)
      .eq('section_id', student.section_id)
      .limit(1)

    if (error) throw new Error(`Failed to resolve course period: ${error.message}`)
    if (!coursePeriods || coursePeriods.length === 0) return null

    const cp = coursePeriods[0] as any
    return { id: cp.id, gradingScaleId: cp.grading_scale_id ?? cp.course?.grading_scale_id ?? null }
  }

  /** No writes — the admin "preview before publishing" view. Includes each student's display name (a small batched lookup, preview-only — runTermBridge's write path doesn't need it) so an admin reviewing the table isn't staring at raw UUIDs. */
  async previewTermBridge(schoolId: string, gradeLevelId: string, academicYearId: string, markingPeriodId: string): Promise<TermBridgePreviewRow[]> {
    const { studentIds, link, marking } = await this.resolveContext(schoolId, gradeLevelId, academicYearId, markingPeriodId)
    if (!link) return []

    const namesById = await this.fetchStudentNames(studentIds)

    const results: TermBridgePreviewRow[] = []
    const CONCURRENCY = 10
    for (let i = 0; i < studentIds.length; i += CONCURRENCY) {
      const batch = studentIds.slice(i, i + CONCURRENCY)
      results.push(...(await Promise.all(batch.map((studentId) => this.computePreviewRow(studentId, namesById.get(studentId) ?? studentId, link, marking)))))
    }
    return results
  }

  private async fetchStudentNames(studentIds: string[]): Promise<Map<string, string>> {
    if (studentIds.length === 0) return new Map()
    const { data, error } = await supabase.from('students').select('id, profile:profiles(first_name, last_name)').in('id', studentIds)
    if (error) throw new Error(`Failed to fetch student names: ${error.message}`)
    const map = new Map<string, string>()
    for (const row of (data as any[]) || []) {
      const profile = row.profile
      const name = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : ''
      map.set(row.id, name || row.id)
    }
    return map
  }

  /** The per-term aggregation job — bounded concurrency (batches of 10, matching student-profiles.service.ts::enrollBulk / plans.service.ts's nightly-assignment batching), per-student try/catch so one failure can't abort the batch. */
  async runTermBridge(schoolId: string, gradeLevelId: string, academicYearId: string, markingPeriodId: string, runBy?: string): Promise<TermBridgeResult> {
    const result: TermBridgeResult = { processed: 0, saved: 0, skipped: 0, errors: [] }

    const { studentIds, link, marking } = await this.resolveContext(schoolId, gradeLevelId, academicYearId, markingPeriodId)
    if (!link) {
      result.errors.push('No active gradebook link configured for this grade level/academic year')
      return result
    }

    const CONCURRENCY = 10
    for (let i = 0; i < studentIds.length; i += CONCURRENCY) {
      const batch = studentIds.slice(i, i + CONCURRENCY)
      await Promise.all(
        batch.map(async (studentId) => {
          result.processed++
          try {
            const outcome = await this.bridgeOneStudent(schoolId, studentId, link, marking, markingPeriodId, academicYearId, runBy)
            if (outcome === 'saved') result.saved++
            else result.skipped++
          } catch (err: any) {
            result.skipped++
            result.errors.push(`Student ${studentId}: ${err.message || err}`)
          }
        })
      )
    }
    return result
  }

  private async resolveContext(schoolId: string, gradeLevelId: string, academicYearId: string, markingPeriodId: string) {
    const link = await this.getLink(schoolId, gradeLevelId, academicYearId)

    const { data: marking, error: markingError } = await supabase
      .from('marking_periods')
      .select('start_date, end_date')
      .eq('id', markingPeriodId)
      .single()
    if (markingError || !marking?.start_date || !marking?.end_date) {
      throw new Error(`Marking period ${markingPeriodId} not found or has no date range`)
    }

    const { data: enrollments, error: enrollError } = await supabase
      .from('hifzi_enrollments')
      .select('student_id, students!inner(grade_level_id)')
      .eq('status', 'active')
      .eq('students.grade_level_id', gradeLevelId)
    if (enrollError) throw new Error(`Failed to fetch enrolled students: ${enrollError.message}`)

    const studentIds = [...new Set((enrollments || []).map((e: any) => e.student_id))]
    return { studentIds, link, marking: { startDate: marking.start_date, endDate: marking.end_date } as MarkingPeriodRange }
  }

  private blend(ca: SessionAverage | null, exam: SessionAverage | null, link: HifziGradebookLink): number | null {
    if (ca && exam) return ca.percent * (link.caWeightPercent / 100) + exam.percent * (link.examWeightPercent / 100)
    if (ca) return ca.percent
    if (exam) return exam.percent
    return null
  }

  private async resolveLetterGrade(finalPercent: number, gradingScaleId: string | null): Promise<{ title?: string; gpaValue?: number }> {
    if (!gradingScaleId) return {}
    const gradeEntry = await gradingScalesService.calculateLetterGrade(finalPercent, gradingScaleId)
    return gradeEntry ? { title: gradeEntry.title, gpaValue: gradeEntry.gpa_value } : {}
  }

  private async computePreviewRow(studentId: string, studentName: string, link: HifziGradebookLink, marking: MarkingPeriodRange): Promise<TermBridgePreviewRow> {
    const [ca, exam] = await Promise.all([
      this.computeStudentCaMark(studentId, marking.startDate, marking.endDate),
      this.computeStudentExamMark(studentId, marking.startDate, marking.endDate),
    ])
    const finalPercent = this.blend(ca, exam, link)

    let letterGrade: string | null = null
    if (finalPercent !== null) {
      const coursePeriod = await this.resolveCoursePeriodForStudent(studentId, link.courseId)
      letterGrade = (await this.resolveLetterGrade(finalPercent, coursePeriod?.gradingScaleId ?? null)).title ?? null
    }

    return { studentId, studentName, caPercent: ca?.percent ?? null, examPercent: exam?.percent ?? null, finalPercent, letterGrade }
  }

  private async bridgeOneStudent(
    schoolId: string,
    studentId: string,
    link: HifziGradebookLink,
    marking: MarkingPeriodRange,
    markingPeriodId: string,
    academicYearId: string,
    runBy?: string
  ): Promise<'saved' | 'skipped'> {
    const [ca, exam] = await Promise.all([
      this.computeStudentCaMark(studentId, marking.startDate, marking.endDate),
      this.computeStudentExamMark(studentId, marking.startDate, marking.endDate),
    ])
    const finalPercent = this.blend(ca, exam, link)
    if (finalPercent === null) throw new Error('no Hifzi sessions this term')

    const coursePeriod = await this.resolveCoursePeriodForStudent(studentId, link.courseId)
    if (!coursePeriod) throw new Error("no linked course_period for this student's section")

    // Guard against clobbering a manual override — never revert a teacher's
    // correction just because the bridge re-ran.
    const { data: existing } = await supabase
      .from('student_final_grades')
      .select('is_override')
      .eq('student_id', studentId)
      .eq('course_period_id', coursePeriod.id)
      .eq('marking_period_id', markingPeriodId)
      .maybeSingle()
    if (existing?.is_override) throw new Error('existing grade is a manual override — not overwritten')

    const { title: letterGrade, gpaValue } = await this.resolveLetterGrade(finalPercent, coursePeriod.gradingScaleId)

    await finalGradesService.saveFinalGrade(
      schoolId,
      {
        student_id: studentId,
        course_period_id: coursePeriod.id,
        marking_period_id: markingPeriodId,
        academic_year_id: academicYearId,
        percent_grade: Math.round(finalPercent * 100) / 100,
        letter_grade: letterGrade,
        gpa_value: gpaValue,
        gradebook_percent: ca?.percent ?? null,
        exam_percent: exam?.percent ?? null,
        exam_weight: link.examWeightPercent,
        grade_source: 'hifzi_bridge',
      },
      runBy
    )
    return 'saved'
  }
}

export const hifziGradebookBridgeService = new HifziGradebookBridgeService()
