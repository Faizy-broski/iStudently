import { supabase } from '../config/supabase'
import {
  EmbeddedResource,
  CreateEmbeddedResourceDTO,
  UpdateEmbeddedResourceDTO,
} from '../types'

// Enrich resources with human-readable names for grades, sections and creator.
async function enrichResources(resources: EmbeddedResource[]): Promise<EmbeddedResource[]> {
  if (resources.length === 0) return resources

  const allGradeIds    = [...new Set(resources.flatMap(r => r.published_grade_ids   || []))]
  const allSectionIds  = [...new Set(resources.flatMap(r => r.published_section_ids || []))]
  const allCreatorIds  = [...new Set(resources.map(r => r.created_by).filter(Boolean) as string[])]

  const [gradesRes, sectionsRes, profilesRes] = await Promise.all([
    allGradeIds.length > 0
      ? supabase.from('grade_levels').select('id, name').in('id', allGradeIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    allSectionIds.length > 0
      ? supabase.from('sections').select('id, name').in('id', allSectionIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    allCreatorIds.length > 0
      ? supabase.from('profiles').select('id, first_name, last_name').in('id', allCreatorIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string }[], error: null }),
  ])

  const gradeMap   = new Map((gradesRes.data   || []).map(g => [g.id, g.name]))
  const sectionMap = new Map((sectionsRes.data  || []).map(s => [s.id, s.name]))
  const profileMap = new Map(
    (profilesRes.data || []).map(p => [p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim()])
  )

  return resources.map(r => ({
    ...r,
    published_grade_names:   (r.published_grade_ids   || []).map(id => gradeMap.get(id)   || id),
    published_section_names: (r.published_section_ids || []).map(id => sectionMap.get(id) || id),
    creator_name: r.created_by ? (profileMap.get(r.created_by) || null) : null,
  }))
}

// ─── Admin (full list) ────────────────────────────────────────────────────────

export const getEmbeddedResources = async (schoolId: string): Promise<EmbeddedResource[]> => {
  const { data, error } = await supabase
    .from('embedded_resources')
    .select('*')
    .eq('school_id', schoolId)
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true })

  if (error) throw error
  return enrichResources(data || [])
}

// ─── User-facing (filtered by role, grade, section, teacher, student) ─────────

interface UserContext {
  role: string
  gradeId?:   string | null
  sectionId?: string | null
  staffId?:   string | null
  studentId?: string | null   // students.id (record id, not profile id)
  profileId?: string | null   // profiles.id — used to look up parent's children
}

async function resolveStudentGradeId(gradeId?: string | null, sectionId?: string | null): Promise<string | null> {
  if (gradeId) return gradeId
  if (!sectionId) return null
  const { data } = await supabase
    .from('sections')
    .select('grade_level_id')
    .eq('id', sectionId)
    .maybeSingle()
  return data?.grade_level_id || null
}

export const getEmbeddedResourcesForUser = async (
  schoolId: string,
  ctx: UserContext
): Promise<EmbeddedResource[]> => {
  const { data, error } = await supabase
    .from('embedded_resources')
    .select('*')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true })

  if (error) throw error
  let resources: EmbeddedResource[] = data || []

  // 1. Role visibility filter
  resources = resources.filter(r =>
    !r.visible_to_roles || r.visible_to_roles.length === 0 || r.visible_to_roles.includes(ctx.role)
  )

  const { role, sectionId, staffId, studentId, profileId } = ctx
  let gradeId = ctx.gradeId

  if (role === 'student') {
    // Resolve grade from section when not directly provided
    if (!gradeId && sectionId) {
      gradeId = await resolveStudentGradeId(null, sectionId)
    }

    resources = resources.filter(r => {
      // Student-specific filter (most granular)
      if (r.visible_to_student_ids && r.visible_to_student_ids.length > 0) {
        return studentId ? r.visible_to_student_ids.includes(studentId) : false
      }
      // Section filter takes precedence when set
      if (r.published_section_ids && r.published_section_ids.length > 0) {
        return sectionId ? r.published_section_ids.includes(sectionId) : false
      }
      // Grade filter
      if (r.published_grade_ids && r.published_grade_ids.length > 0) {
        return gradeId ? r.published_grade_ids.includes(gradeId!) : false
      }
      return true
    })
  } else if (role === 'parent') {
    // For student-specific targeting: check if parent's children are in the list
    const studentSpecific = resources.filter(r => r.visible_to_student_ids && r.visible_to_student_ids.length > 0)
    if (studentSpecific.length > 0 && profileId) {
      const { data: psl } = await supabase
        .from('parent_student_links')
        .select('student_id')
        .eq('parent_id', profileId)
      const childIds = (psl || []).map((r: any) => r.student_id)

      resources = resources.filter(r => {
        if (r.visible_to_student_ids && r.visible_to_student_ids.length > 0) {
          return childIds.some(cid => r.visible_to_student_ids.includes(cid))
        }
        return true
      })
    }
  } else if (role === 'teacher') {
    resources = resources.filter(r => {
      if (r.visible_to_teacher_ids && r.visible_to_teacher_ids.length > 0) {
        return staffId ? r.visible_to_teacher_ids.includes(staffId) : false
      }
      return true
    })
  }

  return enrichResources(resources)
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export const getEmbeddedResourceById = async (
  id: string,
  schoolId: string
): Promise<EmbeddedResource | null> => {
  const { data, error } = await supabase
    .from('embedded_resources')
    .select('*')
    .eq('id', id)
    .eq('school_id', schoolId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export const createEmbeddedResource = async (
  dto: CreateEmbeddedResourceDTO
): Promise<EmbeddedResource> => {
  const { data, error } = await supabase
    .from('embedded_resources')
    .insert({
      school_id:               dto.school_id,
      title:                   dto.title.trim(),
      url:                     dto.url.trim(),
      published_grade_ids:     dto.published_grade_ids     || [],
      published_section_ids:   dto.published_section_ids   || [],
      visible_to_roles:        dto.visible_to_roles        || [],
      visible_to_teacher_ids:  dto.visible_to_teacher_ids  || [],
      visible_to_student_ids:  dto.visible_to_student_ids  || [],
      sort_order:              dto.sort_order ?? 0,
      created_by:              dto.created_by || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export const updateEmbeddedResource = async (
  id: string,
  schoolId: string,
  dto: UpdateEmbeddedResourceDTO
): Promise<EmbeddedResource> => {
  const payload: Record<string, unknown> = {}
  if (dto.title                   !== undefined) payload.title                   = dto.title.trim()
  if (dto.url                     !== undefined) payload.url                     = dto.url.trim()
  if (dto.published_grade_ids     !== undefined) payload.published_grade_ids     = dto.published_grade_ids
  if (dto.published_section_ids   !== undefined) payload.published_section_ids   = dto.published_section_ids
  if (dto.visible_to_roles        !== undefined) payload.visible_to_roles        = dto.visible_to_roles
  if (dto.visible_to_teacher_ids  !== undefined) payload.visible_to_teacher_ids  = dto.visible_to_teacher_ids
  if (dto.visible_to_student_ids  !== undefined) payload.visible_to_student_ids  = dto.visible_to_student_ids
  if (dto.is_active               !== undefined) payload.is_active               = dto.is_active
  if (dto.sort_order              !== undefined) payload.sort_order              = dto.sort_order

  const { data, error } = await supabase
    .from('embedded_resources')
    .update(payload)
    .eq('id', id)
    .eq('school_id', schoolId)
    .select()
    .single()

  if (error) throw error
  if (!data) throw new Error('Embedded resource not found or access denied')
  return data
}

export const deleteEmbeddedResource = async (
  id: string,
  schoolId: string
): Promise<void> => {
  const { error } = await supabase
    .from('embedded_resources')
    .delete()
    .eq('id', id)
    .eq('school_id', schoolId)

  if (error) throw error
}
