import { supabase } from '../config/supabase'

export const AGREEMENT_ROLES = ['teacher', 'student', 'parent', 'staff', 'librarian', 'counselor'] as const
export type AgreementRole = typeof AGREEMENT_ROLES[number]

export interface AgreementItem {
  id: string
  title: string
  content: string
  enabled: boolean
}

export interface RoleAgreementConfig {
  enabled: boolean
  /** 'manual' = stays accepted until admin resets. 'annual' = resets each new academic year. */
  reset_mode?: 'manual' | 'annual'
  /** Parent role only: if true, linked students are blocked until parent accepts. */
  block_linked_students?: boolean
  agreements: AgreementItem[]
}

export type RoleAgreementConfigs = Partial<Record<AgreementRole, RoleAgreementConfig>>

export interface LinkedStudent {
  id: string
  first_name: string
  last_name: string
}

export interface UserAgreementCheckResult {
  must_accept: boolean
  blocked: boolean
  message?: string
  agreement?: RoleAgreementConfig
  /** Parent only: list of children the parent is accepting on behalf of */
  students_needing_acceptance?: LinkedStudent[]
}

// ─────────────────────────────────────────────────────────────────────────────

export class UserAgreementService {

  // ── Admin: config management ───────────────────────────────────────────────

  async getConfig(schoolId: string, campusId: string | null): Promise<RoleAgreementConfigs> {
    let query = supabase
      .from('school_settings')
      .select('role_agreement_configs')
      .eq('school_id', schoolId)

    query = campusId ? query.eq('campus_id', campusId) : query.is('campus_id', null)

    const { data } = await query.maybeSingle()
    return (data?.role_agreement_configs as RoleAgreementConfigs) || {}
  }

  async updateConfig(
    schoolId: string,
    campusId: string | null,
    configs: RoleAgreementConfigs
  ): Promise<void> {
    const updates = {
      role_agreement_configs: configs,
      updated_at: new Date().toISOString(),
    }

    let q = supabase.from('school_settings').update(updates).eq('school_id', schoolId)
    q = campusId ? q.eq('campus_id', campusId) : q.is('campus_id', null)
    const { data: updated, error: updateErr } = await q.select('id')

    if (updateErr) throw updateErr

    if (!updated || updated.length === 0) {
      const { error: insertErr } = await supabase.from('school_settings').insert({
        school_id: schoolId,
        campus_id: campusId ?? null,
        ...updates,
      })
      if (insertErr) throw insertErr
    }
  }

  /** Reset all acceptances for a role — forces everyone to re-accept on next login. */
  async resetAcceptances(schoolId: string, role: AgreementRole): Promise<{ count: number }> {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        agreement_status: null,
        agreement_accepted_academic_year_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('school_id', schoolId)
      .eq('role', role)
      .select('id')

    if (error) throw error
    return { count: data?.length ?? 0 }
  }

  // ── User: agreement check ─────────────────────────────────────────────────

  /**
   * Check whether a user must accept an agreement OR is blocked (student blocked by parent).
   * Called right after every login for non-admin roles.
   */
  async checkUser(
    profileId: string,
    schoolId: string,
    role: string,
    campusId?: string | null
  ): Promise<UserAgreementCheckResult> {
    if (!AGREEMENT_ROLES.includes(role as AgreementRole)) {
      return { must_accept: false, blocked: false }
    }

    // ── Special path: student may be blocked by parent agreement ─────────────
    if (role === 'student') {
      const studentBlocked = await this._checkStudentBlockedByParent(profileId, schoolId, campusId ?? null)
      if (studentBlocked.blocked) {
        return { must_accept: false, blocked: true, message: studentBlocked.message }
      }
    }

    // ── Fetch the role's agreement config ─────────────────────────────────────
    let config = await this._getConfigForRole(schoolId, campusId ?? null, role as AgreementRole)

    const activeAgreements = (config?.agreements ?? []).filter(a => a.enabled)
    if (!config || !config.enabled || !activeAgreements.length) {
      return { must_accept: false, blocked: false }
    }
    config = { ...config, agreements: activeAgreements }

    // ── Check if user has already accepted ────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('agreement_status, agreement_accepted_academic_year_id')
      .eq('id', profileId)
      .single()

    if (profile?.agreement_status === 'accepted') {
      if (config.reset_mode === 'annual') {
        // Annual mode: check acceptance is for the current academic year
        const currentYearId = await this._getCurrentAcademicYearId(schoolId)
        if (currentYearId && profile.agreement_accepted_academic_year_id === currentYearId) {
          return { must_accept: false, blocked: false }
        }
        // Year mismatch — must accept again
      } else {
        // Manual mode — accepted once, always accepted
        return { must_accept: false, blocked: false }
      }
    }

    // ── For parent role: fetch linked student names ───────────────────────────
    let studentsNeedingAcceptance: LinkedStudent[] | undefined

    if (role === 'parent') {
      studentsNeedingAcceptance = await this._getLinkedStudentsForParent(profileId)
    }

    return {
      must_accept: true,
      blocked: false,
      agreement: config,
      students_needing_acceptance: studentsNeedingAcceptance,
    }
  }

  // ── User: accept ──────────────────────────────────────────────────────────

  /**
   * Record acceptance. If the role agreement uses annual mode, also stores
   * the current academic year ID so annual reset works correctly.
   */
  async acceptAgreement(
    profileId: string,
    schoolId: string,
    role: string,
    campusId?: string | null
  ): Promise<void> {
    const config = await this._getConfigForRole(schoolId, campusId ?? null, role as AgreementRole)
    const isAnnual = config?.reset_mode === 'annual'

    let academicYearId: string | null = null
    if (isAnnual) {
      academicYearId = await this._getCurrentAcademicYearId(schoolId)
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        agreement_status: 'accepted',
        agreement_accepted_academic_year_id: academicYearId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId)

    if (error) throw error
  }

  // ── User: reject ──────────────────────────────────────────────────────────

  /** Reject agreement — sets is_active=false and agreement_status='rejected'. */
  async rejectAgreement(profileId: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({
        agreement_status: 'rejected',
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId)

    if (error) throw error
  }

  // ── Public: re-accept request ─────────────────────────────────────────────

  /**
   * Public endpoint: re-enable a rejected account so user can log in
   * and see the agreement popup again.
   */
  async requestReaccept(email: string): Promise<{ found: boolean }> {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, agreement_status')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle()

    if (!profile) return { found: false }

    // Only re-enable if specifically deactivated by agreement rejection
    if (profile.agreement_status !== 'rejected') return { found: true }

    await supabase
      .from('profiles')
      .update({
        agreement_status: null,
        agreement_accepted_academic_year_id: null,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    return { found: true }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /** Get role config, preferring campus-specific then falling back to school-level. */
  private async _getConfigForRole(
    schoolId: string,
    campusId: string | null,
    role: AgreementRole
  ): Promise<RoleAgreementConfig | null> {
    if (campusId) {
      const { data: campusRow } = await supabase
        .from('school_settings')
        .select('role_agreement_configs')
        .eq('school_id', schoolId)
        .eq('campus_id', campusId)
        .maybeSingle()

      const campusConfigs = campusRow?.role_agreement_configs as any
      if (campusConfigs?.[role]) return this._normalizeConfig(campusConfigs[role])
    }

    const { data: schoolRow } = await supabase
      .from('school_settings')
      .select('role_agreement_configs')
      .eq('school_id', schoolId)
      .is('campus_id', null)
      .maybeSingle()

    const schoolConfigs = schoolRow?.role_agreement_configs as any
    return schoolConfigs?.[role] ? this._normalizeConfig(schoolConfigs[role]) : null
  }

  /**
   * Migrate legacy single-agreement configs (title+content) to the new agreements[] format.
   * Stored data created before the multi-agreement change will still have top-level title/content.
   */
  private _normalizeConfig(raw: any): RoleAgreementConfig {
    if (!raw) return raw
    if (!raw.agreements && (raw.title || raw.content)) {
      const { title, content, ...rest } = raw
      return {
        ...rest,
        agreements: [{ id: 'legacy', title: title || '', content: content || '', enabled: true }],
      }
    }
    return raw as RoleAgreementConfig
  }

  /** Fetch the current academic year ID for a school. Returns null if none set. */
  private async _getCurrentAcademicYearId(schoolId: string): Promise<string | null> {
    const { data } = await supabase
      .from('academic_years')
      .select('id')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .maybeSingle()

    return data?.id ?? null
  }

  /**
   * Get students linked to a parent profile.
   * Used to display child names inside the parent's agreement popup.
   */
  private async _getLinkedStudentsForParent(parentProfileId: string): Promise<LinkedStudent[]> {
    // Resolve parent record from profile
    const { data: parentRecord } = await supabase
      .from('parents')
      .select('id')
      .eq('profile_id', parentProfileId)
      .maybeSingle()

    if (!parentRecord) return []

    const { data: links } = await supabase
      .from('parent_student_links')
      .select(`
        student:students!inner(
          id,
          profile:profiles!students_profile_id_fkey(first_name, last_name)
        )
      `)
      .eq('parent_id', parentRecord.id)
      .eq('is_active', true)

    if (!links) return []

    return links.map((link: any) => ({
      id: link.student.id,
      first_name: link.student.profile?.first_name || '',
      last_name: link.student.profile?.last_name || '',
    }))
  }

  /**
   * Check if a student is blocked because their linked parents haven't accepted
   * the parent agreement (when block_linked_students = true on the parent config).
   */
  private async _checkStudentBlockedByParent(
    studentProfileId: string,
    schoolId: string,
    campusId: string | null
  ): Promise<{ blocked: boolean; message?: string }> {
    // Get parent agreement config
    const parentConfig = await this._getConfigForRole(schoolId, campusId, 'parent')

    if (!parentConfig?.enabled || !parentConfig.block_linked_students) {
      return { blocked: false }
    }

    // Get the student's DB record to find their student ID
    const { data: studentRecord } = await supabase
      .from('students')
      .select('id')
      .eq('profile_id', studentProfileId)
      .maybeSingle()

    if (!studentRecord) return { blocked: false }

    // Get all active linked parents
    const { data: parentLinks } = await supabase
      .from('parent_student_links')
      .select('parent:parents!inner(id, profile_id)')
      .eq('student_id', studentRecord.id)
      .eq('is_active', true)

    // No linked parents → not blocked (consistent with old plugin behavior)
    if (!parentLinks || parentLinks.length === 0) return { blocked: false }

    // Get profile IDs of all linked parents
    const parentProfileIds = parentLinks.map((l: any) => l.parent.profile_id).filter(Boolean)

    if (parentProfileIds.length === 0) return { blocked: false }

    // Fetch parent profiles to check acceptance status
    const { data: parentProfiles } = await supabase
      .from('profiles')
      .select('id, agreement_status, agreement_accepted_academic_year_id')
      .in('id', parentProfileIds)

    if (!parentProfiles || parentProfiles.length === 0) return { blocked: false }

    // Check if ANY parent has accepted (for annual mode, must be current year)
    let currentYearId: string | null = null
    if (parentConfig.reset_mode === 'annual') {
      currentYearId = await this._getCurrentAcademicYearId(schoolId)
    }

    for (const parentProfile of parentProfiles) {
      if (parentProfile.agreement_status !== 'accepted') continue

      if (parentConfig.reset_mode === 'annual') {
        if (currentYearId && parentProfile.agreement_accepted_academic_year_id === currentYearId) {
          return { blocked: false } // At least one parent accepted this year
        }
      } else {
        return { blocked: false } // At least one parent accepted (manual mode)
      }
    }

    // No parent has accepted — student is blocked
    return {
      blocked: true,
      message: 'Your parent or guardian must accept the school agreement before you can access the system. Please ask them to log in and accept.',
    }
  }
}

export const userAgreementService = new UserAgreementService()
