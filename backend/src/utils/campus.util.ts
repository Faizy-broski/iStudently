import { supabase } from '../config/supabase'

// ============================================================================
// HELPER: Get main school ID (handles campus hierarchy)
// ============================================================================
// Shared across services. Previously duplicated locally in
// timetable.service.ts, teacher.service.ts, rooms.service.ts,
// scheduling.service.ts, schedule-requests.service.ts, and
// student-dashboard.service.ts — consolidated here.

export const getMainSchoolId = async (schoolId: string): Promise<string> => {
  const { data: school } = await supabase
    .from('schools')
    .select('id, parent_school_id')
    .eq('id', schoolId)
    .single()

  // If this school has a parent, return the parent (main school)
  // Otherwise, this is already the main school
  return school?.parent_school_id || schoolId
}
