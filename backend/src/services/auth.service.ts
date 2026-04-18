import { supabase, supabaseAuth } from '../config/supabase'

// ============================================================================
// AUTH SERVICE — password management & force-change admin operations
// ============================================================================

class AuthService {
  /**
   * Change a user's password and clear the force_password_change flag.
   * Only the authenticated user may call this (userId comes from JWT).
   */
  async changePassword(userId: string, newPassword: string): Promise<void> {
    // Update Supabase auth password via admin API
    const { error: authError } = await supabaseAuth.auth.admin.updateUserById(userId, {
      password: newPassword,
    })
    if (authError) throw new Error(`Failed to update password: ${authError.message}`)

    // Clear the force flag on the profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ force_password_change: false })
      .eq('id', userId)

    if (profileError) throw new Error(`Failed to clear force_password_change: ${profileError.message}`)
  }

  /**
   * Update a user's own profile fields (first_name, last_name, phone).
   * userId comes from the JWT so users can only update themselves.
   */
  async updateProfile(
    userId: string,
    data: { first_name?: string; last_name?: string; phone?: string }
  ): Promise<void> {
    const update: Record<string, string> = {}
    if (data.first_name !== undefined) update.first_name = data.first_name.trim()
    if (data.last_name !== undefined) update.last_name = data.last_name.trim()
    if (data.phone !== undefined) update.phone = data.phone.trim()

    if (Object.keys(update).length === 0) return

    const { error } = await supabase
      .from('profiles')
      .update(update)
      .eq('id', userId)

    if (error) throw new Error(`Failed to update profile: ${error.message}`)
  }

  /**
   * Force all users in a school (or specific campus) to change their password.
   * campus_id is the child-school id; when provided only that campus is targeted.
   */
  async forcePasswordChange(adminSchoolId: string, campusId?: string): Promise<number> {
    const targetSchoolId = campusId ?? adminSchoolId

    const { data, error } = await supabase
      .from('profiles')
      .update({ force_password_change: true })
      .eq('school_id', targetSchoolId)
      // Never force super_admin accounts
      .neq('role', 'super_admin')
      .select('id')

    if (error) throw new Error(`Failed to force password change: ${error.message}`)
    return (data ?? []).length
  }

  /**
   * Clear the force flag for all users in a school / campus.
   * Equivalent to RosarioSIS "Reset" — allows everyone to log in normally again.
   */
  async resetForcePasswordChange(adminSchoolId: string, campusId?: string): Promise<number> {
    const targetSchoolId = campusId ?? adminSchoolId

    const { data, error } = await supabase
      .from('profiles')
      .update({ force_password_change: false })
      .eq('school_id', targetSchoolId)
      .eq('force_password_change', true)
      .select('id')

    if (error) throw new Error(`Failed to reset force_password_change: ${error.message}`)
    return (data ?? []).length
  }

  /**
   * Count how many users currently have force_password_change = true
   * for a given school / campus.
   */
  async countForcedUsers(adminSchoolId: string, campusId?: string): Promise<number> {
    const targetSchoolId = campusId ?? adminSchoolId

    const { count, error } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', targetSchoolId)
      .eq('force_password_change', true)

    if (error) throw new Error(`Failed to count forced users: ${error.message}`)
    return count ?? 0
  }
}

export const authService = new AuthService()
