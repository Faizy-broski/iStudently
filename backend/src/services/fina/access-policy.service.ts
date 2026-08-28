import { supabase } from '../../config/supabase'
import { CallerContext } from './types'

/**
 * Al-Fina' access policy (spec §12). "Class" in the spec maps to this
 * codebase's `sections` table (students.section_id) — there is no separate
 * `classes` concept here. "Guardian" maps to the existing `parent` role.
 */

export type FinaRelation = 'admin' | 'teacher_of' | 'guardian_of' | 'student_self' | 'other'

async function resolveStaffId(profileId: string): Promise<string | null> {
  const { data } = await supabase.from('staff').select('id').eq('profile_id', profileId).maybeSingle()
  return data?.id ?? null
}

async function resolveParentId(profileId: string): Promise<string | null> {
  const { data } = await supabase.from('parents').select('id').eq('profile_id', profileId).maybeSingle()
  return data?.id ?? null
}

/** Every guardian profile id linked to a student (both parents/guardians if
 * more than one, regardless of consent authority) — feeds notification
 * fan-out (spec §14): absence/new-post alerts go to every active guardian,
 * not just whoever holds consent authority for photo decisions. */
export async function getGuardianProfileIdsForStudent(studentId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('parent_student_links')
    .select('parent:parents(profile_id)')
    .eq('student_id', studentId)
    .eq('is_active', true)
  if (error) {
    console.error('Error loading guardian profile ids for student:', error)
    return []
  }
  return [...new Set((data || []).map((r: any) => r.parent?.profile_id).filter(Boolean) as string[])]
}

/** Every student a guardian profile has an active link to, regardless of
 * consent authority — viewing access (spec: "GUARDIAN view scope: own
 * wards") is broader than who may grant/withdraw consent for them. */
export async function getGuardianStudentIds(profileId: string): Promise<string[]> {
  const parentId = await resolveParentId(profileId)
  if (!parentId) return []
  const { data, error } = await supabase
    .from('parent_student_links')
    .select('student_id')
    .eq('parent_id', parentId)
    .eq('is_active', true)
  if (error) {
    console.error('Error loading guardian student ids:', error)
    return []
  }
  return (data || []).map((r) => r.student_id as string)
}

/** Only the student(s) this guardian is the resolved consent authority for —
 * used to gate POST /fina/consents, never for view-access decisions. */
export async function getConsentGuardianStudentIds(profileId: string): Promise<string[]> {
  const parentId = await resolveParentId(profileId)
  if (!parentId) return []
  const { data, error } = await supabase
    .from('parent_student_links')
    .select('student_id')
    .eq('parent_id', parentId)
    .eq('is_active', true)
    .eq('is_consent_guardian', true)
  if (error) {
    console.error('Error loading consent-guardian student ids:', error)
    return []
  }
  return (data || []).map((r) => r.student_id as string)
}

/** Every section id a teacher currently teaches (via teacher_subject_assignments). */
async function getTeacherSectionIds(profileId: string): Promise<string[]> {
  const staffId = await resolveStaffId(profileId)
  if (!staffId) return []
  const { data, error } = await supabase
    .from('teacher_subject_assignments')
    .select('section_id')
    .eq('teacher_id', staffId)
  if (error) {
    console.error('Error loading teacher section ids:', error)
    return []
  }
  return [...new Set((data || []).map((r) => r.section_id as string).filter(Boolean))]
}

export async function getStudentSectionIds(studentIds: string[]): Promise<Map<string, string | null>> {
  if (studentIds.length === 0) return new Map()
  const { data, error } = await supabase.from('students').select('id, section_id').in('id', studentIds)
  if (error) {
    console.error('Error loading student section ids:', error)
    return new Map()
  }
  return new Map((data || []).map((s) => [s.id as string, s.section_id as string | null]))
}

/**
 * Every student id visible to this caller, scoped by role — spec §12's
 * AccessPolicy::visibleStudentIds(). Used by the wall query (Phase 2) and by
 * any listing endpoint that must not leak students outside the caller's
 * legitimate scope. Never falls through to an unscoped `[]`-then-widened
 * result — every branch is explicit, and unrecognized roles get `[]`.
 */
export async function visibleStudentIds(caller: CallerContext): Promise<string[]> {
  switch (caller.role) {
    case 'admin':
    case 'media_officer': {
      const { data, error } = await supabase.from('students').select('id').eq('school_id', caller.schoolId)
      if (error) {
        console.error('Error loading school student ids:', error)
        return []
      }
      return (data || []).map((s) => s.id as string)
    }
    case 'teacher': {
      const sectionIds = await getTeacherSectionIds(caller.profileId)
      if (sectionIds.length === 0) return []
      const { data, error } = await supabase.from('students').select('id').in('section_id', sectionIds)
      if (error) {
        console.error('Error loading teacher-scoped student ids:', error)
        return []
      }
      return (data || []).map((s) => s.id as string)
    }
    case 'parent':
      return getGuardianStudentIds(caller.profileId)
    case 'student': {
      const { data } = await supabase.from('students').select('id').eq('profile_id', caller.profileId).maybeSingle()
      return data ? [data.id as string] : []
    }
    // fina_supervisor sees numbers, never individual students — spec §12.
    // super_admin's view scope is "operational only" — same result.
    case 'fina_supervisor':
    case 'super_admin':
    default:
      return []
  }
}

/**
 * How the caller relates to a set of tagged students (typically the students
 * tagged in one media asset). Checked in priority order matching the spec's
 * ConsentGate.resolve() match arms: admin-equivalent short-circuits first,
 * then guardian/teacher, since a caller can hold more than one relation.
 */
export async function relationTo(caller: CallerContext, targetStudentIds: string[]): Promise<FinaRelation> {
  // super_admin deliberately excluded — spec §12: SYSADMIN has zero content
  // access, so it must never resolve to the 'admin' (full-access) relation.
  if (caller.role === 'admin' || caller.role === 'media_officer') return 'admin'

  if (targetStudentIds.length === 0) return 'other'

  if (caller.role === 'parent') {
    const mine = await getGuardianStudentIds(caller.profileId)
    if (mine.some((id) => targetStudentIds.includes(id))) return 'guardian_of'
  }

  if (caller.role === 'teacher') {
    const sectionIds = await getTeacherSectionIds(caller.profileId)
    if (sectionIds.length > 0) {
      const sectionsById = await getStudentSectionIds(targetStudentIds)
      if ([...sectionsById.values()].some((sid) => sid && sectionIds.includes(sid))) return 'teacher_of'
    }
  }

  if (caller.role === 'student') {
    const { data } = await supabase.from('students').select('id').eq('profile_id', caller.profileId).maybeSingle()
    if (data && targetStudentIds.includes(data.id as string)) return 'student_self'
  }

  return 'other'
}

/** True if the caller (a guardian) has a child in the same section as ANY of
 * the target students — spec's `sameClass(viewer, media)`, CLASS_SCOPE check. */
export async function sameClassAsAny(caller: CallerContext, targetStudentIds: string[]): Promise<boolean> {
  if (caller.role !== 'parent' || targetStudentIds.length === 0) return false
  const mine = await getGuardianStudentIds(caller.profileId)
  if (mine.length === 0) return false
  const [mySections, theirSections] = await Promise.all([
    getStudentSectionIds(mine),
    getStudentSectionIds(targetStudentIds),
  ])
  const mySectionSet = new Set([...mySections.values()].filter(Boolean) as string[])
  return [...theirSections.values()].some((sid) => sid && mySectionSet.has(sid))
}

/** Feeds the composer's audience picker (Phase 2) — the sections and
 * students a compose-capable caller may target. Teachers see only their own
 * taught sections/students; admin/media_officer see the whole school. */
export async function listComposerAudienceOptions(caller: CallerContext) {
  const isSchoolWide = ['admin', 'media_officer'].includes(caller.role)

  let sectionIds: string[] = []
  if (isSchoolWide) {
    const { data } = await supabase.from('sections').select('id').eq('school_id', caller.schoolId)
    sectionIds = (data || []).map((s) => s.id as string)
  } else if (caller.role === 'teacher') {
    sectionIds = await getTeacherSectionIds(caller.profileId)
  }

  const { data: sections } = sectionIds.length
    ? await supabase.from('sections').select('id, name').in('id', sectionIds)
    : { data: [] }

  const { data: students } = sectionIds.length
    ? await supabase.from('students').select('id, section_id, profile:profiles(first_name, last_name)').in('section_id', sectionIds)
    : { data: [] }

  return {
    sections: (sections || []).map((s: any) => ({ id: s.id, name: s.name })),
    students: (students || []).map((s: any) => ({
      id: s.id,
      sectionId: s.section_id,
      name: [s.profile?.first_name, s.profile?.last_name].filter(Boolean).join(' '),
    })),
  }
}
