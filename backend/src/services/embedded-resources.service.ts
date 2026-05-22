import { supabase } from '../config/supabase'
import {
  EmbeddedResource,
  CreateEmbeddedResourceDTO,
  UpdateEmbeddedResourceDTO,
} from '../types'

// Enrich resources with human-readable grade names and the creator's display name.
async function enrichResources(resources: EmbeddedResource[], schoolId: string): Promise<EmbeddedResource[]> {
  if (resources.length === 0) return resources

  // 1. Collect all unique grade IDs used across resources
  const allGradeIds = [...new Set(resources.flatMap(r => r.published_grade_ids || []))]

  // 2. Collect all unique creator profile IDs
  const allCreatorIds = [...new Set(resources.map(r => r.created_by).filter(Boolean) as string[])]

  // Fetch grades and profiles in parallel
  const [gradesResult, profilesResult] = await Promise.all([
    allGradeIds.length > 0
      ? supabase.from('grade_levels').select('id, name').in('id', allGradeIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    allCreatorIds.length > 0
      ? supabase.from('profiles').select('id, first_name, last_name').in('id', allCreatorIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string }[], error: null }),
  ])

  const gradeMap = new Map((gradesResult.data || []).map(g => [g.id, g.name]))
  const profileMap = new Map(
    (profilesResult.data || []).map(p => [p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim()])
  )

  return resources.map(r => ({
    ...r,
    published_grade_names: (r.published_grade_ids || []).map(id => gradeMap.get(id) || id),
    creator_name: r.created_by ? (profileMap.get(r.created_by) || null) : null,
  }))
}

export const getEmbeddedResources = async (schoolId: string): Promise<EmbeddedResource[]> => {
  const { data, error } = await supabase
    .from('embedded_resources')
    .select('*')
    .eq('school_id', schoolId)
    .order('title')

  if (error) throw error
  return enrichResources(data || [], schoolId)
}

// Resolve a student's grade_level_id from their section when it isn't in the profile.
// Returns undefined for non-student roles so filtering is skipped (teachers/parents see all).
async function resolveGradeId(
  role: string,
  explicitGradeId?: string,
  sectionId?: string
): Promise<string | undefined> {
  if (explicitGradeId) return explicitGradeId
  // Only students are subject to grade-level filtering
  if (role !== 'student') return undefined
  if (!sectionId) return undefined

  const { data } = await supabase
    .from('sections')
    .select('grade_level_id')
    .eq('id', sectionId)
    .maybeSingle()

  return data?.grade_level_id || undefined
}

export const getEmbeddedResourcesForUser = async (
  schoolId: string,
  role: string,
  explicitGradeId?: string,
  sectionId?: string
): Promise<EmbeddedResource[]> => {
  const { data, error } = await supabase
    .from('embedded_resources')
    .select('*')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('title')

  if (error) throw error

  const resources: EmbeddedResource[] = data || []

  const gradeId = await resolveGradeId(role, explicitGradeId, sectionId)

  // Grade-level filter for students
  const filtered = gradeId
    ? resources.filter(
        (r) =>
          !r.published_grade_ids ||
          r.published_grade_ids.length === 0 ||
          r.published_grade_ids.includes(gradeId)
      )
    : resources

  return enrichResources(filtered, schoolId)
}

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
      school_id: dto.school_id,
      title: dto.title.trim(),
      url: dto.url.trim(),
      published_grade_ids: dto.published_grade_ids || [],
      created_by: dto.created_by || null,
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
  const updatePayload: Record<string, unknown> = {}
  if (dto.title !== undefined) updatePayload.title = dto.title.trim()
  if (dto.url !== undefined) updatePayload.url = dto.url.trim()
  if (dto.published_grade_ids !== undefined) updatePayload.published_grade_ids = dto.published_grade_ids
  if (dto.is_active !== undefined) updatePayload.is_active = dto.is_active

  const { data, error } = await supabase
    .from('embedded_resources')
    .update(updatePayload)
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
