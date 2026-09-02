import { supabase } from '../../config/supabase'
import { isTeacherAssignedToStudent } from '../../utils/hifzi-access'

// ============================================================================
// Hifzi student domain — enrollment into circles, and the Hifzi-specific
// profile extension. `learning_needs_json` is a restricted field (spec
// HFZ-STU-9): no field-level permission system exists in this codebase
// (role-string based only), so it's masked here in application code, not by
// the schema.
// ============================================================================

const LEARNING_NEEDS_ALLOWED_ROLES = ['admin', 'super_admin']

export interface EnrollStudentDTO {
  circleId: string
  studentId: string
}

class HifziEnrollmentsService {
  async getEnrollments(circleId: string) {
    const { data, error } = await supabase
      .from('hifzi_enrollments')
      .select('*, students(id, student_number, profile:profiles(first_name, last_name))')
      .eq('circle_id', circleId)
      .eq('status', 'active')
      .order('enrolled_at')

    if (error) throw new Error(`Failed to fetch enrollments: ${error.message}`)
    return data || []
  }

  async enroll(dto: EnrollStudentDTO) {
    const { data: existing } = await supabase
      .from('hifzi_enrollments')
      .select('id')
      .eq('circle_id', dto.circleId)
      .eq('student_id', dto.studentId)
      .eq('status', 'active')
      .maybeSingle()

    if (existing) throw new Error('This student is already actively enrolled in this circle')

    const { data, error } = await supabase
      .from('hifzi_enrollments')
      .insert({ circle_id: dto.circleId, student_id: dto.studentId })
      .select()
      .single()

    if (error) throw new Error(`Failed to enroll student: ${error.message}`)

    // Ensure a hifzi_student_profiles row exists (created lazily on first enrollment).
    await supabase.from('hifzi_student_profiles').upsert({ student_id: dto.studentId }, { onConflict: 'student_id', ignoreDuplicates: true })

    return data
  }

  /**
   * Bulk version of enroll() — enrolls many existing students into one
   * circle at once. Reuses enroll() per student rather than reimplementing
   * its duplicate-active-enrollment check / hifzi_student_profiles lazy-
   * upsert; bounded concurrency (batches of 10, matching
   * student.service.ts::bulkImportStudents and this session's earlier
   * plans.service.ts nightly-assignment batching) with a per-student
   * try/catch so one failure can't abort the batch.
   */
  async enrollBulk(circleId: string, studentIds: string[]): Promise<{
    success_count: number
    error_count: number
    errors: { student_id: string; error: string }[]
    enrolled: any[]
  }> {
    let success_count = 0
    let error_count = 0
    const errors: { student_id: string; error: string }[] = []
    const enrolled: any[] = []

    const CONCURRENCY = 10
    for (let i = 0; i < studentIds.length; i += CONCURRENCY) {
      const batch = studentIds.slice(i, i + CONCURRENCY)
      await Promise.all(
        batch.map(async (studentId) => {
          try {
            const row = await this.enroll({ circleId, studentId })
            success_count++
            enrolled.push(row)
          } catch (err: any) {
            error_count++
            errors.push({ student_id: studentId, error: err?.message || String(err) })
          }
        })
      )
    }

    return { success_count, error_count, errors, enrolled }
  }

  async withdraw(enrollmentId: string) {
    const { data, error } = await supabase
      .from('hifzi_enrollments')
      .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString().slice(0, 10) })
      .eq('id', enrollmentId)
      .eq('status', 'active')
      .select()
      .single()

    if (error) throw new Error(`Failed to withdraw enrollment: ${error.message}`)
    return data
  }
}

class HifziStudentProfilesService {
  /** Strips `learning_needs_json` unless the caller's role is allow-listed, or they're a teacher of one of this student's active circles. */
  private async canSeeLearningNeeds(studentId: string, callerRole: string, callerProfileId: string): Promise<boolean> {
    if (LEARNING_NEEDS_ALLOWED_ROLES.includes(callerRole)) return true
    if (callerRole !== 'teacher') return false

    // Shared with hifzi-access.ts's assertCanAccessStudent — single source
    // of truth for "is this teacher assigned to this student's circle".
    return isTeacherAssignedToStudent(studentId, callerProfileId)
  }

  async getProfile(studentId: string, callerRole: string, callerProfileId: string) {
    const { data, error } = await supabase.from('hifzi_student_profiles').select('*').eq('student_id', studentId).maybeSingle()

    if (error) throw new Error(`Failed to fetch student profile: ${error.message}`)
    if (!data) return null

    const canSeeLearningNeeds = await this.canSeeLearningNeeds(studentId, callerRole, callerProfileId)
    if (!canSeeLearningNeeds) {
      const { learning_needs_json, ...rest } = data
      return rest
    }
    return data
  }

  async updateProfile(studentId: string, updates: { riwayahId?: string; currentJuzTarget?: number; memorizationStartDate?: string; learningNeedsJson?: Record<string, any>; notesSummary?: string }) {
    const payload: Record<string, any> = { updated_at: new Date().toISOString() }
    if (updates.riwayahId !== undefined) payload.riwayah_id = updates.riwayahId
    if (updates.currentJuzTarget !== undefined) payload.current_juz_target = updates.currentJuzTarget
    if (updates.memorizationStartDate !== undefined) payload.memorization_start_date = updates.memorizationStartDate
    if (updates.learningNeedsJson !== undefined) payload.learning_needs_json = updates.learningNeedsJson
    if (updates.notesSummary !== undefined) payload.notes_summary = updates.notesSummary

    const { data, error } = await supabase
      .from('hifzi_student_profiles')
      .upsert({ student_id: studentId, ...payload }, { onConflict: 'student_id' })
      .select()
      .single()

    if (error) throw new Error(`Failed to update student profile: ${error.message}`)
    return data
  }

  async addNote(studentId: string, authorProfileId: string, note: string, visibility: 'teacher_only' | 'management' | 'guardian_visible' = 'teacher_only') {
    const { data: profile, error: profileError } = await supabase
      .from('hifzi_student_profiles')
      .upsert({ student_id: studentId }, { onConflict: 'student_id', ignoreDuplicates: true })
      .select('id')
      .single()

    // upsert with ignoreDuplicates returns null data on conflict — fetch explicitly in that case
    const profileId = profile?.id ?? (await supabase.from('hifzi_student_profiles').select('id').eq('student_id', studentId).single()).data?.id

    if (profileError && !profileId) throw new Error(`Failed to resolve student profile: ${profileError.message}`)

    const { data, error } = await supabase
      .from('hifzi_student_notes')
      .insert({ student_profile_id: profileId, author_profile_id: authorProfileId, note, visibility })
      .select()
      .single()

    if (error) throw new Error(`Failed to add student note: ${error.message}`)
    return data
  }
}

export const hifziEnrollmentsService = new HifziEnrollmentsService()
export const hifziStudentProfilesService = new HifziStudentProfilesService()
