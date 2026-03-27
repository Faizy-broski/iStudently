import { supabase } from '../config/supabase'

export class SetupAssistantService {
  /**
   * Get the setup assistant config (which profiles are enabled) for a school/campus.
   * Falls back to school-wide if no campus-specific config.
   */
  async getConfig(schoolId: string, campusId?: string | null): Promise<Record<string, boolean>> {
    if (campusId) {
      const { data } = await supabase
        .from('school_settings')
        .select('setup_assistant_config')
        .eq('school_id', schoolId)
        .eq('campus_id', campusId)
        .maybeSingle()

      if (data?.setup_assistant_config) return data.setup_assistant_config
    }

    // Fallback to school-wide
    const { data } = await supabase
      .from('school_settings')
      .select('setup_assistant_config')
      .eq('school_id', schoolId)
      .is('campus_id', null)
      .maybeSingle()

    return data?.setup_assistant_config ?? {
      admin: true,
      teacher: true,
      parent: false,
      student: false,
      librarian: false,
    }
  }

  /**
   * Update setup assistant config (enable/disable per profile).
   */
  async updateConfig(
    schoolId: string,
    config: Record<string, boolean>,
    campusId?: string | null,
  ): Promise<void> {
    const now = new Date().toISOString()

    let query = supabase
      .from('school_settings')
      .select('id')
      .eq('school_id', schoolId)

    query = campusId ? query.eq('campus_id', campusId) : query.is('campus_id', null)

    const { data: existing } = await query.maybeSingle()

    if (existing?.id) {
      const { error } = await supabase
        .from('school_settings')
        .update({ setup_assistant_config: config, updated_at: now })
        .eq('id', existing.id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabase
        .from('school_settings')
        .insert({
          school_id: schoolId,
          campus_id: campusId ?? null,
          setup_assistant_config: config,
          updated_at: now,
        })
      if (error) throw new Error(error.message)
    }
  }

  /**
   * Get user progress (completed steps + dismissed state).
   */
  async getProgress(
    profileId: string,
    schoolId: string,
  ): Promise<{ completed_steps: string[]; dismissed: boolean }> {
    const { data } = await supabase
      .from('setup_assistant_progress')
      .select('completed_steps, dismissed')
      .eq('profile_id', profileId)
      .eq('school_id', schoolId)
      .maybeSingle()

    return {
      completed_steps: data?.completed_steps ?? [],
      dismissed: data?.dismissed ?? false,
    }
  }

  /**
   * Mark a step as complete.
   */
  async completeStep(
    profileId: string,
    schoolId: string,
    stepId: string,
  ): Promise<void> {
    const { data: existing } = await supabase
      .from('setup_assistant_progress')
      .select('id, completed_steps')
      .eq('profile_id', profileId)
      .eq('school_id', schoolId)
      .maybeSingle()

    const now = new Date().toISOString()

    if (existing) {
      const steps = existing.completed_steps ?? []
      if (steps.includes(stepId)) return // already complete

      const { error } = await supabase
        .from('setup_assistant_progress')
        .update({
          completed_steps: [...steps, stepId],
          updated_at: now,
        })
        .eq('id', existing.id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabase
        .from('setup_assistant_progress')
        .insert({
          profile_id: profileId,
          school_id: schoolId,
          completed_steps: [stepId],
          updated_at: now,
        })
      if (error) throw new Error(error.message)
    }
  }

  /**
   * Dismiss the assistant for this user (permanent until re-enabled).
   */
  async dismiss(profileId: string, schoolId: string): Promise<void> {
    const now = new Date().toISOString()

    const { data: existing } = await supabase
      .from('setup_assistant_progress')
      .select('id')
      .eq('profile_id', profileId)
      .eq('school_id', schoolId)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('setup_assistant_progress')
        .update({ dismissed: true, updated_at: now })
        .eq('id', existing.id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabase
        .from('setup_assistant_progress')
        .insert({
          profile_id: profileId,
          school_id: schoolId,
          dismissed: true,
          updated_at: now,
        })
      if (error) throw new Error(error.message)
    }
  }
}
