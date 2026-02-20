import { supabase } from '../config/supabase'
import {
  AttendanceCode,
  CreateAttendanceCodeDTO,
  UpdateAttendanceCodeDTO,
  ApiResponse
} from '../types'

// ============================================================================
// ATTENDANCE CODES SERVICE
// Manages configurable attendance codes (SETUP > Attendance Codes)
// Each code has a state_code (P/A/H) that drives minutes-based math
// ============================================================================

/**
 * Get all attendance codes for a school
 */
export const getAttendanceCodes = async (
  schoolId: string,
  campusId?: string,
  includeInactive = false
): Promise<ApiResponse<AttendanceCode[]>> => {
  try {
    let query = supabase
      .from('attendance_codes')
      .select('*')
      .eq('school_id', schoolId)
      .order('sort_order', { ascending: true })

    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) throw error

    return { success: true, data: data || [], error: null }
  } catch (error: any) {
    console.error('Error fetching attendance codes:', error)
    return { success: false, data: null, error: error.message }
  }
}

/**
 * Get a single attendance code by ID
 */
export const getAttendanceCodeById = async (
  codeId: string
): Promise<ApiResponse<AttendanceCode>> => {
  try {
    const { data, error } = await supabase
      .from('attendance_codes')
      .select('*')
      .eq('id', codeId)
      .single()

    if (error) throw error

    return { success: true, data, error: null }
  } catch (error: any) {
    console.error('Error fetching attendance code:', error)
    return { success: false, data: null, error: error.message }
  }
}

/**
 * Create a new attendance code
 */
export const createAttendanceCode = async (
  dto: CreateAttendanceCodeDTO
): Promise<ApiResponse<AttendanceCode>> => {
  try {
    // If marking as default, unset existing default first
    if (dto.is_default) {
      await supabase
        .from('attendance_codes')
        .update({ is_default: false })
        .eq('school_id', dto.school_id)
        .eq('is_default', true)
    }

    const { data, error } = await supabase
      .from('attendance_codes')
      .insert(dto)
      .select()
      .single()

    if (error) throw error

    return { success: true, data, error: null }
  } catch (error: any) {
    console.error('Error creating attendance code:', error)
    return { success: false, data: null, error: error.message }
  }
}

/**
 * Update an attendance code
 */
export const updateAttendanceCode = async (
  codeId: string,
  dto: UpdateAttendanceCodeDTO
): Promise<ApiResponse<AttendanceCode>> => {
  try {
    // If marking as default, unset existing default first
    if (dto.is_default) {
      // Get the school_id and campus_id for this code to scope the unset
      const { data: existing } = await supabase
        .from('attendance_codes')
        .select('school_id, campus_id')
        .eq('id', codeId)
        .single()

      if (existing) {
        let unsetQ = supabase
          .from('attendance_codes')
          .update({ is_default: false })
          .eq('school_id', existing.school_id)
          .eq('is_default', true)
        // Scope to same campus (or null campus)
        if (existing.campus_id) {
          unsetQ = unsetQ.eq('campus_id', existing.campus_id)
        } else {
          unsetQ = unsetQ.is('campus_id', null)
        }
        await unsetQ
      }
    }

    const { data, error } = await supabase
      .from('attendance_codes')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', codeId)
      .select()
      .single()

    if (error) throw error

    return { success: true, data, error: null }
  } catch (error: any) {
    console.error('Error updating attendance code:', error)
    return { success: false, data: null, error: error.message }
  }
}

/**
 * Delete (soft-delete by deactivating) an attendance code
 */
export const deleteAttendanceCode = async (
  codeId: string
): Promise<ApiResponse<{ deleted: boolean }>> => {
  try {
    // Check if code is in use
    const { count } = await supabase
      .from('attendance_records')
      .select('id', { count: 'exact', head: true })
      .eq('attendance_code_id', codeId)

    if (count && count > 0) {
      // Soft delete – just deactivate
      await supabase
        .from('attendance_codes')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', codeId)

      return { success: true, data: { deleted: true }, error: null }
    }

    // Hard delete if never used
    const { error } = await supabase
      .from('attendance_codes')
      .delete()
      .eq('id', codeId)

    if (error) throw error

    return { success: true, data: { deleted: true }, error: null }
  } catch (error: any) {
    console.error('Error deleting attendance code:', error)
    return { success: false, data: null, error: error.message }
  }
}

/**
 * Get the default attendance code for a school (the "Present" code)
 */
export const getDefaultAttendanceCode = async (
  schoolId: string,
  campusId?: string
): Promise<ApiResponse<AttendanceCode>> => {
  try {
    let query = supabase
      .from('attendance_codes')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_default', true)
      .eq('is_active', true)

    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    const { data, error } = await query.single()

    if (error) throw error

    return { success: true, data, error: null }
  } catch (error: any) {
    console.error('Error fetching default attendance code:', error)
    return { success: false, data: null, error: error.message }
  }
}
