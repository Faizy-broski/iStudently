import { supabase } from '../config/supabase'
import { PhysicsLab, CreatePhysicsLabDTO, UpdatePhysicsLabDTO, PhysicsLabSubmission } from '../types'

// ── Admin: manage labs ────────────────────────────────────────────────────────

async function resolveSchoolIds(schoolId: string): Promise<string[]> {
  const ids = [schoolId]
  const { data } = await supabase
    .from('schools')
    .select('parent_school_id')
    .eq('id', schoolId)
    .maybeSingle()
  if (data?.parent_school_id) ids.push(data.parent_school_id)
  return ids
}

export const getPhysicsLabs = async (schoolId: string): Promise<PhysicsLab[]> => {
  const schoolIds = await resolveSchoolIds(schoolId)
  const { data, error } = await supabase
    .from('physics_labs')
    .select('*')
    .in('school_id', schoolIds)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export const createPhysicsLab = async (dto: CreatePhysicsLabDTO): Promise<PhysicsLab> => {
  const { data, error } = await supabase
    .from('physics_labs')
    .insert({
      school_id:   dto.school_id,
      sim_key:     dto.sim_key,
      subject_id:  dto.subject_id  || null,
      grade_id:    dto.grade_id    || null,
      custom_note: dto.custom_note || null,
      is_active:   dto.is_active   ?? true,
      created_by:  dto.created_by  || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export const updatePhysicsLab = async (
  id: string,
  schoolId: string,
  dto: UpdatePhysicsLabDTO
): Promise<PhysicsLab> => {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (dto.subject_id  !== undefined) payload.subject_id  = dto.subject_id  || null
  if (dto.grade_id    !== undefined) payload.grade_id    = dto.grade_id    || null
  if (dto.custom_note !== undefined) payload.custom_note = dto.custom_note || null
  if (dto.is_active   !== undefined) payload.is_active   = dto.is_active

  const { data, error } = await supabase
    .from('physics_labs')
    .update(payload)
    .eq('id', id)
    .eq('school_id', schoolId)
    .select()
    .single()

  if (error) throw error
  if (!data) throw new Error('Physics lab not found or access denied')
  return data
}

export const deletePhysicsLab = async (id: string, schoolId: string): Promise<void> => {
  const { error } = await supabase
    .from('physics_labs')
    .delete()
    .eq('id', id)
    .eq('school_id', schoolId)

  if (error) throw error
}

// ── Student-facing: active labs filtered by grade ─────────────────────────────

export const getStudentPhysicsLabs = async (
  schoolId: string,
  gradeId?: string | null
): Promise<PhysicsLab[]> => {
  const schoolIds = await resolveSchoolIds(schoolId)

  let query = supabase
    .from('physics_labs')
    .select('*')
    .in('school_id', schoolIds)
    .eq('is_active', true)

  if (gradeId) {
    // Student has a grade: show their grade's labs + ungraded (all-grades) labs
    query = query.or(`grade_id.eq.${gradeId},grade_id.is.null`)
  }
  // No grade set → return all active labs; set the student's grade in their profile to narrow this

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error

  // Deduplicate by sim_key — one entry per simulation per student regardless of
  // how many grade assignments exist; prefer the grade-specific record over null-grade
  const bySimKey = new Map<string, PhysicsLab>()
  for (const lab of (data || [])) {
    const existing = bySimKey.get(lab.sim_key)
    if (!existing) {
      bySimKey.set(lab.sim_key, lab)
    } else if (lab.grade_id !== null && existing.grade_id === null) {
      // prefer grade-specific over all-grades
      bySimKey.set(lab.sim_key, lab)
    }
  }
  return Array.from(bySimKey.values())
}

// ── Submissions ───────────────────────────────────────────────────────────────

export const createSubmission = async (submission: {
  school_id: string
  lab_id: string
  student_id: string
  findings_text: string
  time_spent_s?: number
}): Promise<PhysicsLabSubmission> => {
  const { data, error } = await supabase
    .from('physics_lab_submissions')
    .insert(submission)
    .select()
    .single()

  if (error) throw error
  return data
}

export const getLabSubmissions = async (
  labId: string,
  schoolId: string
): Promise<PhysicsLabSubmission[]> => {
  const { data, error } = await supabase
    .from('physics_lab_submissions')
    .select('*, profiles!student_id(first_name, last_name, grade_levels(name))')
    .eq('lab_id', labId)
    .eq('school_id', schoolId)
    .order('submitted_at', { ascending: false })

  if (error) throw error
  return data || []
}
