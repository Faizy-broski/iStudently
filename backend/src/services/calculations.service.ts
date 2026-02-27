import { supabase } from '../config/supabase'

// ---- Types ----

export interface Calculation {
  id: string
  school_id: string
  campus_id?: string
  title: string
  formula: string
  breakdown?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CalculationReport {
  id: string
  school_id: string
  campus_id?: string
  title: string
  cells: ReportCell[][]
  created_by?: string
  created_at: string
  updated_at: string
}

export interface ReportCell {
  text?: string
  calculation_id?: string
  breakdown?: string
  show_graph?: boolean
}

export interface RunFilters {
  campus_id?: string
  start_date?: string
  end_date?: string
  grade_level_id?: string
  section_id?: string
}

export interface BreakdownRow {
  label: string
  value: number | string
}

export type RunResult =
  | { type: 'single'; value: number | string }
  | { type: 'breakdown'; rows: BreakdownRow[] }

// ---- CRUD ----

export class CalculationsService {
  // ---- Calculations CRUD ----

  async getCalculations(schoolId: string, campusId?: string): Promise<Calculation[]> {
    let query = supabase
      .from('calculations')
      .select('*')
      .eq('school_id', schoolId)
      .order('title', { ascending: true })

    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  }

  async getCalculationById(id: string, schoolId: string): Promise<Calculation | null> {
    const { data, error } = await supabase
      .from('calculations')
      .select('*')
      .eq('id', id)
      .eq('school_id', schoolId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data
  }

  async createCalculation(
    schoolId: string,
    campusId: string | undefined,
    createdBy: string,
    dto: { title: string; formula: string; breakdown?: string }
  ): Promise<Calculation> {
    const { data, error } = await supabase
      .from('calculations')
      .insert({
        school_id: schoolId,
        campus_id: campusId || null,
        created_by: createdBy,
        title: dto.title,
        formula: dto.formula,
        breakdown: dto.breakdown || null,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updateCalculation(
    id: string,
    schoolId: string,
    dto: { title?: string; formula?: string; breakdown?: string }
  ): Promise<Calculation> {
    const updateData: Record<string, unknown> = {}
    if (dto.title !== undefined) updateData.title = dto.title
    if (dto.formula !== undefined) updateData.formula = dto.formula
    if (dto.breakdown !== undefined) updateData.breakdown = dto.breakdown || null

    const { data, error } = await supabase
      .from('calculations')
      .update(updateData)
      .eq('id', id)
      .eq('school_id', schoolId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteCalculation(id: string, schoolId: string): Promise<void> {
    const { error } = await supabase
      .from('calculations')
      .delete()
      .eq('id', id)
      .eq('school_id', schoolId)

    if (error) throw error
  }

  // ---- Calculation Reports CRUD ----

  async getReports(schoolId: string, campusId?: string): Promise<CalculationReport[]> {
    let query = supabase
      .from('calculation_reports')
      .select('*')
      .eq('school_id', schoolId)
      .order('title', { ascending: true })

    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  }

  async getReportById(id: string, schoolId: string): Promise<CalculationReport | null> {
    const { data, error } = await supabase
      .from('calculation_reports')
      .select('*')
      .eq('id', id)
      .eq('school_id', schoolId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data
  }

  async createReport(
    schoolId: string,
    campusId: string | undefined,
    createdBy: string,
    dto: { title: string; cells: ReportCell[][] }
  ): Promise<CalculationReport> {
    const { data, error } = await supabase
      .from('calculation_reports')
      .insert({
        school_id: schoolId,
        campus_id: campusId || null,
        created_by: createdBy,
        title: dto.title,
        cells: dto.cells,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updateReport(
    id: string,
    schoolId: string,
    dto: { title?: string; cells?: ReportCell[][] }
  ): Promise<CalculationReport> {
    const updateData: Record<string, unknown> = {}
    if (dto.title !== undefined) updateData.title = dto.title
    if (dto.cells !== undefined) updateData.cells = dto.cells

    const { data, error } = await supabase
      .from('calculation_reports')
      .update(updateData)
      .eq('id', id)
      .eq('school_id', schoolId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteReport(id: string, schoolId: string): Promise<void> {
    const { error } = await supabase
      .from('calculation_reports')
      .delete()
      .eq('id', id)
      .eq('school_id', schoolId)

    if (error) throw error
  }

  // ---- Execution Engine ----

  /**
   * Run a saved calculation for the given school/campus + date filters.
   * Returns a single value or a breakdown array.
   */
  async runCalculation(
    id: string,
    schoolId: string,
    filters: RunFilters
  ): Promise<RunResult> {
    const calc = await this.getCalculationById(id, schoolId)
    if (!calc) throw new Error('Calculation not found')

    const campusId = filters.campus_id

    if (calc.breakdown) {
      return this._runWithBreakdown(calc, schoolId, campusId, filters)
    }

    const value = await this._evaluateFormula(calc.formula, schoolId, campusId, filters)
    return { type: 'single', value }
  }

  /**
   * Evaluate an arbitrary formula string without persisting it. Used by the
   * client when running a calculation that hasn't been saved yet.
   */
  async runFormula(
    formula: string,
    breakdown: string | undefined,
    schoolId: string,
    campusId: string | undefined,
    filters: RunFilters
  ): Promise<RunResult> {
    // build a fake calculation object for breakdown logic
    const fakeCalc: Calculation = {
      id: '',
      school_id: schoolId,
      campus_id: campusId,
      title: '',
      formula,
      breakdown,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (breakdown) {
      return this._runWithBreakdown(fakeCalc, schoolId, campusId, filters)
    }

    const value = await this._evaluateFormula(formula, schoolId, campusId, filters)
    return { type: 'single', value }
  }

  /**
   * Run all cells in a report and return a result grid.
   */
  async runReport(
    id: string,
    schoolId: string,
    filters: RunFilters
  ): Promise<{ cells: ReportCell[][]; results: (RunResult | null)[][] }> {
    const report = await this.getReportById(id, schoolId)
    if (!report) throw new Error('Report not found')

    const results: (RunResult | null)[][] = []

    for (const row of report.cells) {
      const resultRow: (RunResult | null)[] = []
      for (const cell of row) {
        if (cell.calculation_id) {
          try {
            const calc = await this.getCalculationById(cell.calculation_id, schoolId)
            if (!calc) {
              resultRow.push(null)
              continue
            }
            const effectiveBreakdown = cell.breakdown || calc.breakdown
            const campusId = filters.campus_id

            if (effectiveBreakdown) {
              const result = await this._runWithBreakdown(
                { ...calc, breakdown: effectiveBreakdown },
                schoolId,
                campusId,
                filters
              )
              resultRow.push(result)
            } else {
              const value = await this._evaluateFormula(calc.formula, schoolId, campusId, filters)
              resultRow.push({ type: 'single', value })
            }
          } catch {
            resultRow.push({ type: 'single', value: 'Error' })
          }
        } else {
          resultRow.push(null)
        }
      }
      results.push(resultRow)
    }

    return { cells: report.cells, results }
  }

  // ---- Private helpers ----

  private async _runWithBreakdown(
    calc: Calculation,
    schoolId: string,
    campusId: string | undefined,
    filters: RunFilters
  ): Promise<RunResult> {
    const breakdown = calc.breakdown!

    if (breakdown === 'grade_level') {
      const { data: grades } = await supabase
        .from('grade_levels')
        .select('id, name')
        .eq('school_id', schoolId)
        .order('order_num', { ascending: true })

      const rows: BreakdownRow[] = []
      for (const grade of grades || []) {
        const value = await this._evaluateFormula(calc.formula, schoolId, campusId, {
          ...filters,
          grade_level_id: grade.id,
        })
        rows.push({ label: grade.name, value })
      }
      return { type: 'breakdown', rows }
    }

    if (breakdown === 'section') {
      let sectionQuery = supabase
        .from('sections')
        .select('id, name')
        .eq('school_id', schoolId)
        .order('name', { ascending: true })

      if (filters.grade_level_id) {
        sectionQuery = sectionQuery.eq('grade_level_id', filters.grade_level_id)
      }

      const { data: sections } = await sectionQuery

      const rows: BreakdownRow[] = []
      for (const section of sections || []) {
        const value = await this._evaluateFormula(calc.formula, schoolId, campusId, {
          ...filters,
          section_id: section.id,
        })
        rows.push({ label: section.name, value })
      }
      return { type: 'breakdown', rows }
    }

    if (breakdown === 'student') {
      // Get all students for the school/campus.
      // Campus membership is stored as students.school_id; students.campus_id and
      // students.is_active do not exist on this table.
      let studentQuery = supabase
        .from('students')
        .select('id, profile:profiles(first_name, last_name)')
        .eq('school_id', campusId || schoolId)

      const { data: students } = await studentQuery

      const rows: BreakdownRow[] = []
      for (const student of students || []) {
        const profile = Array.isArray(student.profile) ? student.profile[0] : student.profile
        const label = profile ? `${profile.first_name} ${profile.last_name}` : student.id
        const value = await this._evaluateFormula(calc.formula, schoolId, campusId, {
          ...filters,
          student_id: student.id,
        } as any)
        rows.push({ label, value })
      }
      return { type: 'breakdown', rows }
    }

    // Fallback: no breakdown, single result
    const value = await this._evaluateFormula(calc.formula, schoolId, campusId, filters)
    return { type: 'single', value }
  }

  /**
   * Parse formula, resolve each function(field) call against the DB,
   * substitute numeric results, then safely evaluate the arithmetic.
   *
   * Supported formula functions: sum, average, count, max, min
   * Supported fields: present, absent, half_day, enrolled, student_id, grade_gpa
   * Example: "sum(present) / count(enrolled) * 100"
   */
  private async _evaluateFormula(
    formula: string,
    schoolId: string,
    campusId: string | undefined,
    filters: RunFilters & { student_id?: string }
  ): Promise<number | string> {
    // Match all function(field) patterns
    const fnPattern = /\b(sum|average|count|max|min|average-max|average-min|sum-max|sum-min)\s*\(\s*([\w\s]+?)\s*\)/gi

    let resolved = formula
    const matches = [...formula.matchAll(fnPattern)]

    for (const match of matches) {
      const [fullMatch, fn, field] = match
      const fieldKey = field.trim().toLowerCase().replace(/\s+/g, '_')
      const value = await this._resolveField(fn.toLowerCase(), fieldKey, schoolId, campusId, filters)
      resolved = resolved.replace(fullMatch, String(value))
    }

    return this._safeEval(resolved)
  }

  /**
   * Execute the appropriate SQL query for a given function + field combination.
   */
  private async _resolveField(
    fn: string,
    field: string,
    schoolId: string,
    campusId: string | undefined,
    filters: RunFilters & { student_id?: string }
  ): Promise<number> {
    const { start_date, end_date, grade_level_id, section_id, student_id } = filters

    // ---- Attendance fields ----
    if (['present', 'absent', 'half_day'].includes(field)) {
      const stateValue = field === 'present' ? 1.0 : field === 'absent' ? 0.0 : 0.5

      let query = supabase
        .from('attendance_daily')
        .select('student_id, state_value', { count: 'exact', head: fn === 'count' })
        .eq('school_id', schoolId)
        .eq('state_value', stateValue)

      if (campusId) query = query.eq('campus_id', campusId)
      if (start_date) query = query.gte('attendance_date', start_date)
      if (end_date) query = query.lte('attendance_date', end_date)
      if (student_id) query = query.eq('student_id', student_id)

      if (grade_level_id || section_id) {
        // Get student IDs in this grade/section then filter
        const studentIds = await this._getStudentIds(schoolId, campusId, grade_level_id, section_id)
        if (studentIds.length === 0) return 0
        query = query.in('student_id', studentIds)
      }

      if (fn === 'count') {
        const { count } = await query
        return count ?? 0
      }

      const { data } = await query.select('state_value')
      const values = (data || []).map((r: any) => Number(r.state_value))
      return this._applyFn(fn, values)
    }

    // ---- Enrolled field ----
    if (field === 'enrolled') {
      // student_enrollment has no is_active column; active enrollment = end_date IS NULL
      let query = supabase
        .from('student_enrollment')
        .select('student_id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .is('end_date', null)

      if (campusId) query = (query as any).eq('campus_id', campusId)
      if (student_id) query = query.eq('student_id', student_id)

      if (grade_level_id || section_id) {
        const studentIds = await this._getStudentIds(schoolId, campusId, grade_level_id, section_id)
        if (studentIds.length === 0) return 0
        query = query.in('student_id', studentIds)
      }

      const { count } = await query
      return count ?? 0
    }

    // ---- Student ID (count distinct) ----
    if (field === 'student_id') {
      // students.campus_id does not exist — campus membership is stored as students.school_id
      // students.is_active does not exist on the students table
      let query = supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', campusId || schoolId)

      if (student_id) query = query.eq('id', student_id)

      if (grade_level_id || section_id) {
        const studentIds = await this._getStudentIds(schoolId, campusId, grade_level_id, section_id)
        if (studentIds.length === 0) return 0
        query = query.in('id', studentIds)
      }

      const { count } = await query
      return count ?? 0
    }

    // ---- Grade GPA ----
    if (field === 'grade_gpa') {
      let query = supabase
        .from('student_final_grades')
        .select('gpa_value')
        .eq('school_id', schoolId)
        .not('gpa_value', 'is', null)

      if (student_id) query = query.eq('student_id', student_id)

      if (grade_level_id || section_id) {
        const studentIds = await this._getStudentIds(schoolId, campusId, grade_level_id, section_id)
        if (studentIds.length === 0) return 0
        query = query.in('student_id', studentIds)
      }

      const { data } = await query
      const values = (data || []).map((r: any) => Number(r.gpa_value))
      return this._applyFn(fn, values)
    }

    return 0
  }

  private async _getStudentIds(
    schoolId: string,
    campusId: string | undefined,
    gradeLevelId?: string,
    sectionId?: string
  ): Promise<string[]> {
    // Campus membership lives in students.school_id (each campus IS a school).
    // students.campus_id and students.is_active do not exist on this table.
    let query = supabase
      .from('students')
      .select('id')
      .eq('school_id', campusId || schoolId)

    if (sectionId) {
      // Students enrolled in this specific section (active = end_date IS NULL)
      const { data: enrolled } = await supabase
        .from('student_enrollment')
        .select('student_id')
        .eq('section_id', sectionId)
        .is('end_date', null)

      const ids = (enrolled || []).map((r: any) => r.student_id)
      if (ids.length === 0) return []
      query = query.in('id', ids)
    } else if (gradeLevelId) {
      // Students whose section belongs to this grade level
      const { data: sections } = await supabase
        .from('sections')
        .select('id')
        .eq('grade_level_id', gradeLevelId)
        .eq('school_id', campusId || schoolId)

      const sectionIds = (sections || []).map((s: any) => s.id)
      if (sectionIds.length === 0) return []

      const { data: enrolled } = await supabase
        .from('student_enrollment')
        .select('student_id')
        .in('section_id', sectionIds)
        .is('end_date', null)

      const ids = (enrolled || []).map((r: any) => r.student_id)
      if (ids.length === 0) return []
      query = query.in('id', ids)
    }

    const { data } = await query
    return (data || []).map((r: any) => r.id)
  }

  private _applyFn(fn: string, values: number[]): number {
    if (values.length === 0) return 0
    switch (fn) {
      case 'sum':
      case 'sum-max':
      case 'sum-min':
        return values.reduce((a, b) => a + b, 0)
      case 'average':
      case 'average-max':
      case 'average-min':
        return values.reduce((a, b) => a + b, 0) / values.length
      case 'count':
        return values.length
      case 'max':
        return Math.max(...values)
      case 'min':
        return Math.min(...values)
      default:
        return values.reduce((a, b) => a + b, 0)
    }
  }

  /**
   * Safe arithmetic evaluator — only allows numbers, operators, parentheses.
   * Returns "Error" string if expression is invalid.
   */
  private _safeEval(expr: string): number | string {
    const safe = expr.replace(/\s+/g, '')
    if (!/^[\d+\-*/().]+$/.test(safe)) return 'Error'
    try {
      // Use Function constructor scoped to avoid global access
      // eslint-disable-next-line no-new-func
      const result = new Function(`"use strict"; return (${safe})`)()
      if (typeof result !== 'number' || !isFinite(result)) return 'Error'
      return Math.round(result * 1000) / 1000
    } catch {
      return 'Error'
    }
  }
}
