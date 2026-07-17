import { supabase } from '../config/supabase'
import { ApiResponse } from '../types'
import {
  TeacherSchedulingConstraint,
  UpsertTeacherSchedulingConstraintDTO
} from '../types/timetable-generator.types'

// ============================================================================
// TEACHER SCHEDULING CONSTRAINTS SERVICE
// Per-teacher-per-year max daily/weekly load + gap constraints, consumed by
// the solver's LCV soft-scoring and (optionally) hard pruning.
// ============================================================================

const CONSTRAINT_SELECT = `
  *,
  teacher:staff!teacher_id(id, profile:profiles!staff_profile_id_fkey(first_name, last_name))
`

function flattenConstraint(item: any): TeacherSchedulingConstraint {
  return {
    ...item,
    teacher_name: item.teacher?.profile
      ? `${item.teacher.profile.first_name} ${item.teacher.profile.last_name}`.trim()
      : undefined
  }
}

export const getTeacherConstraints = async (
  teacherId: string,
  academicYearId: string
): Promise<ApiResponse<TeacherSchedulingConstraint | null>> => {
  try {
    const { data, error } = await supabase
      .from('teacher_scheduling_constraints')
      .select(CONSTRAINT_SELECT)
      .eq('teacher_id', teacherId)
      .eq('academic_year_id', academicYearId)
      .maybeSingle()

    if (error) throw error

    return {
      success: true,
      data: data ? flattenConstraint(data) : null
    }
  } catch (error: any) {
    console.error('Error fetching teacher scheduling constraints:', error)
    return { success: false, error: error.message }
  }
}

export const listTeacherConstraints = async (
  academicYearId: string
): Promise<ApiResponse<TeacherSchedulingConstraint[]>> => {
  try {
    const { data, error } = await supabase
      .from('teacher_scheduling_constraints')
      .select(CONSTRAINT_SELECT)
      .eq('academic_year_id', academicYearId)

    if (error) throw error

    return {
      success: true,
      data: (data || []).map(flattenConstraint)
    }
  } catch (error: any) {
    console.error('Error listing teacher scheduling constraints:', error)
    return { success: false, error: error.message }
  }
}

export const upsertTeacherConstraints = async (
  dto: UpsertTeacherSchedulingConstraintDTO
): Promise<ApiResponse<TeacherSchedulingConstraint>> => {
  try {
    const { data, error } = await supabase
      .from('teacher_scheduling_constraints')
      .upsert(
        {
          school_id: dto.school_id,
          campus_id: dto.campus_id || dto.school_id,
          teacher_id: dto.teacher_id,
          academic_year_id: dto.academic_year_id,
          max_periods_per_day: dto.max_periods_per_day ?? null,
          max_periods_per_week: dto.max_periods_per_week ?? null,
          min_gap_between_periods: dto.min_gap_between_periods ?? 0,
          max_consecutive_periods: dto.max_consecutive_periods ?? null,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'teacher_id,academic_year_id' }
      )
      .select(CONSTRAINT_SELECT)
      .single()

    if (error) throw error

    return {
      success: true,
      data: flattenConstraint(data),
      message: 'Teacher scheduling constraints saved successfully'
    }
  } catch (error: any) {
    console.error('Error upserting teacher scheduling constraints:', error)
    return { success: false, error: error.message }
  }
}
