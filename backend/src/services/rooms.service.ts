import { supabase } from '../config/supabase'
import type {
  Room,
  CreateRoomDTO,
  UpdateRoomDTO,
} from '../types/scheduling.types'
import type { ApiResponse } from '../types'

// ============================================================================
// ROOMS SERVICE
// ============================================================================

const getMainSchoolId = async (schoolId: string): Promise<string> => {
  const { data: school } = await supabase
    .from('schools')
    .select('id, parent_school_id')
    .eq('id', schoolId)
    .single()
  return school?.parent_school_id || schoolId
}

// ──────────────────────────────────────────────────────────────────────────
// CRUD
// ──────────────────────────────────────────────────────────────────────────

export const getRooms = async (
  schoolId: string,
  campusId?: string,
  activeOnly = true
): Promise<ApiResponse<Room[]>> => {
  try {
    const mainSchoolId = await getMainSchoolId(schoolId)
    let query = supabase
      .from('rooms')
      .select('*')
      .eq('school_id', mainSchoolId)
      .order('name')

    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }
    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query
    if (error) throw error

    return { success: true, data: (data || []) as Room[] }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export const getRoomById = async (id: string): Promise<ApiResponse<Room>> => {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return { success: true, data: data as Room }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export const createRoom = async (
  schoolId: string,
  dto: CreateRoomDTO,
  createdBy?: string
): Promise<ApiResponse<Room>> => {
  try {
    const mainSchoolId = await getMainSchoolId(schoolId)
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        school_id: mainSchoolId,
        campus_id: dto.campus_id || null,
        name: dto.name,
        capacity: dto.capacity || null,
        building: dto.building || null,
        floor: dto.floor || null,
        room_type: dto.room_type || 'classroom',
        created_by: createdBy,
      })
      .select()
      .single()

    if (error) throw error
    return { success: true, data: data as Room }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export const updateRoom = async (
  id: string,
  dto: UpdateRoomDTO
): Promise<ApiResponse<Room>> => {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .update(dto)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { success: true, data: data as Room }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export const deleteRoom = async (id: string): Promise<ApiResponse<void>> => {
  try {
    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { success: true, data: undefined }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// ROOM AVAILABILITY CHECK
// ──────────────────────────────────────────────────────────────────────────

/**
 * Check if a room is available at a given day/period
 * (not assigned to another timetable entry or course_period on same day+period).
 */
export const checkRoomAvailability = async (
  roomId: string,
  dayOfWeek: number,
  periodId: string,
  academicYearId: string,
  excludeEntryId?: string
): Promise<ApiResponse<{ available: boolean; conflicting_entry?: any }>> => {
  try {
    let query = supabase
      .from('timetable_entries')
      .select(`
        id,
        section:sections(id, name),
        subject:subjects(id, name),
        teacher:staff!teacher_id(id, profile:profiles!staff_profile_id_fkey(first_name, last_name))
      `)
      .eq('room_id', roomId)
      .eq('day_of_week', dayOfWeek)
      .eq('period_id', periodId)
      .eq('academic_year_id', academicYearId)
      .eq('is_active', true)

    if (excludeEntryId) {
      query = query.neq('id', excludeEntryId)
    }

    const { data, error } = await query
    if (error) throw error

    if (data && data.length > 0) {
      return {
        success: true,
        data: { available: false, conflicting_entry: data[0] },
      }
    }

    return { success: true, data: { available: true } }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
