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
