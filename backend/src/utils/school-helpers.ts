import { supabase } from '../config/supabase'

/**
 * Gets the effective school ID for querying school-wide resources
 * If the school is a campus, returns the parent school ID
 * Otherwise, returns the school ID itself
 * 
 * Use this for resources that should be shared across all campuses:
 * - Academic Years
 * - Fee Structures (school-wide)
 * - School-level Settings
 * 
 * @param schoolId - The school ID to check
 * @returns The effective school ID (parent if campus, otherwise original)
 */
export async function getEffectiveSchoolId(schoolId: string): Promise<string> {
  const { data, error } = await supabase
    .from('schools')
    .select('parent_school_id')
    .eq('id', schoolId)
    .single()

  if (error || !data) {
    return schoolId
  }

  return data.parent_school_id || schoolId
}

/**
 * Gets all campus IDs for a given school (including the school itself)
 * Used when admins need to see aggregated data from all campuses
 * 
 * @param schoolId - The parent school ID
 * @returns Array of school IDs (parent + all campuses)
 */
export async function getAllCampusIds(schoolId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('schools')
    .select('id')
    .or(`id.eq.${schoolId},parent_school_id.eq.${schoolId}`)

  if (error || !data) {
    return [schoolId]
  }

  return data.map(school => school.id)
}

/**
 * Checks if a school is a campus (has a parent school)
 * 
 * @param schoolId - The school ID to check
 * @returns True if the school is a campus, false otherwise
 */
export async function isCampus(schoolId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('schools')
    .select('parent_school_id')
    .eq('id', schoolId)
    .single()

  if (error || !data) {
    return false
  }

  return !!data.parent_school_id
}
