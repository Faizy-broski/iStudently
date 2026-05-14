import { supabase } from '../config/supabase'
import type {
  GradebookAssignmentType,
  GradebookAssignment,
  GradebookGrade,
  GradebookConfig,
  CreateGradebookAssignmentTypeDTO,
  UpdateGradebookAssignmentTypeDTO,
  CreateGradebookAssignmentDTO,
  UpdateGradebookAssignmentDTO,
  EnterGradeDTO,
  BulkEnterGradesDTO,
} from '../types/grades.types'

// ============================================================================
// GRADEBOOK SERVICE
// Core teacher-facing gradebook: assignment types, assignments, grades entry
// ============================================================================

class GradebookService {

  // ──────────────────────────────────────────────────────────────────────────
  // HELPER: Resolve campus_id from course_period
  // ──────────────────────────────────────────────────────────────────────────

  private async getCampusId(coursePeriodId: string): Promise<string | null> {
    const { data } = await supabase
      .from('course_periods')
      .select('campus_id')
      .eq('id', coursePeriodId)
      .single()
    return data?.campus_id || null
  }

  /**
   * Returns the campus assignment_max_points cap (NULL = disabled).
   * Mirrors RosarioSIS "Assignment Max Points" plugin config lookup.
   */
  private async getAssignmentMaxPoints(schoolId: string): Promise<number | null> {
    const { data } = await supabase
      .from('school_settings')
      .select('assignment_max_points')
      .eq('school_id', schoolId)
      .maybeSingle()
    return data?.assignment_max_points ?? null
  }

  /**
   * Throws if points exceeds the campus cap (when the cap is set).
   */
  private async enforceMaxPoints(schoolId: string, points: number): Promise<void> {
    const cap = await this.getAssignmentMaxPoints(schoolId)
    if (cap != null && points > cap) {
      throw new Error(
        `Points (${points}) exceeds the campus maximum of ${cap}. Please correct.`
      )
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ASSIGNMENT TYPES (categories: Homework, Quizzes, Tests, etc.)
  // ──────────────────────────────────────────────────────────────────────────

  async getAssignmentTypes(coursePeriodId: string): Promise<GradebookAssignmentType[]> {
    const { data, error } = await supabase
      .from('gradebook_assignment_types')
      .select('*')
      .eq('course_period_id', coursePeriodId)
      .eq('is_active', true)
      .order('sort_order')

    if (error) throw new Error(`Failed to fetch assignment types: ${error.message}`)
    return (data || []) as GradebookAssignmentType[]
  }

  async getAssignmentTypesByCourse(courseId: string): Promise<GradebookAssignmentType[]> {
    const { data, error } = await supabase
      .from('gradebook_assignment_types')
      .select('*')
      .eq('course_id', courseId)
      .eq('is_active', true)
      .order('sort_order')

    if (error) throw new Error(`Failed to fetch assignment types: ${error.message}`)
    return (data || []) as GradebookAssignmentType[]
  }

  async getAssignmentTypesByScope(campusId?: string, schoolId?: string): Promise<GradebookAssignmentType[]> {
    let query = supabase
      .from('gradebook_assignment_types')
      .select('*')
      .eq('is_active', true)
      .is('course_period_id', null)
      .order('sort_order')

    if (campusId) {
      query = query.eq('campus_id', campusId)
    } else if (schoolId) {
      query = query.eq('school_id', schoolId)
    } else {
      return []
    }

    const { data, error } = await query
    if (error) throw new Error(`Failed to fetch assignment types: ${error.message}`)
    return (data || []) as GradebookAssignmentType[]
  }

  async createAssignmentType(
    schoolId: string,
    coursePeriodId: string | null,
    dto: CreateGradebookAssignmentTypeDTO,
    createdBy?: string
  ): Promise<GradebookAssignmentType> {
    let campusId = (dto as any).campus_id || null
    if (coursePeriodId && !campusId) {
      campusId = await this.getCampusId(coursePeriodId)
    }
    const { data, error } = await supabase
      .from('gradebook_assignment_types')
      .insert({
        school_id: schoolId,
        campus_id: campusId,
        course_period_id: coursePeriodId,
        course_id: dto.course_id,
        title: dto.title,
        final_grade_percent: dto.final_grade_percent || 0,
        sort_order: dto.sort_order || 0,
        created_by: createdBy,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create assignment type: ${error.message}`)
    return data as GradebookAssignmentType
  }

  async updateAssignmentType(id: string, dto: UpdateGradebookAssignmentTypeDTO): Promise<GradebookAssignmentType> {
    const { data, error } = await supabase
      .from('gradebook_assignment_types')
      .update(dto)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Failed to update assignment type: ${error.message}`)
    return data as GradebookAssignmentType
  }

  async deleteAssignmentType(id: string): Promise<void> {
    // Soft delete - set is_active = false
    const { error } = await supabase
      .from('gradebook_assignment_types')
      .update({ is_active: false })
      .eq('id', id)

    if (error) throw new Error(`Failed to delete assignment type: ${error.message}`)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ASSIGNMENTS (individual items within a type)
  // ──────────────────────────────────────────────────────────────────────────

  async getAssignments(coursePeriodId: string, assignmentTypeId?: string): Promise<GradebookAssignment[]> {
    let query = supabase
      .from('gradebook_assignments')
      .select(`
        *,
        assignment_type:gradebook_assignment_types(id, title, final_grade_percent)
      `)
      .eq('course_period_id', coursePeriodId)
      .eq('is_active', true)
      .order('due_date', { ascending: false })

    if (assignmentTypeId) {
      query = query.eq('assignment_type_id', assignmentTypeId)
    }

    const { data, error } = await query
    if (error) throw new Error(`Failed to fetch assignments: ${error.message}`)
    return (data || []) as GradebookAssignment[]
  }

  async getAssignmentById(id: string): Promise<GradebookAssignment | null> {
    const { data, error } = await supabase
      .from('gradebook_assignments')
      .select(`
        *,
        assignment_type:gradebook_assignment_types(id, title, final_grade_percent)
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch assignment: ${error.message}`)
    }
    return data as GradebookAssignment
  }

  async createAssignment(
    schoolId: string,
    coursePeriodId: string,
    dto: CreateGradebookAssignmentDTO,
    createdBy?: string
  ): Promise<GradebookAssignment> {
    if (dto.points != null) {
      await this.enforceMaxPoints(schoolId, dto.points)
    }
    const campusId = await this.getCampusId(coursePeriodId)
    const { data, error } = await supabase
      .from('gradebook_assignments')
      .insert({
        school_id: schoolId,
        campus_id: campusId,
        course_period_id: coursePeriodId,
        assignment_type_id: dto.assignment_type_id,
        title: dto.title,
        description: dto.description,
        assigned_date: dto.assigned_date,
        due_date: dto.due_date,
        points: dto.points || 100,
        default_points: dto.default_points,
        weight: dto.weight || 1.00,
        is_extra_credit: dto.is_extra_credit || false,
        sort_order: dto.sort_order || 0,
        file_url: dto.file_url || null,
        enable_submission: dto.enable_submission ?? false,
        created_by: createdBy,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create assignment: ${error.message}`)
    return data as GradebookAssignment
  }

  async updateAssignment(id: string, dto: UpdateGradebookAssignmentDTO): Promise<GradebookAssignment> {
    // Strip joined/computed fields that are not columns on the table
    const { assignment_type_id, title, points, default_points, weight,
            assigned_date, due_date, description, is_extra_credit,
            sort_order, is_active, file_url, enable_submission } = dto as any
    const updatePayload: Record<string, unknown> = {}
    if (assignment_type_id !== undefined) updatePayload.assignment_type_id = assignment_type_id
    if (title !== undefined) updatePayload.title = title
    if (points !== undefined) updatePayload.points = points
    if (default_points !== undefined) updatePayload.default_points = default_points
    if (weight !== undefined) updatePayload.weight = weight
    if (assigned_date !== undefined) updatePayload.assigned_date = assigned_date
    if (due_date !== undefined) updatePayload.due_date = due_date
    if (description !== undefined) updatePayload.description = description
    if (is_extra_credit !== undefined) updatePayload.is_extra_credit = is_extra_credit
    if (sort_order !== undefined) updatePayload.sort_order = sort_order
    if (is_active !== undefined) updatePayload.is_active = is_active
    if (file_url !== undefined) updatePayload.file_url = file_url
    if (enable_submission !== undefined) updatePayload.enable_submission = enable_submission

    const { data, error } = await supabase
      .from('gradebook_assignments')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Failed to update assignment: ${error.message}`)
    return data as GradebookAssignment
  }

  async deleteAssignment(id: string): Promise<void> {
    const { error } = await supabase
      .from('gradebook_assignments')
      .update({ is_active: false })
      .eq('id', id)

    if (error) throw new Error(`Failed to delete assignment: ${error.message}`)
  }

  async massCreateAssignment(
    schoolId: string,
    dto: {
      title: string
      assignment_type_id: string
      points: number
      default_points?: number | null
      weight?: number | null
      description?: string | null
      assigned_date?: string | null
      due_date?: string | null
      enable_submission?: boolean
      course_period_ids: string[]
    },
    createdBy?: string
  ): Promise<number> {
    if (dto.points != null) {
      await this.enforceMaxPoints(schoolId, dto.points)
    }

    const rows = await Promise.all(
      dto.course_period_ids.map(async (cpId) => {
        const campusId = await this.getCampusId(cpId)
        return {
          school_id: schoolId,
          campus_id: campusId,
          course_period_id: cpId,
          assignment_type_id: dto.assignment_type_id,
          title: dto.title,
          description: dto.description || null,
          assigned_date: dto.assigned_date || null,
          due_date: dto.due_date || null,
          points: dto.points || 100,
          default_points: dto.default_points ?? null,
          weight: dto.weight ?? 1.00,
          created_by: createdBy,
        }
      })
    )

    const { data, error } = await supabase
      .from('gradebook_assignments')
      .insert(rows)
      .select('id')

    if (error) throw new Error(`Failed to mass create assignments: ${error.message}`)
    return data?.length || 0
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GRADES ENTRY
  // ──────────────────────────────────────────────────────────────────────────

  async getGradesForAssignment(assignmentId: string): Promise<GradebookGrade[]> {
    const { data, error } = await supabase
      .from('gradebook_grades')
      .select(`
        *,
        student:students(
          id, student_id,
          profile:profiles(first_name, last_name)
        )
      `)
      .eq('assignment_id', assignmentId)
      .order('created_at')

    if (error) throw new Error(`Failed to fetch grades: ${error.message}`)
    return (data || []) as GradebookGrade[]
  }

  async getGradesForStudent(studentId: string, coursePeriodId: string): Promise<GradebookGrade[]> {
    const { data, error } = await supabase
      .from('gradebook_grades')
      .select(`
        *,
        assignment:gradebook_assignments(
          id, title, points, due_date, is_extra_credit,
          assignment_type:gradebook_assignment_types(id, title, final_grade_percent)
        )
      `)
      .eq('student_id', studentId)
      .eq('course_period_id', coursePeriodId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch student grades: ${error.message}`)
    return (data || []) as GradebookGrade[]
  }

  async enterGrade(schoolId: string, dto: EnterGradeDTO, gradedBy?: string): Promise<GradebookGrade> {
    const campusId = await this.getCampusId(dto.course_period_id)
    const { data, error } = await supabase
      .from('gradebook_grades')
      .upsert({
        school_id: schoolId,
        campus_id: campusId,
        assignment_id: dto.assignment_id,
        student_id: dto.student_id,
        course_period_id: dto.course_period_id,
        points: dto.points,
        letter_grade: dto.letter_grade,
        comment: dto.comment,
        is_exempt: dto.is_exempt || false,
        is_late: dto.is_late || false,
        is_missing: dto.is_missing || false,
        is_incomplete: dto.is_incomplete || false,
        graded_at: new Date().toISOString(),
        graded_by: gradedBy,
      }, { onConflict: 'assignment_id,student_id' })
      .select()
      .single()

    if (error) throw new Error(`Failed to enter grade: ${error.message}`)
    return data as GradebookGrade
  }

  async bulkEnterGrades(schoolId: string, dto: BulkEnterGradesDTO, gradedBy?: string): Promise<GradebookGrade[]> {
    const campusId = await this.getCampusId(dto.course_period_id)
    const records = dto.grades.map((g) => ({
      school_id: schoolId,
      campus_id: campusId,
      assignment_id: dto.assignment_id,
      student_id: g.student_id,
      course_period_id: dto.course_period_id,
      points: g.points,
      letter_grade: g.letter_grade,
      comment: g.comment,
      is_exempt: g.is_exempt || false,
      is_late: g.is_late || false,
      is_missing: g.is_missing || false,
      is_incomplete: g.is_incomplete || false,
      graded_at: new Date().toISOString(),
      graded_by: gradedBy,
    }))

    const { data, error } = await supabase
      .from('gradebook_grades')
      .upsert(records, { onConflict: 'assignment_id,student_id' })
      .select()

    if (error) throw new Error(`Failed to bulk enter grades: ${error.message}`)
    return (data || []) as GradebookGrade[]
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GRADE CALCULATIONS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Calculate the overall grade for a student in a course period.
   * Uses the DB function or falls back to TypeScript calculation.
   */
  async calculateStudentAverage(studentId: string, coursePeriodId: string): Promise<{
    percentage: number | null
    letter_grade: string | null
    gpa_value: number | null
    breakdown: Array<{
      category: string
      earned: number
      possible: number
      percentage: number
      weight: number
    }>
  }> {
    // Get assignment types with their weights
    const types = await this.getAssignmentTypes(coursePeriodId)
    if (types.length === 0) {
      return { percentage: null, letter_grade: null, gpa_value: null, breakdown: [] }
    }

    const breakdown: Array<{
      category: string
      earned: number
      possible: number
      percentage: number
      weight: number
    }> = []

    let totalWeighted = 0
    let totalWeight = 0

    for (const type of types) {
      // Get all assignments for this type
      const { data: assignments } = await supabase
        .from('gradebook_assignments')
        .select('id, points')
        .eq('assignment_type_id', type.id)
        .eq('is_active', true)

      if (!assignments || assignments.length === 0) continue

      // Get grades for this student in these assignments
      const assignmentIds = assignments.map((a) => a.id)
      const { data: grades } = await supabase
        .from('gradebook_grades')
        .select('assignment_id, points, is_exempt')
        .eq('student_id', studentId)
        .in('assignment_id', assignmentIds)

      let earned = 0
      let possible = 0

      for (const assignment of assignments) {
        const grade = grades?.find((g) => g.assignment_id === assignment.id)
        if (grade && !grade.is_exempt) {
          earned += grade.points || 0
          possible += assignment.points
        } else if (!grade) {
          // No grade entered yet — count as 0 earned but ignore in possible
          // (RosarioSIS style: only count graded items)
        }
      }

      if (possible > 0) {
        const catPercent = (earned / possible) * 100
        const weight = type.final_grade_percent || 0

        breakdown.push({
          category: type.title,
          earned,
          possible,
          percentage: Math.round(catPercent * 100) / 100,
          weight,
        })

        if (weight > 0) {
          totalWeighted += (earned / possible) * weight
          totalWeight += weight
        }
      }
    }

    if (totalWeight === 0) {
      return { percentage: null, letter_grade: null, gpa_value: null, breakdown }
    }

    const percentage = Math.round((totalWeighted / totalWeight) * 100 * 100) / 100

    // Get grading scale from course period
    const { data: cp } = await supabase
      .from('course_periods')
      .select('grading_scale_id, course:courses(grading_scale_id)')
      .eq('id', coursePeriodId)
      .single()

    const scaleId = cp?.grading_scale_id || (cp?.course as any)?.grading_scale_id

    let letter_grade: string | null = null
    let gpa_value: number | null = null

    if (scaleId) {
      const { data: gradeEntry } = await supabase
        .from('grading_scale_grades')
        .select('title, gpa_value')
        .eq('grading_scale_id', scaleId)
        .eq('is_active', true)
        .lte('break_off', percentage)
        .order('break_off', { ascending: false })
        .limit(1)
        .single()

      if (gradeEntry) {
        letter_grade = gradeEntry.title
        gpa_value = gradeEntry.gpa_value
      }
    }

    return { percentage, letter_grade, gpa_value, breakdown }
  }

  /**
   * Get a full gradebook view: all assignments x all students with grades.
   */
  async getGradebookView(coursePeriodId: string, sectionId?: string): Promise<{
    assignment_types: GradebookAssignmentType[]
    assignments: GradebookAssignment[]
    students: Array<{ id: string; student_number: string; first_name: string; last_name: string }>
    grades: GradebookGrade[]
  }> {
    // If section_id not provided, look it up from the course period
    let resolvedSectionId = sectionId
    if (!resolvedSectionId) {
      const { data: cp } = await supabase
        .from('course_periods')
        .select('section_id')
        .eq('id', coursePeriodId)
        .single()
      resolvedSectionId = cp?.section_id || undefined
    }

    // Parallel fetch
    const [typesResult, assignmentsResult, studentsResult, gradesResult] = await Promise.all([
      supabase
        .from('gradebook_assignment_types')
        .select('*')
        .eq('course_period_id', coursePeriodId)
        .eq('is_active', true)
        .order('sort_order'),

      supabase
        .from('gradebook_assignments')
        .select('*')
        .eq('course_period_id', coursePeriodId)
        .eq('is_active', true)
        .order('due_date'),

      resolvedSectionId
        ? supabase
            .from('students')
            .select('id, student_number, profile:profiles(first_name, last_name)')
            .eq('section_id', resolvedSectionId)
            .eq('is_active', true)
            .order('student_number')
        : Promise.resolve({ data: [], error: null }),

      supabase
        .from('gradebook_grades')
        .select('*')
        .eq('course_period_id', coursePeriodId),
    ])

    if (typesResult.error) throw new Error(`Failed to fetch types: ${typesResult.error.message}`)
    if (assignmentsResult.error) throw new Error(`Failed to fetch assignments: ${assignmentsResult.error.message}`)
    if (studentsResult.error) throw new Error(`Failed to fetch students: ${studentsResult.error.message}`)
    if (gradesResult.error) throw new Error(`Failed to fetch grades: ${gradesResult.error.message}`)

    const students = (studentsResult.data || []).map((s: any) => ({
      id: s.id,
      student_number: s.student_number,
      first_name: s.profile?.first_name || '',
      last_name: s.profile?.last_name || '',
    }))

    return {
      assignment_types: (typesResult.data || []) as GradebookAssignmentType[],
      assignments: (assignmentsResult.data || []) as GradebookAssignment[],
      students,
      grades: (gradesResult.data || []) as GradebookGrade[],
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GRADEBOOK CONFIG
  // ──────────────────────────────────────────────────────────────────────────

  async getConfig(schoolId: string, coursePeriodId?: string): Promise<Record<string, string>> {
    let query = supabase
      .from('gradebook_config')
      .select('config_key, config_value')
      .eq('school_id', schoolId)

    if (coursePeriodId) {
      query = query.or(`course_period_id.eq.${coursePeriodId},course_period_id.is.null`)
    } else {
      query = query.is('course_period_id', null)
    }

    const { data, error } = await query
    if (error) throw new Error(`Failed to fetch config: ${error.message}`)

    const config: Record<string, string> = {}
    // School-level first, then course-period overrides
    for (const row of data || []) {
      config[row.config_key] = row.config_value
    }
    return config
  }

  async setConfig(schoolId: string, coursePeriodId: string | null, key: string, value: string): Promise<void> {
    const { error } = await supabase
      .from('gradebook_config')
      .upsert({
        school_id: schoolId,
        course_period_id: coursePeriodId,
        config_key: key,
        config_value: value,
      }, { onConflict: 'school_id,course_period_id,config_key' })

    if (error) throw new Error(`Failed to set config: ${error.message}`)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ANOMALOUS GRADES
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Find students whose grades differ significantly from class average.
   */
  async getAnomalousGrades(coursePeriodId: string, threshold: number = 20): Promise<Array<{
    student_id: string
    student_name: string
    student_average: number
    class_average: number
    difference: number
  }>> {
    // Get all students in this course period's section
    const { data: cp } = await supabase
      .from('course_periods')
      .select('section_id')
      .eq('id', coursePeriodId)
      .single()

    if (!cp?.section_id) return []

    const { data: students } = await supabase
      .from('students')
      .select('id, profile:profiles(first_name, last_name)')
      .eq('section_id', cp.section_id)

    if (!students || students.length === 0) return []

    // Calculate each student's average
    const studentAverages: Array<{
      student_id: string
      student_name: string
      average: number
    }> = []

    for (const student of students) {
      const result = await this.calculateStudentAverage(student.id, coursePeriodId)
      if (result.percentage !== null) {
        studentAverages.push({
          student_id: student.id,
          student_name: `${(student as any).profile?.first_name || ''} ${(student as any).profile?.last_name || ''}`.trim(),
          average: result.percentage,
        })
      }
    }

    if (studentAverages.length === 0) return []

    // Class average
    const classAvg = studentAverages.reduce((sum, s) => sum + s.average, 0) / studentAverages.length

    // Find anomalies
    return studentAverages
      .filter((s) => Math.abs(s.average - classAvg) >= threshold)
      .map((s) => ({
        student_id: s.student_id,
        student_name: s.student_name,
        student_average: s.average,
        class_average: Math.round(classAvg * 100) / 100,
        difference: Math.round((s.average - classAvg) * 100) / 100,
      }))
      .sort((a, b) => a.difference - b.difference)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // IMPORT GRADEBOOK GRADES FROM CSV/EXCEL
  // ──────────────────────────────────────────────────────────────────────────

  async importGradebookGrades(
    schoolId: string,
    dto: {
      course_period_id: string
      import_first_row: boolean
      student_identifier: 'name' | 'student_number'
      name_columns?: { first_name_col?: number; last_name_col?: number }
      student_number_col?: number
      mappings: { assignment_id: string; column_index: number }[]
      rows: string[][]
    },
    gradedBy?: string
  ): Promise<{
    imported: number
    skipped: number
    errors: { row: number; reason: string }[]
  }> {
    // 1. Get course period → section_id
    const { data: cp, error: cpErr } = await supabase
      .from('course_periods')
      .select('id, section_id')
      .eq('id', dto.course_period_id)
      .single()

    if (cpErr || !cp) throw new Error('Course period not found')
    if (!cp.section_id) throw new Error('Course period has no section assigned')

    // 2. Get students in this section
    const { data: studentsRaw, error: studErr } = await supabase
      .from('students')
      .select('id, student_number, profile:profiles(first_name, last_name)')
      .eq('section_id', cp.section_id)
      .eq('school_id', schoolId)

    if (studErr) throw new Error(`Failed to fetch students: ${studErr.message}`)
    const students = (studentsRaw || []).map((s: any) => ({
      id: s.id as string,
      student_number: (s.student_number || '') as string,
      first_name: ((s.profile?.first_name || '') as string).trim().toLowerCase(),
      last_name: ((s.profile?.last_name || '') as string).trim().toLowerCase(),
    }))

    // 3. Determine the data rows (skip header if needed)
    const dataRows = dto.import_first_row ? dto.rows : dto.rows.slice(1)

    // 4. Match students and build grade records per assignment
    const gradesByAssignment = new Map<string, { student_id: string; points?: number | null; letter_grade?: string }[]>()
    for (const m of dto.mappings) {
      gradesByAssignment.set(m.assignment_id, [])
    }

    let imported = 0
    let skipped = 0
    const errors: { row: number; reason: string }[] = []

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]
      const rowNum = dto.import_first_row ? i + 1 : i + 2 // 1-based row number in original file

      // Match student
      let matchedStudent: { id: string } | undefined
      if (dto.student_identifier === 'student_number') {
        const colIdx = dto.student_number_col ?? 0
        const val = (row[colIdx] || '').trim()
        matchedStudent = students.find((s) => s.student_number === val)
      } else {
        const firstCol = dto.name_columns?.first_name_col
        const lastCol = dto.name_columns?.last_name_col
        const firstName = firstCol !== undefined ? (row[firstCol] || '').trim().toLowerCase() : ''
        const lastName = lastCol !== undefined ? (row[lastCol] || '').trim().toLowerCase() : ''
        matchedStudent = students.find(
          (s) => s.first_name === firstName && s.last_name === lastName
        )
      }

      if (!matchedStudent) {
        skipped++
        errors.push({ row: rowNum, reason: 'Student not found' })
        continue
      }

      // Extract grade for each mapped assignment column
      for (const m of dto.mappings) {
        const val = (row[m.column_index] || '').trim()
        if (!val) continue

        const numVal = parseFloat(val)
        const grades = gradesByAssignment.get(m.assignment_id)!
        if (!isNaN(numVal)) {
          grades.push({ student_id: matchedStudent.id, points: numVal })
        } else {
          // Treat as letter grade
          grades.push({ student_id: matchedStudent.id, letter_grade: val })
        }
      }
      imported++
    }

    // 5. Bulk insert grades per assignment
    const campusId = await this.getCampusId(dto.course_period_id)
    for (const [assignmentId, grades] of gradesByAssignment.entries()) {
      if (grades.length === 0) continue
      const records = grades.map((g) => ({
        school_id: schoolId,
        campus_id: campusId,
        assignment_id: assignmentId,
        student_id: g.student_id,
        course_period_id: dto.course_period_id,
        points: g.points ?? null,
        letter_grade: g.letter_grade ?? null,
        is_exempt: false,
        is_late: false,
        is_missing: false,
        is_incomplete: false,
        graded_at: new Date().toISOString(),
        graded_by: gradedBy,
      }))

      const { error: upsertErr } = await supabase
        .from('gradebook_grades')
        .upsert(records, { onConflict: 'assignment_id,student_id' })
        .select()

      if (upsertErr) {
        errors.push({ row: 0, reason: `Failed to save grades for assignment ${assignmentId}: ${upsertErr.message}` })
      }
    }

    return { imported, skipped, errors }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ANOMALOUS GRADES — ADVANCED (mirrors AnomalousGrades.php)
  // Filters: missing | negative/excused | exceed max percent | extra credit
  // Optional scoping: single student, include_all_courses
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * AnomalousGrades.php equivalent.
   *
   * Returns assignments where the grade is anomalous for one or more reasons:
   *   - missing:    no grade entered but assignment is past due
   *   - negative:   grade < 0 (excused = -1 or truly negative)
   *   - exceed:     grade > points × max_allowed_ratio (configurable, default 1.0)
   *
   * Scoping:
   *   - If coursePeriodId is supplied, only that course period is checked.
   *   - If staffId is supplied without coursePeriodId, all course_periods
   *     where teacher_id = staffId are checked (include_all_courses mode).
   *   - If studentId is supplied, results are filtered to that student only.
   */
  async getAnomalousGradesAdvanced(options: {
    coursePeriodId?: string
    staffId?: string
    studentId?: string
    includeAllCourses?: boolean
    includeInactive?: boolean
    missing?: boolean
    negative?: boolean
    exceedMaxPercent?: boolean
    maxAllowedRatio?: number   // 1.0 = 100% (default)
    includeExtraCredit?: boolean
  }): Promise<Array<{
    student_id: string
    student_name: string
    student_number: string
    course_period_id: string
    course_title: string
    assignment_id: string
    assignment_title: string
    category_title: string
    points_earned: number | null
    points_possible: number
    problem_type: 'missing' | 'negative' | 'excused' | 'exceed_max' | 'extra_credit'
    comment: string | null
  }>> {
    const {
      coursePeriodId,
      staffId,
      studentId,
      includeAllCourses = false,
      includeInactive = false,
      missing = true,
      negative = true,
      exceedMaxPercent = true,
      maxAllowedRatio = 1.0,
      includeExtraCredit = true,
    } = options

    // 1. Determine which course periods to scan
    let cpIds: string[] = []
    if (coursePeriodId) {
      cpIds = [coursePeriodId]
    } else if (staffId) {
      const { data: cps } = await supabase
        .from('course_periods')
        .select('id')
        .eq('teacher_id', staffId)
        .eq('is_active', true)
      cpIds = (cps || []).map((cp: any) => cp.id)
    }
    if (cpIds.length === 0) return []

    // 2. Get assignments for these course periods
    const { data: assignments } = await supabase
      .from('gradebook_assignments')
      .select(`
        id, title, points, due_date, assigned_date,
        assignment_type:gradebook_assignment_types(id, title),
        course_period:course_periods(id, title)
      `)
      .in('course_period_id', cpIds)
      .eq('is_active', true)

    if (!assignments || assignments.length === 0) return []

    // 3. Get all grades for these assignments (optionally filtered by student)
    let gradesQuery = supabase
      .from('gradebook_grades')
      .select('assignment_id, student_id, points, comment, course_period_id')
      .in('assignment_id', assignments.map((a: any) => a.id))

    if (studentId) {
      gradesQuery = gradesQuery.eq('student_id', studentId)
    }
    const { data: grades } = await gradesQuery

    // Index grades by assignment_id + student_id
    const gradeMap = new Map<string, any>()
    for (const g of grades || []) {
      gradeMap.set(`${g.assignment_id}__${g.student_id}`, g)
    }

    // 4. Get students in the relevant sections
    const cpSet = new Set(cpIds)
    const { data: cpRows } = await supabase
      .from('course_periods')
      .select('id, section_id, title')
      .in('id', cpIds)

    const sectionIds = [...new Set((cpRows || []).map((cp: any) => cp.section_id).filter(Boolean))]
    const cpTitleMap = new Map<string, string>((cpRows || []).map((cp: any) => [cp.id, cp.title]))
    const cpSectionMap = new Map<string, string>((cpRows || []).map((cp: any) => [cp.id, cp.section_id]))

    let studentsQuery = supabase
      .from('students')
      .select('id, student_number, profile:profiles(first_name, last_name)')
      .in('section_id', sectionIds)

    if (studentId) studentsQuery = studentsQuery.eq('id', studentId)
    if (!includeInactive) studentsQuery = studentsQuery.eq('is_active', true)

    const { data: students } = await studentsQuery
    const studentMap = new Map<string, { name: string; student_number: string }>(
      (students || []).map((s: any) => [
        s.id,
        {
          name: `${s.profile?.first_name || ''} ${s.profile?.last_name || ''}`.trim(),
          student_number: s.student_number || '',
        },
      ])
    )

    // 5. Build anomaly list
    const today = new Date().toISOString().split('T')[0]
    const results: any[] = []

    for (const assignment of assignments as any[]) {
      const cpId = (assignment.course_period as any)?.id || ''
      const sectionId = cpSectionMap.get(cpId)
      if (!sectionId) continue

      // Students enrolled in this course period's section
      const enrolledStudents = (students || []).filter(
        (s: any) => s.section_id === sectionId
      )

      for (const student of enrolledStudents) {
        if (studentId && student.id !== studentId) continue

        const gradeKey = `${assignment.id}__${student.id}`
        const grade = gradeMap.get(gradeKey)
        const earned = grade ? grade.points : null
        const possible = assignment.points || 0
        const isPastDue =
          !assignment.due_date || assignment.due_date <= today
        const isAfterAssigned =
          !assignment.assigned_date || assignment.assigned_date <= today

        let problemType: string | null = null

        if (missing && earned === null && isPastDue && isAfterAssigned) {
          problemType = 'missing'
        } else if (negative && earned !== null && earned === -1) {
          problemType = 'excused'
        } else if (negative && earned !== null && earned < 0 && earned !== -1) {
          problemType = 'negative'
        } else if (exceedMaxPercent && earned !== null && possible > 0 && earned > possible * maxAllowedRatio) {
          problemType = 'exceed_max'
        } else if (includeExtraCredit && possible === 0 && earned !== null && earned > 0) {
          problemType = 'extra_credit'
        }

        if (!problemType) continue

        const studentInfo = studentMap.get(student.id)
        results.push({
          student_id: student.id,
          student_name: studentInfo?.name || '',
          student_number: studentInfo?.student_number || '',
          course_period_id: cpId,
          course_title: cpTitleMap.get(cpId) || '',
          assignment_id: assignment.id,
          assignment_title: assignment.title,
          category_title: (assignment.assignment_type as any)?.title || '',
          points_earned: earned,
          points_possible: possible,
          problem_type: problemType as any,
          comment: grade?.comment || null,
        })
      }
    }

    return results
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STUDENT GRADES SUMMARY (mirrors StudentGrades.php)
  // Returns per-course totals + ungraded count + percent/letter for a student
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * StudentGrades.php equivalent — course-level grade summary for one student.
   *
   * Returns an array of courses the student is enrolled in, each with:
   *   - current weighted percent + letter grade
   *   - ungraded assignment count
   *   - list of assignments with individual grades (when expandCourseId is set)
   */
  async getStudentGradesSummary(
    studentId: string,
    markingPeriodId: string,
    options: {
      expandCoursePeriodId?: string   // if set, also return per-assignment detail
      includeInactive?: boolean
      staffId?: string                 // teacher role: only show teacher's own course periods
    } = {}
  ): Promise<Array<{
    course_period_id: string
    course_title: string
    teacher_name: string
    percent_grade: number | null
    letter_grade: string | null
    ungraded_count: number
    assignments: Array<{
      id: string
      title: string
      category: string
      points_earned: number | null
      points_possible: number
      percent: number | null
      comment: string | null
      due_date: string | null
    }>
  }>> {
    const { expandCoursePeriodId, includeInactive = false, staffId } = options

    // 1. Get student's section
    const { data: studentRow } = await supabase
      .from('students')
      .select('section_id')
      .eq('id', studentId)
      .single()

    if (!studentRow?.section_id) return []

    // 2. Get course periods in this section
    let cpQuery = supabase
      .from('course_periods')
      .select(`
        id, title,
        course:courses(id, title, subject:subjects(id, name)),
        teacher:staff(id, profile:profiles!profile_id(first_name, last_name)),
        grading_scale_id
      `)
      .eq('section_id', studentRow.section_id)
      .eq('is_active', true)

    if (staffId) cpQuery = cpQuery.eq('teacher_id', staffId)

    const { data: cps } = await cpQuery
    if (!cps || cps.length === 0) return []

    const results: any[] = []
    const today = new Date().toISOString().split('T')[0]

    for (const cp of cps as any[]) {
      // 3. Get assignments for this course period visible to student (past assigned date)
      const { data: assignments } = await supabase
        .from('gradebook_assignments')
        .select(`
          id, title, points, due_date, assigned_date, is_extra_credit,
          assignment_type:gradebook_assignment_types(id, title, final_grade_percent)
        `)
        .eq('course_period_id', cp.id)
        .eq('is_active', true)
        .lte('assigned_date', today)
        .order('due_date', { ascending: false })

      if (!assignments || assignments.length === 0) {
        results.push({
          course_period_id: cp.id,
          course_title: cp.course?.title || cp.title,
          teacher_name: `${cp.teacher?.profile?.first_name || ''} ${cp.teacher?.profile?.last_name || ''}`.trim(),
          percent_grade: null,
          letter_grade: null,
          ungraded_count: 0,
          assignments: [],
        })
        continue
      }

      // 4. Get grades for this student in these assignments
      const { data: grades } = await supabase
        .from('gradebook_grades')
        .select('assignment_id, points, comment, is_exempt')
        .eq('student_id', studentId)
        .eq('course_period_id', cp.id)
        .in('assignment_id', assignments.map((a: any) => a.id))

      const gradeByAssignment = new Map<string, any>(
        (grades || []).map((g) => [g.assignment_id, g])
      )

      // 5. Count ungraded (past due, no grade, points > 0)
      let ungradedCount = 0
      let totalEarned = 0
      let totalPossible = 0
      let totalWeighted = 0
      let totalWeight = 0
      const assignmentResults: any[] = []

      // Group by type for weighted calculation
      const typeMap = new Map<string, { earned: number; possible: number; weight: number }>()

      for (const a of assignments as any[]) {
        const grade = gradeByAssignment.get(a.id)
        const earned = grade ? grade.points : null
        const isPastDue = !a.due_date || a.due_date <= today

        if (earned === null && isPastDue && a.points > 0) ungradedCount++

        const typeId = a.assignment_type?.id
        const typeWeight = a.assignment_type?.final_grade_percent || 0

        if (!typeMap.has(typeId) && typeWeight > 0) {
          typeMap.set(typeId, { earned: 0, possible: 0, weight: typeWeight })
        }

        if (earned !== null && earned >= 0 && a.points > 0) {
          const typeEntry = typeMap.get(typeId)
          if (typeEntry) {
            typeEntry.earned += earned
            typeEntry.possible += a.points
          }
          totalEarned += earned
          totalPossible += a.points
        }

        // Per-assignment row (only when expand mode)
        if (expandCoursePeriodId === cp.id) {
          const pct = a.points > 0 && earned !== null && earned >= 0
            ? Math.round((earned / a.points) * 10000) / 100
            : null
          assignmentResults.push({
            id: a.id,
            title: a.title,
            category: a.assignment_type?.title || '',
            points_earned: earned === -1 ? null : earned, // -1 = excused
            points_possible: a.points,
            percent: earned === -1 ? null : pct,
            comment: grade?.comment || null,
            due_date: a.due_date || null,
          })
        }
      }

      // 6. Calculate weighted percent
      let percentGrade: number | null = null
      for (const [, t] of typeMap) {
        if (t.possible > 0) {
          totalWeighted += (t.earned / t.possible) * t.weight
          totalWeight += t.weight
        }
      }
      if (totalWeight > 0) {
        percentGrade = Math.round((totalWeighted / totalWeight) * 100 * 100) / 100
      } else if (totalPossible > 0) {
        percentGrade = Math.round((totalEarned / totalPossible) * 100 * 100) / 100
      }

      // 7. Lookup letter grade
      let letterGrade: string | null = null
      const scaleId = cp.grading_scale_id
      if (scaleId && percentGrade !== null) {
        const { data: gradeEntry } = await supabase
          .from('grading_scale_grades')
          .select('title')
          .eq('grading_scale_id', scaleId)
          .eq('is_active', true)
          .lte('break_off', percentGrade)
          .order('break_off', { ascending: false })
          .limit(1)
          .single()
        letterGrade = gradeEntry?.title || null
      }

      results.push({
        course_period_id: cp.id,
        course_title: cp.course?.title || cp.title,
        teacher_name: `${cp.teacher?.profile?.first_name || ''} ${cp.teacher?.profile?.last_name || ''}`.trim(),
        percent_grade: percentGrade,
        letter_grade: letterGrade,
        ungraded_count: ungradedCount,
        assignments: assignmentResults,
      })
    }

    return results
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ASSIGNMENTS BY STAFF (mirrors Assignments.php teacher-scoped fetch)
  // Returns assignments for the current marking period scoped to a teacher
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Assignments.php + Assignments-new.php teacher-scoped list.
   *
   * Returns assignments for `staffId` for the given marking_period_id.
   * Can be filtered by assignment_type_id or course_period_id.
   * Applies the COURSE_ID="all course periods" vs COURSE_PERIOD_ID="this section only" concept.
   */
  async getAssignmentsByStaff(options: {
    staffId: string
    coursePeriodId?: string
    markingPeriodId?: string
    assignmentTypeId?: string
    includeAllCoursePeriods?: boolean
  }): Promise<GradebookAssignment[]> {
    const { staffId, coursePeriodId, markingPeriodId, assignmentTypeId, includeAllCoursePeriods } = options

    let query = supabase
      .from('gradebook_assignments')
      .select(`
        *,
        assignment_type:gradebook_assignment_types(id, title, final_grade_percent)
      `)
      .eq('created_by', staffId)
      .eq('is_active', true)

    if (coursePeriodId && !includeAllCoursePeriods) {
      query = query.eq('course_period_id', coursePeriodId)
    } else if (includeAllCoursePeriods) {
      // Return assignments for ALL course periods this teacher teaches
      const { data: teacherCPs } = await supabase
        .from('course_periods')
        .select('id')
        .eq('teacher_id', staffId)
        .eq('is_active', true)
      const cpIds = (teacherCPs || []).map((cp: any) => cp.id)
      if (cpIds.length > 0) query = query.in('course_period_id', cpIds)
    }

    if (markingPeriodId) {
      const { data: mp, error: mpErr } = await supabase
        .from('marking_periods')
        .select('start_date, end_date')
        .eq('id', markingPeriodId)
        .single()

      if (mpErr) {
        throw new Error(`Failed to fetch marking period: ${mpErr.message}`)
      }

      if (mp?.start_date) {
        query = (query as any).gte('due_date', mp.start_date)
      }
      if (mp?.end_date) {
        query = (query as any).lte('due_date', mp.end_date)
      }
    }

    if (assignmentTypeId) {
      query = query.eq('assignment_type_id', assignmentTypeId)
    }

    const { data, error } = await query.order('due_date', { ascending: false })
    if (error) throw new Error(`Failed to fetch teacher assignments: ${error.message}`)
    return (data || []) as GradebookAssignment[]
  }

  // ──────────────────────────────────────────────────────────────────────────
  // IMPORT FINAL GRADES FROM GRADEBOOK (mirrors InputFinalGrades.php modfunc=gradebook)
  // Calculates final grade from gradebook average and saves to student_final_grades
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * InputFinalGrades.php modfunc=gradebook equivalent.
   *
   * Reads each student's current gradebook average for the given course_period
   * and saves it as their final grade for the given marking_period.
   * Does NOT overwrite grades already marked as is_override=true.
   */
  async importFinalGradesFromGradebook(
    schoolId: string,
    coursePeriodId: string,
    markingPeriodId: string,
    academicYearId: string,
    options: {
      overrideExisting?: boolean  // default false — skip already-saved grades
      staffId?: string            // teacher performing action
    } = {}
  ): Promise<{ saved: number; skipped: number; errors: string[] }> {
    const { overrideExisting = false, staffId } = options

    // 1. Get section from course period → students
    const { data: cp } = await supabase
      .from('course_periods')
      .select('section_id, grading_scale_id, course:courses(credit_hours, grading_scale_id)')
      .eq('id', coursePeriodId)
      .single()

    if (!cp?.section_id) throw new Error('Course period has no section')

    const { data: students } = await supabase
      .from('students')
      .select('id')
      .eq('section_id', cp.section_id)
      .eq('is_active', true)

    if (!students || students.length === 0) {
      return { saved: 0, skipped: 0, errors: [] }
    }

    // 2. Get existing final grades for this CP + MP (to check for override)
    const { data: existingGrades } = await supabase
      .from('student_final_grades')
      .select('student_id, is_override')
      .eq('course_period_id', coursePeriodId)
      .eq('marking_period_id', markingPeriodId)

    const overrideSet = new Set<string>(
      (existingGrades || [])
        .filter((g) => g.is_override)
        .map((g) => g.student_id)
    )
    const existingSet = new Set<string>(
      (existingGrades || []).map((g) => g.student_id)
    )

    const scaleId = cp.grading_scale_id || (cp.course as any)?.grading_scale_id
    const creditHours = (cp.course as any)?.credit_hours || 1

    let saved = 0
    let skipped = 0
    const errors: string[] = []

    for (const student of students) {
      try {
        // Skip if override grade exists and we're not overriding
        if (overrideSet.has(student.id) && !overrideExisting) {
          skipped++
          continue
        }
        // Skip if already has a grade and not overriding
        if (existingSet.has(student.id) && !overrideExisting) {
          skipped++
          continue
        }

        // Calculate gradebook average
        const avg = await this.calculateStudentAverage(student.id, coursePeriodId)
        if (avg.percentage === null) {
          skipped++
          continue
        }

        // Save final grade
        const campusId = await this.getCampusId(coursePeriodId)
        const { error: upsertErr } = await supabase
          .from('student_final_grades')
          .upsert({
            school_id: schoolId,
            campus_id: campusId,
            student_id: student.id,
            course_period_id: coursePeriodId,
            marking_period_id: markingPeriodId,
            academic_year_id: academicYearId,
            percent_grade: Math.round(avg.percentage * 100) / 100,
            letter_grade: avg.letter_grade,
            gpa_value: avg.gpa_value,
            grade_points: avg.gpa_value ? avg.gpa_value * creditHours : null,
            credit_attempted: creditHours,
            credit_earned: avg.percentage >= 50 ? creditHours : 0,
            gradebook_percent: avg.percentage,
            grade_source: 'gradebook_import',
            is_override: false,
            graded_by: staffId,
            graded_at: new Date().toISOString(),
          }, { onConflict: 'student_id,course_period_id,marking_period_id' })

        if (upsertErr) throw new Error(upsertErr.message)
        saved++
      } catch (err: any) {
        errors.push(`Student ${student.id}: ${err.message}`)
      }
    }

    return { saved, skipped, errors }
  }
  /**
   * Generate progress report data for multiple students.
   * Returns data shaped like ReportCardData[] for the frontend print flow.
   */
  async generateProgressReports(
    studentIds: string[],
    options: Record<string, any> = {}
  ): Promise<{ progress_reports: any[] }> {
    const progressReports: any[] = []

    for (const studentId of studentIds) {
      try {
        const card = await this.generateStudentProgressReport(studentId, options)
        progressReports.push({ ...card, options })
      } catch (err: any) {
        console.error(`Error generating progress report for student ${studentId}:`, err.message)
        progressReports.push({ student_id: studentId, error: err.message })
      }
    }

    return { progress_reports: progressReports }
  }

  /**
   * Build a single student's progress report card from gradebook data.
   */
  private async generateStudentProgressReport(
    studentId: string,
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

    // Get the student's course periods via their section
    const sectionId = (student as any)?.section?.id
    if (!sectionId) throw new Error('Student has no section assigned')

    const { data: coursePeriods } = await supabase
      .from('course_periods')
      .select(`
        id, title,
        course:courses(id, title, credit_hours, subject:subjects(id, name)),
        teacher_id
      `)
      .eq('section_id', sectionId)
      .eq('is_active', true)

    // Get teacher names
    const teacherIds = [...new Set((coursePeriods || []).map((cp: any) => cp.teacher_id).filter(Boolean))]
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

    // For each course period, calculate the student's current average
    const grades: any[] = []
    for (const cp of (coursePeriods || [])) {
      try {
        const avg = await this.calculateStudentAverage(studentId, (cp as any).id)
        grades.push({
          course_title: (cp as any).course?.title || (cp as any).title || '',
          subject_name: (cp as any).course?.subject?.name || '',
          teacher_name: (cp as any).teacher_id ? (teacherMap[(cp as any).teacher_id] || '') : '',
          percent_grade: avg.percentage,
          letter_grade: avg.letter_grade || null,
          gpa_value: null,
          credit_hours: (cp as any).course?.credit_hours || 1,
          comments: [],
        })
      } catch {
        grades.push({
          course_title: (cp as any).course?.title || (cp as any).title || '',
          subject_name: (cp as any).course?.subject?.name || '',
          teacher_name: (cp as any).teacher_id ? (teacherMap[(cp as any).teacher_id] || '') : '',
          percent_grade: null,
          letter_grade: null,
          gpa_value: null,
          credit_hours: (cp as any).course?.credit_hours || 1,
          comments: [],
        })
      }
    }

    return {
      student,
      school: (student as any)?.school,
      marking_period: null,
      academic_year: null,
      grades,
      summary: {
        total_credits_attempted: grades.reduce((sum, g) => sum + (g.credit_hours || 0), 0),
        total_credits_earned: 0,
        gpa: null,
      },
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GRADEBOOK BREAKDOWN
  // Mirrors RosarioSIS GradebookBreakdown.php: counts students per letter grade
  // ──────────────────────────────────────────────────────────────────────────

  async getGradebookBreakdown(params: {
    coursePeriodId: string
    assignmentId?: string
  }): Promise<Array<{ grade_title: string; gpa_value: number; student_count: number }>> {
    const { coursePeriodId, assignmentId } = params

    // 1. Get course period → grading scale + section
    const { data: cp } = await supabase
      .from('course_periods')
      .select('section_id, grading_scale_id, course:courses(grading_scale_id)')
      .eq('id', coursePeriodId)
      .single()

    if (!cp?.section_id) return []

    const scaleId = (cp as any).grading_scale_id || (cp as any).course?.grading_scale_id
    if (!scaleId) return []

    // 2. Get grading scale grades ordered high→low break_off
    const { data: scaleGrades } = await supabase
      .from('grading_scale_grades')
      .select('title, gpa_value, break_off')
      .eq('grading_scale_id', scaleId)
      .eq('is_active', true)
      .order('break_off', { ascending: false })

    if (!scaleGrades || scaleGrades.length === 0) return []

    // 3. Get active students in section
    const { data: students } = await supabase
      .from('students')
      .select('id')
      .eq('section_id', (cp as any).section_id)
      .eq('is_active', true)

    if (!students || students.length === 0) return []
    const studentIds = students.map((s: any) => s.id)

    // Initialize count map
    const gradeCount: Record<string, number> = {}
    for (const g of scaleGrades) gradeCount[g.title] = 0

    const percentToTitle = (pct: number): string | null => {
      for (const g of scaleGrades) {
        if (g.break_off != null && pct >= g.break_off) return g.title
      }
      return scaleGrades[scaleGrades.length - 1]?.title ?? null
    }

    if (!assignmentId || assignmentId === 'totals') {
      // ── Totals: weighted average across all assignment types ──────────────
      const { data: types } = await supabase
        .from('gradebook_assignment_types')
        .select('id, final_grade_percent')
        .eq('course_period_id', coursePeriodId)
        .eq('is_active', true)

      if (!types || types.length === 0) return scaleGrades.map(g => ({ grade_title: g.title, gpa_value: g.gpa_value, student_count: 0 }))

      const { data: assignments } = await supabase
        .from('gradebook_assignments')
        .select('id, points, assignment_type_id')
        .eq('course_period_id', coursePeriodId)
        .eq('is_active', true)

      if (!assignments || assignments.length === 0) return scaleGrades.map(g => ({ grade_title: g.title, gpa_value: g.gpa_value, student_count: 0 }))

      const assignmentIds = assignments.map((a: any) => a.id)

      const { data: allGrades } = await supabase
        .from('gradebook_grades')
        .select('assignment_id, student_id, points, is_exempt')
        .in('assignment_id', assignmentIds)
        .in('student_id', studentIds)

      // Build lookup: studentId:assignmentId → grade
      const gradeMap = new Map<string, { points: number | null; is_exempt: boolean }>()
      for (const g of allGrades || []) {
        gradeMap.set(`${(g as any).student_id}:${(g as any).assignment_id}`, {
          points: (g as any).points,
          is_exempt: (g as any).is_exempt,
        })
      }

      // Group assignments by type
      const assignsByType = new Map<string, Array<{ id: string; points: number }>>()
      for (const a of assignments) {
        const tid = (a as any).assignment_type_id
        if (!assignsByType.has(tid)) assignsByType.set(tid, [])
        assignsByType.get(tid)!.push({ id: (a as any).id, points: (a as any).points })
      }

      for (const student of students) {
        let totalWeighted = 0
        let totalWeight = 0

        for (const type of types) {
          const typeAssignments = assignsByType.get((type as any).id) || []
          let earned = 0
          let possible = 0

          for (const assignment of typeAssignments) {
            const key = `${(student as any).id}:${assignment.id}`
            const grade = gradeMap.get(key)
            if (grade && !grade.is_exempt && grade.points != null) {
              earned += grade.points
              possible += assignment.points
            }
          }

          if (possible > 0) {
            const weight = (type as any).final_grade_percent || 0
            if (weight > 0) {
              totalWeighted += (earned / possible) * weight
              totalWeight += weight
            }
          }
        }

        if (totalWeight === 0) continue
        const pct = (totalWeighted / totalWeight) * 100
        const title = percentToTitle(pct)
        if (title && title in gradeCount) gradeCount[title]++
      }
    } else {
      // ── Specific assignment ───────────────────────────────────────────────
      const { data: assignment } = await supabase
        .from('gradebook_assignments')
        .select('id, points')
        .eq('id', assignmentId)
        .single()

      if (!assignment || !(assignment as any).points) {
        return scaleGrades.map(g => ({ grade_title: g.title, gpa_value: g.gpa_value, student_count: 0 }))
      }

      const totalPoints = (assignment as any).points

      const { data: grades } = await supabase
        .from('gradebook_grades')
        .select('student_id, points, is_exempt')
        .eq('assignment_id', assignmentId)
        .in('student_id', studentIds)

      for (const grade of grades || []) {
        if ((grade as any).is_exempt || (grade as any).points == null) continue
        const pct = ((grade as any).points / totalPoints) * 100
        const title = percentToTitle(pct)
        if (title && title in gradeCount) gradeCount[title]++
      }
    }

    return scaleGrades.map(g => ({
      grade_title: g.title,
      gpa_value: g.gpa_value,
      student_count: gradeCount[g.title] || 0,
    }))
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ASSIGNMENT OPTIONS (for breakdown filter dropdown)
  // Returns assignment types + individual assignments as flat AssignmentOption[]
  // ──────────────────────────────────────────────────────────────────────────

  async getAssignmentOptions(params: {
    coursePeriodId: string
    markingPeriodId?: string
  }): Promise<Array<{ id: string; title: string; type: 'assignment_type' | 'assignment'; points?: number }>> {
    const { coursePeriodId } = params

    const [typesResult, assignmentsResult] = await Promise.all([
      supabase
        .from('gradebook_assignment_types')
        .select('id, title')
        .eq('course_period_id', coursePeriodId)
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('gradebook_assignments')
        .select('id, title, points')
        .eq('course_period_id', coursePeriodId)
        .eq('is_active', true)
        .order('due_date', { ascending: false }),
    ])

    const options: Array<{ id: string; title: string; type: 'assignment_type' | 'assignment'; points?: number }> = []

    for (const t of typesResult.data || []) {
      options.push({ id: (t as any).id, title: (t as any).title, type: 'assignment_type' })
    }
    for (const a of assignmentsResult.data || []) {
      options.push({ id: (a as any).id, title: (a as any).title, type: 'assignment', points: (a as any).points })
    }

    return options
  }
}

export const gradebookService = new GradebookService()
