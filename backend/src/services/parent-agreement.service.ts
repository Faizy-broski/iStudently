import { supabase } from '../config/supabase'

/**
 * Parent Agreement Service
 *
 * Mirrors RosarioSIS Parent_Agreement plugin.
 * Campus-specific: each campus configures its own agreement.
 * Per academic year: acceptance resets when a new year becomes current.
 */

interface AgreementConfig {
  title: string
  content: string
}

interface ParentCheckResult {
  must_accept: boolean
  agreement?: AgreementConfig
  students_needing_acceptance?: Array<{ id: string; first_name: string; last_name: string }>
}

interface StudentCheckResult {
  blocked: boolean
  message?: string
}

export class ParentAgreementService {

  /**
   * Check if a parent needs to accept the agreement.
   * Returns must_accept=true if plugin is active AND parent has linked students
   * that haven't been accepted for the current academic year.
   */
  async checkParentStatus(parentId: string, schoolId: string): Promise<ParentCheckResult> {
    // 1. Get linked students + their campus IDs
    const { data: links } = await supabase
      .from('parent_student_links')
      .select(`
        student_id,
        student:students!inner(
          id,
          section:sections(campus_id),
          profile:profiles!students_profile_id_fkey(first_name, last_name)
        )
      `)
      .eq('parent_id', parentId)
      .eq('is_active', true)

    if (!links || links.length === 0) {
      // No linked students — no agreement needed (like RosarioSIS)
      return { must_accept: false }
    }

    // Collect unique campus IDs from linked students
    const campusStudentMap = new Map<string, Array<{ id: string; first_name: string; last_name: string }>>()
    for (const link of links) {
      const student = link.student as any
      const campusId = student?.section?.campus_id
      if (!campusId) continue

      if (!campusStudentMap.has(campusId)) {
        campusStudentMap.set(campusId, [])
      }
      campusStudentMap.get(campusId)!.push({
        id: student.id,
        first_name: student.profile?.first_name || '',
        last_name: student.profile?.last_name || '',
      })
    }

    if (campusStudentMap.size === 0) {
      return { must_accept: false }
    }

    // 2. For each campus, check if plugin is active
    const campusIds = Array.from(campusStudentMap.keys())
    const { data: settingsRows } = await supabase
      .from('school_settings')
      .select('campus_id, active_plugins, parent_agreement_config')
      .eq('school_id', schoolId)
      .in('campus_id', campusIds)

    const activeConfigs = new Map<string, AgreementConfig>()
    for (const row of settingsRows || []) {
      const plugins = row.active_plugins as Record<string, boolean> | null
      if (plugins?.parent_agreement) {
        const config = row.parent_agreement_config as AgreementConfig | null
        if (config?.title && config?.content) {
          activeConfigs.set(row.campus_id, config)
        }
      }
    }

    if (activeConfigs.size === 0) {
      // Plugin not active on any campus where parent has students
      return { must_accept: false }
    }

    // 3. Get current academic year
    const { data: currentYear } = await supabase
      .from('academic_years')
      .select('id')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .maybeSingle()

    if (!currentYear) {
      // No current academic year — can't enforce agreement
      return { must_accept: false }
    }

    // 4. Check acceptance for each student on active campuses
    const studentsNeedingAcceptance: Array<{ id: string; first_name: string; last_name: string }> = []
    let firstConfig: AgreementConfig | null = null

    for (const [campusId, students] of campusStudentMap) {
      const config = activeConfigs.get(campusId)
      if (!config) continue

      const studentIds = students.map(s => s.id)

      const { data: acceptances } = await supabase
        .from('parent_agreement_acceptances')
        .select('student_id')
        .eq('parent_id', parentId)
        .eq('academic_year_id', currentYear.id)
        .eq('campus_id', campusId)
        .in('student_id', studentIds)

      const acceptedIds = new Set((acceptances || []).map(a => a.student_id))

      for (const student of students) {
        if (!acceptedIds.has(student.id)) {
          studentsNeedingAcceptance.push(student)
          if (!firstConfig) firstConfig = config
        }
      }
    }

    if (studentsNeedingAcceptance.length === 0) {
      return { must_accept: false }
    }

    return {
      must_accept: true,
      agreement: firstConfig!,
      students_needing_acceptance: studentsNeedingAcceptance,
    }
  }

  /**
   * Check if a student is blocked because their parent hasn't accepted.
   * Students without linked parents can always access (like RosarioSIS).
   */
  async checkStudentStatus(studentId: string, schoolId: string, campusId?: string | null): Promise<StudentCheckResult> {
    if (!campusId) {
      return { blocked: false }
    }

    // 1. Check if plugin is active for the student's campus
    const { data: settings } = await supabase
      .from('school_settings')
      .select('active_plugins, parent_agreement_config')
      .eq('school_id', schoolId)
      .eq('campus_id', campusId)
      .maybeSingle()

    const plugins = settings?.active_plugins as Record<string, boolean> | null
    if (!plugins?.parent_agreement) {
      return { blocked: false }
    }

    const config = settings?.parent_agreement_config as AgreementConfig | null
    if (!config?.title || !config?.content) {
      // Plugin active but not configured — don't block
      return { blocked: false }
    }

    // 2. Check if student has any active parent links
    const { data: parentLinks } = await supabase
      .from('parent_student_links')
      .select('parent_id')
      .eq('student_id', studentId)
      .eq('is_active', true)

    if (!parentLinks || parentLinks.length === 0) {
      // No parents linked — student can access (like RosarioSIS)
      return { blocked: false }
    }

    // 3. Get current academic year
    const { data: currentYear } = await supabase
      .from('academic_years')
      .select('id')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .maybeSingle()

    if (!currentYear) {
      return { blocked: false }
    }

    // 4. Check if ANY parent has accepted for this student
    const parentIds = parentLinks.map(pl => pl.parent_id)
    const { data: acceptances } = await supabase
      .from('parent_agreement_acceptances')
      .select('id')
      .in('parent_id', parentIds)
      .eq('student_id', studentId)
      .eq('academic_year_id', currentYear.id)
      .eq('campus_id', campusId)
      .limit(1)

    if (acceptances && acceptances.length > 0) {
      // At least one parent has accepted
      return { blocked: false }
    }

    return {
      blocked: true,
      message: 'Your parent or guardian must accept the school agreement before you can access the system. Please ask them to log in and accept.',
    }
  }

  /**
   * Record parent acceptance for all their linked students on active campuses.
   */
  async acceptAgreement(parentId: string, schoolId: string): Promise<void> {
    // 1. Get linked students with campus info
    const { data: links } = await supabase
      .from('parent_student_links')
      .select(`
        student_id,
        student:students!inner(
          id,
          section:sections(campus_id)
        )
      `)
      .eq('parent_id', parentId)
      .eq('is_active', true)

    if (!links || links.length === 0) return

    // 2. Get current academic year
    const { data: currentYear } = await supabase
      .from('academic_years')
      .select('id')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .single()

    if (!currentYear) {
      throw new Error('No current academic year found')
    }

    // 3. Get all campus IDs where plugin is active
    const campusIds = new Set<string>()
    for (const link of links) {
      const campusId = (link.student as any)?.section?.campus_id
      if (campusId) campusIds.add(campusId)
    }

    const { data: settingsRows } = await supabase
      .from('school_settings')
      .select('campus_id, active_plugins')
      .eq('school_id', schoolId)
      .in('campus_id', Array.from(campusIds))

    const activeCampuses = new Set<string>()
    for (const row of settingsRows || []) {
      const plugins = row.active_plugins as Record<string, boolean> | null
      if (plugins?.parent_agreement) {
        activeCampuses.add(row.campus_id)
      }
    }

    // 4. Build acceptance records
    const records: Array<{
      parent_id: string
      student_id: string
      school_id: string
      campus_id: string
      academic_year_id: string
    }> = []

    for (const link of links) {
      const student = link.student as any
      const campusId = student?.section?.campus_id
      if (!campusId || !activeCampuses.has(campusId)) continue

      records.push({
        parent_id: parentId,
        student_id: student.id,
        school_id: schoolId,
        campus_id: campusId,
        academic_year_id: currentYear.id,
      })
    }

    if (records.length === 0) return

    // 5. Upsert acceptances (idempotent)
    const { error } = await supabase
      .from('parent_agreement_acceptances')
      .upsert(records, {
        onConflict: 'parent_id,student_id,academic_year_id,campus_id',
      })

    if (error) throw error
  }

  /**
   * Get agreement config for admin settings page.
   */
  async getConfig(schoolId: string, campusId: string | null): Promise<AgreementConfig> {
    let query = supabase
      .from('school_settings')
      .select('parent_agreement_config')
      .eq('school_id', schoolId)

    if (campusId) {
      query = query.eq('campus_id', campusId)
    } else {
      query = query.is('campus_id', null)
    }

    const { data } = await query.maybeSingle()
    const config = data?.parent_agreement_config as AgreementConfig | null

    return {
      title: config?.title || '',
      content: config?.content || '',
    }
  }

  /**
   * Update agreement config (admin).
   */
  async updateConfig(schoolId: string, campusId: string | null, config: AgreementConfig): Promise<void> {
    const updates = {
      parent_agreement_config: { title: config.title, content: config.content },
      updated_at: new Date().toISOString(),
    }

    let updateQ = supabase.from('school_settings').update(updates).eq('school_id', schoolId)
    updateQ = campusId ? updateQ.eq('campus_id', campusId) : updateQ.is('campus_id', null)
    const { data: updatedRows, error: updateError } = await updateQ.select('id')

    if (updateError) throw updateError

    if (!updatedRows || updatedRows.length === 0) {
      // No row existed — insert one
      const { error: insertError } = await supabase
        .from('school_settings')
        .insert({
          school_id: schoolId,
          campus_id: campusId ?? null,
          ...updates,
        })
      if (insertError) throw insertError
    }
  }
}

export const parentAgreementService = new ParentAgreementService()
