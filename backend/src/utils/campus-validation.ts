import { supabase } from '../config/supabase'

/**
 * Validates that an admin has access to a specific campus
 * An admin has access to a campus if:
 * 1. The campus belongs to their parent school (school_id), OR
 * 2. The campus IS their school (for the main school)
 * 
 * @param adminSchoolId - The admin's school_id from their profile
 * @param targetCampusId - The campus/school ID they're trying to access
 * @returns true if admin has access, false otherwise
 */
export async function validateCampusAccess(
  adminSchoolId: string,
  targetCampusId: string
): Promise<boolean> {
  try {
    // If targeting their own school, always allow
    if (adminSchoolId === targetCampusId) {
      return true
    }

    // Check if the target campus is a child of the admin's school
    const { data: campus, error } = await supabase
      .from('schools')
      .select('id, parent_school_id')
      .eq('id', targetCampusId)
      .single()

    if (error || !campus) {
      console.error('Error validating campus access:', error)
      return false
    }

    // Allow if the campus's parent is the admin's school
    return campus.parent_school_id === adminSchoolId
  } catch (error) {
    console.error('Error in validateCampusAccess:', error)
    return false
  }
}

/**
 * Gets the effective school ID to use for creating records
 * If campus_id is provided in the request body and admin has access, use it
 * Otherwise, fall back to the admin's school_id
 * 
 * @param adminSchoolId - The admin's school_id from their profile
 * @param requestedCampusId - Optional campus_id from request body
 * @returns The school_id to use for the record
 */
export async function getEffectiveSchoolId(
  adminSchoolId: string,
  requestedCampusId?: string
): Promise<string> {
  // If no campus specified, use admin's school
  if (!requestedCampusId) {
    return adminSchoolId
  }

  // Validate access to the requested campus
  const hasAccess = await validateCampusAccess(adminSchoolId, requestedCampusId)
  
  if (!hasAccess) {
    console.warn(`Admin with school_id ${adminSchoolId} attempted to access campus ${requestedCampusId} without permission`)
    // Fall back to admin's school for security
    return adminSchoolId
  }

  return requestedCampusId
}
