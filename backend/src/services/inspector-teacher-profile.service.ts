import { supabase } from '../config/supabase'
import { assertInspectorCanAccessSchool } from '../utils/inspector-access'
import { getQualifications } from './human-resources.service'

export interface CallerContext {
  profileId: string
  role: string
  schoolId: string
}

/** Lists teachers at a campus this inspector is assigned to — for the "add teacher to visit" picker. */
export async function listTeachersForSchool(caller: CallerContext, schoolId: string) {
  if (caller.role !== 'inspector' && caller.role !== 'super_admin') {
    throw new Error('Access denied: inspector access required')
  }
  if (caller.role === 'inspector') {
    const hasAccess = await assertInspectorCanAccessSchool(caller.profileId, schoolId, caller.role)
    if (!hasAccess) throw new Error('Access denied: not assigned to this campus')
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email')
    .eq('school_id', schoolId)
    .eq('role', 'teacher')
    .eq('is_active', true)
    .order('first_name', { ascending: true })

  if (error) throw new Error(`Failed to list teachers: ${error.message}`)
  return data || []
}

/**
 * Lists subjects at a campus this inspector is assigned to — for the visit
 * teacher/subject picker. academics.service.ts's own /academics/subjects
 * endpoint is teacher/admin-only and resolves school_id from the caller's
 * own profile, neither of which fits an inspector reading a DIFFERENT
 * campus's subjects, so this is a dedicated, explicitly-scoped read instead
 * of reusing that route.
 */
export async function listSubjectsForSchool(caller: CallerContext, schoolId: string) {
  if (caller.role !== 'inspector' && caller.role !== 'super_admin') {
    throw new Error('Access denied: inspector access required')
  }
  if (caller.role === 'inspector') {
    const hasAccess = await assertInspectorCanAccessSchool(caller.profileId, schoolId, caller.role)
    if (!hasAccess) throw new Error('Access denied: not assigned to this campus')
  }

  const { data, error } = await supabase
    .from('subjects')
    .select('id, name, code')
    .eq('school_id', schoolId)
    .order('name', { ascending: true })

  if (error) throw new Error(`Failed to list subjects: ${error.message}`)
  return data || []
}

/**
 * Cross-school, inspector-facing read of a teacher's e-portfolio (HR
 * qualifications: education, certifications, languages, skills) ahead of a
 * visit. human-resources.service.ts's own pages are strictly admin-own-
 * school-scoped, so this wraps the same getQualifications() with its own
 * inspector-assignment authorization instead of the admin-school check that
 * function's usual callers rely on.
 *
 * historical_reports stays an empty placeholder until Phase 4 (final
 * report) exists — nothing to show yet.
 */
export async function getTeacherPortfolio(caller: CallerContext, teacherProfileId: string) {
  if (caller.role !== 'inspector' && caller.role !== 'super_admin') {
    throw new Error('Access denied: inspector access required')
  }

  const { data: teacher, error: teacherError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, phone, profile_photo_url, school_id, role')
    .eq('id', teacherProfileId)
    .single()

  if (teacherError || !teacher) throw new Error('Teacher not found')
  if (teacher.role !== 'teacher') throw new Error('Profile is not a teacher')

  if (caller.role === 'inspector') {
    const hasAccess = await assertInspectorCanAccessSchool(caller.profileId, teacher.school_id, caller.role)
    if (!hasAccess) throw new Error('Access denied: not assigned to this teacher\'s campus')
  }

  const { data: qualifications, error: qualError } = await getQualifications(teacherProfileId, teacher.school_id)
  if (qualError) throw new Error(`Failed to load qualifications: ${qualError}`)

  const { data: school } = await supabase.from('schools').select('id, name').eq('id', teacher.school_id).single()

  return {
    teacher: { ...teacher, school },
    qualifications: qualifications || { skills: [], education: [], certifications: [], languages: [] },
    historical_reports: [] as unknown[],
  }
}
