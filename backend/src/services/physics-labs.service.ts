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
      // A section only makes sense scoped to its grade — never persist one without the other.
      section_id:  dto.grade_id ? (dto.section_id || null) : null,
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
  if (dto.section_id  !== undefined) payload.section_id  = dto.section_id || null
  if (dto.custom_note !== undefined) payload.custom_note = dto.custom_note || null
  if (dto.is_active   !== undefined) payload.is_active   = dto.is_active
  // A section only makes sense scoped to its grade — clearing the grade in
  // this same update always clears any section too, regardless of dto.section_id.
  if (dto.grade_id !== undefined && !dto.grade_id) payload.section_id = null

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

// ── Student-facing: active labs filtered by grade + section ──────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const getStudentPhysicsLabs = async (
  schoolId: string,
  gradeId?: string | null,
  sectionId?: string | null
): Promise<PhysicsLab[]> => {
  const schoolIds = await resolveSchoolIds(schoolId)
  const safeGradeId = gradeId && UUID_RE.test(gradeId) ? gradeId : null
  const safeSectionId = sectionId && UUID_RE.test(sectionId) ? sectionId : null

  let query = supabase
    .from('physics_labs')
    .select('*')
    .in('school_id', schoolIds)
    .eq('is_active', true)

  if (safeGradeId) {
    // Student has a grade: show ungraded (all-grades) labs, whole-grade labs
    // for their grade, and — if they have a section — labs narrowed to it.
    const branches = [`grade_id.is.null`, `and(grade_id.eq.${safeGradeId},section_id.is.null)`]
    if (safeSectionId) branches.push(`and(grade_id.eq.${safeGradeId},section_id.eq.${safeSectionId})`)
    query = query.or(branches.join(','))
  }
  // No grade set → return all active labs; set the student's grade in their profile to narrow this

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error

  // Deduplicate by sim_key — one entry per simulation per student regardless of
  // how many grade/section assignments exist; prefer the most specific match:
  // section-specific > whole-grade > all-grades.
  const specificity = (lab: PhysicsLab) => (lab.section_id ? 2 : lab.grade_id ? 1 : 0)
  const bySimKey = new Map<string, PhysicsLab>()
  for (const lab of (data || [])) {
    const existing = bySimKey.get(lab.sim_key)
    if (!existing || specificity(lab) > specificity(existing)) {
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
