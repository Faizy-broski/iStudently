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

  async createAssignmentType(
    schoolId: string,
    coursePeriodId: string,
    dto: CreateGradebookAssignmentTypeDTO,
    createdBy?: string
  ): Promise<GradebookAssignmentType> {
    const campusId = await this.getCampusId(coursePeriodId)
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
        created_by: createdBy,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create assignment: ${error.message}`)
    return data as GradebookAssignment
  }

  async updateAssignment(id: string, dto: UpdateGradebookAssignmentDTO): Promise<GradebookAssignment> {
    const { data, error } = await supabase
      .from('gradebook_assignments')
      .update(dto)
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
  async getGradebookView(coursePeriodId: string, sectionId: string): Promise<{
    assignment_types: GradebookAssignmentType[]
    assignments: GradebookAssignment[]
    students: Array<{ id: string; student_number: string; first_name: string; last_name: string }>
    grades: GradebookGrade[]
  }> {
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

      supabase
        .from('students')
        .select('id, student_number, profile:profiles(first_name, last_name)')
        .eq('section_id', sectionId)
        .order('student_number'),

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
  // PROGRESS REPORTS (batch generation for printing)
  // ──────────────────────────────────────────────────────────────────────────

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
}

export const gradebookService = new GradebookService()
