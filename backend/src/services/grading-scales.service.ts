import { supabase } from '../config/supabase'
import type {
  GradingScale,
  GradingScaleGrade,
  CreateGradingScaleDTO,
  UpdateGradingScaleDTO,
  CreateGradingScaleGradeDTO,
  UpdateGradingScaleGradeDTO,
} from '../types/grades.types'

// ============================================================================
// GRADING SCALES SERVICE
// ============================================================================

class GradingScalesService {

  // ──────────────────────────────────────────────────────────────────────────
  // SCALES CRUD
  // ──────────────────────────────────────────────────────────────────────────

  async getScales(schoolId: string, campusId?: string): Promise<GradingScale[]> {
    let query = supabase
      .from('grading_scales')
      .select('*, grades:grading_scale_grades(id, title, gpa_value, break_off, comment, sort_order, is_active)')
      .eq('school_id', schoolId)
      .order('sort_order')
      .order('title')

    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    const { data, error } = await query

    if (error) throw new Error(`Failed to fetch grading scales: ${error.message}`)
    return (data || []) as GradingScale[]
  }

  async getScaleById(id: string): Promise<GradingScale | null> {
    const { data, error } = await supabase
      .from('grading_scales')
      .select('*, grades:grading_scale_grades(id, title, gpa_value, break_off, comment, sort_order, is_active)')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch grading scale: ${error.message}`)
    }
    return data as GradingScale
  }

  async createScale(schoolId: string, dto: CreateGradingScaleDTO, createdBy?: string): Promise<GradingScale> {
    // If setting as default, unset other defaults first
    if (dto.is_default) {
      await supabase
        .from('grading_scales')
        .update({ is_default: false })
        .eq('school_id', schoolId)
        .eq('is_default', true)
    }

    const { data, error } = await supabase
      .from('grading_scales')
      .insert({
        school_id: schoolId,
        campus_id: dto.campus_id || null,
        title: dto.title,
        type: dto.type || 'percentage',
        comment: dto.comment,
        is_default: dto.is_default || false,
        sort_order: dto.sort_order || 0,
        created_by: createdBy,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create grading scale: ${error.message}`)

    // Create nested grades if provided
    if (dto.grades && dto.grades.length > 0) {
      await this.bulkCreateGrades(data.id, schoolId, dto.grades)
    }

    // Return with grades
    return (await this.getScaleById(data.id))!
  }

  async updateScale(id: string, dto: UpdateGradingScaleDTO): Promise<GradingScale> {
    // If setting as default, unset others first
    if (dto.is_default) {
      const existing = await this.getScaleById(id)
      if (existing) {
        await supabase
          .from('grading_scales')
          .update({ is_default: false })
          .eq('school_id', existing.school_id)
          .eq('is_default', true)
      }
    }

    const { error } = await supabase
      .from('grading_scales')
      .update(dto)
      .eq('id', id)

    if (error) throw new Error(`Failed to update grading scale: ${error.message}`)
    return (await this.getScaleById(id))!
  }

  async deleteScale(id: string): Promise<void> {
    const { error } = await supabase
      .from('grading_scales')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Failed to delete grading scale: ${error.message}`)
  }

  async getDefaultScale(schoolId: string, campusId?: string): Promise<GradingScale | null> {
    let query = supabase
      .from('grading_scales')
      .select('*, grades:grading_scale_grades(id, title, gpa_value, break_off, comment, sort_order, is_active)')
      .eq('school_id', schoolId)
      .eq('is_default', true)

    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    const { data, error } = await query.single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch default scale: ${error.message}`)
    }
    return data as GradingScale
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SCALE GRADES CRUD
  // ──────────────────────────────────────────────────────────────────────────

  async getGrades(scaleId: string): Promise<GradingScaleGrade[]> {
    const { data, error } = await supabase
      .from('grading_scale_grades')
      .select('*')
      .eq('grading_scale_id', scaleId)
      .order('break_off', { ascending: false })

    if (error) throw new Error(`Failed to fetch grades: ${error.message}`)
    return (data || []) as GradingScaleGrade[]
  }

  async createGrade(scaleId: string, schoolId: string, dto: CreateGradingScaleGradeDTO): Promise<GradingScaleGrade> {
    const { data, error } = await supabase
      .from('grading_scale_grades')
      .insert({
        grading_scale_id: scaleId,
        school_id: schoolId,
        title: dto.title,
        gpa_value: dto.gpa_value,
        break_off: dto.break_off,
        comment: dto.comment,
        sort_order: dto.sort_order || 0,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create grade entry: ${error.message}`)
    return data as GradingScaleGrade
  }

  async bulkCreateGrades(scaleId: string, schoolId: string, grades: CreateGradingScaleGradeDTO[]): Promise<GradingScaleGrade[]> {
    const rows = grades.map((g, i) => ({
      grading_scale_id: scaleId,
      school_id: schoolId,
      title: g.title,
      gpa_value: g.gpa_value,
      break_off: g.break_off,
      comment: g.comment,
      sort_order: g.sort_order ?? i,
    }))

    const { data, error } = await supabase
      .from('grading_scale_grades')
      .insert(rows)
      .select()

    if (error) throw new Error(`Failed to bulk create grades: ${error.message}`)
    return (data || []) as GradingScaleGrade[]
  }

  async updateGrade(id: string, dto: UpdateGradingScaleGradeDTO): Promise<GradingScaleGrade> {
    const { data, error } = await supabase
      .from('grading_scale_grades')
      .update(dto)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Failed to update grade entry: ${error.message}`)
    return data as GradingScaleGrade
  }

  async deleteGrade(id: string): Promise<void> {
    const { error } = await supabase
      .from('grading_scale_grades')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Failed to delete grade entry: ${error.message}`)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SCALE GENERATION
  // Mirrors the RosarioSIS Grading_Scale_Generation plugin.
  // Generates a numeric grading scale (min–max with step) and replaces all
  // existing grade entries in the target scale.  Campus-isolated via
  // ownership check (scale.school_id === adminSchoolId).
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Generate and replace all grade entries for a grading scale.
   *
   * @param scaleId          Target grading scale ID
   * @param adminSchoolId    Admin's school_id — used to validate ownership
   * @param gradeMin         Minimum grade value (integer 0–99)
   * @param gradeMax         Maximum grade value (integer 1–100, > gradeMin)
   * @param gradeStep        Step increment: 1 | 0.5 | 0.25 | 0.1 | 0.05 | 0.01
   * @param decimalSeparator Display separator for grade titles ('.' | ',')
   */
  async generateGrades(
    scaleId: string,
    adminSchoolId: string,
    gradeMin: number,
    gradeMax: number,
    gradeStep: number,
    decimalSeparator: '.' | ','
  ): Promise<GradingScaleGrade[]> {
    // Ownership validation — prevents cross-campus tampering
    const scale = await this.getScaleById(scaleId)
    if (!scale) throw new Error('Grading scale not found')
    if (scale.school_id !== adminSchoolId) {
      throw new Error('Access denied: grading scale belongs to a different school')
    }

    // Sanitise inputs (mirrors PHP plugin's clamping)
    const min  = Math.max(0, Math.floor(gradeMin))
    const max  = Math.min(100, Math.floor(gradeMax))
    if (max <= min) throw new Error('Maximum grade must be greater than minimum grade')

    // Supported steps and their integer stepsPerUnit (PHP $steps variable)
    const STEPS_MAP: Record<string, number> = {
      '1': 1, '0.5': 2, '0.25': 4, '0.1': 10, '0.05': 20, '0.01': 100,
    }
    const stepKey     = String(gradeStep)
    const stepsPerUnit = STEPS_MAP[stepKey] ?? Math.round(1 / gradeStep)
    const step         = 1 / stepsPerUnit   // normalised

    // Decimal places needed for consistent formatting
    const decimalPlaces = step < 1 ? Math.ceil(-Math.log10(step)) : 0

    // ── Generate grade values max → min (same traversal as PHP plugin) ──────
    const gradeValues: number[] = []
    for (let i = max; i >= min; i--) {
      if (step === 1 || i === max) {
        gradeValues.push(i)
        continue
      }
      for (let j = stepsPerUnit - 1; j >= 0; j--) {
        // Round to avoid floating-point drift (e.g. 9.000000001)
        gradeValues.push(
          parseFloat((i + step * j).toFixed(decimalPlaces))
        )
      }
    }

    // ── Format title (apply decimal separator) ───────────────────────────────
    const formatTitle = (v: number): string => {
      const fixed = v.toFixed(decimalPlaces)
      return decimalSeparator === ',' ? fixed.replace('.', ',') : fixed
    }

    // ── Compute break_off thresholds (midpoint formula from PHP plugin) ───────
    // break_off = ( (grade/max) + (nextGrade/max  or 0) ) / 2 * 100
    const rows: CreateGradingScaleGradeDTO[] = gradeValues.map((grade, idx) => {
      const next     = gradeValues[idx + 1] ?? null
      const breakOff = parseFloat(
        (((grade / max) + (next !== null ? next / max : 0)) / 2 * 100).toFixed(2)
      )
      return {
        title:      formatTitle(grade),
        gpa_value:  grade,
        break_off:  breakOff,
        sort_order: idx + 1,
      }
    })

    // ── Append N/A grade (no GPA value, lowest break_off) ────────────────────
    rows.push({ title: 'N/A', gpa_value: 0, break_off: 0, sort_order: rows.length + 1 })

    // ── Replace existing grades atomically ───────────────────────────────────
    const { error: deleteError } = await supabase
      .from('grading_scale_grades')
      .delete()
      .eq('grading_scale_id', scaleId)

    if (deleteError) throw new Error(`Failed to clear existing grades: ${deleteError.message}`)

    // Chunk inserts (Supabase limit ~1000 rows per call)
    const CHUNK = 500
    const inserted: GradingScaleGrade[] = []
    for (let start = 0; start < rows.length; start += CHUNK) {
      const chunk  = rows.slice(start, start + CHUNK)
      const result = await this.bulkCreateGrades(scaleId, adminSchoolId, chunk)
      inserted.push(...result)
    }

    return inserted
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CALCULATION HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Calculate letter grade from percentage using a grading scale.
   * Finds the highest break_off that is <= the given percentage.
   */
  async calculateLetterGrade(percentage: number, scaleId: string): Promise<GradingScaleGrade | null> {
    const { data, error } = await supabase
      .from('grading_scale_grades')
      .select('*')
      .eq('grading_scale_id', scaleId)
      .eq('is_active', true)
      .lte('break_off', percentage)
      .order('break_off', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to calculate letter grade: ${error.message}`)
    }
    return data as GradingScaleGrade
  }

  /**
   * Calculate weighted GPA from array of { gpa_value, credit_hours } pairs.
   */
  calculateGPA(grades: { gpa_value: number; credit_hours: number }[]): number {
    if (grades.length === 0) return 0
    const totalCredits = grades.reduce((sum, g) => sum + g.credit_hours, 0)
    if (totalCredits === 0) return 0
    const weightedSum = grades.reduce((sum, g) => sum + g.gpa_value * g.credit_hours, 0)
    return Math.round((weightedSum / totalCredits) * 100) / 100
  }

  /**
   * Seed default grading scale for a school if none exists.
   */
  async seedDefaultScale(schoolId: string, createdBy?: string): Promise<GradingScale> {
    const existing = await this.getDefaultScale(schoolId)
    if (existing) return existing

    return this.createScale(schoolId, {
      title: 'Standard Grading Scale',
      type: 'percentage',
      comment: 'Default grading scale with letter grades',
      is_default: true,
      grades: [
        { title: 'A+', gpa_value: 4.00, break_off: 90, sort_order: 0 },
        { title: 'A',  gpa_value: 3.70, break_off: 85, sort_order: 1 },
        { title: 'B+', gpa_value: 3.30, break_off: 80, sort_order: 2 },
        { title: 'B',  gpa_value: 3.00, break_off: 75, sort_order: 3 },
        { title: 'C+', gpa_value: 2.70, break_off: 70, sort_order: 4 },
        { title: 'C',  gpa_value: 2.30, break_off: 65, sort_order: 5 },
        { title: 'D',  gpa_value: 1.00, break_off: 60, sort_order: 6 },
        { title: 'F',  gpa_value: 0.00, break_off: 0,  sort_order: 7 },
      ],
    }, createdBy)
  }
}

export const gradingScalesService = new GradingScalesService()
