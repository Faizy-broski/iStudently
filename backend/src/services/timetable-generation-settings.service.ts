import { supabase } from '../config/supabase'
import { ApiResponse } from '../types'
import {
  TimetableGenerationSettings,
  UpdateTimetableGenerationSettingsDTO
} from '../types/timetable-generator.types'

// ============================================================================
// TIMETABLE GENERATION SETTINGS SERVICE
// Per school/campus/year solver defaults + soft-constraint scoring weights.
// getSettings() always returns a usable settings object — admins are never
// forced to configure anything before their first generation run.
// ============================================================================

export const DEFAULT_GENERATION_SETTINGS: Omit<
  TimetableGenerationSettings,
  'id' | 'school_id' | 'campus_id' | 'academic_year_id' | 'created_at' | 'updated_at'
> = {
  default_max_periods_per_day: 6,
  default_min_gap_between_periods: 0,
  weight_teacher_availability_preferred: 5,
  weight_gap_violation: 3,
  weight_daily_load_violation: 4,
  weight_double_period_broken: 2,
  weight_frequency_spread: 2,
  solver_time_limit_seconds: 60
}

export const getSettings = async (
  schoolId: string,
  campusId: string | null | undefined,
  academicYearId: string
): Promise<ApiResponse<TimetableGenerationSettings>> => {
  try {
    let query = supabase
      .from('timetable_generation_settings')
      .select('*')
      .eq('school_id', schoolId)
      .eq('academic_year_id', academicYearId)

    query = campusId ? query.eq('campus_id', campusId) : query.is('campus_id', null)

    const { data, error } = await query.maybeSingle()

    if (error) throw error

    if (data) {
      return { success: true, data: data as TimetableGenerationSettings }
    }

    // No row yet — return sensible in-memory defaults so callers (and the
    // generation orchestrator) never have to special-case "not configured".
    return {
      success: true,
      data: {
        id: '',
        school_id: schoolId,
        campus_id: campusId ?? null,
        academic_year_id: academicYearId,
        ...DEFAULT_GENERATION_SETTINGS,
        created_at: '',
        updated_at: ''
      },
      message: 'No custom settings found; returning defaults'
    }
  } catch (error: any) {
    console.error('Error fetching timetable generation settings:', error)
    return { success: false, error: error.message }
  }
}

export const upsertSettings = async (
  dto: UpdateTimetableGenerationSettingsDTO
): Promise<ApiResponse<TimetableGenerationSettings>> => {
  try {
    const { data, error } = await supabase
      .from('timetable_generation_settings')
      .upsert(
        {
          school_id: dto.school_id,
          campus_id: dto.campus_id || null,
          academic_year_id: dto.academic_year_id,
          default_max_periods_per_day: dto.default_max_periods_per_day ?? DEFAULT_GENERATION_SETTINGS.default_max_periods_per_day,
          default_min_gap_between_periods: dto.default_min_gap_between_periods ?? DEFAULT_GENERATION_SETTINGS.default_min_gap_between_periods,
          weight_teacher_availability_preferred: dto.weight_teacher_availability_preferred ?? DEFAULT_GENERATION_SETTINGS.weight_teacher_availability_preferred,
          weight_gap_violation: dto.weight_gap_violation ?? DEFAULT_GENERATION_SETTINGS.weight_gap_violation,
          weight_daily_load_violation: dto.weight_daily_load_violation ?? DEFAULT_GENERATION_SETTINGS.weight_daily_load_violation,
          weight_double_period_broken: dto.weight_double_period_broken ?? DEFAULT_GENERATION_SETTINGS.weight_double_period_broken,
          weight_frequency_spread: dto.weight_frequency_spread ?? DEFAULT_GENERATION_SETTINGS.weight_frequency_spread,
          solver_time_limit_seconds: dto.solver_time_limit_seconds ?? DEFAULT_GENERATION_SETTINGS.solver_time_limit_seconds,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'school_id,campus_id,academic_year_id' }
      )
      .select('*')
      .single()

    if (error) throw error

    return {
      success: true,
      data: data as TimetableGenerationSettings,
      message: 'Generation settings saved successfully'
    }
  } catch (error: any) {
    console.error('Error upserting timetable generation settings:', error)
    return { success: false, error: error.message }
  }
}
