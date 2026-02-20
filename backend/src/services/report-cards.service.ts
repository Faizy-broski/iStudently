import { supabase } from '../config/supabase'
import { finalGradesService } from './final-grades.service'
import type {
  ReportCardCommentCategory,
  ReportCardComment,
  CommentCodeScale,
  CommentCode,
  StudentReportCardComment,
} from '../types/grades.types'

// ============================================================================
// REPORT CARDS SERVICE
// Manages comment categories, comments, comment codes, and generates
// report card data aggregating final grades + comments.
// ============================================================================

class ReportCardsService {

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
  // COMMENT CATEGORIES
  // ──────────────────────────────────────────────────────────────────────────

  async getCategories(schoolId: string): Promise<ReportCardCommentCategory[]> {
    const { data, error } = await supabase
      .from('report_card_comment_categories')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('sort_order')

    if (error) throw new Error(`Failed to fetch comment categories: ${error.message}`)
    return (data || []) as ReportCardCommentCategory[]
  }

  async createCategory(schoolId: string, title: string, sortOrder?: number, campusId?: string): Promise<ReportCardCommentCategory> {
    const { data, error } = await supabase
      .from('report_card_comment_categories')
      .insert({ school_id: schoolId, campus_id: campusId || null, title, sort_order: sortOrder || 0 })
      .select()
      .single()

    if (error) throw new Error(`Failed to create comment category: ${error.message}`)
    return data as ReportCardCommentCategory
  }

  async updateCategory(id: string, updates: { title?: string; sort_order?: number }): Promise<ReportCardCommentCategory> {
    const { data, error } = await supabase
      .from('report_card_comment_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Failed to update comment category: ${error.message}`)
    return data as ReportCardCommentCategory
  }

  async deleteCategory(id: string): Promise<void> {
    const { error } = await supabase
      .from('report_card_comment_categories')
      .update({ is_active: false })
      .eq('id', id)

    if (error) throw new Error(`Failed to delete comment category: ${error.message}`)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // COMMENTS (pre-defined templates)
  // ──────────────────────────────────────────────────────────────────────────

  async getComments(schoolId: string, categoryId?: string): Promise<ReportCardComment[]> {
    let query = supabase
      .from('report_card_comments')
      .select(`
        *,
        category:report_card_comment_categories(id, title)
      `)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('sort_order')

    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }

    const { data, error } = await query
    if (error) throw new Error(`Failed to fetch comments: ${error.message}`)
    return (data || []) as ReportCardComment[]
  }

  async createComment(schoolId: string, dto: {
    category_id?: string
    title: string
    comment: string
    sort_order?: number
    campus_id?: string
  }): Promise<ReportCardComment> {
    const { data, error } = await supabase
      .from('report_card_comments')
      .insert({
        school_id: schoolId,
        campus_id: dto.campus_id || null,
        category_id: dto.category_id,
        title: dto.title,
        comment: dto.comment,
        sort_order: dto.sort_order || 0,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create comment: ${error.message}`)
    return data as ReportCardComment
  }

  async updateComment(id: string, updates: Partial<{
    category_id: string
    title: string
    comment: string
    sort_order: number
  }>): Promise<ReportCardComment> {
    const { data, error } = await supabase
      .from('report_card_comments')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Failed to update comment: ${error.message}`)
    return data as ReportCardComment
  }

  async deleteComment(id: string): Promise<void> {
    const { error } = await supabase
      .from('report_card_comments')
      .update({ is_active: false })
      .eq('id', id)

    if (error) throw new Error(`Failed to delete comment: ${error.message}`)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // COMMENT CODE SCALES & CODES
  // ──────────────────────────────────────────────────────────────────────────

  async getCodeScales(schoolId: string): Promise<CommentCodeScale[]> {
    const { data, error } = await supabase
      .from('comment_code_scales')
      .select(`
        *,
        codes:comment_codes(id, title, short_name, comment, sort_order, is_active)
      `)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('sort_order')

    if (error) throw new Error(`Failed to fetch code scales: ${error.message}`)
    return (data || []) as CommentCodeScale[]
  }

  async createCodeScale(schoolId: string, title: string, comment?: string, campusId?: string): Promise<CommentCodeScale> {
    const { data, error } = await supabase
      .from('comment_code_scales')
      .insert({ school_id: schoolId, campus_id: campusId || null, title, comment })
      .select()
      .single()

    if (error) throw new Error(`Failed to create code scale: ${error.message}`)
    return data as CommentCodeScale
  }

  async createCode(scaleId: string, schoolId: string, dto: {
    title: string
    short_name?: string
    comment?: string
    sort_order?: number
  }): Promise<CommentCode> {
    const { data, error } = await supabase
      .from('comment_codes')
      .insert({
        scale_id: scaleId,
        school_id: schoolId,
        title: dto.title,
        short_name: dto.short_name,
        comment: dto.comment,
        sort_order: dto.sort_order || 0,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create code: ${error.message}`)
    return data as CommentCode
  }

  async deleteCodeScale(id: string): Promise<void> {
    const { error } = await supabase.from('comment_code_scales').update({ is_active: false }).eq('id', id)
    if (error) throw new Error(`Failed to delete code scale: ${error.message}`)
  }

  async deleteCode(id: string): Promise<void> {
    const { error } = await supabase.from('comment_codes').update({ is_active: false }).eq('id', id)
    if (error) throw new Error(`Failed to delete code: ${error.message}`)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STUDENT REPORT CARD COMMENTS
  // ──────────────────────────────────────────────────────────────────────────

  async getStudentComments(
    studentId: string,
    markingPeriodId: string,
    coursePeriodId?: string
  ): Promise<StudentReportCardComment[]> {
    let query = supabase
      .from('student_report_card_comments')
      .select(`
        *,
        comment:report_card_comments(id, title, comment, category:report_card_comment_categories(id, title)),
        comment_code:comment_codes(id, title, short_name)
      `)
      .eq('student_id', studentId)
      .eq('marking_period_id', markingPeriodId)

    if (coursePeriodId) {
      query = query.eq('course_period_id', coursePeriodId)
    }

    const { data, error } = await query.order('created_at')
    if (error) throw new Error(`Failed to fetch student comments: ${error.message}`)
    return (data || []) as StudentReportCardComment[]
  }

  async saveStudentComment(schoolId: string, dto: {
    student_id: string
    course_period_id: string
    marking_period_id: string
    comment_id?: string
    comment_code_id?: string
    custom_comment?: string
  }, createdBy?: string): Promise<StudentReportCardComment> {
    const campusId = await this.getCampusId(dto.course_period_id)
    const { data, error } = await supabase
      .from('student_report_card_comments')
      .upsert({
        school_id: schoolId,
        campus_id: campusId,
        student_id: dto.student_id,
        course_period_id: dto.course_period_id,
        marking_period_id: dto.marking_period_id,
        comment_id: dto.comment_id,
        comment_code_id: dto.comment_code_id,
        custom_comment: dto.custom_comment,
        created_by: createdBy,
      }, { onConflict: 'student_id,course_period_id,marking_period_id,comment_id' })
      .select()
      .single()

    if (error) throw new Error(`Failed to save student comment: ${error.message}`)
    return data as StudentReportCardComment
  }

  async deleteStudentComment(id: string): Promise<void> {
    const { error } = await supabase
      .from('student_report_card_comments')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Failed to delete student comment: ${error.message}`)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // REPORT CARD GENERATION
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Generate full report card data for a student in a marking period.
   * Combines: final grades + comments + student info.
   */
  async generateReportCard(
    studentId: string,
    markingPeriodId: string,
    academicYearId: string
  ): Promise<{
    student: any
    school: any
    marking_period: any
    academic_year: any
    grades: Array<{
      course_title: string
      subject_name: string
      teacher_name: string
      percent_grade: number | null
      letter_grade: string | null
      gpa_value: number | null
      credit_hours: number
      comments: StudentReportCardComment[]
    }>
    summary: {
      total_credits_attempted: number
      total_credits_earned: number
      gpa: number | null
    }
  }> {
    // Fetch student, school, marking period, academic year in parallel
    const [studentResult, mpResult, ayResult] = await Promise.all([
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
      supabase
        .from('marking_periods')
        .select('*')
        .eq('id', markingPeriodId)
        .single(),
      supabase
        .from('academic_years')
        .select('*')
        .eq('id', academicYearId)
        .single(),
    ])

    if (studentResult.error) throw new Error(`Student not found: ${studentResult.error.message}`)

    // Get final grades for this student + marking period
    const finalGrades = await finalGradesService.getStudentFinalGrades(studentId, academicYearId)
    const mpGrades = finalGrades.filter((g) => g.marking_period_id === markingPeriodId)

    // Fetch teacher names for all unique teacher_ids
    const teacherIds = [...new Set(mpGrades.map((g) => (g.course_period as any)?.teacher_id).filter(Boolean))]
    const teacherMap: Record<string, string> = {}
    if (teacherIds.length > 0) {
      const { data: staffRows } = await supabase
        .from('staff')
        .select('id, profile:profiles(first_name, last_name)')
        .in('id', teacherIds)
      for (const s of staffRows || []) {
        const p = Array.isArray(s.profile) ? s.profile[0] : s.profile
        teacherMap[s.id] = `${p?.first_name || ''} ${p?.last_name || ''}`.trim()
      }
    }

    // Get comments
    const comments = await this.getStudentComments(studentId, markingPeriodId)

    // Build grade rows
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
        comments: comments.filter((c) => c.course_period_id === fg.course_period_id),
      }
    })

    // Calculate GPA summary
    let totalCreditsAttempted = 0
    let totalCreditsEarned = 0
    let totalGradePoints = 0

    for (const g of mpGrades) {
      const credits = (g.course_period as any)?.course?.credit_hours || 1
      totalCreditsAttempted += g.credit_attempted || credits
      totalCreditsEarned += g.credit_earned || 0
      totalGradePoints += (g.gpa_value || 0) * credits
    }

    const gpa = totalCreditsAttempted > 0
      ? Math.round((totalGradePoints / totalCreditsAttempted) * 100) / 100
      : null

    return {
      student: studentResult.data,
      school: (studentResult.data as any)?.school,
      marking_period: mpResult.data,
      academic_year: ayResult.data,
      grades,
      summary: {
        total_credits_attempted: totalCreditsAttempted,
        total_credits_earned: totalCreditsEarned,
        gpa,
      },
    }
  }

  /**
   * Generate report cards for multiple students.
   * Loops through student_ids and calls generateReportCard for each.
   */
  async generateReportCards(
    studentIds: string[],
    options: {
      marking_period_ids: string[]
      academic_year_id?: string
      campus_id?: string
      [key: string]: any
    }
  ): Promise<{ report_cards: any[] }> {
    // We need an academic_year_id. If not provided, try to find the active one.
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
    if (!academicYearId) {
      throw new Error('academic_year_id is required or no active academic year found')
    }

    const markingPeriodIds = options.marking_period_ids || []
    if (markingPeriodIds.length === 0) {
      throw new Error('At least one marking_period_id is required')
    }

    const reportCards: any[] = []

    for (const studentId of studentIds) {
      for (const mpId of markingPeriodIds) {
        try {
          const card = await this.generateReportCard(studentId, mpId, academicYearId)
          reportCards.push({ ...card, options })
        } catch (err: any) {
          console.error(`Error generating report card for student ${studentId}, MP ${mpId}:`, err.message)
          reportCards.push({ student_id: studentId, marking_period_id: mpId, error: err.message })
        }
      }
    }

    return { report_cards: reportCards }
  }
}

export const reportCardsService = new ReportCardsService()
